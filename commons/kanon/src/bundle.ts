// Spec: 0002-kanon-content-checks FR-008, FR-009, FR-010, FR-011
/**
 * The published bundle of a Logical model (commons 0033-kanon FR-026): the model as five files and a manifest of the SHA-256 and size of each, made the same way every time, and a loader that checks the whole bundle
 * before it returns any of it. `makeBundle` writes the files as text; `verifyBundle` takes the manifest's text and the bytes of every file found, reads no file, no clock and no network, evaluates nothing, and either
 * returns every fault (a file changed, missing or extra, a manifest that is not valid, a verified file that is not of the form) and none of the files, or the verified files and the model decoded from them.
 *
 * @remarks
 * The design is that of `grc`'s verification of an evidence bundle (0011-grc-bundles), made again on `core` and `crypto`: `grc` is in the same layer as Kanon and cannot be imported (commons 0032-libraries-by-concern
 * FR-003). There is no ledger and no signature here: the manifest holds digests, and a signature of it is another requirement.
 *
 * @example
 * ```ts
 * import { makeBundle, verifyBundle, type LayeredModel } from "@intellectual-frontiers/kanon";
 * declare const model: LayeredModel;
 * const bundle = await makeBundle(model);
 * bundle.files.size; // 5
 * ```
 *
 * @module
 */
import {
  absurd,
  array,
  boolean,
  type Decoder,
  err,
  formatDecodeError,
  integer,
  json,
  literal,
  nullable,
  object,
  ok,
  oneOf,
  record,
  type Result,
  string,
} from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type InstanceName, parseInstanceName } from "./family.ts";
import { type Disposition, type ElementId, type LayeredModel, type ModelElement, type ModelFinding, type ModelLayer, parseElementId, type Relation, type TraceEdge } from "./model.ts";
import { LAYERS } from "./table.ts";

/** The name of the manifest in a bundle. */
export const MANIFEST = "manifest.json";
/** The files of a bundle besides its manifest, in the order of their paths. */
export const FILES = ["dispositions.json", "elements.json", "model.json", "relations.json", "trace.json"] as const;
const SCHEMA = "kanon-bundle/1";

/** One thing wrong with a bundle: a closed union, each case with the path it concerns and one sentence. */
export type BundleFault =
  | { readonly kind: "changed"; readonly path: string; readonly message: string }
  | { readonly kind: "missing"; readonly path: string; readonly message: string }
  | { readonly kind: "extra"; readonly path: string; readonly message: string }
  | { readonly kind: "manifest"; readonly path: string; readonly message: string }
  | { readonly kind: "form"; readonly path: string; readonly message: string };

/** The files of a bundle as text, and the text of its manifest. */
export type Bundle = { readonly files: ReadonlyMap<string, string>; readonly manifest: string };

/** What a verified bundle gives: its files as bytes and the model decoded from them. */
export type VerifiedBundle = { readonly files: ReadonlyMap<string, Uint8Array>; readonly model: LayeredModel };

const text = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const sorted = <T>(o: Readonly<Record<string, T>>): Readonly<Record<string, T>> => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k] as T]));
const bytes = (t: string): Uint8Array => new TextEncoder().encode(t);

function elementOf(e: ModelElement): unknown {
  return {
    id: e.id,
    layer: e.layer,
    kind: e.kind,
    name: e.name,
    definition: e.definition,
    ...(e.parent === undefined ? {} : { parent: e.parent }),
    ...(e.instance === undefined ? {} : { instance: e.instance }),
    source: { file: e.source.file, line: e.source.line },
    properties: sorted(e.properties),
  };
}

function dispositionOf(d: Disposition): unknown {
  const base = { element: d.element, annotation: d.annotation, ...(d.instance === undefined ? {} : { instance: d.instance }) };
  switch (d.outcome) {
    case "expressed":
    case "carried":
      return { ...base, outcome: d.outcome, target: d.target };
    case "unexpressed":
      return { ...base, outcome: d.outcome, reason: d.reason };
    default:
      return absurd(d);
  }
}

/** The bundle of a model: the same model gives the same bytes, with the ids and the trace edges as the model has them. */
export async function makeBundle(model: LayeredModel): Promise<Bundle> {
  const files = new Map<string, string>([
    [
      "model.json",
      text({
        schema: SCHEMA,
        name: model.name,
        library: model.library,
        title: model.title,
        summary: model.summary,
        layers: model.layers.map((l) => ({ id: l.id, title: l.title, summary: l.summary, kinds: [...l.kinds] })),
        instances: [...model.instances],
        findings: model.findings.map((f) => ({ rule: f.rule, element: f.element, message: f.message })),
        ...(model.vocabulary === undefined ? {} : { vocabulary: { kinds: model.vocabulary.kinds.map((k) => ({ layer: k.layer, kinds: [...k.kinds] })), relationKinds: [...model.vocabulary.relationKinds], annotations: [...model.vocabulary.annotations] } }),
      }),
    ],
    ["elements.json", text(model.elements.map(elementOf))],
    ["trace.json", text(model.trace.map((t) => ({ from: t.from, to: t.to, how: t.how })))],
    ["relations.json", text((model.relations ?? []).map((r) => ({ from: r.from, to: r.to, kind: r.kind })))],
    ["dispositions.json", text(model.dispositions.map(dispositionOf))],
  ]);
  const listed: { path: string; sha256: string; size: number }[] = [];
  for (const path of [...files.keys()].sort()) {
    const b = bytes(files.get(path) ?? "");
    listed.push({ path, sha256: await sha256(b), size: b.length });
  }
  return { files, manifest: text({ schema: SCHEMA, files: listed }) };
}

const manifestForm = object({ schema: literal(SCHEMA), files: array(object({ path: string, sha256: string, size: integer })) });
const SAFE = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

function unsafe(path: string): boolean {
  return !SAFE.test(path) || path.split("/").some((p) => p === "." || p === "..");
}

/**
 * Verifies a whole bundle, from the text of its manifest and the bytes of each file found in it (not the manifest). It returns every fault, in the order of the paths, and none of the files where there is one; where there
 * is none, the verified files and the model decoded from them. It evaluates nothing of the bundle.
 */
export async function verifyBundle(input: { readonly manifest: string; readonly files: ReadonlyMap<string, Uint8Array> }): Promise<Result<VerifiedBundle, readonly BundleFault[]>> {
  const parsed = json(input.manifest, manifestForm);
  if (parsed.kind === "err") return err([{ kind: "manifest", path: MANIFEST, message: `the manifest is not of the form: ${formatDecodeError(parsed.error)}` }]);
  const faults: BundleFault[] = [];
  const seen = new Set<string>();
  const listed: typeof parsed.value.files[number][] = [];
  for (const f of parsed.value.files) {
    if (unsafe(f.path)) faults.push({ kind: "manifest", path: f.path, message: `${JSON.stringify(f.path)} is not a path inside the bundle` });
    else if (f.path === MANIFEST) faults.push({ kind: "manifest", path: f.path, message: "the manifest lists itself" });
    else if (seen.has(f.path)) faults.push({ kind: "manifest", path: f.path, message: `${f.path} is listed twice` });
    else if (!/^[0-9a-f]{64}$/.test(f.sha256)) faults.push({ kind: "manifest", path: f.path, message: `the digest of ${f.path} is not 64 lower-case hexadecimal digits` });
    else if (f.size < 0) faults.push({ kind: "manifest", path: f.path, message: `the size of ${f.path} is negative` });
    else listed.push(f);
    seen.add(f.path);
  }
  const names = new Set(listed.map((f) => f.path));
  for (const f of listed) {
    const found = input.files.get(f.path);
    if (found === undefined) faults.push({ kind: "missing", path: f.path, message: `${f.path} is in the manifest and not in the bundle` });
    else if (found.length !== f.size || (await sha256(found)) !== f.sha256) faults.push({ kind: "changed", path: f.path, message: `${f.path} is not what the manifest lists (its digest or its size differs)` });
  }
  for (const path of input.files.keys()) if (!names.has(path) && !seen.has(path)) faults.push({ kind: "extra", path, message: `${path} is in the bundle and not in the manifest` });
  const order = { manifest: 0, changed: 1, missing: 2, extra: 3, form: 4 } as const;
  faults.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : order[a.kind] - order[b.kind]));
  if (faults.length > 0) return err(faults);
  const files = new Map(listed.map((f) => [f.path, input.files.get(f.path) as Uint8Array] as const));
  const model = decodeModel(files);
  return model.kind === "ok" ? ok({ files, model: model.value }) : err([model.error]);
}

// ---- decoding the verified files: a decoder at the boundary, never a cast of what a file says

const propertyValue: Decoder<string | number | boolean | readonly string[] | null> = oneOf(string, (i, p) => (typeof i === "number" ? ok(i) : err({ kind: "decode" as const, path: p ?? "$", expected: "a number", found: typeof i })), boolean, array(string), nullable(string));
const layerId = literal(...LAYERS);
const modelForm = object(
  { name: string, library: string, title: string, summary: string, layers: array(object({ id: layerId, title: string, summary: string, kinds: array(string) })), instances: array(string), findings: array(object({ rule: string, element: string, message: string })) },
  { vocabulary: object({ kinds: array(object({ layer: layerId, kinds: array(string) })), relationKinds: array(string), annotations: array(string) }) },
);
const elementForm = array(
  object(
    { id: string, layer: layerId, kind: string, name: string, definition: string, source: object({ file: string, line: integer }), properties: record(propertyValue) },
    { parent: string, instance: string },
  ),
);
const traceForm = array(object({ from: string, to: string, how: string }));
const relationForm = array(object({ from: string, to: string, kind: string }));
const dispositionForm = array(object({ element: string, annotation: string, outcome: literal("expressed", "carried", "unexpressed") }, { instance: string, target: string, reason: string }));

const formFault = (path: string, message: string): BundleFault => ({ kind: "form", path, message });

function id(path: string, v: string): Result<ElementId, BundleFault> {
  const r = parseElementId(v);
  return r.kind === "ok" ? r : err(formFault(path, r.error));
}

function instance(path: string, v: string): Result<InstanceName, BundleFault> {
  const r = parseInstanceName(v);
  return r.kind === "ok" ? r : err(formFault(path, r.error));
}

function parse<T>(files: ReadonlyMap<string, Uint8Array>, path: string, form: Decoder<T>): Result<T, BundleFault> {
  const b = files.get(path);
  if (b === undefined) return err(formFault(path, `${path} is not in the bundle`));
  const r = json(new TextDecoder().decode(b), form);
  return r.kind === "ok" ? r : err(formFault(path, `${path} is not of the form: ${formatDecodeError(r.error)}`));
}

function decodeModel(files: ReadonlyMap<string, Uint8Array>): Result<LayeredModel, BundleFault> {
  const m = parse(files, "model.json", modelForm);
  if (m.kind === "err") return m;
  const e = parse(files, "elements.json", elementForm);
  if (e.kind === "err") return e;
  const t = parse(files, "trace.json", traceForm);
  if (t.kind === "err") return t;
  const r = parse(files, "relations.json", relationForm);
  if (r.kind === "err") return r;
  const d = parse(files, "dispositions.json", dispositionForm);
  if (d.kind === "err") return d;
  const elements: ModelElement[] = [];
  for (const x of e.value) {
    const i = id("elements.json", x.id);
    if (i.kind === "err") return i;
    let parent: ElementId | undefined;
    if (x.parent !== undefined) {
      const p = id("elements.json", x.parent);
      if (p.kind === "err") return p;
      parent = p.value;
    }
    let inst: InstanceName | undefined;
    if (x.instance !== undefined) {
      const n = instance("elements.json", x.instance);
      if (n.kind === "err") return n;
      inst = n.value;
    }
    elements.push({ id: i.value, layer: x.layer, kind: x.kind, name: x.name, definition: x.definition, ...(parent === undefined ? {} : { parent }), ...(inst === undefined ? {} : { instance: inst }), source: x.source, properties: x.properties });
  }
  const trace: TraceEdge[] = [];
  for (const x of t.value) {
    const from = id("trace.json", x.from);
    const to = id("trace.json", x.to);
    if (from.kind === "err") return from;
    if (to.kind === "err") return to;
    trace.push({ from: from.value, to: to.value, how: x.how });
  }
  const relations: Relation[] = [];
  for (const x of r.value) {
    const from = id("relations.json", x.from);
    const to = id("relations.json", x.to);
    if (from.kind === "err") return from;
    if (to.kind === "err") return to;
    relations.push({ from: from.value, to: to.value, kind: x.kind });
  }
  const dispositions: Disposition[] = [];
  for (const x of d.value) {
    const el = id("dispositions.json", x.element);
    if (el.kind === "err") return el;
    let inst: InstanceName | undefined;
    if (x.instance !== undefined) {
      const n = instance("dispositions.json", x.instance);
      if (n.kind === "err") return n;
      inst = n.value;
    }
    const base = { element: el.value, annotation: x.annotation, ...(inst === undefined ? {} : { instance: inst }) };
    if (x.outcome === "unexpressed") {
      if (x.reason === undefined) return err(formFault("dispositions.json", `an unexpressed disposition of ${x.element} has no reason`));
      dispositions.push({ ...base, outcome: "unexpressed", reason: x.reason });
    } else {
      if (x.target === undefined) return err(formFault("dispositions.json", `a ${x.outcome} disposition of ${x.element} has no target`));
      const target = id("dispositions.json", x.target);
      if (target.kind === "err") return target;
      dispositions.push({ ...base, outcome: x.outcome, target: target.value });
    }
  }
  const findings: ModelFinding[] = [];
  for (const f of m.value.findings) {
    const el = id("model.json", f.element);
    if (el.kind === "err") return el;
    findings.push({ rule: f.rule, element: el.value, message: f.message });
  }
  const instances: InstanceName[] = [];
  for (const n of m.value.instances) {
    const i = instance("model.json", n);
    if (i.kind === "err") return i;
    instances.push(i.value);
  }
  const layers: ModelLayer[] = m.value.layers.map((l) => ({ id: l.id, title: l.title, summary: l.summary, kinds: l.kinds }));
  const model: LayeredModel = {
    name: m.value.name,
    library: m.value.library,
    title: m.value.title,
    summary: m.value.summary,
    layers,
    elements,
    trace,
    findings,
    dispositions,
    instances,
    ...(relations.length === 0 ? {} : { relations }),
    ...(m.value.vocabulary === undefined ? {} : { vocabulary: m.value.vocabulary }),
  };
  return ok(model);
}
