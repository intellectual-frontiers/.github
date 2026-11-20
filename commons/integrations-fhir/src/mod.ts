// Spec: 0001-integrations-fhir-plugin FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The FHIR plugin of Integrations (commons integrations-fhir 0001-integrations-fhir-plugin): R4 and US Core as registry entries with their licence as data, a codec for
 * FHIR JSON and for NDJSON to and from the abstract typed tree, a loader that reads StructureDefinitions, CodeSystems and ValueSets the user supplies into schemas, profiles
 * and terminologies (it embeds none of them), and the acknowledgement port of OperationOutcome.
 *
 * @remarks
 * A JSON object is one transaction whose id is its `resourceType`; a property is a segment (a primitive: one element with an empty id for a string, `number`, `boolean` or `null` for
 * the other JSON types) or a loop (an object); an array is a run of siblings of one id. Whether one sibling is an array is not in the JSON, so a codec is made with the set of repeating
 * paths that the StructureDefinitions give (`repeatingPaths`), and writes an array for those and for any id that occurs twice.
 *
 * @limits
 * Choice types (`value[x]`) are not expanded by the loader: their elements are skipped. XML is Planned. Empty objects and empty arrays are not kept.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  parseStandardUrn,
  ref,
  type EmbeddedContent,
  type Standard,
  type StandardUrn,
} from "@intellectual-frontiers/integrations/governance";
import {
  element,
  finding,
  isObject,
  loop,
  member,
  segment,
  textOf,
  type AckPort,
  type Acknowledgement,
  type Codec,
  type Constraint,
  type Definitions,
  type Element,
  type Finding,
  type Interchange,
  type Json,
  type Loader,
  type Part,
  type Profile,
  type Schema,
  type StandardsPlugin,
  type SyntaxProblem,
  type Terminology,
  type Transaction,
} from "@intellectual-frontiers/integrations/logical";

function urn(text: string): StandardUrn {
  const r = parseStandardUrn(text);
  if (r.kind === "err") throw new Error(`a constant of the plugin is not a standard urn: ${text}`);
  return r.value;
}

/** FHIR JSON, the syntax. */
export const FHIR_JSON = urn("urn:standard:hl7:fhir-json:4.0.1");
/** FHIR NDJSON (one resource a line), the syntax of bulk data. */
export const FHIR_NDJSON = urn("urn:standard:hl7:fhir-ndjson:4.0.1");
/** FHIR R4 (4.0.1), the resources. */
export const FHIR_R4 = urn("urn:standard:hl7:fhir:4.0.1");
/** US Core, the implementation guide. */
export const US_CORE = urn("urn:standard:hl7:us-core:6.1.0");

const TERMS =
  "HL7 publishes FHIR under an open licence (https://hl7.org/fhir/license.html). That reading is not yet verified here for embedding, so this library records the entry as user-supplied: definitions are read from data the user supplies, and none is embedded.";

const base = { issuer: "hl7", location: "https://hl7.org/fhir/R4/", license: { spdx: "CC0-1.0", embedding: "user-supplied", terms: TERMS }, sha256: undefined } as const;

/** The standards the plugin registers. */
export const STANDARDS: readonly Standard[] = [
  { ...base, urn: FHIR_JSON, level: "syntax", family: "file-format", title: "FHIR JSON representation", version: "4.0.1", basis: { kind: "adopts", of: FHIR_R4 } },
  { ...base, urn: FHIR_NDJSON, level: "syntax", family: "file-format", title: "FHIR NDJSON", version: "4.0.1", basis: { kind: "adopts", of: FHIR_R4 } },
  { ...base, urn: FHIR_R4, level: "schema", family: "resource-api", title: "FHIR R4 resources", version: "4.0.1", basis: { kind: "unaligned", reason: "the standard itself" } },
  { ...base, urn: US_CORE, level: "profile", family: "resource-api", title: "US Core implementation guide", version: "6.1.0", location: "https://hl7.org/fhir/us/core/", basis: { kind: "specializes", of: FHIR_R4 } },
];

/** The files of standards content the package embeds: none. */
export const EMBEDDED: readonly EmbeddedContent[] = [];

const failure = (code: SyntaxProblem["code"], offset = 0): SyntaxProblem => ({ kind: "syntax", code, offset });

function primitive(k: string, v: string | number | boolean | null): Part {
  if (typeof v === "string") return segment(k, element("", v));
  if (typeof v === "number") return segment(k, element("number", String(v)));
  if (typeof v === "boolean") return segment(k, element("boolean", String(v)));
  return segment(k, element("null", ""));
}

function nodes(k: string, v: Json): readonly Part[] {
  if (Array.isArray(v)) return v.flatMap((x) => nodes(k, x));
  if (isObject(v)) return [loop(k, ...Object.entries(v).flatMap(([key, x]) => nodes(key, x)))];
  return [primitive(k, v === undefined ? null : (v as string | number | boolean | null))];
}

function resourceOf(j: Json): Transaction | undefined {
  if (!isObject(j)) return undefined;
  const type = textOf(j, "resourceType");
  if (type === undefined || type === "") return undefined;
  const children = Object.entries(j).filter(([k]) => k !== "resourceType").flatMap(([k, v]) => nodes(k, v));
  return { kind: "transaction", id: type, control: textOf(j, "id") ?? "", children };
}

function interchange(syntax: StandardUrn, transactions: readonly Transaction[]): Interchange {
  return { kind: "interchange", syntax: ref("syntax", syntax), control: "1", groups: [{ kind: "group", id: "FHIR", control: "1", transactions }] };
}

function valueOf(e: Element | undefined): Json {
  if (e === undefined) return null;
  switch (e.id) {
    case "number":
      return Number(e.value);
    case "boolean":
      return e.value === "true";
    case "null":
      return null;
    default:
      return e.value;
  }
}

function build(parts: readonly Part[], path: string, repeating: ReadonlySet<string>): { readonly [k: string]: Json } {
  const groups = new Map<string, Json[]>();
  for (const p of parts) {
    const v: Json = p.kind === "segment" ? valueOf(p.elements[0]) : build(p.children, `${path}.${p.id}`, repeating);
    groups.set(p.id, [...(groups.get(p.id) ?? []), v]);
  }
  return Object.fromEntries([...groups].map(([k, vs]) => [k, vs.length > 1 || repeating.has(`${path}.${k}`) ? vs : (vs[0] ?? null)]));
}

function writeResource(t: Transaction, repeating: ReadonlySet<string>): { readonly [k: string]: Json } {
  return { resourceType: t.id, ...build(t.children, t.id, repeating) };
}

function parseOne(text: string): Result<Transaction, SyntaxProblem> {
  let j: Json;
  try {
    j = JSON.parse(text) as Json;
  } catch {
    return err(failure("bad-structure"));
  }
  const t = resourceOf(j);
  return t === undefined ? err(failure("bad-envelope")) : ok(t);
}

/** Paths that are arrays in every version of the resources the plugin itself makes (an OperationOutcome's issues). */
const ALWAYS_ARRAYS: ReadonlySet<string> = new Set(["OperationOutcome.issue"]);

/** The codec of FHIR JSON: one resource a text. `repeating` is the set of paths that are arrays even where one occurs (`repeatingPaths`). */
export function jsonCodec(more: ReadonlySet<string> = new Set()): Codec {
  const repeating = new Set([...ALWAYS_ARRAYS, ...more]);
  return {
    syntax: ref("syntax", FHIR_JSON),
    parse: (text) => {
      if (text.trim() === "") return err(failure("empty"));
      const t = parseOne(text);
      return t.kind === "ok" ? ok(interchange(FHIR_JSON, [t.value])) : t;
    },
    serialize: (i) => {
      const t = i.groups[0]?.transactions[0];
      return t === undefined ? err(failure("bad-structure")) : ok(JSON.stringify(writeResource(t, repeating)));
    },
  };
}

/** The codec of NDJSON: one resource a line, each a transaction. */
export function ndjsonCodec(repeating: ReadonlySet<string> = new Set()): Codec {
  return {
    syntax: ref("syntax", FHIR_NDJSON),
    parse: (text) => {
      const lines = text.split("\n").filter((l) => l.trim() !== "");
      if (lines.length === 0) return err(failure("empty"));
      const out: Transaction[] = [];
      for (const [i, l] of lines.entries()) {
        const t = parseOne(l);
        if (t.kind === "err") return err(failure(t.error.code, i));
        out.push(t.value);
      }
      return ok(interchange(FHIR_NDJSON, out));
    },
    serialize: (i) => {
      const ts = i.groups.flatMap((g) => g.transactions);
      return ts.length === 0 ? err(failure("bad-structure")) : ok(`${ts.map((t) => JSON.stringify(writeResource(t, repeating))).join("\n")}\n`);
    },
  };
}

function parseJson(text: string): Json | undefined {
  try {
    return JSON.parse(text) as Json;
  } catch {
    return undefined;
  }
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

function urnOfCanonical(canonical: string, fallbackVersion = "1"): StandardUrn {
  const [url = "", version = fallbackVersion] = canonical.split("|");
  return urn(`urn:standard:hl7:${slug(url.split("/").pop() ?? url)}:${slug(version) === "x" ? "1" : version.replace(/[^A-Za-z0-9._-]/g, "-")}`);
}

function constraintsOf(elements: readonly Json[], root: string): { readonly paths: string[]; readonly constraints: Constraint[] } {
  const paths: string[] = [];
  const constraints: Constraint[] = [];
  for (const e of elements) {
    const path = textOf(e, "path");
    if (path === undefined || path === root || path.includes("[x]")) continue;
    paths.push(path);
    const min = member(e, "min");
    const max = textOf(e, "max");
    if (typeof min === "number" && max !== undefined) constraints.push({ kind: "cardinality", path, min, max: max === "*" ? "*" : Number(max) });
    const binding = member(e, "binding");
    const vs = textOf(binding, "valueSet");
    const strength = textOf(binding, "strength");
    if (vs !== undefined && (strength === "required" || strength === "extensible" || strength === "preferred" || strength === "example")) {
      constraints.push({ kind: "binding", path, terminology: ref("terminology", urnOfCanonical(vs)), strength });
    }
  }
  return { paths, constraints };
}

function loadDefinition(standard: StandardUrn, text: string): Result<Definitions, { readonly kind: "malformed"; readonly standard: StandardUrn; readonly code: "not-json" | "wrong-resource" | "no-elements" }> {
  const bad = (code: "not-json" | "wrong-resource" | "no-elements") => err({ kind: "malformed" as const, standard, code });
  const j = parseJson(text);
  if (j === undefined) return bad("not-json");
  const type = textOf(j, "resourceType");
  if (type === "StructureDefinition") {
    const root = textOf(j, "type") ?? "";
    const list = member(member(j, "snapshot"), "element") ?? member(member(j, "differential"), "element");
    if (root === "" || !Array.isArray(list) || list.length === 0) return bad("no-elements");
    const { paths, constraints } = constraintsOf(list, root);
    const id = urn(`urn:standard:hl7:${slug(textOf(j, "name") ?? root)}:${(textOf(j, "version") ?? "0").replace(/[^A-Za-z0-9._-]/g, "-")}`);
    const schema: Schema = { id: ref("schema", id), transaction: root, paths: [root, ...paths], constraints };
    const profiles: Profile[] = textOf(j, "derivation") === "constraint" ? [{ id: ref("profile", id), schema: ref("schema", id), constraints }] : [];
    return ok({ schemas: [schema], profiles, terminologies: [] });
  }
  if (type === "CodeSystem" || type === "ValueSet") {
    const url = textOf(j, "url");
    if (url === undefined) return bad("no-elements");
    const codes = new Set<string>();
    const walk = (c: Json): void => {
      if (!Array.isArray(c)) return;
      for (const x of c) {
        const code = textOf(x, "code");
        if (code !== undefined) codes.add(code);
        walk(member(x, "concept") ?? null);
      }
    };
    walk(member(j, "concept") ?? null);
    const include = member(member(j, "compose"), "include");
    if (Array.isArray(include)) for (const i of include) walk(member(i, "concept") ?? null);
    const term: Terminology = { id: ref("terminology", urnOfCanonical(url, textOf(j, "version") ?? "1")), codes };
    return ok({ schemas: [], profiles: [], terminologies: [term] });
  }
  return bad("wrong-resource");
}

/** The paths that are arrays in the schemas: those whose cardinality allows more than one. For `jsonCodec`. */
export function repeatingPaths(schemas: readonly Schema[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const s of schemas) for (const c of s.constraints) if (c.kind === "cardinality" && (c.max === "*" || c.max > 1)) out.add(c.path);
  return out;
}

/** The loader of FHIR definitions the user supplies: StructureDefinition, CodeSystem and ValueSet JSON. */
export const loader: Loader = {
  standard: FHIR_R4,
  load: (supplied) => loadDefinition(supplied.standard, supplied.text),
};

const SEVERITY = { informational: "information", fatal: "error", error: "error", warning: "warning", information: "information" } as const;

/** The acknowledgement port of FHIR: an OperationOutcome made from a status, and read back into findings that hold codes and paths only. */
export const acks: AckPort = {
  acknowledge: (_received, status) => {
    const severity = status === "accepted" ? "information" : status === "accepted-with-errors" ? "warning" : "error";
    const code = status === "accepted" ? "informational" : "processing";
    const t: Transaction = { kind: "transaction", id: "OperationOutcome", control: "", children: [loop("issue", segment("severity", element("", severity)), segment("code", element("", code)))] };
    return ok(interchange(FHIR_JSON, [t]));
  },
  read: (i) => {
    const out: Acknowledgement[] = [];
    for (const t of i.groups.flatMap((g) => g.transactions)) {
      if (t.id !== "OperationOutcome") continue;
      const issues: Finding[] = [];
      let n = 0;
      for (const p of t.children) {
        if (p.kind !== "loop" || p.id !== "issue") continue;
        const sev = p.children.find((c) => c.kind === "segment" && c.id === "severity");
        const raw = sev?.kind === "segment" ? sev.elements[0]?.value : undefined;
        const severity = raw !== undefined && raw in SEVERITY ? SEVERITY[raw as keyof typeof SEVERITY] : "error";
        issues.push(finding("business-rule", severity, "business-rule", `OperationOutcome.issue[${n}]`));
        n += 1;
      }
      out.push({ kind: "fhir-operation-outcome", issues });
    }
    return out.length === 0 ? err(failure("bad-structure")) : ok(out);
  },
};

/** The plugin of FHIR JSON. */
export function fhirPlugin(repeating: ReadonlySet<string> = new Set()): StandardsPlugin {
  return { id: "fhir", standards: STANDARDS, codec: jsonCodec(repeating), loaders: [loader], acks };
}

/** The plugin of FHIR NDJSON. */
export function fhirNdjsonPlugin(repeating: ReadonlySet<string> = new Set()): StandardsPlugin {
  return { id: "fhir-ndjson", standards: STANDARDS, codec: ndjsonCodec(repeating), loaders: [loader], acks: undefined };
}

