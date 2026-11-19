// Spec: 0052-sql-quality FR-009
/**
 * Tests that a schema asks for (commons data 0052-sql-quality): what a schema says of its tables (a column that is not null, a primary key, the codes of a code table) is also a data test, as dbt's
 * codegen writes them from a database. A database that enforces the schema passes them; one that was loaded around it, or a view of it, is held to them.
 *
 * @module
 */
import type { State } from "@intellectual-frontiers/data/sql/lifecycle";
import { acceptedValues, notNull, unique, uniqueCombinationOfColumns } from "./generic.ts";
import { type DqTest, on, type Relation, use } from "./test.ts";

/**
 * The tests of a state: `not_null` for a column that is not null (a key's columns are covered by the key), `unique` and `not_null` for a one-column primary key, `unique_combination_of_columns` for a longer
 * one, and `accepted_values` for the codes of a code table.
 *
 * @param relation - the relation a table of the state is in the database as
 */
export function testsFromState(state: State, relation: (table: string) => Relation = (name) => ({ name, ...(state.qualifier === undefined ? {} : { schema: state.qualifier }) })): readonly DqTest[] {
  return state.tables.flatMap((t) => {
    const r = on(relation(t.name));
    const out: DqTest[] = [];
    const key = t.primaryKey;
    for (const c of t.columns) if (!c.nullable && !key.includes(c.name)) out.push(...r.column(c.name, use(notNull)));
    if (key.length === 1 && key[0] !== undefined) out.push(...r.column(key[0], use(notNull), use(unique)));
    if (key.length > 1) {
      out.push(...key.flatMap((k) => r.column(k, use(notNull))));
      out.push(...r.model(use(uniqueCombinationOfColumns, { columns: key as unknown as readonly [string, ...string[]] })));
    }
    if (t.rows.length > 0 && key.length === 1 && key[0] !== undefined) out.push(...r.column(key[0], use(acceptedValues, { values: t.rows.map((row) => row.code) })));
    return out;
  });
}
