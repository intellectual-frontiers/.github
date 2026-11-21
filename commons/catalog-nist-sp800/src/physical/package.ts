// Spec: 0002-sp800-package FR-002, FR-003, FR-004
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
import { FRAMEWORKS, LICENCE, MADE_AT, REPOSITORY, SOURCES, urlOf } from "@intellectual-frontiers/catalog-nist-sp800/governance";
import { convertCatalog, type Catalog, type OutControl } from "@intellectual-frontiers/catalog-nist-sp800/logical";

/** The folder of the package: the one the loader of grc reads. */
export const PACKAGE_DIR: string = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "data");

const head = (kind: string, id: string): Record<string, unknown> => ({ kind, schema: "1", id, createdAt: MADE_AT, provenance: { producer: { name: "catalog-nist-sp800", version: "1" }, inputs: SOURCES.map(urlOf) } });
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** The text of every file of the package, by its path, from the catalogs by source id. */
export async function makePackage(catalogs: Readonly<Record<"800-53" | "800-171", Catalog>>): Promise<ReadonlyMap<string, string>> {
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
  const manifest = json({
    ...head("grc.catalog-package", "catalog-nist-sp800"),
    version: "1",
    title: "NIST SP 800-53 Rev 5.2.0 and SP 800-171 Rev 3, with their assessment objectives",
    source: { publisher: "National Institute of Standards and Technology (NIST), OSCAL content", edition: `${SOURCES.map((s) => s.edition).join("; ")}; ${REPOSITORY.url} at ${REPOSITORY.commit}`, url: REPOSITORY.url },
    licence: LICENCE,
    redistributable: true,
    holds,
    sources: SOURCES.map((s) => ({ url: urlOf(s), sha256: s.sha256 })),
  });
  return new Map([["manifest.json", manifest], ...files]);
}

/** The SHA-256 of the bytes of a source file, as the package pins it. */
export async function digestOf(bytes: Uint8Array): Promise<string> {
  return sha256(bytes);
}
