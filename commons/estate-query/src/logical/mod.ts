// Spec: 0001-estate-query-layers FR-001
/**
 * The Logical layer of Estate Query: the relations built from what an estate holds, and the question asked of them.
 *
 * @module
 */
export { fromSnapshot, tablesOf } from "./data.ts";
export type { AssessmentLike, EstateData, SnapshotLike, Tables } from "./data.ts";
export { CATALOG, DEFAULT_BUDGET, formatTable, openEstateQuery } from "./query.ts";
export type { Budget, EstateQuery, Live, QueryProblem } from "./query.ts";
