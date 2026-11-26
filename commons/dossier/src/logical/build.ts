// Spec: 0002-dossier-core FR-007, FR-008
/**
 * The build of a dossier (0046-dossiers): the sources a declaration selects as of an instant, each lens run on what it may read, the plates a reader may see (a plate above the class of the reader is replaced by a statement that it was withheld), the AsciiDoc,
 * and the manifest. A build is a function of its arguments: it reads no file, no clock and no network, and it writes nothing; where it fails it gives no dossier.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type Built, type BuildError, type Declaration, type DisclosureClass, type Json, type Lens, type Manifest, mayShow, type Plate, type Source } from "@intellectual-frontiers/dossier/governance";
import { canonicalize, digestOf } from "@intellectual-frontiers/grc/logical";
import { documentAdoc } from "./adoc.ts";
import { plateOf, slugOf, text } from "./lens.ts";
import { canonicalSelection, INSTANT, instantOf, meets, select } from "./selection.ts";
import { checkSources } from "./sources.ts";

/** The lenses a build may use, by id. */
export type Registry = ReadonlyMap<string, Lens<unknown>>;

/** A registry from lenses, each erased with `erase`. */
export function registryOf(lenses: readonly Lens<unknown>[]): Registry {
  return new Map(lenses.map((l) => [l.id, l]));
}

/** The plate that stands where a plate of a class above the reader's would be: it says only the class (0046-dossiers FR-034). */
export function withheldPlate(lens: { readonly id: string }, plateClass: DisclosureClass, audience: DisclosureClass): Plate {
  return plateOf({
    lens: { id: lens.id, ceiling: "public" },
    title: "Withheld",
    slug: `withheld-${slugOf(lens.id)}`,
    blocks: [{ t: "note", tone: "important", inlines: [text(`This plate is of class ${plateClass}, which is above the class of this dossier (${audience}). It is withheld.`)] }],
  });
}

interface Resolved {
  readonly asOf: string;
  readonly sources: readonly Source[];
}

/** The instant and the sources of a declaration: those that meet its selection at or before the instant. */
function resolve(decl: Declaration, checked: readonly Source[]): Result<Resolved, BuildError> {
  const pre = checked.filter((x) => meets(decl.selection, x));
  const asOf = instantOf(decl.asOf, pre);
  if (!INSTANT.test(asOf)) return err({ code: "E-DOSSIER-AS-OF", message: `${JSON.stringify(asOf)} is not an instant like 2026-11-26T12:00:00Z` });
  return ok({ asOf, sources: select(decl.selection, checked, asOf) });
}

interface Planned {
  readonly lens: Lens<unknown>;
  readonly params: unknown;
  readonly raw: Json;
}

function plan(decl: Declaration, registry: Registry): Result<readonly Planned[], BuildError> {
  const out: Planned[] = [];
  for (const use of decl.lenses) {
    const lens = registry.get(use.lens);
    if (lens === undefined) return err({ code: "E-DOSSIER-LENS-UNKNOWN", message: `the dossier names the lens ${use.lens}, which the build does not have` });
    const raw: Json = use.params ?? null;
    const p = lens.decode(raw);
    if (p.kind === "err") return err({ code: "E-DOSSIER-LENS-PARAMS", message: `the parameters of ${use.lens} are not accepted: ${p.error}` });
    const kinds = decl.selection.kinds;
    if (kinds !== undefined) {
      const missing = lens.inputs.filter((k) => !kinds.includes(k));
      if (missing.length > 0) return err({ code: "E-DOSSIER-LENS-INPUT", message: `${use.lens} reads sources of kind ${missing.join(", ")}, which the selection of the dossier does not include` });
    }
    out.push({ lens, params: p.value, raw });
  }
  return ok(out);
}

/** The hash of the inputs of a dossier (0046-dossiers FR-101): its selection, instant and class, each lens with its version and parameters, the id and hash of each source a reader may see, and how many sources of each lens were above the lens's ceiling; the same inputs give the same hash and nothing else does. */
export async function inputsHashOf(decl: Declaration, registry: Registry, all: readonly Source[]): Promise<Result<string, BuildError>> {
  const checked = await checkSources(all);
  if (checked.kind === "err") return checked;
  const r = resolve(decl, checked.value);
  if (r.kind === "err") return r;
  const planned = plan(decl, registry);
  if (planned.kind === "err") return planned;
  return ok(await digestOf(inputsOf(decl, r.value, planned.value)));
}

function inputsOf(decl: Declaration, r: Resolved, planned: readonly Planned[]): Json {
  return {
    selection: canonicalSelection(decl.selection) as Json,
    asOf: r.asOf,
    audience: decl.audience,
    lenses: planned.map((p) => ({
      id: p.lens.id,
      version: p.lens.version,
      params: p.raw,
      withheld: r.sources.filter((s) => p.lens.inputs.includes(s.kind) && !mayShow(p.lens.ceiling, s.class)).length,
      sources: r.sources.filter((s) => p.lens.inputs.includes(s.kind) && mayShow(decl.audience, s.class) && mayShow(p.lens.ceiling, s.class)).map((s) => [s.id, s.hash]),
    })),
  };
}

/** Whether a build is due (0046-dossiers FR-103): the hash of the inputs now is not the hash of the last build. */
export async function isDue(lastInputs: string | undefined, decl: Declaration, registry: Registry, all: readonly Source[]): Promise<Result<boolean, BuildError>> {
  const now = await inputsHashOf(decl, registry, all);
  return now.kind === "err" ? now : ok(lastInputs !== now.value);
}

/** A dossier built from a declaration, the lenses and the sources, as of the instant of the declaration (0046-dossiers FR-102: an earlier instant gives what a build then would have given from the sources then). */
export async function build(decl: Declaration, registry: Registry, all: readonly Source[]): Promise<Result<Built, BuildError>> {
  const checked = await checkSources(all);
  if (checked.kind === "err") return checked;
  const r = resolve(decl, checked.value);
  if (r.kind === "err") return r;
  const planned = plan(decl, registry);
  if (planned.kind === "err") return planned;
  const plates: Plate[] = [];
  const held = new Map<string, Source>();
  const withheld: { lens: string; class: DisclosureClass }[] = [];
  for (const p of planned.value) {
    if (!mayShow(decl.audience, p.lens.ceiling)) {
      withheld.push({ lens: p.lens.id, class: p.lens.ceiling });
      plates.push(withheldPlate(p.lens, p.lens.ceiling, decl.audience));
      continue;
    }
    const ofKinds = r.value.sources.filter((s) => p.lens.inputs.includes(s.kind));
    const given = ofKinds.filter((s) => mayShow(p.lens.ceiling, s.class));
    const out = p.lens.plate({ sources: given, params: p.params, asOf: r.value.asOf, withheld: ofKinds.length - given.length });
    if (out.kind === "err") return err({ code: "E-DOSSIER-LENS-REFUSED", message: `${p.lens.id} gave no plate: ${out.error.message}` });
    const plate = out.value;
    if (!mayShow(p.lens.ceiling, plate.ceiling)) return err({ code: "E-DOSSIER-LENS-CEILING", message: `${p.lens.id} gave a plate of class ${plate.ceiling}, above its ceiling ${p.lens.ceiling}` });
    const ids = new Set(given.map((s) => s.id));
    const stray = plate.cites.find((c) => !ids.has(c));
    if (stray !== undefined) return err({ code: "E-DOSSIER-LENS-CITE", message: `${p.lens.id} cites ${stray}, which it was not given` });
    for (const s of given) held.set(s.id, s);
    plates.push(plate);
  }
  const evidence = [...held.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  const inputs = await digestOf(inputsOf(decl, r.value, planned.value));
  const doc = documentAdoc({ title: decl.title, asOf: r.value.asOf, audience: decl.audience, inputs, lenses: planned.value.map((p) => ({ id: p.lens.id, version: p.lens.version })), plates, sources: evidence });
  if (doc.kind === "err") return doc;
  const manifest: Manifest = {
    dossier: decl.id,
    asOf: r.value.asOf,
    audience: decl.audience,
    lenses: planned.value.map((p) => ({ id: p.lens.id, version: p.lens.version, params: p.raw })),
    selection: canonicalSelection(decl.selection),
    sources: evidence.map((s) => ({ id: s.id, kind: s.kind, observedAt: s.observedAt, hash: s.hash, class: s.class, ...(s.signer === undefined ? {} : { signer: s.signer }) })),
    withheld,
    inputs,
    renditions: { "dossier.adoc": await sha256(doc.value) },
  };
  return ok({ declaration: decl, asOf: r.value.asOf, plates, sources: evidence, adoc: doc.value, manifest });
}

/** The manifest as the bytes that are written: canonical JSON and one final newline. */
export const manifestText = (m: Manifest): string => `${canonicalize(m)}\n`;

/** The digest of a manifest: what a seal signs. */
export const manifestDigest = (m: Manifest): Promise<string> => digestOf(m);

/** The manifest with a rendition's hash added. */
export const withRendition = (m: Manifest, name: string, hash: string): Manifest => ({ ...m, renditions: { ...m.renditions, [name]: hash } });
