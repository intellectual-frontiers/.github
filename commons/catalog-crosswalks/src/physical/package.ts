// Spec: 0002-crosswalks FR-002, FR-003, FR-004
/**
 * The files of the package (0002-crosswalks FR-002, FR-003, FR-004): from the proposals to the text of each crosswalk, with the manifest's digests, and the folder where they are kept. Making is pure; reading and writing the folder is the tool's.
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
import { CROSSWALKS, HIPAA_PROPOSALS, ISO_PROPOSALS, LICENCE, MADE_AT, PENDING, REFERENCES, SOC2_PROPOSALS, SOURCE_FILES } from "@intellectual-frontiers/catalog-crosswalks/governance";
import { composeThrough, mappingsOf, type OutMapping } from "@intellectual-frontiers/catalog-crosswalks/logical";

/** The folder of the package: the one the loader of grc reads. */
export const PACKAGE_DIR: string = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "data");

const head = (kind: string, id: string): Record<string, unknown> => ({ kind, schema: "1", id, createdAt: MADE_AT, provenance: { producer: { name: "catalog-crosswalks", version: "1" }, inputs: SOURCE_FILES } });
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** The path of each crosswalk's file inside the package. */
export const CROSSWALK_FILES = Object.fromEntries(Object.entries(CROSSWALKS).map(([k, v]) => [k, `crosswalks/${v.id}.json`])) as Record<keyof typeof CROSSWALKS, string>;

/** What a manifest says about the content that is not there. */
export const NOTICE =
  "No published mapping was read: the mappings of NIST SP 800-53 to ISO/IEC 27001, of the Trust Services Criteria to SP 800-53 and of the Security Rule to SP 800-53 were not fetched. Every row is our proposal, intersects-with at strength 1, and carries the words person-decision-required and its reason; a consumer MUST NOT count a row that still carries them. The crosswalk of ISO/IEC 27001 to SOC 2 is derived through the controls of SP 800-53 that both sides share. The clauses 4 to 10 of ISO/IEC 27001 are not mapped.";

/** The text of every file of the package, by its path, given the SHA-256 of each source file the proposals are in. */
export async function makePackage(sourceDigests: Readonly<Record<string, string>>): Promise<ReadonlyMap<string, string>> {
  const rows: Record<keyof typeof CROSSWALKS, readonly OutMapping[]> = { soc2: [], iso: [], hipaa: [], isoSoc2: [] };
  for (const [key, proposals] of [["soc2", SOC2_PROPOSALS], ["iso", ISO_PROPOSALS], ["hipaa", HIPAA_PROPOSALS]] as const) {
    const made = mappingsOf(proposals, CROSSWALKS[key].from, CROSSWALKS[key].to, PENDING);
    if (made.repeated.length > 0) throw new Error(`${CROSSWALKS[key].id} repeats ${made.repeated.join(", ")}`);
    rows[key] = made.mappings;
  }
  rows.isoSoc2 = composeThrough(rows.iso, rows.soc2, PENDING);
  const files = new Map<string, string>();
  const holds: { kind: string; id: string; file: string; digest: string }[] = [];
  for (const key of ["soc2", "iso", "hipaa", "isoSoc2"] as const) {
    const text = json({ ...head("grc.crosswalk", CROSSWALKS[key].id), mappings: rows[key] });
    files.set(CROSSWALK_FILES[key], text);
    holds.push({ kind: "grc.crosswalk", id: CROSSWALKS[key].id, file: CROSSWALK_FILES[key], digest: await sha256(new TextEncoder().encode(text)) });
  }
  const manifest = json({
    ...head("grc.catalog-package", "catalog-crosswalks"),
    version: "1",
    title: "Crosswalks of SOC 2, ISO/IEC 27001 and the HIPAA Security Rule to NIST SP 800-53, and of ISO/IEC 27001 to SOC 2, as proposals for a person to decide",
    source: { publisher: "Intellectual Frontiers LLC, from the catalogs of this repository", edition: `${REFERENCES.map((r) => `${r.title} (${r.status})`).join("; ")}`, url: "https://github.com/intellectual-frontiers/.github" },
    licence: LICENCE,
    redistributable: true,
    holds,
    sources: SOURCE_FILES.map((url) => ({ url, sha256: sourceDigests[url] ?? "" })),
    notice: NOTICE,
  });
  files.set("manifest.json", manifest);
  return new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The SHA-256 of the bytes of a source file, as the package records it. */
export async function digestOf(bytes: Uint8Array): Promise<string> {
  return sha256(bytes);
}
