// Spec: 0015-sql-safety FR-004, FR-005, FR-006, FR-007
/**
 * Quarantine (commons data 0015-sql-safety FR-004 to FR-007): a step that drops a column copies its values, with the table's key, to a table of their own first; a step that drops a table renames
 * it away. Either can be undone by the step's down statements, and nothing is destroyed until a person purges the quarantine table.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { vocabularies, words } from "@intellectual-frontiers/data/governance";
import { carriedOf, sameWords } from "@intellectual-frontiers/data/sql/logical";
import type { Check, Plan, StepContext, StepDraft, StepStatement, StepTransform } from "@intellectual-frontiers/data/sql/lifecycle";
import { hashOf } from "@intellectual-frontiers/data/sql/lifecycle";
import { type Dialect, type Naming, qualified } from "@intellectual-frontiers/data/sql/physical";
import type { Safety } from "./settings.ts";

const { quality } = vocabularies;

const stmt = (sql: string, extra: Partial<StepStatement> = {}): StepStatement => ({
  group: "table",
  origin: "core",
  sql,
  of: [],
  ...extra,
});

/** What the retention of an element says, in words, or nothing where governance says none. */
function keptFor(context: StepContext, tableWords: readonly string[], columnWords?: readonly string[]): string {
  const t = context.schema.tables.find((x) => sameWords(x.name, tableWords));
  if (t === undefined) return "";
  const target = columnWords === undefined ? t : t.columns.find((c) => sameWords(c.name, columnWords));
  const r = target === undefined ? undefined : carriedOf(target, quality.retention)[0];
  return r === undefined ? "" : `; governance says to keep it ${JSON.stringify(r)}`;
}

/** The name of a quarantine table: the table's words, the column's and the suffix, written by the case style. */
export const quarantineName = (naming: Naming, table: string, column: readonly string[] | undefined, suffix: string): string =>
  naming.names.write([...words(table), ...(column ?? []), suffix]);

/** A fingerprint of the values of a column: how many rows, how long the values are in all, and the least and the greatest, as one text, so that the values kept can be told from the values dropped. */
const fingerprint = (dialect: Dialect, table: string, column: string): string => {
  const v = `CAST(${dialect.quote(column)} AS VARCHAR)`;
  return `SELECT CAST(COUNT(*) AS VARCHAR) || ':' || CAST(COALESCE(SUM(LENGTH(${v})), 0) AS VARCHAR) || ':' || COALESCE(MIN(${v}), '') || ':' || COALESCE(MAX(${v}), '') FROM ${table}`;
};

/**
 * The quarantine transform.
 *
 * @param settings - the settings
 * @returns the transform
 */
export function quarantine(settings: Safety): StepTransform {
  return (draft, context): StepDraft => {
    if (!settings.quarantine) return draft;
    const { dialect, naming } = context;
    const c = draft.change;
    const probes = dialect.probes;
    if (c.kind === "dropColumn") {
      const before = context.before.tables.find((t) => sameWords(t.words, c.table.words));
      if (before === undefined) return draft;
      const qn = quarantineName(naming, before.name, c.column.words, settings.suffixes.column);
      const table = qualified(dialect, context.before.qualifier, before.name);
      const qt = qualified(dialect, context.before.qualifier, qn);
      const q = (n: string): string => dialect.quote(n);
      const keys = before.primaryKey;
      const copied = keys.length > 0 ? [...keys, c.column.name] : before.columns.map((x) => x.name);
      const guard = probes === undefined ? undefined : { query: probes.table(qn, context.before.qualifier), skipWhen: "rows" as const };
      const copy = stmt(
        `CREATE TABLE IF NOT EXISTS ${qt} AS SELECT ${copied.map(q).join(", ")} FROM ${table};`,
        guard === undefined ? {} : { guard },
      );
      const restore: StepStatement[] =
        keys.length === 0
          ? []
          : [
              stmt(
                `UPDATE ${table} SET ${q(c.column.name)} = (SELECT ${q("q")}.${q(c.column.name)} FROM ${qt} ${q("q")} WHERE ${keys.map((k) => `${q("q")}.${q(k)} = ${table}.${q(k)}`).join(" AND ")});`,
                { natural: true },
              ),
              ...(c.column.nullable || !dialect.features.includes("alter-column")
                ? []
                : [stmt(`ALTER TABLE ${table} ALTER COLUMN ${q(c.column.name)} SET NOT NULL;`)]),
            ];
      const readd = stmt(
        `ALTER TABLE ${table} ADD COLUMN ${q(c.column.name)} ${c.column.type}${c.column.default === undefined ? "" : ` DEFAULT ${c.column.default}`};`,
      );
      const checks: Check[] = [
        {
          describe: `the values of ${c.table.name}.${c.column.name} are kept in ${qn}`,
          query: probes === undefined ? "SELECT 1" : probes.table(qn, context.before.qualifier),
          expect: "rows",
        },
      ];
      return {
        ...draft,
        class: "data-dependent",
        why: `the values of ${c.table.name}.${c.column.name} are kept in ${qn} until a person purges it${keptFor(context, c.table.words, c.column.words)}`,
        reversibility: keys.length > 0 ? "quarantine" : "irreversible",
        up: [copy, ...draft.up],
        ...(keys.length > 0 ? { down: [readd, ...restore] } : {}),
        verify: {
          ...draft.verify,
          before: [
            ...(draft.verify?.before ?? []),
            { key: "quarantine-rows", query: `SELECT COUNT(*) FROM ${table}` },
            { key: "quarantine-content", query: fingerprint(dialect, table, c.column.name) },
          ],
          after: [
            ...(draft.verify?.after ?? []),
            ...checks,
            {
              describe: `the quarantine table of ${c.column.name} holds the values the column held, not the values of an earlier drop of a column of the same name: purge ${qn} first where it is old`,
              query: fingerprint(dialect, qt, c.column.name),
              expect: { sameAs: "quarantine-content" },
            },
            {
              describe: `the quarantine table of ${c.column.name} holds a row for each row of the table`,
              query: `SELECT COUNT(*) FROM ${qt}`,
              expect: { sameAs: "quarantine-rows" },
            },
          ],
        },
      };
    }
    if (c.kind === "dropTable") {
      const qn = quarantineName(naming, c.table.name, undefined, settings.suffixes.table);
      if (context.before.tables.some((t) => t.name === qn)) return draft;
      const from = qualified(dialect, context.before.qualifier, c.table.name);
      const back = qualified(dialect, context.before.qualifier, qn);
      return {
        ...draft,
        class: "data-dependent",
        why: `the table ${c.table.name} is kept as ${qn} until a person purges it${keptFor(context, c.table.words)}`,
        reversibility: "quarantine",
        up: [stmt(`ALTER TABLE ${from} RENAME TO ${dialect.quote(qn)};`)],
        down: [stmt(`ALTER TABLE ${back} RENAME TO ${dialect.quote(c.table.name)};`)],
      };
    }
    return draft;
  };
}

/** What `purge` is given. */
export interface PurgeOptions {
  /** The hash of the state the database is in: a purge changes no table of the state. */
  readonly from: string;
  /** The names of the quarantine tables to drop, as written. */
  readonly names: readonly string[];
  readonly dialect: Dialect;
  readonly settings: Safety;
  /** The schema the tables are qualified by. */
  readonly qualifier?: string;
}

/**
 * A plan of one step that drops quarantine tables, which a person asks for by name.
 *
 * @param options - what to purge
 * @returns the plan, or why a name is not a quarantine table
 */
export function purge(options: PurgeOptions): Result<Plan, readonly { readonly kind: "not-quarantine"; readonly name: string }[]> {
  const { suffixes } = options.settings;
  const bad = options.names.filter((n) => {
    const last = words(n).at(-1);
    return last !== suffixes.column && last !== suffixes.table;
  });
  if (bad.length > 0) return err(bad.map((name) => ({ kind: "not-quarantine" as const, name })));
  const up = options.names.map((n): StepStatement => stmt(`DROP TABLE IF EXISTS ${qualified(options.dialect, options.qualifier, n)};`));
  const base = {
    kind: "dropTable" as const,
    key: `purge:${options.names.join(",")}`,
    name: `purge ${options.names.join(", ")}`,
    class: "destructive" as const,
    why: "the quarantined data is destroyed",
    reversibility: "irreversible" as const,
    up,
    of: [],
    manual: true,
    idempotency: "natural" as const,
  };
  const id = hashOf({ purge: options.names, from: options.from });
  const step = {
    ...base,
    id,
    from: options.from,
    to: options.from,
    change: {
      kind: "dropTable" as const,
      key: base.key,
      table: { id: "", words: [], name: "", columns: [], primaryKey: [], constraints: [], rows: [] },
    },
  };
  return ok({ dialect: options.dialect.name, from: options.from, to: options.from, steps: [step], repeatable: [] });
}
