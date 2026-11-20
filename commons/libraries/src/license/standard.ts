/**
 * The license of this repository as data: the one license every library and every part of the repository is under, the one place its identifier is written, and the standard its text is taken from
 * (commons 0035-licensing FR-001 to FR-004, 0018-standards-first FR-006 and FR-007). The text is the official PolyForm Noncommercial License 1.0.0, copied byte for byte into
 * `PolyForm-Noncommercial-1.0.0.md` beside this file from the tag `1.0.0` of the official repository, and held to the SHA-256 recorded here.
 *
 * @remarks
 * Read as data by `../license.ts` (which writes and checks every `LICENSE`), by the packer (the `license` of a package) and by the decoder of the manifest (its optional `license`). The identifier is a closed union:
 * a license is added to {@link SPDX_IDS} together with its text, never as a free string.
 *
 * Spec: 0001-libraries FR-019
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The SPDX identifiers of the licenses this repository can carry: each has its official text in this folder. */
export const SPDX_IDS = ["PolyForm-Noncommercial-1.0.0"] as const;
/** An SPDX license identifier of {@link SPDX_IDS}. */
export type SpdxId = (typeof SPDX_IDS)[number];

/** The license of every library and of the repository, unless a manifest's `license` says another of {@link SPDX_IDS}. */
export const DEFAULT_LICENSE: SpdxId = "PolyForm-Noncommercial-1.0.0";

/** An SPDX identifier from text, or why the text is none of the licenses this repository can carry. */
export function parseSpdxId(text: string): Result<SpdxId, string> {
  const found = SPDX_IDS.find((id) => id === text);
  return found === undefined ? err(`${JSON.stringify(text)} is not a license of this repository (${SPDX_IDS.join(", ")})`) : ok(found);
}

/** A standard imported as data (0018-standards-first FR-006): its issuer, name, version, location, license and the SHA-256 of what was imported. */
export type Standard = {
  readonly id: string;
  readonly issuer: string;
  readonly name: string;
  readonly version: string;
  /** Where the imported text is, at the tag that is pinned. */
  readonly location: string;
  /** What the text may be copied under (an SPDX identifier where there is one). */
  readonly license: string;
  readonly redistributable: boolean;
  /** The SHA-256 of the file in this folder, line ends as they are (they are `\n`). */
  readonly sha256: string;
  /** The file of this folder that holds the text. */
  readonly file: string;
};

/** The official text of each license, as a standard of 0018-standards-first. */
export const LICENSE_STANDARDS: Readonly<Record<SpdxId, Standard>> = {
  "PolyForm-Noncommercial-1.0.0": {
    id: "polyform-noncommercial-1.0.0",
    issuer: "The PolyForm Project",
    name: "PolyForm Noncommercial License 1.0.0",
    version: "1.0.0",
    location: "https://raw.githubusercontent.com/polyformproject/polyform-licenses/1.0.0/PolyForm-Noncommercial-1.0.0.md",
    license: "The terms of LICENSE.md of polyformproject/polyform-licenses at tag 1.0.0: a PolyForm license is copied as it is, and a change removes the name PolyForm",
    redistributable: true,
    sha256: "c0ea4a896d2c8c394b29f9427589996db826cd501c512279ff0ed3ef48fabbe5",
    file: "PolyForm-Noncommercial-1.0.0.md",
  },
};

/** The licensor named in the `Required Notice:` line of every `LICENSE` and in `NOTICE`. */
export const LICENSOR = "Intellectual Frontiers LLC";
/** The repository the `Required Notice:` line names. */
export const REPOSITORY_URL = "https://github.com/intellectual-frontiers/.github";
/** Where a commercial license is asked for. */
export const COMMERCIAL_ISSUES_URL = "https://github.com/intellectual-frontiers/.github/issues";
