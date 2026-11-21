// Spec: 0001-estate-query-layers FR-001
/**
 * The Governance layer of Estate Query: what the relations of an estate are.
 *
 * @module
 */
export { RELATIONS, relationNamed } from "./relations.ts";
export type { Column, ColumnType, Relation } from "./relations.ts";
export { LIVE_STATUS, OSQUERY_PREFIX, OSQUERY_TABLES, osqueryRelation, osquerySelect, osqueryTablesNamed } from "./osquery.ts";
export type { OsqueryTable } from "./osquery.ts";
