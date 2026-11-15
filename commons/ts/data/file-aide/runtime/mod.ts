/**
 * The parts of File Aide that reach the host through IFC TypeScript's runtime: the `posix` driver (commons 0010-file-aide FR-017). A
 * harness imports this module beside `file-aide/mod.ts` where it reaches a folder of the computer.
 *
 * @module
 */
export { posixStore, TEMPORARY } from "./posix.ts";
export type { PosixCapability } from "./posix.ts";
