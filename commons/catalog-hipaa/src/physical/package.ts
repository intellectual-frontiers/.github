// Spec: 0002-hipaa-package FR-002, FR-003, FR-004
/**
 * The files of the package (0002-hipaa-package FR-002, FR-003, FR-004): from the entries to the text of each file, with the manifest's digest, and the folder where they are kept. Making is pure; reading and writing the folder is the tool's.
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
import { ENTRIES, FRAMEWORK, LICENCE, MADE_AT, REFERENCE, SOURCE_FILE } from "@intellectual-frontiers/catalog-hipaa/governance";
import { convert } from "@intellectual-frontiers/catalog-hipaa/logical";

/** The folder of the package: the one the loader of grc reads. */
export const PACKAGE_DIR: string = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "data");

const FRAMEWORK_FILE = `frameworks/${FRAMEWORK.id}-${FRAMEWORK.version}.json`;
const head = (kind: string, id: string): Record<string, unknown> => ({ kind, schema: "1", id, createdAt: MADE_AT, provenance: { producer: { name: "catalog-hipaa", version: "1" }, inputs: [SOURCE_FILE] } });
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** What a manifest says about the content that is not there. */
export const NOTICE =
  "The text of the regulation is not carried: the statements are our own reading, and the regulation at the address of the reference stays the authority. The crosswalk to NIST SP 800-53 is in commons catalog-crosswalks. The rule's proposals to make every addressable specification required are not in force and are not here.";

/** The text of every file of the package, by its path, given the SHA-256 of the source file the entries are in. */
export async function makePackage(sourceDigest: string): Promise<ReadonlyMap<string, string>> {
  const c = convert(ENTRIES);
  if (c.repeated.length > 0) throw new Error(`the entries repeat ${c.repeated.join(", ")}`);
  const framework = json({ ...head("grc.framework", FRAMEWORK.id), version: FRAMEWORK.version, title: FRAMEWORK.title, controls: c.controls, publisher: REFERENCE.publisher, source: REFERENCE.url });
  const manifest = json({
    ...head("grc.catalog-package", "catalog-hipaa"),
    version: FRAMEWORK.version,
    title: FRAMEWORK.title,
    source: { publisher: "Intellectual Frontiers LLC, reading a regulation of the United States government", edition: `${REFERENCE.edition}, read on ${REFERENCE.readOn}`, url: REFERENCE.url },
    licence: LICENCE,
    redistributable: true,
    holds: [{ kind: "grc.framework", id: FRAMEWORK.id, file: FRAMEWORK_FILE, digest: await sha256(new TextEncoder().encode(framework)) }],
    sources: [{ url: SOURCE_FILE, sha256: sourceDigest }],
    notice: NOTICE,
  });
  return new Map([["manifest.json", manifest], [FRAMEWORK_FILE, framework]]);
}

/** The SHA-256 of the bytes of the source file, as the package records it. */
export async function digestOf(bytes: Uint8Array): Promise<string> {
  return sha256(bytes);
}
