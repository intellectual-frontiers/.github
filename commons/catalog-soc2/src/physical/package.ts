// Spec: 0002-soc2-package FR-002, FR-003, FR-004; 0003-soc2-focus FR-001, FR-002
/**
 * The files of the package (0002-soc2-package FR-002, FR-003, FR-004): from the criteria to the text of each file, with the manifest's digests, and the folder where they are kept. Making is pure; reading and writing the folder is the tool's.
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
import { CRITERIA, FOCUS, FOCUS_FRAMEWORK, FRAMEWORK, LICENCE, MADE_AT, REFERENCE, SOURCE_FILES } from "@intellectual-frontiers/catalog-soc2/governance";
import { convert } from "@intellectual-frontiers/catalog-soc2/logical";

/** The folder of the package: the one the loader of grc reads. */
export const PACKAGE_DIR: string = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "data");

const FRAMEWORK_FILE = `frameworks/${FRAMEWORK.id}-${FRAMEWORK.version}.json`;
const FOCUS_FILE = `frameworks/${FOCUS_FRAMEWORK.id}-${FOCUS_FRAMEWORK.version}.json`;
const head = (kind: string, id: string): Record<string, unknown> => ({ kind, schema: "1", id, createdAt: MADE_AT, provenance: { producer: { name: "catalog-soc2", version: "1" }, inputs: SOURCE_FILES } });
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** What a manifest says about the content that is not there. */
export const NOTICE = "The points of focus the AICPA prints under each criterion are not carried and were not read. The framework soc2-focus is our own list of what an organization shows for each criterion; it is not a reading of the points of focus, and a person who holds the AICPA's publication decides which of its points of focus a matter answers.";

/** The text of every file of the package, by its path, given the SHA-256 of each source file. */
export async function makePackage(sourceDigests: Readonly<Record<string, string>>): Promise<ReadonlyMap<string, string>> {
  const c = convert(CRITERIA);
  if (c.repeated.length > 0) throw new Error(`the criteria repeat ${c.repeated.join(", ")}`);
  const f = convert(FOCUS);
  if (f.repeated.length > 0) throw new Error(`the matters repeat ${f.repeated.join(", ")}`);
  const framework = json({ ...head("grc.framework", FRAMEWORK.id), version: FRAMEWORK.version, title: FRAMEWORK.title, controls: c.controls });
  const focus = json({ ...head("grc.framework", FOCUS_FRAMEWORK.id), version: FOCUS_FRAMEWORK.version, title: FOCUS_FRAMEWORK.title, controls: f.controls });
  const manifest = json({
    ...head("grc.catalog-package", "catalog-soc2"),
    version: FRAMEWORK.version,
    title: FRAMEWORK.title,
    source: { publisher: "Intellectual Frontiers LLC, reading the criteria of the AICPA", edition: `${REFERENCE.edition}; ${REFERENCE.publisher}`, url: REFERENCE.url },
    licence: LICENCE,
    redistributable: true,
    holds: [
      { kind: "grc.framework", id: FRAMEWORK.id, file: FRAMEWORK_FILE, digest: await sha256(new TextEncoder().encode(framework)) },
      { kind: "grc.framework", id: FOCUS_FRAMEWORK.id, file: FOCUS_FILE, digest: await sha256(new TextEncoder().encode(focus)) },
    ],
    sources: SOURCE_FILES.map((url) => ({ url, sha256: sourceDigests[url] ?? "" })),
    notice: NOTICE,
  });
  const entries: [string, string][] = [["manifest.json", manifest], [FRAMEWORK_FILE, framework], [FOCUS_FILE, focus]];
  return new Map(entries.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)));
}

/** The SHA-256 of the bytes of a source file, as the package records it. */
export async function digestOf(bytes: Uint8Array): Promise<string> {
  return sha256(bytes);
}
