/**
 * The generic importer of a JSON Schema (commons 0019-mizan-integrations FR-022, FR-023, FR-005, FR-006, FR-009): a slice of the `$defs` of a pinned schema (draft 2020-12),
 * written as a generated TypeScript module in which each `enum` is a typed code list and each object's properties are a typed union of field names, so that a requirement names
 * a value or a field of a schema we do not own and the compiler knows it exists in the pinned version.
 *
 * @remarks
 * The slice names definitions (`Severity`, `Event`), never the whole schema. A definition that is an `enum`, a `const`, or a `oneOf` or `anyOf` of `const`s becomes a code list: a
 * `const` tuple and the union type of its members, named as the definition. A definition with `properties` becomes `NameFields`, an object keyed by field name whose entry says the
 * field's type, whether it is required, the definition it refers to (`$ref` to `#/$defs/...`), its enum, its items, and `NameField`, the union of the field names; an `enum` or a nested object
 * inside a property is lifted to a code list or fields of its own, named after the definition and the property. The checks are those of the other importers: a pin that differs, no license
 * and no right to copy are refused, a definition the schema lacks is named, the same input gives the same text, and the module's header names the source, schema, hash and slice.
 *
 * @limits
 * What a typed union of names cannot hold is named, per definition, as an `unsupported` finding and never dropped silently: composition (`anyOf` and `oneOf` of schemas that are not
 * constants; `allOf` of objects and `$ref`s is merged, not lost), `patternProperties`, `additionalProperties` as a schema, `propertyNames`, dependent and conditional keywords (`dependentSchemas`, `if`), `not`, a `$ref` that is not into
 * `#/$defs/`, a schema of another draft (its `$defs` or `definitions` are read as 2020-12's), and the value constraints (`pattern`, `format`, bounds, lengths). Annotations (`title`, `description`,
 * `default`, `examples`) are not carried: they are prose a person reads in the schema. A definition with nothing to hold ends the import.
 *
 * @example
 * ```ts
 * import { importJsonSchema } from "./import-json-schema.ts";
 * // importJsonSchema({ standard, sourceText, slice: ["Severity", "Event"] })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { ImportOutput, ImportRecordData } from "./import-vocabulary.ts";
import type { IntegrationFinding, StandardRecord } from "./types.ts";

/** The generator's name, as the provenance and the header of a generated module give it. */
export const JSON_SCHEMA_GENERATOR = "commons/ts/mizan/integrations/pure/import-json-schema.ts";

/** What a JSON Schema import needs. */
export type JsonSchemaImportInput = {
  readonly standard: StandardRecord;
  /** The schema's JSON, as the pinned bytes read as UTF-8 text. */
  readonly sourceText: string;
  /** The names of the `$defs` to take, never the whole schema. */
  readonly slice: readonly string[];
};

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

const isObject = (x: Json | undefined): x is JsonObject => typeof x === "object" && x !== null && !Array.isArray(x);
const isArray = (x: Json | undefined): x is readonly Json[] => Array.isArray(x);

const DRAFT = "https://json-schema.org/draft/2020-12/schema";
const CONSTRAINTS = [
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "contains",
  "minContains",
  "maxContains",
] as const;
const UNHELD = [
  "patternProperties",
  "propertyNames",
  "dependentSchemas",
  "dependentRequired",
  "if",
  "not",
  "unevaluatedProperties",
  "$dynamicRef",
] as const;

/** A name as a TypeScript identifier in Pascal case: words split at what is not a letter or a digit. */
function pascal(name: string): string {
  const id = name
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w !== "")
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join("");
  return /^[0-9]/.test(id) ? `_${id}` : id;
}

const key = (name: string): string => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : JSON.stringify(name));

type Declaration =
  | {
      readonly kind: "codes";
      readonly name: string;
      readonly about: string;
      readonly members: readonly (null | boolean | number | string)[];
    }
  | {
      readonly kind: "fields";
      readonly name: string;
      readonly about: string;
      readonly fields: readonly { readonly name: string; readonly descriptor: string }[];
    };

/** One run of the importer over a schema: the declarations it makes, the findings it names, and the identifiers it has used. */
class Run {
  readonly declarations: Declaration[] = [];
  readonly findings: IntegrationFinding[] = [];
  private readonly used = new Map<string, string>();
  private readonly defs: JsonObject;

  constructor(defs: JsonObject) {
    this.defs = defs;
  }

  /** The properties of a schema and of what it extends: its own, and those of each `allOf` branch, a `$ref` into `$defs` followed once (a cycle is cut). */
  private merged(
    schema: JsonObject,
    about: string,
    seen: ReadonlySet<string>,
  ): { readonly props: [string, Json][]; readonly required: Set<string> } {
    const props: [string, Json][] = [];
    const required = new Set<string>();
    const own = schema["properties"];
    if (isObject(own)) for (const [k, v] of Object.entries(own)) props.push([k, v]);
    if (isArray(schema["required"])) for (const r of schema["required"]) if (typeof r === "string") required.add(r);
    const all = schema["allOf"];
    for (const branch of isArray(all) ? all : []) {
      if (!isObject(branch)) continue;
      const ref = branch["$ref"];
      let sub: JsonObject | undefined = branch;
      let subAbout = about;
      if (typeof ref === "string") {
        const target = ref.startsWith("#/$defs/") ? this.defs[ref.slice(8)] : undefined;
        if (!isObject(target)) {
          this.unsupported(`a $ref (${ref}) that is not a definition of the schema`, about);
          continue;
        }
        if (seen.has(ref)) continue;
        sub = target;
        subAbout = ref;
      } else this.losses(branch, about);
      const m = this.merged(sub, subAbout, new Set(typeof ref === "string" ? [...seen, ref] : seen));
      for (const [k, v] of m.props) if (!props.some(([p]) => p === k)) props.push([k, v]);
      for (const r of m.required) required.add(r);
    }
    return { props, required };
  }

  private unsupported(what: string, about: string): void {
    this.findings.push({ kind: "unsupported", what, about });
  }

  private claim(id: string, about: string): boolean {
    const other = this.used.get(id);
    if (other !== undefined && other !== about) {
      this.unsupported(`the same identifier ${id} as ${other}`, about);
      return false;
    }
    this.used.set(id, about);
    return true;
  }

  private constants(schema: JsonObject): readonly (null | boolean | number | string)[] | undefined {
    const primitive = (x: Json | undefined): x is null | boolean | number | string =>
      x === null || ["boolean", "number", "string"].includes(typeof x);
    const e = schema["enum"];
    if (isArray(e)) {
      const ok = e.filter(primitive);
      if (ok.length !== e.length) this.unsupported("an enum member that is an object or an array", "an enum");
      return ok;
    }
    if (schema["const"] !== undefined && primitive(schema["const"])) return [schema["const"]];
    for (const k of ["oneOf", "anyOf"] as const) {
      const alts = schema[k];
      if (!isArray(alts) || alts.length === 0) continue;
      const consts = alts.map((a) => (isObject(a) && "const" in a ? a["const"] : undefined));
      if (consts.every(primitive)) return consts;
    }
    return undefined;
  }

  /** What is in a schema that a typed union of names cannot hold, named once for the place it is in. */
  private losses(schema: JsonObject, about: string): void {
    for (const k of ["anyOf", "oneOf"] as const) {
      if (schema[k] !== undefined && this.constants(schema) === undefined) this.unsupported(`${k}, a composition of schemas`, about);
    }
    for (const k of UNHELD) if (schema[k] !== undefined) this.unsupported(`${k}`, about);
    const ap = schema["additionalProperties"];
    if (isObject(ap)) this.unsupported("additionalProperties as a schema", about);
    const seen = CONSTRAINTS.filter((c) => schema[c] !== undefined);
    if (seen.length > 0) this.unsupported(`value constraints (${seen.join(", ")})`, about);
  }

  /** The descriptor of a schema as TypeScript text, lifting an enum and an object to declarations of their own, named from `name`. */
  private describe(schema: Json | undefined, name: string, about: string, required: boolean): string {
    const parts: string[] = [];
    if (!isObject(schema)) return `{ required: ${required} }`;
    for (const k of ["anyOf", "oneOf"] as const) {
      const only = schema[k];
      if (isArray(only) && only.length === 1 && this.constants(schema) === undefined) return this.describe(only[0], name, about, required);
    }
    const ref = schema["$ref"];
    if (typeof ref === "string") {
      if (ref.startsWith("#/$defs/")) parts.push(`ref: ${JSON.stringify(ref.slice(8))}`);
      else this.unsupported(`a $ref outside the schema's $defs (${ref})`, about);
    }
    const t = schema["type"];
    if (typeof t === "string") parts.push(`type: ${JSON.stringify(t)}`);
    else if (isArray(t) && t.every((x) => typeof x === "string")) parts.push(`type: ${JSON.stringify(t.join("|"))}`);
    const members = this.constants(schema);
    if (members !== undefined && ref === undefined) {
      if (this.claim(name, about)) this.declarations.push({ kind: "codes", name, about, members });
      parts.push(`enum: ${JSON.stringify(name)}`);
    }
    this.losses(schema, about);
    if (ref === undefined && members === undefined && this.fields(schema, name, about))
      parts.push(`fields: ${JSON.stringify(`${name}Fields`)}`);
    const items = schema["items"];
    if (isObject(items)) parts.push(`items: ${this.describe(items, `${name}Item`, `${about}/items`, false)}`);
    parts.push(`required: ${required}`);
    return `{ ${parts.join(", ")} }`;
  }

  /** The fields of a schema (its own and what it extends) as a declaration named `nameFields`; whether it has any. */
  private fields(schema: JsonObject, name: string, about: string): boolean {
    const m = this.merged(schema, about, new Set());
    if (m.props.length === 0) return false;
    const fields = m.props.map(([field, sub]) => ({
      name: field,
      descriptor: this.describe(sub, `${name}${pascal(field)}`, `${about}/properties/${field}`, m.required.has(field)),
    }));
    if (this.claim(`${name}Fields`, about)) this.declarations.push({ kind: "fields", name: `${name}Fields`, about, fields });
    return true;
  }

  /** A definition of the slice: a code list, or fields; whether it has anything to hold. */
  definition(def: string, schema: Json | undefined): "codes" | "fields" | undefined {
    const about = `#/$defs/${def}`;
    const name = pascal(def);
    if (!isObject(schema)) return undefined;
    const members = this.constants(schema);
    this.losses(schema, about);
    if (members !== undefined) {
      if (this.claim(name, about)) this.declarations.push({ kind: "codes", name, about, members });
      return "codes";
    }
    return this.fields(schema, name, about) ? "fields" : undefined;
  }
}

function moduleText(i: JsonSchemaImportInput, schema: JsonObject, slice: readonly string[], run: Run): string {
  const s = i.standard;
  const id = typeof schema["$id"] === "string" ? schema["$id"] : "";
  const title = typeof schema["title"] === "string" ? schema["title"] : "";
  const dialect = typeof schema["$schema"] === "string" ? schema["$schema"] : DRAFT;
  const body: string[] = [];
  for (const d of run.declarations) {
    if (d.kind === "codes") {
      body.push(
        `/** The members of ${d.about} in ${s.name}, a typed code list (basis: adopts). */`,
        `export const ${d.name} = [${d.members.map((m) => JSON.stringify(m)).join(", ")}] as const;`,
        ``,
        `/** A member of ${d.about}. */`,
        `export type ${d.name} = (typeof ${d.name})[number];`,
        ``,
      );
    } else {
      const single = d.name.replace(/Fields$/, "");
      body.push(
        `/** The properties of ${d.about} in ${s.name}, each with its type, whether it is required and what it refers to (basis: adopts). */`,
        `export const ${d.name} = {`,
        ...d.fields.map((f) => `  ${key(f.name)}: ${f.descriptor},`),
        `} as const;`,
        ``,
        `/** A field name of ${d.about}. */`,
        `export type ${single}Field = keyof typeof ${d.name};`,
        ``,
      );
    }
  }
  return [
    `// AUTO-GENERATED by ${JSON_SCHEMA_GENERATOR} (commons 0019-mizan-integrations FR-022). Do not edit: change the slice and import again.`,
    `// source: ${s.name}, ${s.issuer}, version ${s.version}, ${s.location}`,
    `// schema: ${title === "" ? "(untitled)" : title}${id === "" ? "" : `, ${id}`}, ${dialect}`,
    `// license: ${s.license}`,
    `// source_sha256=${s.sha256}`,
    `// basis: adopts (0018-standards-first FR-003)`,
    `// slice: ${slice.join(", ")}`,
    ``,
    ...body,
  ].join("\n");
}

/** A slice of the `$defs` of a JSON Schema as a generated module of typed code lists and field-name unions, or what stops it. */
export async function importJsonSchema(i: JsonSchemaImportInput): Promise<Result<ImportOutput, readonly IntegrationFinding[]>> {
  const s = i.standard;
  if (s.license === "") return err([{ kind: "no-license", standard: s.id }]);
  if (!s.redistributable) return err([{ kind: "not-redistributable", standard: s.id }]);
  const actual = await sha256(i.sourceText);
  if (actual !== s.sha256) return err([{ kind: "pin-mismatch", standard: s.id, expected: s.sha256, actual }]);
  if (i.slice.length === 0) return err([{ kind: "slice-empty" }]);
  let json: Json;
  try {
    json = JSON.parse(i.sourceText) as Json;
  } catch (e) {
    return err([{ kind: "syntax", line: 1, message: `the schema is not JSON: ${e instanceof Error ? e.message : String(e)}` }]);
  }
  if (!isObject(json)) return err([{ kind: "syntax", line: 1, message: "the schema is not a JSON object" }]);
  const defs = isObject(json["$defs"]) ? json["$defs"] : isObject(json["definitions"]) ? json["definitions"] : undefined;
  if (defs === undefined) return err([{ kind: "syntax", line: 1, message: "the schema has no $defs" }]);
  const run = new Run(defs);
  const declared = typeof json["$schema"] === "string" ? json["$schema"] : DRAFT;
  if (declared !== DRAFT && !declared.startsWith(`${DRAFT}#`))
    run.findings.push({ kind: "unsupported", what: `the dialect ${declared}, read as draft 2020-12`, about: "the schema" });
  if (json["$defs"] === undefined)
    run.findings.push({ kind: "unsupported", what: "definitions, the keyword of earlier drafts, read as $defs", about: "the schema" });
  const taken: string[] = [];
  const failed: IntegrationFinding[] = [];
  const terms: { iri: string; kind: "code-list" | "field-names" }[] = [];
  for (const def of [...new Set(i.slice)].sort()) {
    if (!(def in defs)) {
      failed.push({ kind: "term-missing", iri: `#/$defs/${def}` });
      continue;
    }
    const made = run.definition(def, defs[def]);
    if (made === undefined) {
      failed.push({ kind: "unsupported", what: "no enum and no properties to hold", about: `#/$defs/${def}` });
      continue;
    }
    taken.push(def);
    terms.push({ iri: `#/$defs/${def}`, kind: made === "codes" ? "code-list" : "field-names" });
  }
  if (failed.length > 0) return err([...failed, ...run.findings]);
  if (run.findings.some((f) => f.kind === "unsupported" && f.what.startsWith("the same identifier"))) return err(run.findings);
  const record: ImportRecordData = {
    standard: s.id,
    name: s.name,
    issuer: s.issuer,
    version: s.version,
    location: s.location,
    license: s.license,
    sha256: s.sha256,
    generator: JSON_SCHEMA_GENERATOR,
    slice: taken,
  };
  return ok({ module: moduleText(i, json, taken, run), record, terms, findings: run.findings });
}
