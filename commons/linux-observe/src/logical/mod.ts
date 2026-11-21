// Spec: 0001-linux-observe-layers FR-001
/**
 * The Logical layer of Linux Observe: the model it reasons with.
 *
 * @module
 */
export * from "./shapes.ts";
export { architectureOf, osReleaseTable, parseDeclared, platformDrift, platformOfOsRelease } from "./platform.ts";
