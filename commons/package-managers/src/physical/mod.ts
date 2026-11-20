// Spec: 0001-package-managers-layers FR-001
/**
 * Physical: the dialect of a manager and the runner that asks a program something under a limit of time.
 *
 * @module
 */
export * from "./dialect.ts";
export * from "./runner.ts";
export { main as program, type Io } from "./bin.ts";
