// Spec: 0011-sql-lifecycle FR-006, FR-007, FR-008, FR-009
/**
 * Plans (commons data 0011-sql-lifecycle FR-006 to FR-009): the ordered steps that take a database from the state it is in to the state wanted. Each change is made into statements to do it and
 * to undo it, classified by what it could lose and whether it can be undone, and given the hash of the state it needs and the state it leaves, so that a step names the one database it is
 * for. What the dialect cannot do in place, and what loses data, is refused as an error value unless a person has written the step or allowed it. What extensions add is repeatable.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Composition, point } from "@intellectual-frontiers/data/engine";
import { sameWords, type Column, type LogicalId, type LogicalSchema, type Table } from "@intellectual-frontiers/data/sql/logical";
import {
  bind,
  type Dialect,
  expressor,
  type Naming,
  naming as defaultNaming,
  type PhysicalError,
  type Statement,
  type StatementSource,
  type TableClause,
  qualified,
  upsert,
  writeNames,
} from "@intellectual-frontiers/data/sql/physical";
import { applyChange, type Change, type ChangeKind, diff, type TableRef } from "./change.ts";
import { hashOf } from "./hash.ts";
import { emptyState, type State, type StateConstraint, type StateRow, stateHash, snapshotOf } from "./state.ts";

/** What a change could lose. */
export type StepClass = "safe" | "data-dependent" | "destructive" | "manual";
/** Whether a step can be undone. */
export type Reversibility = "lossless" | "quarantine" | "irreversible";

/** A query on the catalog and the answer that means a statement's work is done and it is to be skipped (0012-sql-idempotency FR-002). */
export interface Guard {
  readonly query: string;
  /** `rows`: skip the statement when the query returns a row; `none`: skip it when the query returns none. */
  readonly skipWhen: "rows" | "none";
}

/** A statement of a step, which may carry a guard. */
export type StepStatement = Statement & {
  readonly guard?: Guard;
  /** Set by whoever wrote it, where it knows the statement does no harm run twice (a restore of values). */
  readonly natural?: boolean;
};

/** How a step is safe to run twice: `natural` (every statement is), `guarded` (some are guarded and none is left) or `ledger-only` (some cannot be, so only the ledger keeps it from running twice). */
export type Idempotency = "natural" | "guarded" | "ledger-only";

/** A step: a change made into statements, from the state it needs to the state it leaves. */
export interface Step {
  /** Made of the step's content: the states, the key and the statements. */
  readonly id: string;
  /** What a person reads. */
  readonly name: string;
  readonly kind: ChangeKind;
  /** Stable for the same change; a hand-written step names it. */
  readonly key: string;
  readonly class: StepClass;
  /** Why it is not safe, where it is not. */
  readonly why?: string;
  readonly reversibility: Reversibility;
  /** The hash of the state the step needs. */
  readonly from: string;
  /** The hash of the state it leaves. */
  readonly to: string;
  readonly up: readonly StepStatement[];
  readonly down?: readonly StepStatement[];
  /** What must be true after it, which the run checks in its transaction. */
  readonly verify?: Verification;
  /** How it is safe to run twice, where an idempotency transform has said. */
  readonly idempotency?: Idempotency;
  /** Whether the table is made again and the old one dropped (0017-sql-rewrite FR-003). */
  readonly rebuild?: boolean;
  /** The change it makes, which an extension of the lifecycle reads. */
  readonly change: Change;
  /** The logical elements it is made from. */
  readonly of: readonly LogicalId[];
  /** Whether a person wrote its statements. */
  readonly manual: boolean;
}

/** A value to read before a step, to be compared after it (0015-sql-safety FR-001). */
export interface Capture {
  readonly key: string;
  /** A query that returns one row of one value. */
  readonly query: string;
}

/** What a check expects of its query: a row, no row, or the value captured under a key. */
export type Expect = "rows" | "none" | { readonly sameAs: string };

/** What must be true after a step. */
export interface Check {
  readonly describe: string;
  readonly query: string;
  readonly expect: Expect;
}

/** What a step says must be true of the database after it, checked in its transaction (0015-sql-safety FR-001). */
export interface Verification {
  readonly before?: readonly Capture[];
  readonly after: readonly Check[];
}

/** What an extension adds to the schema, applied again whenever its text changes. */
export interface Repeatable {
  readonly key: string;
  /** The hash of its text. */
  readonly hash: string;
  /** The statements that make it, applied together. */
  readonly statements: readonly Statement[];
  /** The elements it is made from: when a step changes one, it is applied again. */
  readonly of: readonly LogicalId[];
}

/** What a run needs of a step: a frozen step, read back from a file, has no more than this. */
export interface RunStep {
  readonly id: string;
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly up: readonly StepStatement[];
  readonly verify?: Verification;
  readonly of: readonly LogicalId[];
}

/** What a run needs of a plan. */
export interface RunPlan {
  readonly from: string;
  readonly to: string;
  readonly steps: readonly RunStep[];
  readonly repeatable: readonly Repeatable[];
}

/** The identifier of a step, made of what it does: the states, its key, its statements with their guards and what must be true after it. */
export const stepIdOf = (s: {
  readonly from: string;
  readonly to: string;
  readonly key: string;
  readonly up: readonly StepStatement[];
  readonly verify?: Verification | undefined;
}): string => hashOf({ from: s.from, to: s.to, key: s.key, up: s.up.map((x) => [x.sql, x.guard]), verify: s.verify });

/** A plan. */
export interface Plan {
  readonly dialect: string;
  /** The hash of the state the plan starts from. */
  readonly from: string;
  /** The hash of the state it ends in. */
  readonly to: string;
  readonly steps: readonly Step[];
  readonly repeatable: readonly Repeatable[];
}

/** What is wrong with a plan; `plan` returns all of it together. */
export type PlanError =
  | { readonly kind: "write"; readonly errors: readonly PhysicalError[] }
  | { readonly kind: "dialect"; readonly from: string; readonly to: string }
  | { readonly kind: "schema"; readonly from: string | undefined; readonly to: string | undefined }
  | { readonly kind: "refused"; readonly key: string; readonly name: string; readonly class: StepClass; readonly why: string }
  | { readonly kind: "manual"; readonly key: string; readonly name: string; readonly why: string }
  | { readonly kind: "unresolved"; readonly resolves: string }
  | { readonly kind: "not-idempotent"; readonly key: string; readonly name: string }
  | { readonly kind: "inconsistent"; readonly expected: string; readonly got: string };

/** A step a person wrote, for a change the lifecycle cannot or may not make by itself. */
export interface ManualStep {
  /** The key of the change it stands for. */
  readonly resolves: string;
  readonly name: string;
  readonly up: readonly string[];
  readonly down?: readonly string[];
  /** A guard for every statement of the step, which makes it safe to run twice. */
  readonly guard?: Guard;
}

/** What a transform is given. */
export interface PlanContext {
  readonly dialect: Dialect;
  readonly naming: Naming;
  readonly schema: LogicalSchema;
}

/** A step before it is hashed: what an extension of the lifecycle may change in it. */
export type StepDraft = Omit<Step, "id" | "from" | "to">;

/** A change an extension makes to the steps of a plan before they are hashed (idempotency, safety). */
export type StepTransform = (draft: StepDraft, context: StepContext) => StepDraft;

/** What a transform is given: the plan's context and the states a step is between, so that it can write what depends on the tables it changes (0014-sql-protected-access FR-010). */
export interface StepContext extends PlanContext {
  readonly before: State;
  readonly after: State;
}

/** What a plan is made for. */
export interface Desired {
  readonly dialect: Dialect;
  readonly naming?: Naming;
  /** The schema the tables are in (0013-sql-qualified-names). */
  readonly schema?: string;
  readonly sources?: readonly StatementSource[];
  readonly tableClauses?: readonly TableClause[];
}

/** What a plan is allowed. */
/** What an extension makes of a change that the core cannot make in place: the step's draft, or none (0017-sql-rewrite FR-001). */
export type Fallback = (
  change: Change,
  why: string,
  context: StepContext,
) => Omit<StepDraft, "name" | "kind" | "key" | "manual" | "change"> | undefined;

export interface PlanOptions {
  readonly allow?: { readonly destructive?: boolean };
  /** Makes what the core cannot make in place, such as a table that is made again. */
  readonly fallback?: Fallback;
  readonly manual?: readonly ManualStep[];
  readonly transforms?: readonly StepTransform[];
  /** Refuse, as an error value, a step that is only safe to run twice because of the ledger (0012-sql-idempotency FR-007). */
  readonly requireIdempotent?: boolean;
}

/** The contribution point an extension of the lifecycle fills to make what the core cannot make in place. */
export const fallbackPoint = point<Fallback>("lifecycle.fallback");

/**
 * The fallbacks of a composition as one: the first that makes the change wins.
 *
 * @param composition - the project's composition
 * @returns the fallback, or none where no extension contributes one
 */
export function fallbackFrom(composition: Composition): Fallback | undefined {
  const all = composition.contributions(fallbackPoint);
  return all.length === 0
    ? undefined
    : (change, why, context) => all.reduce<ReturnType<Fallback>>((made, f) => made ?? f(change, why, context), undefined);
}

/** The contribution point an extension of the lifecycle fills to change the steps of a plan before they are hashed. */
export const transformPoint = point<StepTransform>("lifecycle.transform");

/**
 * The transforms of a composition, in its order.
 *
 * @param composition - the project's composition
 * @returns the transforms its extensions contribute
 */
export const transformsFrom = (composition: Composition): readonly StepTransform[] => composition.contributions(transformPoint);

/**
 * The steps that take a database from one state to the schema wanted.
 *
 * @param from - the state the database is in; none for an empty database
 * @param schema - the logical schema wanted
 * @param desired - the dialect, the naming and what extensions add
 * @param options - what is allowed, the steps a person wrote and the transforms
 * @returns the plan, or every error
 */
export function plan(
  from: State | undefined,
  schema: LogicalSchema,
  desired: Desired,
  options: PlanOptions = {},
): Result<Plan, readonly PlanError[]> {
  const { dialect } = desired;
  const naming = desired.naming ?? defaultNaming();
  const errors: PlanError[] = [];
  const snap = snapshotOf(schema, {
    dialect,
    naming,
    ...(desired.schema === undefined ? {} : { schema: desired.schema }),
    ...(desired.tableClauses === undefined ? {} : { tableClauses: desired.tableClauses }),
  });
  if (snap.kind === "err") return err([{ kind: "write", errors: snap.error }]);
  const to = snap.value;
  const bound = bind(schema, {
    dialect,
    naming,
    ...(desired.schema === undefined ? {} : { schema: desired.schema }),
    ...(desired.sources === undefined ? {} : { sources: desired.sources }),
    ...(desired.tableClauses === undefined ? {} : { tableClauses: desired.tableClauses }),
  });
  if (bound.kind === "err") return err([{ kind: "write", errors: bound.error }]);
  if (from !== undefined && from.dialect !== to.dialect) return err([{ kind: "dialect", from: from.dialect, to: to.dialect }]);
  if (from !== undefined && from.qualifier !== to.qualifier) return err([{ kind: "schema", from: from.qualifier, to: to.qualifier }]);
  const start: State = from ?? emptyState(to.dialect, to.naming, to.qualifier);

  // the changes in the order they are made: creates in the order `bind` makes the tables
  const order = new Map<string, number>();
  bound.value.statements.forEach((s, i) => {
    if (s.origin === "core" && s.group === "table" && s.of[0] !== undefined && !order.has(s.of[0])) order.set(s.of[0], i);
  });
  const changes = [...diff(from, to)];
  const rank = (c: Change): number => (c.kind === "createTable" ? (order.get(c.table.id) ?? 0) : 0);
  changes.sort((a, b) => (a.kind === "createTable" && b.kind === "createTable" ? rank(a) - rank(b) : 0));

  const names = writeNames(schema, dialect, naming, [], desired.schema);
  const x = expressor(dialect, naming, names, []);
  const context: PlanContext = { dialect, naming, schema };
  // the state before and after each change, for the transforms
  const between: { readonly before: State; readonly after: State }[] = [];
  {
    let s = start;
    for (const c of changes) {
      const next = applyChange(s, c);
      between.push({ before: s, after: next });
      s = next;
    }
  }
  const q = (n: string): string => dialect.quote(n);
  const tableByWords = (words: readonly string[]): Table | undefined => schema.tables.find((t) => sameWords(t.name, words));
  const idOfTable = (words: readonly string[]): LogicalId[] => {
    const t = tableByWords(words);
    return t === undefined ? [] : [t.id];
  };
  const stmt = (group: Statement["group"], sql: string, of: readonly LogicalId[]): Statement => ({ group, origin: "core", sql, of });
  const can = (f: Dialect["features"][number]): boolean => dialect.features.includes(f);

  type Made = Omit<StepDraft, "name" | "kind" | "key" | "manual" | "change"> | { readonly manualNeeded: string };
  const make = (c: Change): Made => {
    const T = (t: TableRef): string => qualified(dialect, to.qualifier, t.name);
    const QI = (n: string): string => qualified(dialect, to.qualifier, n);
    const sql = (...parts: string[]): string => `${parts.join(" ")};`;
    const cols = (c2: StateConstraint): string => c2.text;
    switch (c.kind) {
      case "renameTable":
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("table", sql("ALTER TABLE", QI(c.fromName), "RENAME TO", q(c.toName)), idOfTable(c.toWords))],
          down: [stmt("table", sql("ALTER TABLE", QI(c.toName), "RENAME TO", q(c.fromName)), idOfTable(c.toWords))],
          of: idOfTable(c.toWords),
        };
      case "renameColumn":
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("table", sql("ALTER TABLE", T(c.table), "RENAME COLUMN", q(c.from.name), "TO", q(c.to.name)), [c.to.id as LogicalId])],
          down: [
            stmt("table", sql("ALTER TABLE", T(c.table), "RENAME COLUMN", q(c.to.name), "TO", q(c.from.name)), [c.to.id as LogicalId]),
          ],
          of: [c.to.id as LogicalId],
        };
      case "dropConstraint": {
        const k = c.constraint;
        const of = [k.id as LogicalId];
        if (k.kind === "index")
          return {
            class: "safe",
            reversibility: "lossless",
            up: [stmt("index", sql("DROP INDEX", QI(k.name)), of)],
            down: [stmt("index", sql("CREATE INDEX IF NOT EXISTS", q(k.name), "ON", T(c.table), `(${cols(k)})`), of)],
            of,
          };
        if (!can("add-constraint"))
          return { manualNeeded: `${dialect.name} cannot drop a constraint in place: the table must be made again` };
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("constraint", sql("ALTER TABLE", T(c.table), "DROP CONSTRAINT", q(k.name)), of)],
          down: [stmt("constraint", sql("ALTER TABLE", T(c.table), "ADD", k.text), of)],
          of,
        };
      }
      case "renameConstraint": {
        const of = [c.to.id as LogicalId];
        if (c.from.kind === "index")
          return can("add-constraint")
            ? {
                class: "safe",
                reversibility: "lossless",
                up: [stmt("index", sql("ALTER INDEX", QI(c.from.name), "RENAME TO", q(c.to.name)), of)],
                down: [stmt("index", sql("ALTER INDEX", QI(c.to.name), "RENAME TO", q(c.from.name)), of)],
                of,
              }
            : {
                class: "safe",
                reversibility: "lossless",
                up: [
                  stmt("index", sql("DROP INDEX", QI(c.from.name)), of),
                  stmt("index", sql("CREATE INDEX IF NOT EXISTS", q(c.to.name), "ON", T(c.table), `(${cols(c.to)})`), of),
                ],
                down: [
                  stmt("index", sql("DROP INDEX", QI(c.to.name)), of),
                  stmt("index", sql("CREATE INDEX IF NOT EXISTS", q(c.from.name), "ON", T(c.table), `(${cols(c.from)})`), of),
                ],
                of,
              };
        if (!can("add-constraint"))
          return {
            class: "safe",
            reversibility: "lossless",
            up: [],
            down: [],
            of,
            why: "the name is only a name: the engine keeps the one it has",
          };
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("constraint", sql("ALTER TABLE", T(c.table), "RENAME CONSTRAINT", q(c.from.name), "TO", q(c.to.name)), of)],
          down: [stmt("constraint", sql("ALTER TABLE", T(c.table), "RENAME CONSTRAINT", q(c.to.name), "TO", q(c.from.name)), of)],
          of,
        };
      }
      case "addColumn": {
        const t = tableByWords(c.table.words);
        const lc: Column | undefined = t?.columns.find((k) => sameWords(k.name, c.column.words));
        if (t === undefined || lc === undefined) return { manualNeeded: "the column is not in the schema" };
        const refusal = dialect.addColumnRefusal?.({
          type: lc.type,
          nullable: lc.nullable,
          ...(lc.default === undefined ? {} : { default: lc.default }),
        });
        if (refusal !== undefined) return { manualNeeded: refusal };
        const required = !lc.nullable && lc.default === undefined;
        const of = [lc.id];
        return {
          class: required ? "data-dependent" : "safe",
          ...(required ? { why: "the rows that are there have no value for a required column" } : {}),
          reversibility: "lossless",
          up: [stmt("table", sql("ALTER TABLE", T(c.table), "ADD COLUMN", x.columnLine(t, lc, false)), of)],
          down: [stmt("table", sql("ALTER TABLE", T(c.table), "DROP COLUMN", q(c.column.name)), of)],
          of,
        };
      }
      case "dropColumn":
        return {
          class: "destructive",
          why: `the values of ${c.table.name}.${c.column.name} are lost`,
          reversibility: "irreversible",
          up: [stmt("table", sql("ALTER TABLE", T(c.table), "DROP COLUMN", q(c.column.name)), [c.column.id as LogicalId])],
          of: [c.column.id as LogicalId],
        };
      case "alterType":
        return {
          manualNeeded: `the type of ${c.table.name}.${c.to.name} changes from ${c.from.type} to ${c.to.type}: it may lose data, so a person writes the step`,
        };
      case "alterNullable": {
        if (!can("alter-column"))
          return { manualNeeded: `${dialect.name} cannot change whether a column may be null in place: the table must be made again` };
        const of = [c.to.id as LogicalId];
        const set = (nullable: boolean): string =>
          sql("ALTER TABLE", T(c.table), "ALTER COLUMN", q(c.to.name), nullable ? "DROP NOT NULL" : "SET NOT NULL");
        return {
          class: c.to.nullable ? "safe" : "data-dependent",
          ...(c.to.nullable ? {} : { why: "the rows that are there may hold no value" }),
          reversibility: "lossless",
          up: [stmt("table", set(c.to.nullable), of)],
          down: [stmt("table", set(c.from.nullable), of)],
          of,
        };
      }
      case "alterDefault": {
        if (!can("alter-column")) return { manualNeeded: `${dialect.name} cannot change a default in place: the table must be made again` };
        const of = [c.to.id as LogicalId];
        const set = (d: string | undefined): string =>
          sql("ALTER TABLE", T(c.table), "ALTER COLUMN", q(c.to.name), d === undefined ? "DROP DEFAULT" : `SET DEFAULT ${d}`);
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("table", set(c.to.default), of)],
          down: [stmt("table", set(c.from.default), of)],
          of,
        };
      }
      case "alterPrimaryKey":
        return {
          manualNeeded: `the primary key of ${c.table.name} changes from (${c.from.join(", ")}) to (${c.to.join(", ")}): a person writes the step`,
        };
      case "alterClause":
        return {
          manualNeeded: `the clause of ${c.table.name} changes from ${c.from ?? "none"} to ${c.to ?? "none"}: a person writes the step`,
        };
      case "createTable": {
        const ids = new Set<string>([c.table.id, ...c.table.columns.map((k) => k.id), ...c.table.constraints.map((k) => k.id)]);
        const mine = bound.value.statements.filter((s) => s.origin === "core" && s.group !== "setup" && s.of.some((id) => ids.has(id)));
        return {
          class: "safe",
          reversibility: "lossless",
          up: mine.map((s) => ({ group: s.group, origin: "core" as const, sql: s.sql, of: s.of })),
          down: [stmt("table", sql("DROP TABLE", QI(c.table.name)), [c.table.id as LogicalId])],
          of: [c.table.id as LogicalId],
        };
      }
      case "addConstraint": {
        const k = c.constraint;
        const of = [k.id as LogicalId];
        if (k.kind === "index")
          return {
            class: "safe",
            reversibility: "lossless",
            up: [stmt("index", sql("CREATE INDEX IF NOT EXISTS", q(k.name), "ON", T(c.table), `(${cols(k)})`), of)],
            down: [stmt("index", sql("DROP INDEX", QI(k.name)), of)],
            of,
          };
        if (!can("add-constraint"))
          return { manualNeeded: `${dialect.name} cannot add a constraint to a table that exists: the table must be made again` };
        return {
          class: "data-dependent",
          why: "the rows that are there may not meet it",
          reversibility: "lossless",
          up: [stmt("constraint", sql("ALTER TABLE", T(c.table), "ADD", k.text), of)],
          down: [stmt("constraint", sql("ALTER TABLE", T(c.table), "DROP CONSTRAINT", q(k.name)), of)],
          of,
        };
      }
      case "upsertRows": {
        const t = to.tables.find((k) => sameWords(k.words, c.table.words));
        if (t === undefined) return { manualNeeded: "the table is not in the state wanted" };
        const colNames = t.columns.map((k) => k.name);
        const key = t.primaryKey;
        const tuple = (r: StateRow): (string | null)[] => [r.code, r.label, r.description];
        const added = c.rows.filter((r) => !c.before.some((b) => b.code === r.code));
        const of = idOfTable(c.table.words);
        return {
          class: "safe",
          reversibility: "lossless",
          up: [stmt("data", upsert(dialect, c.table.name, colNames, key, c.rows.map(tuple), to.qualifier), of)],
          down: [
            ...(added.length === 0
              ? []
              : [
                  stmt(
                    "data",
                    sql(
                      "DELETE FROM",
                      T(c.table),
                      "WHERE",
                      q(key[0] ?? ""),
                      "IN",
                      `(${added.map((r) => dialect.literal(r.code)).join(", ")})`,
                    ),
                    of,
                  ),
                ]),
            ...(c.before.length === 0
              ? []
              : [stmt("data", upsert(dialect, c.table.name, colNames, key, c.before.map(tuple), to.qualifier), of)]),
          ],
          of,
        };
      }
      case "removeRows": {
        const t = from?.tables.find((k) => sameWords(k.words, c.table.words));
        const key = t?.primaryKey[0] ?? "code";
        const of = idOfTable(c.table.words);
        return {
          class: "destructive",
          why: `the codes ${c.rows.map((r) => r.code).join(", ")} of ${c.table.name} are removed`,
          reversibility: "lossless",
          up: [
            stmt(
              "data",
              sql("DELETE FROM", T(c.table), "WHERE", q(key), "IN", `(${c.rows.map((r) => dialect.literal(r.code)).join(", ")})`),
              of,
            ),
          ],
          down: [
            stmt(
              "data",
              upsert(
                dialect,
                c.table.name,
                t?.columns.map((k) => k.name) ?? [],
                t?.primaryKey ?? [],
                c.rows.map((r) => [r.code, r.label, r.description]),
              ),
              of,
            ),
          ],
          of,
        };
      }
      case "dropTable":
        return {
          class: "destructive",
          why: `the table ${c.table.name} and its rows are lost`,
          reversibility: "irreversible",
          up: [stmt("table", sql("DROP TABLE", QI(c.table.name)), [c.table.id as LogicalId])],
          of: [c.table.id as LogicalId],
        };
    }
  };
  const nameOf = (c: Change): string => {
    switch (c.kind) {
      case "renameTable":
        return `rename table ${c.fromName} to ${c.toName}`;
      case "renameColumn":
        return `rename column ${c.table.name}.${c.from.name} to ${c.to.name}`;
      case "dropConstraint":
        return `drop ${c.constraint.kind} ${c.constraint.name} of ${c.table.name}`;
      case "renameConstraint":
        return `rename ${c.from.kind} ${c.from.name} of ${c.table.name} to ${c.to.name}`;
      case "addColumn":
        return `add column ${c.table.name}.${c.column.name}`;
      case "dropColumn":
        return `drop column ${c.table.name}.${c.column.name}`;
      case "alterType":
        return `change the type of ${c.table.name}.${c.to.name}`;
      case "alterNullable":
        return `${c.to.nullable ? "allow" : "refuse"} null in ${c.table.name}.${c.to.name}`;
      case "alterDefault":
        return `change the default of ${c.table.name}.${c.to.name}`;
      case "alterPrimaryKey":
        return `change the primary key of ${c.table.name}`;
      case "alterClause":
        return `change the clause of ${c.table.name}`;
      case "createTable":
        return `create table ${c.table.name}`;
      case "addConstraint":
        return `add ${c.constraint.kind} ${c.constraint.name} to ${c.table.name}`;
      case "upsertRows":
        return `load the rows of ${c.table.name}`;
      case "removeRows":
        return `remove rows of ${c.table.name}`;
      case "dropTable":
        return `drop table ${c.table.name}`;
    }
  };

  const handWritten =
    (of: readonly LogicalId[], guard: Guard | undefined) =>
    (s: string): StepStatement => ({
      ...stmt("table", s.trim().endsWith(";") ? s.trim() : `${s.trim()};`, of),
      ...(guard === undefined ? {} : { guard }),
    });
  const manual = new Map((options.manual ?? []).map((m) => [m.resolves, m]));
  const used = new Set<string>();
  const drafts: { readonly draft: StepDraft; readonly change: Change }[] = [];
  for (const [index, c] of changes.entries()) {
    const sc: StepContext = { ...context, ...(between[index] ?? { before: start, after: start }) };
    let made = make(c);
    if ("manualNeeded" in made && options.fallback !== undefined && !manual.has(c.key)) {
      const f = options.fallback(c, made.manualNeeded, sc);
      if (f !== undefined) made = f;
    }
    const base = { kind: c.kind, key: c.key, name: nameOf(c) };
    const m = manual.get(c.key);
    if (m !== undefined) {
      used.add(c.key);
      const of = "of" in made ? made.of : [];
      let written: StepDraft = {
        ...base,
        name: m.name,
        class: "manual",
        why: "written by a person",
        reversibility: m.down === undefined ? "irreversible" : "lossless",
        up: m.up.map(handWritten(of, m.guard)),
        ...(m.down === undefined ? {} : { down: m.down.map(handWritten(of, m.guard)) }),
        ...(m.guard === undefined ? {} : { idempotency: "guarded" as const }),
        change: c,
        of,
        manual: true,
      };
      for (const t of options.transforms ?? []) written = t(written, sc);
      if (options.requireIdempotent === true && written.idempotency === "ledger-only")
        errors.push({ kind: "not-idempotent", key: written.key, name: written.name });
      drafts.push({ change: c, draft: written });
      continue;
    }
    if ("manualNeeded" in made) {
      errors.push({ kind: "manual", key: c.key, name: base.name, why: made.manualNeeded });
      continue;
    }
    let draft: StepDraft = { ...base, ...made, change: c, manual: false };
    for (const t of options.transforms ?? []) draft = t(draft, sc);
    // what a transform has made safe is not refused
    if (draft.class === "destructive" && options.allow?.destructive !== true)
      errors.push({ kind: "refused", key: c.key, name: base.name, class: draft.class, why: draft.why ?? "it loses data" });
    if (options.requireIdempotent === true && draft.idempotency === "ledger-only")
      errors.push({ kind: "not-idempotent", key: draft.key, name: draft.name });
    drafts.push({ change: c, draft });
  }
  for (const k of manual.keys()) if (!used.has(k)) errors.push({ kind: "unresolved", resolves: k });

  // the states between the steps, and the hash of each step
  const toHash = stateHash(to);
  const steps: Step[] = [];
  let state = start;
  let at = stateHash(state);
  const fromHash = at;
  drafts.forEach(({ draft, change }, i) => {
    state = applyChange(state, change);
    const last = i === drafts.length - 1;
    const next = stateHash(last ? { ...state, naming: to.naming } : state);
    const id = stepIdOf({ from: at, to: next, key: draft.key, up: draft.up, verify: draft.verify });
    steps.push({ ...draft, id, from: at, to: next });
    at = next;
  });
  if (errors.length === 0 && at !== toHash && !(drafts.length === 0 && stateHash({ ...start, naming: to.naming }) === toHash))
    errors.push({ kind: "inconsistent", expected: toHash, got: at });
  if (errors.length > 0) return err(errors);

  // what extensions add, and the setup, which are applied again when their text changes: the statements of one group that are made from the same elements are one unit
  const units = new Map<string, { statements: Statement[]; of: Set<LogicalId> }>();
  for (const s of bound.value.statements) {
    if (!(s.origin === "extension" || s.group === "setup")) continue;
    const key = `${s.group}:${s.of.join(",")}`;
    const unit = units.get(key) ?? { statements: [], of: new Set<LogicalId>() };
    unit.statements.push(s);
    for (const id of s.of) unit.of.add(id);
    units.set(key, unit);
  }
  const repeatable: Repeatable[] = [...units].map(([key, u]) => ({
    key,
    hash: hashOf(u.statements.map((x) => x.sql)),
    statements: u.statements,
    of: [...u.of],
  }));
  return ok({ dialect: dialect.name, from: fromHash, to: toHash, steps, repeatable });
}

/**
 * The repeatable objects that are due: those whose text is not the one last applied, and those that are made from an element a step has just changed.
 *
 * @param repeatable - the plan's repeatable objects
 * @param applied - the hash last applied, by key
 * @param touched - the elements the steps of this run changed
 * @returns those to apply, in the plan's order
 */
export const dueRepeatables = (
  repeatable: readonly Repeatable[],
  applied: ReadonlyMap<string, string>,
  touched: ReadonlySet<string> = new Set(),
): readonly Repeatable[] => repeatable.filter((r) => applied.get(r.key) !== r.hash || r.of.some((id) => touched.has(id)));
