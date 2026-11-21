/**
 * The rules of introspection (commons lang-sql 0008-sql-introspect FR-007): a rule is data, a code, a severity, a message and a query over the relations that gives a `node` column, so that the lint of a tree is written in the same SQL.
 *
 * Spec: 0008-sql-introspect FR-007
 *
 * @module
 */

/** A rule of diagnostics. */
export interface Rule {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  /** A query that gives one column named `node`: the id of each node that deserves the diagnostic. */
  readonly sql: string;
}

/** The rules that every parse is judged by. */
export const BUILTIN_RULES: readonly Rule[] = [
  {
    code: "delete-without-where",
    severity: "warning",
    message: "a DELETE with no WHERE deletes every row",
    sql: "SELECT n.id AS node FROM node n WHERE n.kind = 'delete' AND NOT EXISTS (SELECT 1 FROM node c WHERE c.parent = n.id AND c.field = 'where')",
  },
  {
    code: "update-without-where",
    severity: "warning",
    message: "an UPDATE with no WHERE changes every row",
    sql: "SELECT n.id AS node FROM node n WHERE n.kind = 'update' AND NOT EXISTS (SELECT 1 FROM node c WHERE c.parent = n.id AND c.field = 'where')",
  },
  {
    code: "select-star",
    severity: "info",
    message: "SELECT * reads every column, so a change of the table changes the result",
    sql: "SELECT n.id AS node FROM node n JOIN node p ON p.id = n.parent WHERE n.kind = 'star' AND p.kind = 'select-item'",
  },
  {
    code: "join-without-condition",
    severity: "warning",
    message: "a join with no ON or USING is a product of its sides",
    sql: "SELECT n.id AS node FROM node n JOIN attr t ON t.node = n.id AND t.name = 'type' JOIN attr nat ON nat.node = n.id AND nat.name = 'natural' WHERE n.kind = 'join' AND t.value <> 'cross' AND nat.value = false AND NOT EXISTS (SELECT 1 FROM node c WHERE c.parent = n.id AND (c.field = 'on' OR c.field = 'using'))",
  },
  {
    code: "unused-cte",
    severity: "warning",
    message: "a common table expression that nothing reads",
    sql: "SELECT node FROM cte WHERE uses = 0",
  },
  {
    code: "deep-nesting",
    severity: "info",
    message: "a query nested in four others is hard to read",
    sql: "SELECT n.id AS node FROM node n WHERE n.kind = 'select' AND (SELECT count(*) FROM ancestor a JOIN node p ON p.id = a.ancestor WHERE a.node = n.id AND p.kind = 'select') >= 4",
  },
  {
    code: "too-many-joins",
    severity: "info",
    message: "a statement with more than seven joins",
    sql: "SELECT min(id) AS node FROM node WHERE kind = 'join' GROUP BY stmt HAVING count(*) > 7",
  },
];
