// Spec: 0001-layers FR-009; 0002-engine FR-002
/**
 * The engine's public surface (`@intellectual-frontiers/data/engine`): the extension host every layer and every extension stands on. Only
 * the declaration of a contribution point is built; the manifest, `compose` and activation follow (commons data 0002-engine).
 *
 * @module
 */
export { type ContributionPoint, point, type PointName } from "./point.ts";
