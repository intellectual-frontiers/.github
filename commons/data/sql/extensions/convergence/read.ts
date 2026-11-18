// Spec: 0019-sql-convergence FR-001, FR-002, FR-003
/**
 * Reading a database (commons data 0019-sql-convergence FR-001 to FR-003): the state a database is in, from its own catalog read by its dialect. A table and a column are found by the words of
 * their names; a type that is the desired state's under another name is the desired state's; what the dialect cannot list is taken from the desired state, so that it is not a difference; and the
 * state of a database made from the desired schema has the hash of the desired state.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { words } from "@intellectual-frontiers/data/governance";
import type { Driver, State, StateColumn, StateConstraint, StateRow, StateTable } from "@intellectual-frontiers/data/sql/lifecycle";
import type { LogicalType } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, qualified } from "@intellectual-frontiers/data/sql/physical";

const SYNONYMS: readonly (readonly [string, string])[] = [
  ["character varying", "varchar"],
  ["timestamp with time zone", "timestamptz"],
  ["timestamp without time zone", "timestamp"],
  ["double precision", "double"],
  ["decimal", "numeric"],
  ["character", "char"],
  ["int4", "integer"],
  ["int", "integer"],
  ["bool", "boolean"],
];

/** A type with its synonyms put together, so that `character varying(10)` and `VARCHAR(10)` are the same. */
export function normalizeType(t: string): string {
  let out = t
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1")
    .trim();
  for (const [from, to] of SYNONYMS) out = out.replace(new RegExp(`^${from}(?![a-z])`), to);
  return out;
}

/** Whether two written types are the same type. */
export const sameType = (a: string, b: string): boolean => normalizeType(a) === normalizeType(b);

const PLAIN: readonly LogicalType[] = [
  { kind: "text" },
  { kind: "integer" },
  { kind: "boolean" },
  { kind: "date" },
  { kind: "timestamp", zone: true },
  { kind: "timestamp", zone: false },
  { kind: "json" },
  { kind: "bytes" },
];

/** A type as the dialect writes it, found from what the catalog calls it, so that a column that has no counterpart in the state wanted is still in the state's own spelling. */
export function spell(dialect: Dialect, live: string): string {
  const n = normalizeType(live);
  for (const t of PLAIN) if (normalizeType(dialect.type(t)) === n) return dialect.type(t);
  let m: RegExpMatchArray | null;
  if ((m = n.match(/^varchar\((\d+)\)$/))) return dialect.type({ kind: "text", max: Number(m[1]) });
  if ((m = n.match(/^numeric\((\d+)(?:,(\d+))?\)$/)))
    return dialect.type({ kind: "decimal", precision: Number(m[1]), ...(m[2] === undefined ? {} : { scale: Number(m[2]) }) });
  if (n === "numeric") return dialect.type({ kind: "decimal" });
  if ((m = n.match(/^(?:vector\((\d+)\)|float\[(\d+)\])$/))) return dialect.type({ kind: "vector", dimensions: Number(m[1] ?? m[2]) });
  return live;
}

/** What is wrong with a read. */
export type ReadError = { readonly kind: "unsupported"; readonly why: string };

/**
 * The state a database is in.
 *
 * @param driver - the database
 * @param dialect - its dialect, which reads its catalog
 * @param desired - the state wanted, which names are matched to and types and what the dialect cannot list are taken from
 * @param options - the names to leave out
 * @returns the state, or why the dialect cannot read
 */
export async function readState(
  driver: Driver,
  dialect: Dialect,
  desired: State,
  options: { readonly ignore?: readonly string[] } = {},
): Promise<Result<State, readonly ReadError[]>> {
  if (dialect.catalog === undefined) return err([{ kind: "unsupported", why: `${dialect.name} cannot read its own catalog` }]);
  const live = await dialect.catalog.read((sql) => driver.query(sql), desired.qualifier);
  const skip = new Set(options.ignore ?? []);
  // the words the schema put before a table's own, where the dialect has no schemas
  const first = desired.tables[0];
  const prefix = first === undefined ? [] : words(first.name).slice(0, Math.max(0, words(first.name).length - first.words.length));
  const tables: StateTable[] = [];
  for (const t of live) {
    if (skip.has(t.name)) continue;
    const want = desired.tables.find((d) => d.name === t.name);
    const w =
      want?.words ??
      (prefix.length > 0 && words(t.name).slice(0, prefix.length).join(".") === prefix.join(".")
        ? words(t.name).slice(prefix.length)
        : words(t.name));
    const columns: StateColumn[] = t.columns.map((c) => {
      const d = want?.columns.find((x) => x.name === c.name);
      // a column that governance says was renamed is still under its old name here: its type is compared with the new one's
      const renamed = d === undefined ? want?.columns.find((x) => x.renamedFrom?.join(".") === words(c.name).join(".")) : undefined;
      const typed = d ?? renamed;
      return {
        id: d?.id ?? `column:${w.join(".")}/${words(c.name).join(".")}`,
        words: d?.words ?? words(c.name),
        name: c.name,
        type: typed !== undefined && sameType(typed.type, c.type) ? typed.type : spell(dialect, c.type),
        nullable: c.nullable,
        ...(d?.default === undefined ? {} : { default: d.default }),
      };
    });
    const kinds = ["foreignKey", "unique", "check"] as const;
    const constraints: StateConstraint[] = [];
    for (const k of kinds) {
      if (t.constraints === undefined) constraints.push(...(want?.constraints.filter((c) => c.kind === k) ?? []));
      else
        for (const c of t.constraints.filter((x) => x.kind === k))
          constraints.push(
            want?.constraints.find((d) => d.kind === k && d.name === c.name) ?? {
              id: `${k}:${c.name}`,
              kind: k,
              name: c.name,
              signature: `unknown:${c.name}`,
              text: "",
            },
          );
    }
    for (const name of t.indexes)
      constraints.push(
        want?.constraints.find((d) => d.kind === "index" && d.name === name) ?? {
          id: `ix:${name}`,
          kind: "index",
          name,
          signature: `unknown:${name}`,
          text: "",
        },
      );
    // the rows of a code table are part of the state
    let rows: StateRow[] = [];
    if (want !== undefined && want.rows.length > 0 && columns.length >= 3) {
      const [c0, c1, c2] = columns.map((c) => dialect.quote(c.name));
      const found = await driver.query(`SELECT ${c0} AS a, ${c1} AS b, ${c2} AS c FROM ${qualified(dialect, desired.qualifier, t.name)}`);
      rows = found.map((r) => ({
        code: String(r["a"]),
        label: String(r["b"]),
        description: r["c"] === null || r["c"] === undefined ? null : String(r["c"]),
      }));
    }
    tables.push({
      id: want?.id ?? `table:${w.join(".")}`,
      words: w,
      name: t.name,
      columns,
      primaryKey: t.primaryKey,
      constraints,
      rows,
      ...(want?.clause === undefined ? {} : { clause: want.clause }),
    });
  }
  return ok({
    format: 1,
    dialect: desired.dialect,
    naming: desired.naming,
    ...(desired.qualifier === undefined ? {} : { qualifier: desired.qualifier }),
    tables,
  });
}
