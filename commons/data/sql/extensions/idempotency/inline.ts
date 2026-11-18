// Spec: 0012-sql-idempotency FR-008
/**
 * A guard in plain SQL (commons data 0012-sql-idempotency FR-008): where the dialect has a procedural block, a guarded statement is written as one block that runs the statement only if its guard
 * says so, so that a script that no runner reads still does no harm run twice. Where it has none, the answer says so and the statement is not written.
 *
 * @module
 */
import type { StepStatement } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";

/** A statement written as plain SQL, or why it cannot be. */
export type Inline = { readonly kind: "sql"; readonly sql: string } | { readonly kind: "refused"; readonly why: string };

const TAG = "$ifc_guard$";

/**
 * A statement as plain SQL that is safe to run twice.
 *
 * @param statement - the statement, guarded or not
 * @param dialect - the dialect
 * @returns the SQL, or why the dialect cannot carry the guard
 */
export function guardInline(statement: StepStatement, dialect: Dialect): Inline {
  const guard = statement.guard;
  if (guard === undefined) return { kind: "sql", sql: statement.sql };
  if (!dialect.features.includes("routines"))
    return {
      kind: "refused",
      why: `${dialect.name} has no procedural block to carry a guard: run the statement from a runner that honours it`,
    };
  if (statement.sql.includes(TAG) || guard.query.includes(TAG)) return { kind: "refused", why: `the statement holds ${TAG}` };
  const test = `${guard.skipWhen === "rows" ? "NOT " : ""}EXISTS (${guard.query})`;
  return {
    kind: "sql",
    sql: `DO ${TAG}\nBEGIN\n    IF ${test} THEN\n        EXECUTE ${dialect.literal(statement.sql)};\n    END IF;\nEND\n${TAG};`,
  };
}
