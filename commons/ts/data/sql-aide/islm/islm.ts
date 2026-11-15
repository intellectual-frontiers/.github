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
 * @limits
 * With a shadow (`shadow(entities, emptyDatabase, ctx)`, a database of the same engine made from the model, entity by entity), `plan(...,
 * { shadow })` compares every object each dialect's catalog lets it read, so that what an engine rewrites is rewritten the same way on
 * both sides. Without a shadow it compares what it did before: which tables, columns, views and indexes exist and whether a column may be
 * null. What each dialect's catalog lets it compare, and what it leaves, is `ISLM_COMPARED`.
 *
 * What is changed in place: a column added or dropped, nullness (PostgreSQL, DuckDB), a default (PostgreSQL, DuckDB), a constraint added,
 * dropped or replaced (PostgreSQL), an index made, replaced or dropped, a view, routine, trigger, policy, row-level security or comment
 * applied again, enum labels appended (PostgreSQL). Said as needing a step written by hand: a column's type (it may lose data), a
 * generated or numbered column, a default in SQLite, a constraint of DuckDB or SQLite (the table must be made again), a sequence, domain
 * or partition that differs (each is made only if absent), a table that should be partitioned, and an object in the database the model
 * does not make. An added column gets its type, nullness and default, not its references or checks. DuckDB will not alter a column of a
 * table that has an index, so the plan drops the table's indexes first and makes the model's again. DuckDB has no triggers, so nothing in
 * the database refuses a change to its ledger there. A teardown drops tables, views and indexes and leaves routines, policies and types. A
 * generated column is written with its expression first and no `NOT NULL` or default beside it, which DuckDB requires.
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
import { type CatalogObject, differences, readObjects } from "./deep.ts";

/** Whether a change may be run on every apply (it makes or replaces what it defines) or changes structure or data that exists. */
export type Classification = "idempotent" | "non-idempotent";

/** What a change does. */
export type ChangeKind =
  | "create"
  | "replace"
  | "add-column"
  | "drop-column"
  | "set-not-null"
  | "drop-not-null"
  | "set-default"
  | "add-constraint"
  | "drop-constraint"
  | "replace-constraint"
  | "add-enum-values"
  | "drop"
  | "drop-index"
  | "step";

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
  C extends EmitContext<Dialect, "durable"> = EmitContext<Dialect, "durable">,
>(
  desired: Desired<E, S>,
  catalog: Catalog,
  ctx: C & Fits<DialectOf<C>, ReqOf<E[number]["ddl"]> | ReqOf<S[number]["sql"]>, DxOf<E[number]["ddl"] | S[number]["sql"]>>,
  options: PlanOptions = {},
): Promise<Plan> {
  const shadowOf = options.shadow;
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
        // a generated column's nullness is its expression's, whatever the model says
        if (c.identity || c.generated !== undefined || has.notNull === !c.nullable) continue;
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
      else if (shadowOf === undefined && catalog.applied.get(stepName) !== (await sha256(text0)))
        if (e.materialized) unplanned.push(`${key} is a materialized view whose definition may differ: a step must drop and make it again`);
        else await add(stepName, "replace", "idempotent", text0);
      continue;
    }
    // with a shadow, an entity whose objects the catalog reads is compared object by object below; the ledger's hash decides the rest
    if (shadowOf !== undefined && [...shadowOf.owners.values()].includes(e)) continue;
    if (catalog.applied.get(stepName) !== (await sha256(text0))) await add(stepName, "replace", "idempotent", text0);
  }
  for (const o of shadowOf?.objects.values() ?? []) if (o.kind === "column" && o.table !== undefined) modelled.add(o.table);
  for (const key of catalog.tables.keys()) {
    const n = key.slice(key.indexOf(".") + 1);
    if (!modelled.has(key) && !LIBRARY_TABLES.has(n) && !n.endsWith("_landing"))
      unplanned.push(`${key} is in the database and not in the model`);
  }
  if (shadowOf !== undefined) await deepPlan(shadowOf, catalog, ctx, changes, unplanned, add);
  for (const s of desired.steps ?? []) {
    const textOf = renderUnchecked(s.sql, ctx);
    if (catalog.applied.get(s.name) === (await sha256(textOf))) continue;
    await add(s.name, "step", s.classification, textOf, {
      destructive: s.destructive,
      transactional: s.transactional,
      ...(s.reverses === undefined ? {} : { reverses: s.reverses }),
    });
  }
  // a plugin may classify a change again: what its hook says replaces what the plan said
  const classified = changes.map((c) => {
    let out = c;
    for (const p of ctx.plugins) {
      const said = p.hooks?.classify?.(out);
      if (said !== undefined) out = { ...out, ...said };
    }
    return out;
  });
  return { dialect: ctx.dialect.name, changes: classified, unplanned };
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
export async function apply(
  p: Plan,
  runner: Runner,
  ctx: EmitContext<Dialect, "durable">,
  options: ApplyOptions,
): Promise<Result<Applied, ApplyError>> {
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
export async function teardown<const E extends readonly Entity[], C extends EmitContext<Dialect, "durable">>(
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

/** What a plan is compared with beyond the model's entities: the catalog of a shadow database the same engine made from the model. */
export interface Shadow {
  /** The objects of the shadow's catalog. */
  readonly objects: ReadonlyMap<string, CatalogObject>;
  /** The entity of the model that made each object. */
  readonly owners: ReadonlyMap<string, Entity>;
}

/** What a plan may be given beyond the model and the catalog. */
export interface PlanOptions {
  /** A shadow of the model (from {@link shadow}): with it, the plan compares every object the dialect's catalog lets it read (FR-035). */
  readonly shadow?: Shadow;
}

/**
 * Makes the shadow of a model: its entities defined, one after another in the order their references give, in an empty database of
 * the same engine, and the objects each made read from the catalog after it. The database must be empty and is left as the model made
 * it; it is the caller's to make and to let go (an in-memory SQLite or DuckDB, a PGlite, a database made for the purpose on a server).
 *
 * @param entities - the model's entities, as the plan is given them
 * @param empty - what runs SQL in an empty database of the dialect
 * @param ctx - the context of the dialect
 */
export async function shadow<const E extends readonly Entity[], C extends EmitContext<Dialect, "durable">>(
  entities: E,
  empty: Runner,
  ctx: C & Fits<DialectOf<C>, ReqOf<E[number]["ddl"]>, DxOf<E[number]["ddl"]>>,
): Promise<Shadow> {
  const sorted = ordered(entities);
  if (sorted.kind === "err") throw new Error(`entities need each other in a circle: ${sorted.error.entities.join(", ")}`);
  const owners = new Map<string, Entity>();
  let seen = await readObjects(empty, ctx);
  if ([...seen.values()].some((o) => o.kind !== "schema" && o.kind !== "extension")) throw new Error("the shadow database is not empty");
  for (const e of sorted.value) {
    await empty.exec(renderUnchecked(e.ddl, ctx));
    const now = await readObjects(empty, ctx);
    for (const k of now.keys()) if (!seen.has(k)) owners.set(k, e);
    seen = now;
  }
  return { objects: seen, owners };
}

/** What adds a change to a plan. */
type Add = (
  step: string,
  what: ChangeKind,
  classification: Classification,
  text: string,
  flags?: { readonly destructive?: boolean; readonly transactional?: boolean },
) => Promise<void>;

/** The changes, and the differences no change makes, that the deep comparison finds between the live catalog and the shadow's. */
async function deepPlan(
  shadowOf: Shadow,
  catalog: Catalog,
  ctx: EmitContext,
  changes: Change[],
  unplanned: string[],
  add: Add,
): Promise<void> {
  const live = catalog.objects ?? new Map<string, CatalogObject>();
  const dialect = ctx.dialect.name;
  const planned = (step: string): boolean => changes.some((c) => c.step === step);
  const name = (qualified: string): string =>
    qualified
      .split(".")
      .map((p) => ctx.dialect.quoteName(p))
      .join(".");
  const after = (key: string, kind: string): string => key.slice(kind.length + 1);
  const shadowTables = new Set([...shadowOf.objects.values()].flatMap((o) => (o.table === undefined ? [] : [o.table])));
  const there = (table: string): boolean => catalog.tables.has(table) || catalog.views.has(table);
  const reapply = async (o: CatalogObject, why: string): Promise<void> => {
    const owner = shadowOf.owners.get(o.key);
    if (owner === undefined) {
      unplanned.push(`${o.key} ${why}, and no entity of the model makes it: a step written by hand must`);
      return;
    }
    const step = `${owner.entity}:${owner.schema ?? catalog.defaultSchema}.${owner.name}`;
    if (!planned(step)) await add(step, "replace", "idempotent", renderUnchecked(owner.ddl, ctx));
  };
  const handWritten = (o: CatalogObject, what: string, reason: string): void => {
    unplanned.push(`${o.key}: ${what}; ${reason}: a step written by hand must change it`);
  };
  for (const [key, want] of shadowOf.objects) {
    const has = live.get(key);
    const owner = shadowOf.owners.get(key);
    if (has === undefined) {
      if (want.table !== undefined && !there(want.table)) {
        // a table or view that is not there is made by the plan's own change for it; what else made it is applied again
        if (owner !== undefined && !isTable(owner) && !isView(owner)) await reapply(want, "is not in the database");
        continue;
      }
      switch (want.kind) {
        case "column":
        case "view":
          break;
        case "index":
          if (owner === undefined || !isIndex(owner)) await reapply(want, "is not in the database");
          break;
        case "constraint":
          if (dialect === "postgres") {
            const [table, constraintName] = splitLast(after(key, "constraint"));
            await add(
              `${key}:add`,
              "add-constraint",
              "non-idempotent",
              `ALTER TABLE ${name(table)} ADD CONSTRAINT ${ctx.dialect.quoteName(constraintName)} ${want.def["text"] ?? ""};`,
            );
          } else handWritten(want, "is not in the database", `${dialect} cannot add a constraint to a table that exists`);
          break;
        case "partitioned":
          handWritten(want, "the table is not partitioned", "a table cannot be partitioned in place");
          break;
        default:
          await reapply(want, "is not in the database");
      }
      continue;
    }
    const diff = differences(has, want);
    if (diff.length === 0) continue;
    const what = diff.join("; ");
    switch (want.kind) {
      case "column": {
        const [table, column] = splitLast(after(key, "column"));
        const fields = new Set(diff.map((d) => d.slice(0, d.indexOf(":"))));
        if (fields.has("type")) handWritten(want, what, "a change of type may lose data or need a conversion");
        else if (fields.has("generated") || fields.has("identity"))
          handWritten(want, what, "a generated or numbered column is made again, not changed");
        else if (dialect === "sqlite") handWritten(want, what, "SQLite changes a default only by making the table again");
        else if (dialect === "duckdb" && generatedColumn(owner, column))
          handWritten(want, what, "a generated column is made again, not changed");
        else {
          const wantedDefault = want.def["default"] ?? "";
          await add(
            `${key}:default`,
            "set-default",
            "non-idempotent",
            `ALTER TABLE ${name(table)} ALTER COLUMN ${ctx.dialect.quoteName(column)} ${wantedDefault === "" ? "DROP DEFAULT" : `SET DEFAULT ${wantedDefault}`};`,
          );
        }
        break;
      }
      case "constraint": {
        const [table, constraintName] = splitLast(after(key, "constraint"));
        const named = ctx.dialect.quoteName(constraintName);
        await add(
          `${key}:replace`,
          "replace-constraint",
          "non-idempotent",
          `ALTER TABLE ${name(table)} DROP CONSTRAINT ${named};\nALTER TABLE ${name(table)} ADD CONSTRAINT ${named} ${want.def["text"] ?? ""};`,
        );
        break;
      }
      case "index":
        await add(
          `${key}:replace`,
          "replace",
          "idempotent",
          `DROP INDEX IF EXISTS ${name(after(key, "index"))};\n${(want.def["sql"] ?? "").replace(/;?\s*$/, ";")}`,
        );
        break;
      case "view": {
        if (owner === undefined) {
          handWritten(want, what, "no entity of the model makes it");
          break;
        }
        const step = `${owner.entity}:${owner.schema ?? catalog.defaultSchema}.${owner.name}`;
        const dropped = `DROP ${want.def["materialized"] === "yes" ? "MATERIALIZED VIEW" : "VIEW"} IF EXISTS ${name(after(key, "view"))};`;
        if (!planned(step)) await add(step, "replace", "idempotent", `${dropped}\n${renderUnchecked(owner.ddl, ctx)}`);
        break;
      }
      case "enum": {
        const had = (has.def["labels"] ?? "").split(",");
        const wanted = (want.def["labels"] ?? "").split(",");
        const appended = wanted.length > had.length && had.every((l, i) => wanted[i] === l);
        if (dialect === "postgres" && appended)
          await add(
            `${key}:add-values`,
            "add-enum-values",
            "idempotent",
            wanted
              .slice(had.length)
              .map((l) => `ALTER TYPE ${name(after(key, "enum"))} ADD VALUE IF NOT EXISTS ${ctx.dialect.literal(l)};`)
              .join("\n"),
          );
        else
          handWritten(
            want,
            what,
            dialect === "postgres"
              ? "a label removed or moved is not changed in place"
              : `${dialect} does not change an enumerated type in place`,
          );
        break;
      }
      case "sequence":
      case "domain":
      case "partition":
      case "partitioned":
        handWritten(want, what, "it is made only if absent, so applying it again changes nothing");
        break;
      default:
        await reapply(want, `differs (${what})`);
    }
  }
  for (const [key, had] of live) {
    if (shadowOf.objects.has(key)) continue;
    if (had.table !== undefined && !shadowTables.has(had.table)) continue;
    switch (had.kind) {
      case "column":
        break;
      case "index":
        await add(`${key}:drop`, "drop-index", "non-idempotent", `DROP INDEX ${name(after(key, "index"))};`);
        break;
      case "constraint":
        if (dialect === "postgres") {
          const [table, constraintName] = splitLast(after(key, "constraint"));
          await add(
            `${key}:drop`,
            "drop-constraint",
            "non-idempotent",
            `ALTER TABLE ${name(table)} DROP CONSTRAINT ${ctx.dialect.quoteName(constraintName)};`,
          );
        } else handWritten(had, "is in the database and not in the model", `${dialect} cannot drop a constraint of a table that exists`);
        break;
      case "comment": {
        const [target = "", ...rest] = after(key, "comment").split(" ");
        const on = target === "column" ? "COLUMN" : target === "routine" ? "FUNCTION" : target === "view" ? "VIEW" : "TABLE";
        const object = target === "routine" ? rest.join(" ") : name(rest.join(" "));
        await add(`${key}:drop`, "replace", "idempotent", `COMMENT ON ${on} ${object} IS NULL;`);
        break;
      }
      case "rls":
        await add(`${key}:disable`, "replace", "idempotent", `ALTER TABLE ${name(after(key, "rls"))} DISABLE ROW LEVEL SECURITY;`);
        break;
      default:
        unplanned.push(`${key} is in the database and not in the model`);
    }
  }
}

/** A qualified name split at its last dot: the table, and the column or constraint. */
function splitLast(qualified: string): readonly [string, string] {
  const i = qualified.lastIndexOf(".");
  return [qualified.slice(0, i), qualified.slice(i + 1)];
}

/** Whether the model makes a column of a table as generated. */
function generatedColumn(owner: Entity | undefined, column: string): boolean {
  return owner !== undefined && isTable(owner) && owner.spec.columns.some(([n, c]) => n === column && c.generated !== undefined);
}
