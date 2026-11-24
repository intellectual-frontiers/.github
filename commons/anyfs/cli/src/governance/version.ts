// Spec: 0001-anyfs-cli-layers FR-003
/**
 * The version of the `anyfs` program, as it says it (`anyfs --version`). The manifest names this constant in `versionConstants`, so that the release writes the version here and a check finds it where it
 * disagrees.
 *
 * @example
 * ```ts
 * import { ANYFS_CLI_VERSION } from "./version.ts";
 * ANYFS_CLI_VERSION; // "0.1.0"
 * ```
 *
 * @module
 */

/** The version of the library, which the manifest, the package and the release record say as well. */
export const ANYFS_CLI_VERSION = "0.1.0";
