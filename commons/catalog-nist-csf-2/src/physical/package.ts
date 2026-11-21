// Spec: 0002-csf2-package FR-002, FR-003, FR-004
/**
 * The files of the package (0002-csf2-package FR-002, FR-003, FR-004): from the source value to the text of each file, with the manifest's digests, and the folder where they are kept. Making is pure; reading and writing the folder is the tool's.
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
import { FRAMEWORK, MADE_AT, SOURCE } from "@intellectual-frontiers/catalog-nist-csf-2/governance";
import { convert, type Source } from "@intellectual-frontiers/catalog-nist-csf-2/logical";

/** The folder of the package: the one the loader of grc reads. */
export const PACKAGE_DIR: string = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "data");

const FRAMEWORK_FILE = "frameworks/nist-csf-2.0.json";
const head = (kind: string, id: string): Record<string, unknown> => ({ kind, schema: "1", id, createdAt: MADE_AT, provenance: { producer: { name: "catalog-nist-csf-2", version: "1" }, inputs: [SOURCE.url] } });
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** The text of every file of the package, by its path: the framework and the manifest that holds its digest. */
export async function makePackage(source: Source): Promise<ReadonlyMap<string, string>> {
  const c = convert(source);
  const framework = json({ ...head("grc.framework", FRAMEWORK.id), version: FRAMEWORK.version, title: FRAMEWORK.title, controls: c.controls });
  const manifest = json({
    ...head("grc.catalog-package", "catalog-nist-csf-2"),
    version: FRAMEWORK.version,
    title: FRAMEWORK.title,
    source: { publisher: SOURCE.publisher, edition: SOURCE.edition, url: SOURCE.url },
    licence: SOURCE.licence,
    redistributable: true,
    holds: [{ kind: "grc.framework", id: FRAMEWORK.id, file: FRAMEWORK_FILE, digest: await sha256(new TextEncoder().encode(framework)) }],
    sources: [{ url: SOURCE.url, sha256: SOURCE.sha256 }],
  });
  return new Map([["manifest.json", manifest], [FRAMEWORK_FILE, framework]]);
}

/** The SHA-256 of the bytes of a source file, as the package pins it. */
export async function digestOf(bytes: Uint8Array): Promise<string> {
  return sha256(bytes);
}
