// Spec: 0053-sql-typed FR-001, FR-003, FR-004, FR-007
/**
 * The typed table, column and row algebra and query builder (commons data 0053-sql-typed): typed expressions, tables with typed columns, a query builder (joins, conditions, groups, order, limit, set operations,
 * subqueries, common table expressions) and typed statements (insert, update, delete, returning), written for SQLite, DuckDB and PostgreSQL. The tables of each model are in `./models`, made from the model.
 *
 * @module
 */
export { TypedError } from "./compile.ts";
export {
  add, and, asc, avg, between, choose, coalesce, concat, count, countDistinct, countOf, desc, eq, type Expr, gt, gte, ilike, inList, isNotNull, isNull, like, lit, lower, lt, lte, max, min, mul, ne, not, notInList, type Operand, or, type Order, sub, sum, upper, type ValueOf,
} from "./expr.ts";
export { Delete, deleteFrom, excluded, Insert, insertInto, PendingDelete, PendingUpdate, type Statement, Update, update } from "./mutate.ts";
export { From, from, keyIs, type Projection, type RowOfProjection, type Runner, type Scope, Select } from "./select.ts";
export { type Column, type Columns, defineTable, type ForeignKeyInfo, type InsertOf, type NullableColumns, type RowOf, type Table, type TableSpec } from "./table.ts";

/** A timestamp as a driver gives it, or as a program writes it. */
export type Timestamp = Date | string;
