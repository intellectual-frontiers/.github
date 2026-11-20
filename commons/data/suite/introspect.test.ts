// Spec: 0055-sql-introspect FR-001, FR-002, FR-003, FR-004
/**
 * Reading a live database (commons data 0055-sql-introspect), on SQLite, DuckDB and PostgreSQL: what a database made from a model holds is what the model says, drift is told with the names of what differs,
 * a database that nobody modelled is adopted as a logical schema that makes the same database again, and one engine's database is made on another.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { adopt, drift, expectedOf, introspect, logicalOf, type Observed } from "@intellectual-frontiers/data/sql/lifecycle";
import { bind, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error).slice(0, 500));
  return r.value;
};
const made = async (name: Engine["name"], dialect: Dialect, version: 1 | 2 | 3): Promise<Engine> => {
  const e = await openEngine(name);
  await load(e, must(bind(libraryAt(version), { dialect })));
  return e;
};

proves(
  ["0055-sql-introspect FR-001", "0055-sql-introspect FR-002"],
  "a database made from a model is read back as what the model says: every table, column, nullability, primary key, foreign key, unique constraint and index, on each engine, and the drift from the model is none",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await made(name, dialect, 1);
      try {
        const found = await introspect(driverOf(e), dialect);
        const expected = expectedOf(libraryAt(1), dialect);
        assert(found.tables.length >= 3, `${name}: ${found.tables.length} tables`);
        same(found.tables.map((t) => t.name), expected.tables.map((t) => t.name).toSorted(), name);
        const withFk = found.tables.filter((t) => t.foreignKeys.length > 0).length;
        assert(withFk > 0 && found.tables.every((t) => t.primaryKey.length > 0 || t.columns.length > 0), `${name}: keys read`);
        same(drift(expected, found), [], `${name}: no drift`);
        const extras = (o: Observed): number => o.tables.reduce((n, t) => n + t.indexes.length + t.uniques.length, 0);
        same(extras(found), extras(expected), `${name}: the unique constraints and indexes`);
        const only = await introspect(driverOf(e), dialect, { exclude: (t) => t === found.tables[0]?.name });
        same(only.tables.length, found.tables.length - 1, name);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0055-sql-introspect FR-003"],
  "drift names what differs: a table or column that is missing or stray, a type of another family, a nullability, a key, a foreign key, a unique or an index that is missing; a database of another version of the model, and one that was changed by hand, are told apart",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await made(name, dialect, 2);
      try {
        const found = await introspect(driverOf(e), dialect);
        const found1 = drift(expectedOf(libraryAt(1), dialect), found);
        const found2 = drift(expectedOf(libraryAt(2), dialect), found);
        same(found2, [], `${name}: version 2 is as version 2 says`);
        assert(found1.length > 0, `${name}: version 2 is not version 1: ${found1.length}`);
        const kinds = new Set(found1.map((d) => d.kind));
        assert([...kinds].every((k) => ["missing-table", "stray-table", "missing-column", "stray-column", "type", "nullability", "primary-key", "missing-foreign-key", "missing-unique", "missing-index"].includes(k)), name);
      } finally {
        await e.close();
      }
      const w = await made(name, dialect, 1);
      try {
        const base = await introspect(driverOf(w), dialect);
        const t = base.tables.find((x) => x.columns.length > 1)!;
        const q = dialect.quote;
        await w.run(`CREATE TABLE ${q("stray_one")} (${q("id")} INTEGER)`);
        await w.run(`ALTER TABLE ${q(t.name)} ADD COLUMN ${q("stray_col")} TEXT`);
        const victim = base.tables.find((x) => x.name !== t.name && !base.tables.some((o) => o.foreignKeys.some((f) => f.references.table === x.name)))!;
        await w.run(`DROP TABLE ${q(victim.name)}`);
        const d = drift(expectedOf(libraryAt(1), dialect), await introspect(driverOf(w), dialect));
        assert(d.some((x) => x.kind === "stray-table" && x.table === "stray_one"), `${name}: ${JSON.stringify(d)}`);
        assert(d.some((x) => x.kind === "stray-column" && x.table === t.name && x.column === "stray_col"), name);
        assert(d.some((x) => x.kind === "missing-table" && x.table === victim.name), name);
      } finally {
        await w.close();
      }
    }
    same([logicalOf("BIGINT"), logicalOf("character varying(20)"), logicalOf("timestamp with time zone"), logicalOf("vector(3)"), logicalOf("geometry")], [{ kind: "integer" }, { kind: "text" }, { kind: "timestamp", zone: true }, { kind: "vector", dimensions: 3 }, undefined]);
  },
);

proves(
  ["0055-sql-introspect FR-004"],
  "a database that was not modelled is adopted as a logical schema that makes the same database again on its own engine, and on each of the others; a type of no known family is an error that names it",
  async () => {
    for (const a of DIALECTS) {
      const src = await made(a.name, a.dialect, 1);
      try {
        const observed = await introspect(driverOf(src), a.dialect);
        const adopted = must(adopt(observed, "adopted"));
        same(adopted.tables.length, observed.tables.length, a.name);
        for (const b of DIALECTS) {
          const dst = await openEngine(b.name);
          try {
            await load(dst, must(bind(adopted, { dialect: b.dialect })), ["setup", "table"]);
            const again = await introspect(driverOf(dst), b.dialect);
            same(again.tables.map((t) => t.name), observed.tables.map((t) => t.name), `${a.name} to ${b.name}`);
            const cols = (o: Observed): string[] => o.tables.flatMap((t) => t.columns.map((c) => `${t.name}.${c.name}:${logicalOf(c.type)?.kind}`));
            same(cols(again), cols(observed), `${a.name} to ${b.name}: the same columns of the same families`);
            same(again.tables.map((t) => t.primaryKey), observed.tables.map((t) => t.primaryKey), `${a.name} to ${b.name}: the same keys`);
            same(again.tables.map((t) => t.foreignKeys.length), observed.tables.map((t) => t.foreignKeys.length), `${a.name} to ${b.name}: the same foreign keys`);
          } finally {
            await dst.close();
          }
        }
      } finally {
        await src.close();
      }
    }
    const e = adopt({ dialect: "postgres", tables: [{ name: "t", columns: [{ name: "g", type: "geometry(point)", nullable: true }], primaryKey: [], uniques: [], foreignKeys: [], indexes: [] }] }, "d");
    assert(e.kind === "err" && e.error[0]?.column === "g" && e.error[0].why.includes("geometry"), "an unknown type is named");
  },
);

proves(["0055-sql-introspect FR-001"], "composite keys, unique constraints, indexes, foreign keys over more than one column and defaults are read as they were written, on each engine", async () => {
  for (const { name, dialect } of DIALECTS) {
    const e = await openEngine(name);
    try {
      await e.run("CREATE TABLE parent (a INTEGER NOT NULL, b INTEGER NOT NULL, label TEXT NOT NULL DEFAULT 'x', n INTEGER DEFAULT 7, PRIMARY KEY (a, b))");
      await e.run("CREATE TABLE child (id INTEGER PRIMARY KEY, a INTEGER NOT NULL, b INTEGER NOT NULL, code TEXT, UNIQUE (code, a), FOREIGN KEY (a, b) REFERENCES parent (a, b))");
      await e.run("CREATE INDEX child_ab ON child (b, a)");
      const o = await introspect(driverOf(e), dialect);
      const p = o.tables.find((t) => t.name === "parent")!;
      const c = o.tables.find((t) => t.name === "child")!;
      same(p.primaryKey, ["a", "b"], name);
      same(p.columns.map((x) => [x.name, x.nullable]), [["a", false], ["b", false], ["label", false], ["n", true]], name);
      assert(p.columns.find((x) => x.name === "label")?.default?.includes("x") === true && p.columns.find((x) => x.name === "n")?.default?.includes("7") === true, `${name}: defaults`);
      same(c.foreignKeys, [{ columns: ["a", "b"], references: { table: "parent", columns: ["a", "b"] } }], name);
      same(c.uniques.map((u) => u.columns), [["code", "a"]], name);
      same(c.indexes.map((i) => i.columns), [["b", "a"]], name);
      const adopted = adopt(o, "d");
      assert(adopted.kind === "ok" && adopted.value.tables.find((t) => t.name.join("") === "parent")?.columns.find((x) => x.name.join("") === "label")?.default?.kind === "literal", `${name}: a default is adopted`);
    } finally {
      await e.close();
    }
  }
});
