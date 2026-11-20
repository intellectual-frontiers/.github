// Spec: 0009-sql-features FR-014, FR-015
/**
 * Partitions (commons data 0009-sql-features FR-014, FR-015): a table whose rows are divided among parts by a key. The division adds `PARTITION BY` to the table, through the physical schema's
 * table clauses, and makes each part as a table of its own that holds the rows of its bounds. A key that is not a column of the table, or not in its primary key (an engine needs the key to
 * be unique within a part), or a dialect that cannot partition, is an error value.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { words } from "@intellectual-frontiers/data/governance";
import { columnNamed, featureId, sameWords, tableNamed } from "@intellectual-frontiers/data/sql/logical";
import type {
  BindContext,
  Literal,
  PhysicalError,
  Statement,
  StatementSource,
  TableClause,
} from "@intellectual-frontiers/data/sql/physical";

/** How a table is divided, and the parts. */
export type Division = { readonly table: string; readonly key: readonly string[] } & (
  | {
      readonly strategy: "range";
      readonly partitions: readonly { readonly name: string; readonly from: readonly Literal[]; readonly to: readonly Literal[] }[];
    }
  | { readonly strategy: "list"; readonly partitions: readonly { readonly name: string; readonly values: readonly Literal[] }[] }
  | {
      readonly strategy: "hash";
      readonly partitions: readonly { readonly name: string; readonly modulus: number; readonly remainder: number }[];
    }
);

/**
 * The clause that makes tables partitioned and the source that makes their parts: both come from the same divisions, so they are given together.
 *
 * @param divisions - how tables are divided
 * @returns the clause and the source
 */
export function partitions(divisions: readonly Division[]): { readonly clause: TableClause; readonly source: StatementSource } {
  const clause: TableClause = (context, table) => {
    const d = divisions.find((x) => sameWords(table.name, words(x.table)));
    if (d === undefined) return ok(undefined);
    const bad = (why: string): PhysicalError => ({ kind: "unsupported", element: table.id, why: `the division of ${d.table}: ${why}` });
    if (!context.dialect.features.includes("partitions")) return err([bad(`${context.dialect.name} has no partitions`)]);
    const errors: PhysicalError[] = [];
    const names: string[] = [];
    for (const k of d.key) {
      const c = columnNamed(table, k);
      const n = c === undefined ? undefined : context.written.column(c.id);
      if (c === undefined || n === undefined) errors.push(bad(`the table has no column ${k}`));
      else {
        names.push(context.dialect.quote(n));
        if (!table.primaryKey.some((p) => sameWords(p, c.name))) errors.push(bad(`${k} is not in the primary key`));
      }
    }
    if (d.key.length === 0) errors.push(bad("it has no key"));
    return errors.length > 0 ? err(errors) : ok(`PARTITION BY ${d.strategy.toUpperCase()} (${names.join(", ")})`);
  };
  const source: StatementSource = (context: BindContext) => {
    const { dialect, schema, written, naming } = context;
    if (!dialect.features.includes("partitions")) return ok([]);
    const errors: PhysicalError[] = [];
    const out: Statement[] = [];
    for (const d of divisions) {
      const t = tableNamed(schema, d.table);
      const tn = t === undefined ? undefined : written.table(t.id);
      if (t === undefined || tn === undefined) {
        errors.push({
          kind: "unsupported",
          element: featureId("partition", words(d.table)),
          why: `the division of ${d.table}: the schema has no table ${d.table}`,
        });
        continue;
      }
      for (const p of d.partitions) {
        const name = naming.names.write([...t.name, ...words(p.name)]);
        const id = featureId("partition", [...t.name, ...words(p.name)]);
        if (written.tableName(name).length > dialect.maxName)
          errors.push({ kind: "length", element: id, name: written.tableName(name), max: dialect.maxName });
        const lit = (vs: readonly Literal[]): string => vs.map((v) => dialect.literal(v)).join(", ");
        const bounds =
          d.strategy === "range"
            ? (() => {
                const r = p as { from: readonly Literal[]; to: readonly Literal[] };
                return `FROM (${lit(r.from)}) TO (${lit(r.to)})`;
              })()
            : d.strategy === "list"
              ? `IN (${lit((p as { values: readonly Literal[] }).values)})`
              : `WITH (MODULUS ${(p as { modulus: number }).modulus}, REMAINDER ${(p as { remainder: number }).remainder})`;
        out.push({
          group: "table",
          sql: `CREATE TABLE IF NOT EXISTS ${written.qualify(name)} PARTITION OF ${written.ref(t.id)} FOR VALUES ${bounds};`,
          of: [t.id, id],
        });
      }
    }
    return errors.length > 0 ? err(errors) : ok(out);
  };
  return { clause, source };
}
