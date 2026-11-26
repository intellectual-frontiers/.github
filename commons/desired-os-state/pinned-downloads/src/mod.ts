// Spec: 0001-pinned-downloads-layers FR-003
/**
 * The default dialect of tools: it obtains the programs a computer needs as their publishers released them, pinned by the SHA-256 of the artifact, into a folder of the user's own, with no
 * administrator rights and no package manager, and builds nothing from source.
 *
 * @module
 */
export * from "./dialect.ts";
export * from "./observe.ts";
export * from "./pin.ts";
export * from "./plan-file.ts";
export * from "./steps.ts";
export * from "./store.ts";
export { describeInstallError, programFile, unpackVerified, type InstallError, type InstallSpec, type Os } from "./install.ts";
