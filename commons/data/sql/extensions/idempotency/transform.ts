// Spec: 0012-sql-idempotency FR-003, FR-004, FR-005
/**
 * The idempotency transform (commons data 0012-sql-idempotency FR-003 to FR-005): each statement of a step is written in a form that is safe to run twice. Where the dialect has a natural form
 * (`IF NOT EXISTS`, `IF EXISTS`, an upsert) the statement is written in it; where it has none, the statement carries a guard, a query on the catalog that says its work is done; where neither is
 * possible the step is marked as safe only because the ledger runs it at most once. Every step says which.
 *
 * @module
 */
import type { Guard, Idempotency, StepDraft, StepStatement, StepTransform } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect, IfExistsForm } from "@intellectual-frontiers/data/sql/physical";

/** What a project says of idempotency; what is not said is the default. */
export interface IdempotencySettings {
  /** `on` (the default) makes every step safe to run twice; `off` leaves the statements as the core wrote them. */
  readonly mode?: "on" | "off";
  /** What to do with a step that only the ledger keeps from running twice: `allow` (the default) or `refuse`. */
  readonly unguardable?: "allow" | "refuse";
}

const ID = '"(?:[^"]|"")*"';
const REF = `${ID}(?:\\.${ID})?`;
const unquote = (id: string): string => id.slice(1, -1).replaceAll('""', '"');
/** A name as a statement refers to it, which may carry a schema: its schema, where it has one, and its name. */
const refOf = (text: string | undefined): { readonly schema: string | undefined; readonly name: string } => {
  const parts = (text ?? "").match(new RegExp(ID, "g")) ?? [];
  return parts.length > 1
    ? { schema: unquote(parts[0] ?? ""), name: unquote(parts[1] ?? "") }
    : { schema: undefined, name: unquote(parts[0] ?? "") };
};

/** How one statement was made safe. */
interface Made {
  readonly statement: StepStatement;
  readonly level: Idempotency;
}

const RANK: Readonly<Record<Idempotency, number>> = { natural: 0, guarded: 1, "ledger-only": 2 };
const worst = (levels: readonly Idempotency[]): Idempotency => levels.reduce<Idempotency>((a, b) => (RANK[b] > RANK[a] ? b : a), "natural");

function make(s: StepStatement, dialect: Dialect, dropped: ReadonlySet<string>): Made {
  const natural = (sql: string = s.sql): Made => ({ statement: { ...s, sql }, level: "natural" });
  const ledgerOnly = (): Made => ({ statement: s, level: "ledger-only" });
  const guarded = (query: string | undefined, skipWhen: Guard["skipWhen"]): Made =>
    query === undefined ? ledgerOnly() : { statement: { ...s, guard: { query, skipWhen } }, level: "guarded" };
  const has = (form: IfExistsForm): boolean => dialect.ifExists?.includes(form) ?? false;
  const probes = dialect.probes;
  const sql = s.sql;
  let m: RegExpMatchArray | null;

  if (
    /^(CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|CREATE UNIQUE INDEX IF NOT EXISTS|INSERT |DELETE FROM |COMMENT ON |CREATE OR REPLACE |DROP POLICY IF EXISTS |CREATE EXTENSION IF NOT EXISTS |CREATE SCHEMA IF NOT EXISTS |GRANT |REVOKE )/.test(
      sql,
    )
  )
    return natural();
  if (/^ALTER (TABLE|VIEW|SCHEMA) .+ OWNER TO /.test(sql)) return natural();
  if (/^ALTER TABLE .+ ALTER COLUMN .+ (SET|DROP) (NOT NULL|DEFAULT)/.test(sql)) return natural();
  if (/ ADD COLUMN IF NOT EXISTS /.test(sql) || /^DROP \w+ IF EXISTS /.test(sql)) return natural();
  // a view or a trigger made after the same view was dropped in the step is made again whenever the step is run
  if ((m = sql.match(new RegExp(`^CREATE (?:OR REPLACE )?VIEW (${REF})`))) && dropped.has(m[1] ?? "")) return natural();
  if ((m = sql.match(new RegExp(`^CREATE TRIGGER ${ID} INSTEAD OF \\w+ ON (${REF})`))) && dropped.has(m[1] ?? "")) return natural();
  if (probes === undefined) return ledgerOnly();

  if ((m = sql.match(new RegExp(`^ALTER TABLE (${REF}) ADD COLUMN (${ID})`)))) {
    if (has("addColumn")) return natural(sql.replace(" ADD COLUMN ", " ADD COLUMN IF NOT EXISTS "));
    return guarded(probes.column(refOf(m[1]).name, unquote(m[2] ?? ""), refOf(m[1]).schema), "rows");
  }
  if ((m = sql.match(new RegExp(`^ALTER TABLE (${REF}) DROP COLUMN (${ID});$`)))) {
    if (has("dropColumn")) return natural(sql.replace(" DROP COLUMN ", " DROP COLUMN IF EXISTS "));
    return guarded(probes.column(refOf(m[1]).name, unquote(m[2] ?? ""), refOf(m[1]).schema), "none");
  }
  if ((m = sql.match(new RegExp(`^ALTER TABLE (${REF}) RENAME TO (${ID});$`))))
    return guarded(probes.table(refOf(m[1]).name, refOf(m[1]).schema), "none");
  if ((m = sql.match(new RegExp(`^ALTER TABLE (${REF}) RENAME COLUMN (${ID}) TO (${ID});$`))))
    return guarded(probes.column(refOf(m[1]).name, unquote(m[2] ?? ""), refOf(m[1]).schema), "none");
  if ((m = sql.match(new RegExp(`^ALTER TABLE (${REF}) ADD CONSTRAINT (${ID})`))))
    return guarded(probes.constraint(refOf(m[1]).name, unquote(m[2] ?? ""), refOf(m[1]).schema), "rows");
  if ((m = sql.match(new RegExp(`^ALTER TABLE (${REF}) DROP CONSTRAINT (${ID});$`)))) {
    if (has("dropConstraint")) return natural(sql.replace(" DROP CONSTRAINT ", " DROP CONSTRAINT IF EXISTS "));
    return guarded(probes.constraint(refOf(m[1]).name, unquote(m[2] ?? ""), refOf(m[1]).schema), "none");
  }
  if ((m = sql.match(new RegExp(`^ALTER TABLE (${REF}) RENAME CONSTRAINT (${ID}) TO (${ID});$`))))
    return guarded(probes.constraint(refOf(m[1]).name, unquote(m[2] ?? ""), refOf(m[1]).schema), "none");
  if ((m = sql.match(new RegExp(`^ALTER INDEX (${REF}) RENAME TO (${ID});$`))))
    return guarded(probes.index(refOf(m[1]).name, refOf(m[1]).schema), "none");
  if ((m = sql.match(new RegExp(`^DROP TABLE (${REF});$`)))) {
    if (has("dropTable")) return natural(sql.replace("DROP TABLE ", "DROP TABLE IF EXISTS "));
    return guarded(probes.table(refOf(m[1]).name, refOf(m[1]).schema), "none");
  }
  if ((m = sql.match(new RegExp(`^DROP INDEX (${REF});$`)))) {
    if (has("dropIndex")) return natural(sql.replace("DROP INDEX ", "DROP INDEX IF EXISTS "));
    return guarded(probes.index(refOf(m[1]).name, refOf(m[1]).schema), "none");
  }
  return ledgerOnly();
}

/**
 * The idempotency transform of a project.
 *
 * @param settings - what the project says of idempotency
 * @returns the transform, to be given to `plan` or contributed through `lifecycle.transform`
 */
export function idempotency(settings: IdempotencySettings = {}): StepTransform {
  if (settings.mode === "off") return (draft) => draft;
  return (draft: StepDraft, context): StepDraft => {
    // a step a person wrote is only as safe as the person made it
    if (draft.manual) return { ...draft, idempotency: draft.idempotency ?? "ledger-only" };
    const droppedViews = (ss: readonly StepStatement[] | undefined): ReadonlySet<string> =>
      new Set((ss ?? []).flatMap((s) => [...s.sql.matchAll(new RegExp(`^DROP VIEW IF EXISTS (${REF});$`, "g"))].map((m) => m[1] ?? "")));
    const up = draft.up.map((s) => make(s, context.dialect, droppedViews(draft.up)));
    const down = draft.down?.map((s) => make(s, context.dialect, droppedViews(draft.down)));
    return {
      ...draft,
      up: up.map((m) => m.statement),
      ...(down === undefined ? {} : { down: down.map((m) => m.statement) }),
      idempotency: worst([...up.map((m) => m.level), ...(down?.map((m) => m.level) ?? [])]),
    };
  };
}
