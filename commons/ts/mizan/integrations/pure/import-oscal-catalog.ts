/**
 * The importer of an OSCAL control catalog (commons 0019-mizan-integrations FR-005, FR-006, FR-009, FR-015): a slice of the controls of a catalog such as NIST SP 800-53, read from
 * OSCAL's JSON, written as a generated TypeScript module of a typed code list whose keys are the control identifiers, so that a requirement cites `ac-2` and the compiler knows it
 * is a control of the pinned catalog.
 *
 * @remarks
 * The catalog's JSON is read once, here, into typed records (`decodeCatalog`); a control is its identifier, title, group and, for an enhancement, the control it enhances. The
 * slice names control identifiers (`ac-2`, `ac-2.1`), never the whole catalog. The checks are those of the vocabulary importer: a pin that differs, no license and no right to
 * copy are refused, a control the catalog lacks is named, and the same input gives the same text. The module carries the catalog's title, version and OSCAL version in its header.
 *
 * @limits
 * It keeps no statements, parameters, guidance or assessment objectives, which are prose a person reads in the catalog; it carries identifiers and titles only.
 *
 * @example
 * ```ts
 * import { importOscalCatalog } from "./import-oscal-catalog.ts";
 * // importOscalCatalog({ standard, sourceText, slice: ["ac-2", "ac-2.1"] })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { ImportOutput, ImportRecordData } from "./import-vocabulary.ts";
import type { IntegrationFinding, StandardRecord } from "./types.ts";

/** The generator's name, as the provenance and the header of a generated module give it. */
export const OSCAL_GENERATOR = "commons/ts/mizan/integrations/pure/import-oscal-catalog.ts";

/** A control of a catalog as the importer reads it. */
export type Control = { readonly id: string; readonly title: string; readonly group: string; readonly enhancementOf?: string };

/** A catalog as the importer reads it: what its metadata says, and every control, enhancements included. */
export type Catalog = {
  readonly title: string;
  readonly version: string;
  readonly oscalVersion: string;
  readonly controls: readonly Control[];
};

/** What an OSCAL import needs. */
export type OscalImportInput = {
  readonly standard: StandardRecord;
  /** The catalog's JSON, as the pinned bytes read as UTF-8 text. */
  readonly sourceText: string;
  /** The control identifiers to take (`ac-2`, `ac-2.1`), never the whole catalog. */
  readonly slice: readonly string[];
  /** The name the code list is exported as (`controls` by default). */
  readonly exportName?: string;
};

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): string | undefined => (typeof x === "string" ? x : undefined);

function collect(list: unknown, group: string, parent: string | undefined, out: Control[]): void {
  if (!Array.isArray(list)) return;
  for (const c of list) {
    if (!isRecord(c)) continue;
    const id = str(c["id"]);
    const title = str(c["title"]);
    if (id === undefined || title === undefined) continue;
    out.push({ id, title, group, ...(parent === undefined ? {} : { enhancementOf: parent }) });
    collect(c["controls"], group, id, out);
  }
}

/** The text of an OSCAL catalog's JSON as a typed catalog, or the sentence that says what is wrong with it. */
export function decodeCatalog(text: string): Result<Catalog, string> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return err(`the catalog is not JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const catalog = isRecord(json) ? json["catalog"] : undefined;
  if (!isRecord(catalog)) return err("the JSON has no catalog");
  const meta = catalog["metadata"];
  if (!isRecord(meta)) return err("the catalog has no metadata");
  const [title, version, oscalVersion] = [str(meta["title"]), str(meta["version"]), str(meta["oscal-version"])];
  if (title === undefined || version === undefined || oscalVersion === undefined)
    return err("the catalog's metadata lacks a title, a version or an oscal-version");
  const controls: Control[] = [];
  const groups = catalog["groups"];
  if (Array.isArray(groups)) {
    for (const g of groups) {
      if (isRecord(g)) collect(g["controls"], str(g["id"]) ?? "", undefined, controls);
    }
  }
  collect(catalog["controls"], "", undefined, controls);
  return ok({ title, version, oscalVersion, controls });
}

function key(id: string): string {
  return JSON.stringify(id);
}

function moduleText(i: OscalImportInput, c: Catalog, taken: readonly Control[]): string {
  const name = i.exportName ?? "controls";
  const s = i.standard;
  const body = taken
    .map(
      (t) =>
        `  ${key(t.id)}: { title: ${JSON.stringify(t.title)}, group: ${JSON.stringify(t.group)}${t.enhancementOf === undefined ? "" : `, enhancementOf: ${JSON.stringify(t.enhancementOf)}`} },`,
    )
    .join("\n");
  return [
    `// AUTO-GENERATED by ${OSCAL_GENERATOR} (commons 0019-mizan-integrations FR-015). Do not edit: change the slice and import again.`,
    `// source: ${s.name}, ${s.issuer}, version ${s.version}, ${s.location}`,
    `// catalog: ${c.title}, version ${c.version}, OSCAL ${c.oscalVersion}`,
    `// license: ${s.license}`,
    `// source_sha256=${s.sha256}`,
    `// basis: adopts (0018-standards-first FR-003)`,
    ``,
    `/** The controls of ${s.name} that commons cites, by identifier: their title, group and, for an enhancement, the control it enhances (basis: adopts). */`,
    `export const ${name} = {`,
    body,
    `} as const;`,
    ``,
    `/** The identifier of a control of the slice. */`,
    `export type ControlId = keyof typeof ${name};`,
    ``,
  ].join("\n");
}

/** A slice of an OSCAL catalog as a generated typed code list of controls, or what stops it. */
export async function importOscalCatalog(i: OscalImportInput): Promise<Result<ImportOutput, readonly IntegrationFinding[]>> {
  const s = i.standard;
  if (s.license === "") return err([{ kind: "no-license", standard: s.id }]);
  if (!s.redistributable) return err([{ kind: "not-redistributable", standard: s.id }]);
  const actual = await sha256(i.sourceText);
  if (actual !== s.sha256) return err([{ kind: "pin-mismatch", standard: s.id, expected: s.sha256, actual }]);
  if (i.slice.length === 0) return err([{ kind: "slice-empty" }]);
  const cat = decodeCatalog(i.sourceText);
  if (cat.kind === "err") return err([{ kind: "syntax", line: 1, message: cat.error }]);
  const byId = new Map(cat.value.controls.map((c) => [c.id, c]));
  const findings: IntegrationFinding[] = [];
  const taken: Control[] = [];
  for (const id of [...new Set(i.slice)].sort()) {
    const c = byId.get(id);
    if (c === undefined) findings.push({ kind: "term-missing", iri: id });
    else taken.push(c);
  }
  if (findings.length > 0) return err(findings);
  const record: ImportRecordData = {
    standard: s.id,
    name: s.name,
    issuer: s.issuer,
    version: s.version,
    location: s.location,
    license: s.license,
    sha256: s.sha256,
    generator: OSCAL_GENERATOR,
    slice: taken.map((t) => t.id),
  };
  return ok({
    module: moduleText(i, cat.value, taken),
    record,
    terms: taken.map((t) => ({ iri: t.id, kind: "control" as const })),
    findings,
  });
}
