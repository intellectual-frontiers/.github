// Spec: 0020-sql-parallel-versions FR-001
/**
 * The expanded schema (commons data 0020-sql-parallel-versions FR-001): what the tables hold while versions overlap. The latest version's schema, with each column and table an older live version
 * still uses and the latest does not have added as optional, and each column only the latest has made optional, so that an older version's writes are not refused. A column that governance says
 * was renamed is the same column.
 *
 * @module
 */
import { vocabularies, words } from "@intellectual-frontiers/data/governance";
import { carriedOf, columnId, type Column, type LogicalSchema, sameWords, type Table, tableId } from "@intellectual-frontiers/data/sql/logical";

const { lifecycle } = vocabularies;

/** The table of a schema that is the same table as another's, by its words or by what governance says it was called. */
export function matchTable(schema: LogicalSchema, other: Table): Table | undefined {
  return (
    schema.tables.find((t) => sameWords(t.name, other.name)) ??
    schema.tables.find((t) => carriedOf(t, lifecycle.renamedFrom).some((o) => sameWords(words(o), other.name))) ??
    schema.tables.find((t) => carriedOf(other, lifecycle.renamedFrom).some((o) => sameWords(words(o), t.name)))
  );
}

/** The column of a table that is the same column as another's, by its words or by what governance says it was called. */
export function matchColumn(table: Table, other: Column): Column | undefined {
  return (
    table.columns.find((c) => sameWords(c.name, other.name)) ??
    table.columns.find((c) => carriedOf(c, lifecycle.renamedFrom).some((o) => sameWords(words(o), other.name))) ??
    table.columns.find((c) => carriedOf(other, lifecycle.renamedFrom).some((o) => sameWords(words(o), c.name)))
  );
}

const optional = (c: Column): Column => {
  const { default: _d, ...rest } = c;
  return { ...rest, nullable: true };
};

/**
 * The schema the tables are made to during the overlap.
 *
 * @param latest - the latest version's logical schema
 * @param older - the logical schemas of the older live versions
 * @returns the latest's schema with what the older versions still use kept, and what only the latest has made optional
 */
export function expandSchema(latest: LogicalSchema, older: readonly LogicalSchema[]): LogicalSchema {
  if (older.length === 0) return latest;
  const tables = latest.tables.map((t): Table => {
    const known = older.map((o) => o.tables.find((x) => matchTable({ ...o, tables: [t] }, x) !== undefined)).filter((x): x is Table => x !== undefined);
    if (known.length === 0) return t;
    const kept: Column[] = t.columns.map((c) => (known.some((k) => matchColumn(k, c) !== undefined) || t.primaryKey.some((p) => sameWords(p, c.name)) ? c : optional(c)));
    for (const k of known)
      for (const c of k.columns) {
        if (matchColumn(t, c) !== undefined || kept.some((x) => sameWords(x.name, c.name))) continue;
        kept.push({ ...optional(c), id: columnId(t.name, c.name) });
      }
    return { ...t, columns: kept };
  });
  for (const o of older)
    for (const t of o.tables) {
      if (tables.some((x) => matchTable({ ...latest, tables: [x] }, t) !== undefined)) continue;
      tables.push({
        ...t,
        id: tableId(t.name),
        columns: t.columns.map((c) => (t.primaryKey.some((p) => sameWords(p, c.name)) ? c : optional(c))),
        foreignKeys: [],
        uniques: [],
        checks: [],
        indexes: [],
        ...(t.rows === undefined ? {} : { rows: t.rows }),
      });
    }
  return { ...latest, tables };
}
