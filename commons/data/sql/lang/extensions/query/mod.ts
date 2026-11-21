/**
 * Queries over a syntax tree (commons data 0067-sql-ast-tools FR-005 to FR-008): an index from each node to its parent, lazy typed selections of nodes (`select(root).find("table").where(...)`), and a few named
 * analyses that are the questions asked of SQL most: which tables a script reads and writes, which functions it calls, and whether it is read-only. An extension of the SQL language core: it imports the core and
 * nothing else.
 *
 * @remarks
 * A selection is lazy and can be read again: each method makes a new selection over what the last one gives, and nothing is read until an end (`toArray`, `first`, `count`, `some`, `every`) or a loop asks.
 * The kind a method is given types what comes out: `find("table")` is a selection of table references.
 *
 * @limits
 * Names are not resolved to the columns or tables they come from; the only scope rule is that of common table expressions.
 *
 * @example
 * ```ts
 * const { script } = parse("WITH a AS (SELECT 1) SELECT * FROM a JOIN t ON TRUE");
 * select(script).find("table").map((t) => t.name).toArray().length; // 2: a and t
 * tableUses(script).map((u) => u.name.join(".")); // ["t"]: a is a common table expression
 * ```
 *
 * Spec: 0067-sql-ast-tools FR-005, FR-006, FR-007, FR-008
 *
 * @module
 */
export { type ParentIndex, ancestors, parentIndex, parentOf } from "./parents.ts";
export { Selection, select } from "./selection.ts";
export { type FunctionCall, functionsCalled, readOnlyProblem, type TableAccess, type TableUse, tableUses } from "./analysis.ts";
