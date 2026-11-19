// Spec: 0017-sql-rewrite FR-001 to FR-006
/**
 * Making a table again (commons data 0017-sql-rewrite): what an engine cannot change in place (whether a column may be null, a default, the primary key, a constraint, a column that is required
 * and has no default) is made by making the table again from the state after the change: a new table, the rows copied, the old one dropped, the new one renamed, the indexes made. A change
 * of type is made in place with a cast where the engine can, and by making the table again where it cannot, when the project says that values may be cast.
 *
 * @module
 */
import { words } from "@intellectual-frontiers/data/governance";
import type { Fallback, StateTable, StepDraft, StepStatement } from "@intellectual-frontiers/data/sql/lifecycle";
import { type Dialect, type Naming, qualified, type Rebuild } from "@intellectual-frontiers/data/sql/physical";

/** What a project says of the rewrite; what is not said is the default. */
export interface RewriteSettings {
  /** Whether a table is made again where the engine cannot change it in place; `on` by default. */
  readonly rewrite?: "on" | "off";
  /** Whether a change of type may cast the values; `refuse` by default, which leaves it to a person. */
  readonly casts?: "refuse" | "allow";
  /** The last word of the name the new table has while it is made; `rebuild` by default. */
  readonly suffix?: string;
}

/** The settings with every default filled. */
export interface Rewrite {
  readonly rewrite: boolean;
  readonly casts: boolean;
  readonly suffix: string;
}

/** The settings with a project's changes. */
export const settingsOf = (given: RewriteSettings = {}): Rewrite => ({
  rewrite: (given.rewrite ?? "on") === "on",
  casts: (given.casts ?? "refuse") === "allow",
  suffix: given.suffix ?? "rebuild",
});

const stmt = (sql: string): StepStatement => ({ group: "table", origin: "core", sql, of: [] });

/** The statements that make a table again as another, copying the columns they have in common, or none where a column cannot be filled. */
function rebuild(
  from: StateTable,
  to: StateTable,
  qualifier: string | undefined,
  dialect: Dialect,
  naming: Naming,
  rb: Rebuild,
  settings: Rewrite,
): readonly StepStatement[] | undefined {
  const q = dialect.quote;
  const tmp = naming.names.write([...words(to.name), settings.suffix]);
  const old = qualified(dialect, qualifier, from.name);
  const fresh = qualified(dialect, qualifier, tmp);
  const copied: { readonly target: string; readonly source: string }[] = [];
  for (const c of to.columns) {
    const was = from.columns.find((x) => x.words.join(".") === c.words.join("."));
    if (was === undefined) {
      if (!c.nullable && c.default === undefined) return undefined;
      continue;
    }
    if (was.type !== c.type) {
      if (!settings.casts) return undefined;
      copied.push({ target: c.name, source: `CAST(${q(was.name)} AS ${c.type})` });
    } else copied.push({ target: c.name, source: q(was.name) });
  }
  const lines = [
    ...to.columns.map(
      (c) => `${q(c.name)} ${c.type}${c.nullable ? "" : " NOT NULL"}${c.default === undefined ? "" : ` DEFAULT ${c.default}`}`,
    ),
    ...(to.primaryKey.length === 0 ? [] : [`PRIMARY KEY (${to.primaryKey.map(q).join(", ")})`]),
    ...to.constraints.filter((k) => k.kind !== "index").map((k) => k.text),
  ];
  return [
    ...rb.prelude.map(stmt),
    stmt(`CREATE TABLE ${fresh} (\n${lines.map((l) => `    ${l}`).join(",\n")}\n);`),
    stmt(
      `INSERT INTO ${fresh} (${copied.map((c) => q(c.target)).join(", ")}) SELECT ${copied.map((c) => c.source).join(", ")} FROM ${old};`,
    ),
    stmt(`DROP TABLE ${old};`),
    stmt(`ALTER TABLE ${fresh} RENAME TO ${q(to.name)};`),
    ...to.constraints
      .filter((k) => k.kind === "index")
      .map((k) => stmt(`CREATE INDEX IF NOT EXISTS ${q(k.name)} ON ${qualified(dialect, qualifier, to.name)} (${k.text});`)),
  ];
}

/** What makes a table made again fail where it would lose its triggers (which the engine drops with the table): their number is the same after as before. */
function triggersKept(dialect: Dialect, table: string, qualifier: string | undefined): Pick<StepDraft, "verify"> {
  const probe = dialect.probes?.triggers;
  if (probe === undefined) return {};
  const query = probe(table, qualifier);
  return {
    verify: {
      before: [{ key: "triggers", query }],
      after: [{ describe: `the triggers of ${table} are as many as they were: a table made again loses the triggers it had, and they are not made again here`, query, expect: { sameAs: "triggers" } }],
    },
  };
}

const ELIGIBLE = new Set(["addColumn", "alterNullable", "alterDefault", "alterPrimaryKey", "addConstraint", "dropConstraint"]);

/**
 * The fallback of a project's settings.
 *
 * @param given - what a project says
 * @returns the fallback, to be given to `plan` or contributed through `lifecycle.fallback`
 */
export function rewrite(given: RewriteSettings = {}): Fallback {
  const settings = settingsOf(given);
  return (change, _why, context): ReturnType<Fallback> => {
    if (!settings.rewrite) return undefined;
    const { dialect, naming } = context;
    const q = dialect.quote;
    if (change.kind === "alterType") {
      if (!settings.casts) return undefined;
      const t = qualified(dialect, context.after.qualifier, change.table.name);
      const to = `ALTER TABLE ${t} ALTER COLUMN ${q(change.to.name)} SET DATA TYPE ${change.to.type} USING CAST(${q(change.to.name)} AS ${change.to.type});`;
      const back = `ALTER TABLE ${t} ALTER COLUMN ${q(change.to.name)} SET DATA TYPE ${change.from.type} USING CAST(${q(change.to.name)} AS ${change.from.type});`;
      const inPlace = dialect.features.includes("alter-column");
      const before = context.before.tables.find((x) => x.words.join(".") === change.table.words.join("."));
      const after = context.after.tables.find((x) => x.words.join(".") === change.table.words.join("."));
      const note = {
        class: "data-dependent" as const,
        why: `the values of ${change.table.name}.${change.to.name} are cast from ${change.from.type} to ${change.to.type}, which may change or refuse them`,
      };
      if (inPlace) return { ...note, reversibility: "irreversible", up: [stmt(to)], down: [stmt(back)], of: [] } as ReturnType<Fallback>;
      if (dialect.rebuild === undefined || before === undefined || after === undefined) return undefined;
      if (
        dialect.rebuild.blockedByParents &&
        context.before.tables.some((o) =>
          o.constraints.some((k) => k.kind === "foreignKey" && k.signature.includes(`>${before.words.join(".")}(`)),
        )
      )
        return undefined;
      const up = rebuild(before, after, context.after.qualifier, dialect, naming, dialect.rebuild, settings);
      return up === undefined ? undefined : ({ ...note, reversibility: "irreversible", up, of: [], rebuild: true, ...triggersKept(dialect, before.name, context.after.qualifier) } as ReturnType<Fallback>);
    }
    const rb = dialect.rebuild;
    if (rb === undefined || !ELIGIBLE.has(change.kind) || !("table" in change) || !("words" in change.table)) return undefined;
    if (change.kind === "addConstraint" && change.constraint.kind === "index") return undefined;
    if (change.kind === "dropConstraint" && change.constraint.kind === "index") return undefined;
    const words2 = change.table.words.join(".");
    const before = context.before.tables.find((x) => x.words.join(".") === words2);
    const after = context.after.tables.find((x) => x.words.join(".") === words2);
    if (before === undefined || after === undefined) return undefined;
    // a table that others refer to cannot be dropped where the engine checks that at once
    if (
      rb.blockedByParents &&
      context.before.tables.some((o) => o.constraints.some((k) => k.kind === "foreignKey" && k.signature.includes(`>${words2}(`)))
    )
      return undefined;
    const up = rebuild(before, after, context.after.qualifier, dialect, naming, rb, settings);
    if (up === undefined) return undefined;
    const down = rebuild(after, before, context.after.qualifier, dialect, naming, rb, settings);
    const tight = change.kind === "addConstraint" || (change.kind === "alterNullable" && !change.to.nullable);
    const draft: Omit<StepDraft, "name" | "kind" | "key" | "manual" | "change"> = {
      class: tight ? "data-dependent" : "safe",
      ...(tight
        ? { why: "the rows that are there may not meet it; the table is made again and the step is undone if they do not" }
        : { why: `${dialect.name} cannot do this in place: the table ${change.table.name} is made again` }),
      reversibility: down === undefined ? "irreversible" : "lossless",
      up,
      ...(down === undefined ? {} : { down }),
      of: [],
      rebuild: true,
      ...triggersKept(dialect, before.name, context.after.qualifier),
    };
    return draft;
  };
}
