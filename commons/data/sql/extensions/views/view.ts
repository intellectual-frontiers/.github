// Spec: 0009-sql-features FR-005, FR-006, FR-007
/**
 * Views (commons data 0009-sql-features FR-005 to FR-007): a view is derived, so it is not governance; it is made from a typed definition of tables and columns named as governance names them
 * (`partyId`), written by the case style, and replaced where the dialect can say so or dropped and made again where it cannot.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { words } from "@intellectual-frontiers/data/governance";
import { columnNamed, featureId, type LogicalId, tableNamed } from "@intellectual-frontiers/data/sql/logical";
import type { BindContext, Literal, PhysicalError, Statement, StatementSource } from "@intellectual-frontiers/data/sql/physical";

/** A column of a table, as governance names them. */
export interface ColumnRef {
  readonly table: string;
  readonly column: string;
}

/** A column a view shows, and the name it is shown by where that is not the column's. */
export interface ViewColumn extends ColumnRef {
  readonly as?: string;
}

/** A join to another table, where two columns are equal. */
export interface Join {
  readonly table: string;
  readonly on: readonly [ColumnRef, ColumnRef];
}

/** What a row must meet: a column is null, is not null, or is equal to a literal. */
export type Condition = ColumnRef & ({ readonly is: "null" } | { readonly is: "notNull" } | { readonly equals: Literal });

/** A view. */
export interface ViewDefinition {
  /** Its name as governance writes names, lower camel case. */
  readonly name: string;
  readonly description: string;
  /** The table it is drawn from. */
  readonly from: string;
  readonly joins?: readonly Join[];
  readonly columns: readonly ViewColumn[];
  readonly where?: readonly Condition[];
}

/**
 * The source of the views.
 *
 * @param definitions - the views, in the order they are made
 * @returns a statement source
 */
export function viewsSource(definitions: readonly ViewDefinition[]): StatementSource {
  return (context: BindContext) => {
    const { schema, dialect, written } = context;
    const q = (n: string): string => dialect.quote(n);
    const errors: PhysicalError[] = [];
    const out: Statement[] = [];
    for (const v of definitions) {
      const id = featureId("view", words(v.name));
      const bad = (why: string): void => void errors.push({ kind: "unsupported", element: id, why: `the view ${v.name}: ${why}` });
      const used: LogicalId[] = [];
      const ref = (r: ColumnRef): string | undefined => {
        const t = tableNamed(schema, r.table);
        if (t === undefined) return void bad(`the schema has no table ${r.table}`);
        const c = columnNamed(t, r.column);
        if (c === undefined) return void bad(`the table ${r.table} has no column ${r.column}`);
        const tn = written.table(t.id);
        const cn = written.column(c.id);
        if (tn === undefined || cn === undefined) return void bad(`${r.table}.${r.column} was not written`);
        used.push(t.id, c.id);
        return `${written.ref(t.id)}.${q(cn)}`;
      };
      const from = tableNamed(schema, v.from);
      const fromName = from === undefined ? undefined : written.table(from.id);
      if (from === undefined || fromName === undefined) {
        bad(`the schema has no table ${v.from}`);
        continue;
      }
      if (v.columns.length === 0) bad("it shows no column");
      const name = context.naming.names.write(words(v.name));
      if (schema.tables.some((t) => written.table(t.id) === name)) bad(`${name} is the name of a table`);
      const shown = v.columns.map((c) => ({ ref: ref(c), as: context.naming.names.write(words(c.as ?? c.column)) }));
      const joins = (v.joins ?? []).map((j) => {
        const jt = tableNamed(schema, j.table);
        const jn = jt === undefined ? undefined : written.table(jt.id);
        if (jt === undefined || jn === undefined) return void bad(`the schema has no table ${j.table}`);
        const a = ref(j.on[0]);
        const b = ref(j.on[1]);
        return a === undefined || b === undefined ? undefined : `  JOIN ${written.ref(jt.id)} ON ${a} = ${b}`;
      });
      const conditions = (v.where ?? []).map((c) => {
        const r = ref(c);
        if (r === undefined) return undefined;
        return "is" in c ? `${r} IS ${c.is === "null" ? "NULL" : "NOT NULL"}` : `${r} = ${dialect.literal(c.equals)}`;
      });
      if (errors.length > 0) continue;
      const select = shown.map((s) => s.ref ?? "").join(", ");
      const body =
        `SELECT ${select}\n  FROM ${written.ref(from.id)}` +
        joins.map((j) => `\n${j ?? ""}`).join("") +
        (conditions.length === 0 ? "" : `\n WHERE ${conditions.map((c) => c ?? "").join(" AND ")}`);
      const head = `${q(name)} (${shown.map((s) => q(s.as)).join(", ")}) AS\n${body};`;
      const of = [...new Set(used)];
      if (dialect.features.includes("or-replace-view")) out.push({ group: "view", sql: `CREATE OR REPLACE VIEW ${head}`, of });
      else {
        out.push({ group: "view", sql: `DROP VIEW IF EXISTS ${q(name)};`, of });
        out.push({ group: "view", sql: `CREATE VIEW ${head}`, of });
      }
      if (dialect.features.includes("comment-on") && v.description.trim() !== "")
        out.push({ group: "view", sql: `COMMENT ON VIEW ${q(name)} IS ${dialect.literal(v.description)};`, of });
    }
    return errors.length > 0 ? err(errors) : ok(out);
  };
}
