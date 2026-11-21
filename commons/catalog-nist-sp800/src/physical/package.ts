// Spec: 0002-sp800-package FR-002, FR-003, FR-004
// Spec: 0003-sp800-171-r2 FR-001, FR-002
/**
 * The files of the package: from the two catalogs to the text of each file, with the manifest's digests, and the folder where they are kept. Making is pure; reading and writing the folder is the tool's.
 *
 * @example
 * ```ts
 * import { PACKAGE_DIR } from "./package.ts";
 * PACKAGE_DIR.endsWith("data"); // true
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { path } from "@intellectual-frontiers/system";
import { FRAMEWORKS, LICENCE, MADE_AT, PRINTED_SOURCES, REPOSITORY, REV2_FRAMEWORKS, SOURCES, urlOf } from "@intellectual-frontiers/catalog-nist-sp800/governance";
import { convertCatalog, readObjectives, readRequirements, type Catalog, type OutControl } from "@intellectual-frontiers/catalog-nist-sp800/logical";

/** The folder of the package: the one the loader of grc reads. */
export const PACKAGE_DIR: string = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "data");

const head = (kind: string, id: string, inputs: readonly string[] = SOURCES.map(urlOf)): Record<string, unknown> => ({ kind, schema: "1", id, createdAt: MADE_AT, provenance: { producer: { name: "catalog-nist-sp800", version: "1" }, inputs } });
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** The text of every file of the package, by its path, from the catalogs by source id and the text of the two printed publications of Revision 2 (`pdftotext -raw` of each). */
export async function makePackage(catalogs: Readonly<Record<"800-53" | "800-171", Catalog>>, printed: Readonly<Record<"800-171r2" | "800-171a", string>>): Promise<ReadonlyMap<string, string>> {
  const converted = { "800-53": convertCatalog(catalogs["800-53"], "800-53"), "800-171": convertCatalog(catalogs["800-171"], "800-171") };
  const files = new Map<string, string>();
  const holds: unknown[] = [];
  for (const f of FRAMEWORKS) {
    const controls: readonly OutControl[] = f.id.endsWith("a") ? converted[f.source].objectives : converted[f.source].requirements;
    const text = json({ ...head("grc.framework", f.id), version: f.version, title: f.title, controls });
    const file = `frameworks/${f.id}-${f.version}.json`;
    files.set(file, text);
    holds.push({ kind: "grc.framework", id: f.id, file, digest: await sha256(new TextEncoder().encode(text)) });
  }
  const rev2 = readRequirements(printed["800-171r2"]);
  const parts: Readonly<Record<string, readonly OutControl[]>> = { "nist-800-171-r2": rev2.requirements, "nist-800-171a-r2": readObjectives(printed["800-171a"], rev2.requirements) };
  for (const f of REV2_FRAMEWORKS) {
    const text = json({ ...head("grc.framework", f.id, PRINTED_SOURCES.map((p) => p.url)), version: f.version, title: f.title, controls: parts[f.id] });
    const file = `frameworks/${f.id}-${f.version}.json`;
    files.set(file, text);
    holds.push({ kind: "grc.framework", id: f.id, file, digest: await sha256(new TextEncoder().encode(text)) });
  }
  const manifest = json({
    ...head("grc.catalog-package", "catalog-nist-sp800", [...SOURCES.map(urlOf), ...PRINTED_SOURCES.map((p) => p.url)]),
    version: "1",
    title: "NIST SP 800-53 Rev 5.2.0, SP 800-171 Rev 3 and Rev 2, with their assessment objectives",
    source: { publisher: "National Institute of Standards and Technology (NIST), OSCAL content", edition: `${[...SOURCES, ...PRINTED_SOURCES].map((s) => s.edition).join("; ")}; ${REPOSITORY.url} at ${REPOSITORY.commit}`, url: REPOSITORY.url },
    licence: LICENCE,
    redistributable: true,
    holds,
    sources: [...SOURCES.map((s) => ({ url: urlOf(s), sha256: s.sha256 })), ...PRINTED_SOURCES.map((s) => ({ url: s.url, sha256: s.sha256 }))],
  });
  return new Map([["manifest.json", manifest], ...files]);
}

/** The SHA-256 of the bytes of a source file, as the package pins it. */
export async function digestOf(bytes: Uint8Array): Promise<string> {
  return sha256(bytes);
}
