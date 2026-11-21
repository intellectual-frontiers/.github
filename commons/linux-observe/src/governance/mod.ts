// Spec: 0001-linux-observe-layers FR-001
/**
 * The Governance layer of Linux Observe: what kind of machine a Linux machine is.
 *
 * @module
 */
export { ARCHITECTURES, FAMILIES, FAMILY_OF_ID, familyOf } from "./platform.ts";
export type { Architecture, Declared, Family, Observed } from "./platform.ts";
