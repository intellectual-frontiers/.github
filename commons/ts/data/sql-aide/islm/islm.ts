/**
 * ISLM, the information schema lifecycle manager (commons 0009-sql-aide FR-035 to FR-040): the model is the state wanted, the catalog
 * is the state found, and a plan is what differs, each change classified as idempotent or not. A plan is written as a script for a
 * person to read and is applied only when asked, through a runner, each step recorded in an append-only ledger in the database itself;
 * a step already applied is not applied again. ISLM goes forward only: an undo is a new step that names the step it reverses. It needs
 * nothing outside the library, in PostgreSQL, SQLite and DuckDB.
 *
 * What a plan compares: whether each table, column, view and index is there, and whether each column may be null. It does not compare
 * types, keys, checks or foreign keys of a table that exists; a change of those is a step a person writes. Routines, triggers, policies
 * and the other objects are applied again when their definition changes, which the ledger's hash tells.
 *
 * @module
 */
import { err, ok, type Result, type Sha256, sha256 } from "../../../kernel/mod.ts";
import { integer, oneOf, text, timestamptz } from "../algebra/column.ts";
import type { ColumnSpec } from "../algebra/column.ts";
import { table, type TableSpec } from "../algebra/table.ts";
import type { Dialect, EmitContext } from "../emit/context.ts";
import { type AnySql, bind, type DialectOf, type DxOf, type Fits, name, renderUnchecked, type ReqOf, SQL } from "../emit/sql.ts";
import { lineageTable } from "../integrate/lineage.ts";
import { type Entity, type EntityName, ordered } from "../model/entity.ts";
import type { Runner } from "../test/assert.ts";
import { type Catalog, LEDGER } from "./catalog.ts";

/** Whether a change may be run on every apply (it makes or replaces what it defines) or changes structure or data that exists. */
export type Classification = "idempotent" | "non-idempotent";

/** What a change does. */
export type ChangeKind =
  "create" | "replace" | "add-column" | "drop-column" | "set-not-null" | "drop-not-null" | "drop" | "drop-index" | "step";

/** A step a person writes: SQL with a name, applied once. */
export interface Step<Q extends AnySql = AnySql> {
  /** The step's name, unique in the project: a date and a few words is the usual form. */
  readonly name: string;
  /** What it runs. */
  readonly sql: Q;
  /** Whether it may be run again. */
  readonly classification: Classification;
  /** Whether it destroys data. */
  readonly destructive: boolean;
  /** Whether it can run in a transaction. */
  readonly transactional: boolean;
  /** The step it reverses, for an undo. */
  readonly reverses?: string;
}

/**
 * A step written by hand: a data change, or a change of structure a plan does not make (a type, a key). Non-idempotent unless said.
 *
 * @param stepName - its name
 * @param sql - what it runs
 * @param options - whether it is idempotent, destroys data, or cannot run in a transaction
 */
export function step<const Q extends AnySql>(
  stepName: string,
  sql: Q,
  options: { readonly classification?: Classification; readonly destructive?: boolean; readonly transactional?: boolean } = {},
): Step<Q> {
  return {
    name: stepName,
    sql,
    classification: options.classification ?? "non-idempotent",
    destructive: options.destructive ?? false,
    transactional: options.transactional ?? true,
  };
}

/**
 * The undo of a step: a new step that names the one it reverses (FR-038). Nothing is removed from the ledger; both are kept.
 *
 * @param stepName - the undo's own name
 * @param reverses - the name of the step it reverses
 * @param sql - what it runs
 */
export function undo<const Q extends AnySql>(
  stepName: string,
  reverses: string,
  sql: Q,
  options: { readonly destructive?: boolean } = {},
): Step<Q> {
  return { ...step(stepName, sql, options), reverses };
}

/** One change of a plan, rendered for its dialect. */
export interface Change {
  /** The name it is recorded under in the ledger. */
  readonly step: string;
  /** What it does. */
  readonly what: ChangeKind;
  /** Whether it may be run on every apply. */
  readonly classification: Classification;
  /** Whether it destroys data. */
  readonly destructive: boolean;
  /** Whether it can run in a transaction (`CREATE INDEX CONCURRENTLY` cannot). */
  readonly transactional: boolean;
  /** The SQL. */
  readonly text: string;
  /** The SHA-256 of the SQL. */
  readonly hash: Sha256;
  /** The step it reverses, for an undo. */
  readonly reverses?: string;
}

/** A plan: the changes that make a database what the model says, in order, and what differs that no change of it makes. */
export interface Plan {
  /** The dialect it is rendered for. */
  readonly dialect: string;
  /** The changes. */
  readonly changes: readonly Change[];
  /** Differences the plan does not change, each in one sentence, for a person to write a step for. */
  readonly unplanned: readonly string[];
}

/** What the model is: its entities, and the steps written by hand. */
export interface Desired<E extends readonly Entity[], S extends readonly Step[]> {
  /** The entities. */
  readonly entities: E;
  /** The steps, in the order they are applied, after the entities' changes. */
  readonly steps?: S;
}

function isTable(e: Entity): e is Entity & { readonly spec: TableSpec } {
  return e.entity === "table" && "spec" in e;
}
function isIndex(
  e: Entity,
): e is Entity & { readonly nameIn: (ctx: EmitContext) => string; readonly isConcurrent: boolean; readonly table: EntityName } {
  return e.entity === "index" && "nameIn" in e && "isConcurrent" in e && "table" in e;
}
function isView(e: Entity): e is Entity & { readonly materialized: boolean } {
  return e.entity === "view" && "materialized" in e;
}

const ident = (ctx: EmitContext, ...parts: readonly string[]): string => renderUnchecked(name(...parts), ctx);

/** The column of an added column: its type, whether it may be null, and its default. Its references and checks are not added. */
function columnLine(ctx: EmitContext, n: string, c: ColumnSpec): string {
  let line = `${ident(ctx, ctx.naming.column(n))} ${ctx.dialect.typeOf(c.domain)}`;
  if (!c.nullable) line += " NOT NULL";
  if (c.default !== undefined) line += ` DEFAULT ${renderUnchecked(c.default, ctx)}`;
  return line;
}

const LIBRARY_TABLES = new Set([LEDGER, "ifcsql_lineage"]);

/**
 * Makes a plan: the changes that bring a database from what its catalog says to what the model says (FR-035, FR-036). A table, view or
 * index that is not there is made (idempotent); a column added, dropped or changed in whether it may be null is a non-idempotent
 * change; any other entity is applied where the ledger has not applied its definition as it is now. The steps written by hand follow,
 * each where the ledger has not applied it as it is now (FR-037). The model must fit the context, or the call does not compile.
 *
 * @param desired - the model's entities and steps
 * @param catalog - what the database holds, from {@link inspect}
 * @param ctx - the context of the database's dialect
 */
export async function plan<
  const E extends readonly Entity[],
  const S extends readonly Step[] = readonly [],
  C extends EmitContext = EmitContext,
>(
  desired: Desired<E, S>,
  catalog: Catalog,
  ctx: C & Fits<DialectOf<C>, ReqOf<E[number]["ddl"]> | ReqOf<S[number]["sql"]>, DxOf<E[number]["ddl"] | S[number]["sql"]>>,
): Promise<Plan> {
  const sorted = ordered(desired.entities);
  if (sorted.kind === "err") throw new Error(`entities need each other in a circle: ${sorted.error.entities.join(", ")}`);
  const changes: Change[] = [];
  const unplanned: string[] = [];
  const add = async (
    stepName: string,
    what: ChangeKind,
    classification: Classification,
    textOf: string,
    flags: { readonly destructive?: boolean; readonly transactional?: boolean; readonly reverses?: string } = {},
  ): Promise<void> => {
    changes.push({
      step: stepName,
      what,
      classification,
      destructive: flags.destructive ?? false,
      transactional: flags.transactional ?? true,
      text: textOf,
      hash: await sha256(textOf),
      ...(flags.reverses === undefined ? {} : { reverses: flags.reverses }),
    });
  };
  const keyOf = (n: string, schema: string | undefined): { readonly key: string; readonly parts: readonly string[] } => {
    const parts = ctx.naming.table(n, schema);
    return { key: `${parts.length > 1 ? (parts[0] ?? catalog.defaultSchema) : catalog.defaultSchema}.${parts.at(-1) ?? n}`, parts };
  };
  const modelled = new Set<string>();
  for (const e of sorted.value) {
    const ddl = (): string => renderUnchecked(e.ddl, ctx);
    if (isTable(e)) {
      const { key, parts } = keyOf(e.name, e.schema);
      modelled.add(key);
      const found = catalog.tables.get(key);
      if (found === undefined) {
        await add(`table:${key}`, "create", "idempotent", ddl());
        continue;
      }
      const t = ident(ctx, ...parts);
      const columnChangesFrom = changes.length;
      const wanted = new Set(e.spec.columns.map(([n]) => ctx.naming.column(n)));
      for (const [n, c] of e.spec.columns) {
        const cn = ctx.naming.column(n);
        const has = found.get(cn);
        if (has === undefined) {
          if (c.identity) unplanned.push(`${key}.${cn} is numbered by the database and is not there: a step must add it`);
          else
            await add(`column:${key}.${cn}:add`, "add-column", "non-idempotent", `ALTER TABLE ${t} ADD COLUMN ${columnLine(ctx, n, c)};`);
          continue;
        }
        if (c.identity || has.notNull === !c.nullable) continue;
        if (ctx.dialect.name === "sqlite") {
          unplanned.push(
            `${key}.${cn} ${c.nullable ? "refuses" : "allows"} null, and SQLite cannot change that in place: a step must rebuild the table`,
          );
          continue;
        }
        const set = c.nullable ? "DROP NOT NULL" : "SET NOT NULL";
        await add(
          `column:${key}.${cn}:${c.nullable ? "drop-not-null" : "set-not-null"}`,
          c.nullable ? "drop-not-null" : "set-not-null",
          "non-idempotent",
          `ALTER TABLE ${t} ALTER COLUMN ${ident(ctx, cn)} ${set};`,
        );
      }
      for (const cn of found.keys())
        if (!wanted.has(cn))
          await add(`column:${key}.${cn}:drop`, "drop-column", "non-idempotent", `ALTER TABLE ${t} DROP COLUMN ${ident(ctx, cn)};`, {
            destructive: true,
          });
      // DuckDB will not change a column of a table that has an index, so its indexes are dropped first and the model's made again after
      const altered = changes.slice(columnChangesFrom).some((c) => c.what !== "add-column");
      const onTable = [...catalog.indexes].filter(([, tk]) => tk === key).map(([ik]) => ik);
      if (ctx.dialect.name === "duckdb" && altered && onTable.length > 0) {
        const alters = changes.splice(columnChangesFrom);
        for (const ik of onTable) {
          const [schema = catalog.defaultSchema, ...rest] = ik.split(".");
          await add(
            `index:${ik}:drop-before-alter`,
            "drop-index",
            "non-idempotent",
            `DROP INDEX IF EXISTS ${ident(ctx, schema, rest.join("."))};`,
          );
        }
        changes.push(...alters);
        for (const other of sorted.value)
          if (isIndex(other) && keyOf(other.table.name, other.table.schema).key === key) {
            const ik = `${key.split(".")[0] ?? catalog.defaultSchema}.${other.nameIn(ctx)}`;
            if (onTable.includes(ik)) await add(`index:${ik}`, "create", "idempotent", renderUnchecked(other.ddl, ctx));
          }
      }
      continue;
    }
    if (isIndex(e)) {
      const schema = keyOf(e.name, e.schema).key.split(".")[0] ?? catalog.defaultSchema;
      const key = `${schema}.${e.nameIn(ctx)}`;
      if (!catalog.indexes.has(key)) await add(`index:${key}`, "create", "idempotent", ddl(), { transactional: !e.isConcurrent });
      continue;
    }
    const text0 = ddl();
    const stepName = `${e.entity}:${keyOf(e.name, e.schema).key}`;
    if (isView(e)) {
      const { key } = keyOf(e.name, e.schema);
      modelled.add(key);
      if (!catalog.views.has(key)) await add(stepName, "create", "idempotent", text0);
      else if (catalog.applied.get(stepName) !== (await sha256(text0)))
        if (e.materialized) unplanned.push(`${key} is a materialized view whose definition may differ: a step must drop and make it again`);
        else await add(stepName, "replace", "idempotent", text0);
      continue;
    }
    if (catalog.applied.get(stepName) !== (await sha256(text0))) await add(stepName, "replace", "idempotent", text0);
  }
  for (const key of catalog.tables.keys()) {
    const n = key.slice(key.indexOf(".") + 1);
    if (!modelled.has(key) && !LIBRARY_TABLES.has(n) && !n.endsWith("_landing"))
      unplanned.push(`${key} is in the database and not in the model`);
  }
  for (const s of desired.steps ?? []) {
    const textOf = renderUnchecked(s.sql, ctx);
    if (catalog.applied.get(s.name) === (await sha256(textOf))) continue;
    await add(s.name, "step", s.classification, textOf, {
      destructive: s.destructive,
      transactional: s.transactional,
      ...(s.reverses === undefined ? {} : { reverses: s.reverses }),
    });
  }
  return { dialect: ctx.dialect.name, changes, unplanned };
}

/** What lint finds in a plan: a change that destroys data, or one that cannot run in a transaction (FR-039). */
export interface PlanFinding {
  /** The rule. */
  readonly rule: "destructive" | "non-transactional";
  /** The step. */
  readonly step: string;
  /** What it means, in one sentence. */
  readonly message: string;
}

/**
 * Flags the changes of a plan a person must look at before it is applied.
 *
 * @param p - the plan
 */
export function lintPlan(p: Plan): readonly PlanFinding[] {
  return p.changes.flatMap((c): PlanFinding[] => [
    ...(c.destructive
      ? [{ rule: "destructive" as const, step: c.step, message: "destroys data: it is applied only when that is allowed" }]
      : []),
    ...(c.transactional
      ? []
      : [
          {
            rule: "non-transactional" as const,
            step: c.step,
            message: "cannot run in a transaction: if it fails halfway, nothing undoes what it did",
          },
        ]),
  ]);
}

/**
 * The plan as a script for a person to read: each change under a comment that says its step, its classification, what lint finds in
 * it and its hash, then the differences no change makes. This is what ISLM gives by default (FR-039).
 *
 * @param p - the plan
 */
export function planScript(p: Plan): string {
  const lines = [
    `-- ISLM plan for ${p.dialect}: ${p.changes.length} change(s), ${p.changes.filter((c) => c.classification === "non-idempotent").length} non-idempotent`,
  ];
  for (const c of p.changes) {
    const flags = [c.classification, ...(c.destructive ? ["destroys data"] : []), ...(c.transactional ? [] : ["outside a transaction"])];
    const reverses = c.reverses === undefined ? "" : `, reverses ${c.reverses}`;
    lines.push("", `-- step ${c.step} (${flags.join(", ")}${reverses}) sha256 ${c.hash}`, c.text);
  }
  for (const u of p.unplanned) lines.push("", `-- not planned: ${u}`);
  return `${lines.join("\n")}\n`;
}

/** The ledger: one row for every step run, never changed or removed (FR-037, FR-038). */
export const ledgerTable = table(
  LEDGER,
  {
    entry_id: text().doc("The key of this entry"),
    step: text().doc("The step's name"),
    hash: text().doc("The SHA-256 of the step's SQL as run"),
    kind: oneOf(["idempotent", "non-idempotent"]).doc("Whether the step may be run on every apply"),
    actor: text().doc("Who applied it"),
    started_at: timestamptz().doc("When it began"),
    duration_ms: integer().doc("How long it took, in milliseconds"),
    outcome: oneOf(["ok", "failed"]).doc("How it ended"),
    message: text().nullable().doc("What the database said, where it failed"),
    reverses: text().nullable().doc("The step this one reverses, for an undo"),
  },
  { primaryKey: ["entry_id"], owner: "ifc-sql-aide", doc: "ISLM's history: every step run, never changed or removed" },
);

/** The statements that make the ledger and the lineage table, and, where the dialect has triggers, refuse a change to the ledger. */
function bootstrap(ctx: EmitContext): string {
  const ledger = ident(ctx, ...ctx.naming.table(LEDGER, undefined));
  const out = [renderUnchecked(ledgerTable.ddl, ctx), renderUnchecked(lineageTable.ddl, ctx)];
  const guard = ident(ctx, `${LEDGER}_append_only`);
  switch (ctx.dialect.name) {
    case "postgres":
      out.push(
        `CREATE OR REPLACE FUNCTION ${guard}() RETURNS trigger LANGUAGE plpgsql AS $ifc$ BEGIN RAISE EXCEPTION 'the ledger is append-only'; END $ifc$;`,
        `CREATE OR REPLACE TRIGGER ${guard} BEFORE UPDATE OR DELETE ON ${ledger} FOR EACH ROW EXECUTE FUNCTION ${guard}();`,
        `CREATE OR REPLACE TRIGGER ${ident(ctx, `${LEDGER}_no_truncate`)} BEFORE TRUNCATE ON ${ledger} FOR EACH STATEMENT EXECUTE FUNCTION ${guard}();`,
      );
      break;
    case "sqlite":
      for (const event of ["UPDATE", "DELETE"])
        out.push(
          `CREATE TRIGGER IF NOT EXISTS ${ident(ctx, `${LEDGER}_no_${event.toLowerCase()}`)} BEFORE ${event} ON ${ledger} BEGIN SELECT RAISE(ABORT, 'the ledger is append-only'); END;`,
        );
      break;
    default:
      // DuckDB has no triggers: its ledger is append-only because ISLM only appends
      break;
  }
  return out.join("\n");
}

/** Why an apply stopped. */
export type ApplyError =
  | { readonly kind: "destructive"; readonly steps: readonly string[] }
  | { readonly kind: "failed"; readonly step: string; readonly message: string; readonly ran: readonly string[] };

/** What an apply did. */
export interface Applied {
  /** The steps run, in order. */
  readonly ran: readonly string[];
}

/** How to apply a plan. */
export interface ApplyOptions {
  /** Who applies it, as the ledger records. */
  readonly actor: string;
  /** Whether a change that destroys data may be applied; without it, a plan that has one is refused whole. */
  readonly allowDestructive?: boolean;
}

/**
 * Applies a plan through a runner, only when asked (FR-039): each change in a transaction where it can be, and an entry in the ledger
 * for it, ok or failed. A plan with a change that destroys data is refused unless that is allowed. The first change that fails stops
 * the apply, its transaction rolled back.
 *
 * @param p - the plan, made for the runner's database
 * @param runner - what runs SQL in the database
 * @param ctx - the context of the database's dialect
 * @param options - who applies it, and whether destroying data is allowed
 */
export async function apply(p: Plan, runner: Runner, ctx: EmitContext, options: ApplyOptions): Promise<Result<Applied, ApplyError>> {
  const destructive = p.changes.filter((c) => c.destructive).map((c) => c.step);
  if (destructive.length > 0 && options.allowDestructive !== true) return err({ kind: "destructive", steps: destructive });
  await runner.exec(bootstrap(ctx));
  const ledger = name(...ctx.naming.table(LEDGER, undefined));
  // the entry's key sorts as the entries were made: when, then its place in this apply, then a random part for applies at one moment
  const run = globalThis.crypto.randomUUID();
  let entries = 0;
  const entryId = (started: Date): string => `${started.toISOString()} ${String(++entries).padStart(6, "0")} ${run}`;
  const record = (c: Change, started: Date, ms: number, outcome: "ok" | "failed", message: string | null): string =>
    renderUnchecked(
      SQL`INSERT INTO ${ledger} ("entry_id", "step", "hash", "kind", "actor", "started_at", "duration_ms", "outcome", "message", "reverses") VALUES (${bind(entryId(started))}, ${bind(c.step)}, ${bind(c.hash)}, ${bind(c.classification)}, ${bind(options.actor)}, ${bind(started, { kind: "timestamp", zone: true })}, ${ms}, ${bind(outcome)}, ${bind(message)}, ${bind(c.reverses ?? null)});`,
      ctx,
    );
  const ran: string[] = [];
  for (const c of p.changes) {
    const started = new Date();
    try {
      if (c.transactional) await runner.exec("BEGIN TRANSACTION;");
      await runner.exec(c.text);
      const ms = Date.now() - started.getTime();
      await runner.exec(record(c, started, ms, "ok", null));
      if (c.transactional) await runner.exec("COMMIT;");
      ran.push(c.step);
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : String(thrown);
      if (c.transactional) await runner.exec("ROLLBACK;").catch(() => undefined);
      await runner.exec(record(c, started, Date.now() - started.getTime(), "failed", message));
      return err({ kind: "failed", step: c.step, message, ran });
    }
  }
  return ok({ ran });
}

/** A teardown refused, because the context is production (FR-039). */
export type TeardownRefused = { readonly kind: "refused"; readonly message: string };

/**
 * The plan that drops a model's tables, views and indexes, last defined first: every change destroys data. It is refused in a production
 * context. Other entities (routines, policies, types) are left, and said so in the plan; the ledger is never dropped.
 *
 * @param entities - the model's entities
 * @param ctx - the context; where its execution is `production`, the teardown is refused
 */
export async function teardown<const E extends readonly Entity[], C extends EmitContext<Dialect>>(
  entities: E,
  ctx: C & Fits<DialectOf<C>, ReqOf<E[number]["ddl"]>, DxOf<E[number]["ddl"]>>,
): Promise<Result<Plan, TeardownRefused>> {
  if (ctx.execution === "production") return err({ kind: "refused", message: "a teardown is refused in a production context" });
  const sorted = ordered(entities);
  if (sorted.kind === "err") throw new Error(`entities need each other in a circle: ${sorted.error.entities.join(", ")}`);
  const changes: Change[] = [];
  const unplanned: string[] = [];
  for (const e of [...sorted.value].reverse()) {
    const parts = ctx.naming.table(e.name, e.schema);
    let statement: string | undefined;
    if (isTable(e)) statement = `DROP TABLE IF EXISTS ${ident(ctx, ...parts)};`;
    else if (isView(e)) statement = `DROP ${e.materialized ? "MATERIALIZED VIEW" : "VIEW"} IF EXISTS ${ident(ctx, ...parts)};`;
    else if (isIndex(e))
      statement = `DROP INDEX IF EXISTS ${ident(ctx, ...(parts.length > 1 ? [parts[0] ?? "", e.nameIn(ctx)] : [e.nameIn(ctx)]))};`;
    if (statement === undefined) {
      unplanned.push(`${e.entity} ${e.name} is not dropped by a teardown`);
      continue;
    }
    changes.push({
      step: `teardown:${e.entity}:${parts.join(".")}`,
      what: "drop",
      classification: "non-idempotent",
      destructive: true,
      transactional: true,
      text: statement,
      hash: await sha256(statement),
    });
  }
  return ok({ dialect: ctx.dialect.name, changes, unplanned });
}
