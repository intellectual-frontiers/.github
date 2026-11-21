// Spec: 0001-repoctl-layers FR-005
/**
 * The version of Repoctl, as the program says it (`repoctl --version`). The manifest names this constant in `versionConstants`, so that the release writes the new version here with the manifest and the package, and the check
 * finds it where it disagrees.
 *
 * @example
 * ```ts
 * import { REPOCTL_VERSION } from "./version.ts";
 * REPOCTL_VERSION; // "0.1.0"
 * ```
 *
 * @module
 */

/** The version of the library, which the manifest, the package and the release record say as well. */
export const REPOCTL_VERSION = "0.2.3";
