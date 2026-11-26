// Spec: 0002-crosswalks FR-007
/**
 * The projection of a framework as an OSCAL catalog and of a crosswalk as an OSCAL mapping collection (0002-crosswalks FR-007): pure functions of the documents, with a version 5 UUID of the document's own name so that the same document gives the same bytes. An OSCAL identifier cannot start
 * with a digit, so an identifier that does (the sections of the Security Rule) is written with one underscore in front, and a character that a token cannot hold is written as an underscore.
 *
 * @example
 * ```ts
 * import { tokenOf } from "./oscal.ts";
 * tokenOf("164.308.a.1"); // "_164.308.a.1"
 * ```
 *
 * @module
 */
import { NAMESPACE_URL, uuidV5 } from "@intellectual-frontiers/crypto/uuid";

type Obj = { [key: string]: unknown };

/** A framework document, as the catalog loader of grc has it. */
export type Framework = { readonly id: string; readonly version: string; readonly title: string; readonly controls: readonly { readonly id: string; readonly title: string; readonly statement: string; readonly family: string }[] };

/** A crosswalk document, as the catalog loader of grc has it. */
export type Crosswalk = { readonly id: string; readonly mappings: readonly { readonly from: string; readonly to: string; readonly relationship: string; readonly strength: number; readonly note: string }[] };

/** What the projections are told: the time of the document and the version of OSCAL it is written as. */
export type Options = { readonly madeAt: string; readonly oscalVersion: string };

/** An identifier written as an OSCAL token: a character a token cannot hold becomes an underscore, and one underscore goes in front of an identifier that does not start with a letter or an underscore. */
export function tokenOf(id: string): string {
  const safe = id.replace(/[^\p{L}\p{N}._-]/gu, "_");
  return /^[\p{L}_]/u.test(safe) ? safe : `_${safe}`;
}

const uuid = (name: string): Promise<string> => uuidV5(NAMESPACE_URL, name);

/** The OSCAL catalog of a framework: one group for each family, in the order the families first occur, and one control for each control, with its statement as a part. */
export async function oscalCatalogOf(fw: Framework, o: Options): Promise<Obj> {
  const order: string[] = [];
  for (const c of fw.controls) if (!order.includes(c.family)) order.push(c.family);
  const groups: Obj[] = order.map((family) => ({
    id: tokenOf(family),
    class: "family",
    title: family,
    controls: fw.controls.filter((c) => c.family === family).map((c) => ({ id: tokenOf(c.id), class: "control", title: c.title, parts: [{ id: `${tokenOf(c.id)}_smt`, name: "statement", prose: c.statement }] })),
  }));
  return { catalog: { uuid: await uuid(`urn:grc:${fw.id}:${fw.version}`), metadata: { title: fw.title, "last-modified": o.madeAt, version: fw.version, "oscal-version": o.oscalVersion }, groups } };
}

/** The OSCAL mapping collection of a crosswalk: one mapping for each pair of frameworks its rows start from and reach, and one map for each row, with the note as remarks. The provenance says the rows are a draft made by hand. */
export async function oscalMappingOf(cw: Crosswalk, title: string, o: Options): Promise<Obj> {
  const parse = (urn: string): { readonly fw: string; readonly version: string; readonly control: string } => {
    const m = /^urn:grc:([^:]+):([^:]+):(.+)$/.exec(urn);
    if (m === null) throw new Error(`not a control URN: ${urn}`);
    return { fw: m[1] ?? "", version: m[2] ?? "", control: m[3] ?? "" };
  };
  const pairs = new Map<string, { from: string; to: string; rows: Crosswalk["mappings"][number][] }>();
  for (const r of cw.mappings) {
    const f = parse(r.from);
    const t = parse(r.to);
    const key = `urn:grc:${f.fw}:${f.version}\u0000urn:grc:${t.fw}:${t.version}`;
    const have = pairs.get(key) ?? { from: `urn:grc:${f.fw}:${f.version}`, to: `urn:grc:${t.fw}:${t.version}`, rows: [] };
    have.rows.push(r);
    pairs.set(key, have);
  }
  const mappings: Obj[] = [];
  for (const p of [...pairs.values()].sort((a, b) => (`${a.from}${a.to}` < `${b.from}${b.to}` ? -1 : 1))) {
    const maps: Obj[] = [];
    for (const r of p.rows) {
      maps.push({
        uuid: await uuid(`${cw.id}\u0000${r.from}\u0000${r.to}`),
        relationship: r.relationship,
        sources: [{ type: "control", "id-ref": tokenOf(parse(r.from).control) }],
        targets: [{ type: "control", "id-ref": tokenOf(parse(r.to).control) }],
        remarks: r.note,
      });
    }
    mappings.push({ uuid: await uuid(`${cw.id}\u0000${p.from}\u0000${p.to}`), "source-resource": { type: "catalog", href: p.from }, "target-resource": { type: "catalog", href: p.to }, maps });
  }
  return {
    "mapping-collection": {
      uuid: await uuid(`urn:grc:crosswalk:${cw.id}`),
      metadata: { title, "last-modified": o.madeAt, version: "1", "oscal-version": o.oscalVersion },
      provenance: { method: "human", "matching-rationale": "semantic", status: "draft", "mapping-description": "Proposals made by hand from the names of the two sides; no published mapping was read, and each row says that a person decides it." },
      mappings,
    },
  };
}
