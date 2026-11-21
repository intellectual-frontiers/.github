// Spec: 0002-csf2-package FR-002, FR-003
/**
 * Where the content of the package came from (0002-csf2-package FR-002, FR-003): the publisher, the edition, the address and the SHA-256 of the one source file, and the licence wording. A change of any of them is a change of the package.
 *
 * @example
 * ```ts
 * import { SOURCE } from "./source.ts";
 * SOURCE.sha256.length; // 64
 * ```
 *
 * @module
 */

/** The source the package is made from, as data. */
export const SOURCE = {
  publisher: "National Institute of Standards and Technology (NIST)",
  edition: "Cybersecurity Framework 2.0 (CSWP 29)",
  url: "https://csrc.nist.gov/extensions/nudp/services/json/nudp/framework/version/csf_2_0_0/export/json?element=all",
  sha256: "de36759d2f3f70a0f28ab9a95505259e568467923295a13d510a068939773e5a",
  /** The wording of https://www.nist.gov/oism/copyrights, read on 2026-11-21, which applies to the information on NIST's sites. */
  licence:
    "Public information of the United States government (NIST): with the exception of material marked as copyrighted, information presented on NIST sites is considered public information and may be distributed or copied; use of an appropriate byline is requested (https://www.nist.gov/oism/copyrights). Source: NIST Cybersecurity Framework 2.0.",
} as const;

/** The framework's identifier and version in the URN of a control: `urn:grc:nist-csf:2.0:GV.OC-01`. */
export const FRAMEWORK = { id: "nist-csf", version: "2.0", title: "NIST Cybersecurity Framework 2.0" } as const;

/** The time written in every document: fixed, so that the same source gives the same bytes. */
export const MADE_AT = "2026-11-21T00:00:00Z";
