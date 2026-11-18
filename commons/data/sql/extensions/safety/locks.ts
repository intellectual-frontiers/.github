// Spec: 0015-sql-safety FR-008, FR-009
/**
 * Lock discipline (commons data 0015-sql-safety FR-008, FR-009): a step that changes a table asks for its locks with a timeout and runs with a limit, the run tries it again when the engine gives up
 * on a lock, and a constraint is added without checking the rows that are there and checked in a statement of its own, so that the strongest lock is held for a short time.
 *
 * @module
 */
import type { StepDraft, StepStatement, StepTransform } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import type { Safety } from "./settings.ts";

const CHANGES = new Set([
  "renameTable",
  "renameColumn",
  "addColumn",
  "dropColumn",
  "dropTable",
  "alterType",
  "alterNullable",
  "alterDefault",
  "addConstraint",
  "dropConstraint",
  "alterPrimaryKey",
]);

/** The transform that asks for locks with a timeout. */
export function lockTimeouts(settings: Safety): StepTransform {
  return (draft, context): StepDraft => {
    if (!settings.locks || !CHANGES.has(draft.kind) || context.dialect.locks === undefined) return draft;
    const set: readonly StepStatement[] = context.dialect.locks
      .timeouts(settings.lockTimeoutMs, settings.statementTimeoutMs)
      .map((sql) => ({ group: "table", origin: "core", sql, of: [] }));
    return { ...draft, up: [...set, ...draft.up], ...(draft.down === undefined ? {} : { down: [...set, ...draft.down] }) };
  };
}

/** The transform that adds a foreign key or a check without checking the rows and then checks them. */
export function validateLater(settings: Safety): StepTransform {
  return (draft, context): StepDraft => {
    const c = draft.change;
    if (!settings.validateLater || c.kind !== "addConstraint" || context.dialect.deferredValidation !== true) return draft;
    if (c.constraint.kind !== "foreignKey" && c.constraint.kind !== "check") return draft;
    const q = context.dialect.quote;
    const table = context.after.qualifier === undefined ? q(c.table.name) : `${q(context.after.qualifier)}.${q(c.table.name)}`;
    const up = draft.up.flatMap((s): readonly StepStatement[] =>
      /ADD CONSTRAINT/.test(s.sql)
        ? [
            { ...s, sql: s.sql.replace(/;$/, " NOT VALID;") },
            { group: "constraint", origin: "core", sql: `ALTER TABLE ${table} VALIDATE CONSTRAINT ${q(c.constraint.name)};`, of: s.of },
          ]
        : [s],
    );
    return { ...draft, up };
  };
}

/**
 * What `execute` is given to try a step again when the engine gives up on a lock.
 *
 * @param dialect - the dialect
 * @param settings - the settings
 * @returns the retry, or none where the dialect has no locks with a timeout or the feature is off
 */
export function lockRetry(
  dialect: Dialect,
  settings: Safety,
): { readonly attempts: number; readonly delayMs: number; readonly when: (message: string) => boolean } | undefined {
  const locks = dialect.locks;
  return settings.locks && locks !== undefined
    ? { attempts: settings.attempts, delayMs: settings.delayMs, when: (m) => locks.timedOut(m) }
    : undefined;
}
