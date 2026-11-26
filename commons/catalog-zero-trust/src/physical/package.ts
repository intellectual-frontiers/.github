// Spec: 0002-zero-trust-package FR-002, FR-003, FR-004, FR-005
/**
 * The files of the package (0002-zero-trust-package FR-002, FR-003, FR-004, FR-005): from the entries to the text of each file, with the manifest's digests, and the folder where they are kept. Making is pure; reading and writing the folder is the tool's.
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
import { CROSSWALK, FRAMEWORKS, GOALS, INPUTS, LICENCE, MADE_AT, PILLARS, PILLAR_STAGES, PROPOSALS, REFERENCES, SOURCE_FILES, STAGES, STARTS, TARGETS, TENETS, THEMES, THEME_STAGES, FUNCTIONS } from "@intellectual-frontiers/catalog-zero-trust/governance";
import { convert, mappingsOf } from "@intellectual-frontiers/catalog-zero-trust/logical";

/** The folder of the package: the one the loader of grc reads. */
export const PACKAGE_DIR: string = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "data");

const head = (kind: string, id: string): Record<string, unknown> => ({ kind, schema: "1", id, createdAt: MADE_AT, provenance: { producer: { name: "catalog-zero-trust", version: "1" }, inputs: SOURCE_FILES } });
const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** The path of each framework's file inside the package. */
export const FRAMEWORK_FILES = {
  sp800207: `frameworks/${FRAMEWORKS.sp800207.id}-${FRAMEWORKS.sp800207.version}.json`,
  ztmm: `frameworks/${FRAMEWORKS.ztmm.id}-${FRAMEWORKS.ztmm.version}.json`,
  m2209: `frameworks/${FRAMEWORKS.m2209.id}-${FRAMEWORKS.m2209.version}.json`,
} as const;
/** The path of the crosswalk's file inside the package. */
export const CROSSWALK_FILE = `crosswalks/${CROSSWALK.id}.json`;

/** What a manifest says about the content that is not there. */
export const NOTICE =
  "The stages and the activities of the Department of Defense zero trust model are not in this package: its source has not been read. The rows of the crosswalk are proposals that each carry the words person-decision-required: the published mapping of the example architecture has not been read, and a row that still carries them is not counted.";

/** The text of every file of the package, by its path, given the SHA-256 of each source file the entries are in. */
export async function makePackage(sourceDigests: Readonly<Record<string, string>>): Promise<ReadonlyMap<string, string>> {
  const sets = {
    sp800207: [...TENETS, ...INPUTS],
    ztmm: [...STAGES, ...PILLARS, ...THEMES, ...FUNCTIONS, ...PILLAR_STAGES, ...THEME_STAGES],
    m2209: GOALS,
  } as const;
  const files = new Map<string, string>();
  const holds: { kind: string; id: string; file: string; digest: string }[] = [];
  for (const key of ["sp800207", "ztmm", "m2209"] as const) {
    const c = convert(sets[key]);
    if (c.repeated.length > 0) throw new Error(`${FRAMEWORKS[key].id} repeats ${c.repeated.join(", ")}`);
    const text = json({ ...head("grc.framework", FRAMEWORKS[key].id), version: FRAMEWORKS[key].version, title: FRAMEWORKS[key].title, controls: c.controls, publisher: REFERENCES[key].publisher, source: REFERENCES[key].url });
    files.set(FRAMEWORK_FILES[key], text);
    holds.push({ kind: "grc.framework", id: FRAMEWORKS[key].id, file: FRAMEWORK_FILES[key], digest: await sha256(new TextEncoder().encode(text)) });
  }
  const made = mappingsOf(PROPOSALS, STARTS, CROSSWALK.pending, TARGETS);
  if (made.unknown.length > 0) throw new Error(`the proposals start from frameworks the package does not hold: ${made.unknown.join(", ")}`);
  const crosswalk = json({ ...head("grc.crosswalk", CROSSWALK.id), mappings: made.mappings });
  files.set(CROSSWALK_FILE, crosswalk);
  holds.push({ kind: "grc.crosswalk", id: CROSSWALK.id, file: CROSSWALK_FILE, digest: await sha256(new TextEncoder().encode(crosswalk)) });
  const manifest = json({
    ...head("grc.catalog-package", "catalog-zero-trust"),
    version: "1",
    title: "Zero trust: the tenets of SP 800-207, the CISA maturity model 2.0 and the goals of OMB M-22-09, in our own words, with a crosswalk to SP 800-53 and SP 800-171",
    source: {
      publisher: "Intellectual Frontiers LLC, reading the publications of NIST, CISA and OMB",
      edition: [REFERENCES.sp800207, REFERENCES.ztmm, REFERENCES.m2209].map((r) => `${r.edition}, read on ${r.readOn}, ${r.url}`).join("; "),
      url: REFERENCES.ztmm.url,
    },
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
