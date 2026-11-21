// Spec: 0002-sp800-package FR-002, FR-003
/**
 * Where the content of the package came from: NIST's own OSCAL catalogs in `usnistgov/oscal-content`, each pinned by the commit and the SHA-256 of its file, and the licence of that repository. NIST dedicates the content to the public domain (a work of the US government) and waives
 * copyright worldwide under CC0 1.0; the text of the controls and of the assessment objectives is therefore carried in the package.
 *
 * @example
 * ```ts
 * import { SOURCES } from "./source.ts";
 * SOURCES.length; // 2
 * ```
 *
 * @module
 */

/** The repository and the commit the sources were read at. */
export const REPOSITORY = { url: "https://github.com/usnistgov/oscal-content", commit: "f0de6d8d8c059d374f15e0ae07508d82e370fc1d" } as const;

/** The licence of the repository, quoted from its `LICENSE.md` (read 2026-11-21). */
export const LICENCE =
  "Public domain: as a work of the United States government the content is in the public domain within the United States, and NIST additionally waives copyright and related rights worldwide under CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/); source: https://github.com/usnistgov/oscal-content/blob/main/LICENSE.md";

/** One source file. */
export type Source = { readonly id: "800-53" | "800-171"; readonly path: string; readonly sha256: string; readonly edition: string };

/** The two catalogs, with the SHA-256 of each file at the commit. */
export const SOURCES: readonly Source[] = [
  { id: "800-53", path: "nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json", sha256: "64ca6b4161de51ab6af098a7d101d326f14c95e1abf721396cd8a049e8115eeb", edition: "SP 800-53 Rev 5.2.0 with SP 800-53A Rev 5.2.0 assessment procedures" },
  { id: "800-171", path: "nist.gov/SP800-171/rev3/json/NIST_SP800-171_rev3_catalog.json", sha256: "fd68bad4c1fee98dd1b2511884b585fb1f14265d4c5693d0492a25dd66e73dde", edition: "SP 800-171 Rev 3 with SP 800-171A Rev 3 assessment objectives" },
];

/** The address a source is read from, at the commit. */
export const urlOf = (s: Source): string => `https://raw.githubusercontent.com/usnistgov/oscal-content/${REPOSITORY.commit}/${s.path}`;

/** The frameworks the package holds: the slug of each, its version, its title and the source it is made from. */
export const FRAMEWORKS = [
  { id: "nist-800-53", version: "5.2.0", title: "NIST SP 800-53 Rev 5.2.0: security and privacy controls", source: "800-53" },
  { id: "nist-800-53a", version: "5.2.0", title: "NIST SP 800-53A Rev 5.2.0: assessment objectives", source: "800-53" },
  { id: "nist-800-171", version: "3", title: "NIST SP 800-171 Rev 3: protecting CUI in nonfederal systems", source: "800-171" },
  { id: "nist-800-171a", version: "3", title: "NIST SP 800-171A Rev 3: assessment objectives", source: "800-171" },
] as const;

/** The time written in every document: fixed, so that the same sources give the same bytes. */
export const MADE_AT = "2026-11-21T00:00:00Z";
