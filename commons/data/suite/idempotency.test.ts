// Spec: 0012-sql-idempotency FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * The idempotency feature (commons data 0012-sql-idempotency): statements are written in their natural form where the dialect has one and carry a guard where it has none; each step says which;
 * a guard is honoured by a run and part of the step's identity; a step a person wrote relies on the ledger unless it is guarded; and on SQLite, DuckDB and PostgreSQL every step of a plan can be
 * run twice, without the ledger, with the result of running it once.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { compose } from "@intellectual-frontiers/data/engine";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import {
  defaultIdempotency,
  guardInline,
  idempotency,
  idempotencyExtension,
  planOptions,
} from "@intellectual-frontiers/data/sql/extensions/idempotency";
import {
  applyStatement,
  emptyState,
  plan,
  type Plan,
  snapshotOf,
  type State,
  type StateTable,
  stateHash,
  transformsFrom,
} from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, structure, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";
import { bind } from "@intellectual-frontiers/data/sql/physical";

const snap = (v: 1 | 2 | 3, d: Dialect): State => {
  const r = snapshotOf(libraryAt(v), { dialect: d });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const planOf = (from: State | undefined, v: 1 | 2 | 3, d: Dialect, options: Parameters<typeof plan>[3] = {}): Plan => {
  const r = plan(from, libraryAt(v), { dialect: d }, { transforms: [idempotency()], allow: { destructive: true }, ...options });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const edit = (s: State, table: string, fn: (t: StateTable) => StateTable): State => ({
  ...s,
  tables: s.tables.map((t) => (t.name === table ? fn(t) : t)),
});
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};
const shape = async (e: Engine): Promise<unknown> => {
  const s = await structure(e);
  return Object.fromEntries(
    Object.entries(s.tables)
      .map(([n, t]) => [n, Object.keys(t.columns).sort()])
      .sort(([a], [b]) => ((a as string) < (b as string) ? -1 : 1)),
  );
};

proves(
  ["0012-sql-idempotency FR-001"],
  "a dialect says which forms have IF EXISTS and gives a probe for a table, a column, a constraint and an index that finds it on the engine",
  async () => {
    same(postgres.ifExists, ["addColumn", "dropColumn", "dropConstraint", "dropTable", "dropIndex"]);
    same(duckdb.ifExists, ["addColumn", "dropColumn", "dropTable", "dropIndex"]);
    same(sqlite.ifExists, ["dropTable", "dropIndex"]);
    same(
      [postgres, duckdb, sqlite].map((d) => d.probes?.constraint("t", "c") === undefined),
      [false, true, true],
    );
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const p = dialect.probes;
        assert(p !== undefined);
        if (p === undefined) return;
        await e.run('CREATE TABLE "t" ("id" INTEGER PRIMARY KEY, "v" INTEGER, CONSTRAINT "t_v_ck" CHECK ("v" > 0))');
        await e.run('CREATE INDEX "t_v_idx" ON "t" ("v")');
        const found = async (q: string | undefined): Promise<boolean> => q !== undefined && (await e.rows(q)).length > 0;
        assert((await found(p.table("t"))) && !(await found(p.table("nope"))), `${name}: table`);
        assert(
          (await found(p.column("t", "v"))) && !(await found(p.column("t", "nope"))) && !(await found(p.column("nope", "v"))),
          `${name}: column`,
        );
        assert((await found(p.index("t_v_idx"))) && !(await found(p.index("nope"))), `${name}: index`);
        if (name === "postgres")
          assert((await found(p.constraint("t", "t_v_ck"))) && !(await found(p.constraint("t", "nope"))), `${name}: constraint`);
      });
    }
  },
);

proves(
  ["0012-sql-idempotency FR-002"],
  "a run skips a guarded statement whose work is done, and the guard is part of the identity of the step",
  async () => {
    await withEngine("sqlite", async (e) => {
      const d = driverOf(e);
      await e.run('CREATE TABLE "t" ("id" INTEGER)');
      const add = { group: "table" as const, origin: "core" as const, sql: 'ALTER TABLE "t" ADD COLUMN "v" INTEGER;', of: [] };
      const guard = { query: sqlite.probes?.column("t", "v") ?? "", skipWhen: "rows" as const };
      same(await applyStatement(d, { ...add, guard }), true, "run when the work is not done");
      same(await applyStatement(d, { ...add, guard }), false, "skipped when it is");
      same(
        await applyStatement(d, {
          group: "table",
          origin: "core",
          sql: 'ALTER TABLE "t" ADD COLUMN "w" INTEGER;',
          of: [],
          guard: { query: "SELECT 1 WHERE 0", skipWhen: "none" },
        }),
        false,
      );
    });
    const plain = plan(snap(1, sqlite), libraryAt(2), { dialect: sqlite });
    const guarded = plan(snap(1, sqlite), libraryAt(2), { dialect: sqlite }, { transforms: [idempotency()] });
    assert(plain.kind === "ok" && guarded.kind === "ok");
    if (plain.kind === "ok" && guarded.kind === "ok") {
      assert(
        plain.value.steps.some((s, i) => s.id !== guarded.value.steps[i]?.id && s.up[0]?.sql === guarded.value.steps[i]?.up[0]?.sql),
        "the guard alone changes the identifier",
      );
      same(plain.value.to, guarded.value.to);
    }
  },
);

proves(
  ["0012-sql-idempotency FR-003", "0012-sql-idempotency FR-004"],
  "a statement is natural where the dialect has a form, guarded where it has none, and the step says which",
  () => {
    const level = (d: Dialect, from: State | undefined, v: 1 | 2 | 3): string[] =>
      planOf(from, v, d).steps.map((s) => `${s.kind}:${s.idempotency}`);
    // PostgreSQL has a natural form for a column; SQLite guards it; a table is natural everywhere
    assert(level(postgres, snap(1, postgres), 2).includes("addColumn:natural"));
    assert(level(duckdb, snap(1, duckdb), 2).includes("addColumn:natural"));
    assert(level(sqlite, snap(1, sqlite), 2).includes("addColumn:guarded"));
    for (const d of [postgres, duckdb, sqlite])
      assert(
        level(d, undefined, 1).every((l) => l.endsWith(":natural")),
        `${d.name}: create table, indexes and rows`,
      );
    const add = planOf(snap(1, postgres), 2, postgres).steps.find((s) => s.kind === "addColumn");
    assert(
      add?.up[0]?.sql.includes("ADD COLUMN IF NOT EXISTS") &&
        add.down?.[0]?.sql.includes("DROP COLUMN IF EXISTS") &&
        add.up[0].guard === undefined,
    );
    const sq = planOf(snap(1, sqlite), 2, sqlite).steps.find((s) => s.kind === "addColumn");
    assert(
      sq?.up[0]?.guard?.skipWhen === "rows" &&
        sq.up[0].guard.query.includes("pragma_table_info") &&
        !sq.up[0].sql.includes("IF NOT EXISTS"),
    );
    // a rename is guarded on every engine, a drop is natural where there is a form
    for (const d of [postgres, duckdb, sqlite]) {
      const r = planOf(snap(2, d), 3, d).steps;
      assert(r.find((s) => s.kind === "renameColumn")?.idempotency === "guarded", `${d.name}: rename`);
      assert(r.find((s) => s.kind === "renameColumn")?.up[0]?.guard?.skipWhen === "none");
    }
    same(planOf(snap(2, postgres), 3, postgres).steps.find((s) => s.kind === "dropColumn")?.idempotency, "natural");
    same(planOf(snap(2, sqlite), 3, sqlite).steps.find((s) => s.kind === "dropColumn")?.idempotency, "guarded");
    // a constraint added is guarded by the catalog where it can be asked, and a constraint dropped is natural on PostgreSQL
    const noFk = edit(snap(1, postgres), "book", (t) => ({ ...t, constraints: t.constraints.filter((c) => c.kind !== "foreignKey") }));
    const fks = planOf(noFk, 1, postgres).steps;
    assert(
      fks.length === 2 &&
        fks.every(
          (s) => s.idempotency === "guarded" && s.up[0]?.guard?.query.includes("pg_constraint") && s.up[0].guard.skipWhen === "rows",
        ),
    );
    same(fks[0]?.down?.[0]?.sql.includes("DROP CONSTRAINT IF EXISTS"), true);
    // a statement that is idempotent already is left as it is
    const created = planOf(undefined, 1, postgres).steps[0];
    assert(created?.up.every((s) => s.guard === undefined) && created.idempotency === "natural");
    same(
      plan(undefined, libraryAt(1), { dialect: postgres }, {}).kind === "ok" ? "plain" : "",
      "plain",
      "without the transform the steps say nothing",
    );
    const raw = plan(undefined, libraryAt(1), { dialect: postgres });
    assert(raw.kind === "ok" && raw.value.steps.every((s) => s.idempotency === undefined));
  },
);

proves(
  ["0012-sql-idempotency FR-005", "0012-sql-idempotency FR-007"],
  "a step a person wrote relies on the ledger unless it is guarded, and a project can refuse such a step",
  () => {
    const typed = edit(snap(1, postgres), "book", (t) => ({
      ...t,
      columns: t.columns.map((c) => (c.name === "title" ? { ...c, type: "VARCHAR(10)" } : c)),
    }));
    const manual = (guard?: { query: string; skipWhen: "rows" | "none" }) => [
      {
        resolves: "alterType:book.title",
        name: "widen",
        up: ['ALTER TABLE "book" ALTER COLUMN "title" TYPE TEXT'],
        ...(guard === undefined ? {} : { guard }),
      },
    ];
    const bare = plan(typed, libraryAt(1), { dialect: postgres }, { manual: manual(), transforms: [idempotency()] });
    assert(bare.kind === "ok" && bare.value.steps[0]?.manual === true && bare.value.steps[0].idempotency === "ledger-only");
    const g = plan(
      typed,
      libraryAt(1),
      { dialect: postgres },
      { manual: manual({ query: "SELECT 1 WHERE 0", skipWhen: "none" }), transforms: [idempotency()] },
    );
    assert(g.kind === "ok" && g.value.steps[0]?.idempotency === "guarded" && g.value.steps[0].up[0]?.guard !== undefined);
    const refused = plan(typed, libraryAt(1), { dialect: postgres }, { ...planOptions({ unguardable: "refuse" }), manual: manual() });
    assert(refused.kind === "err" && refused.error.some((e) => e.kind === "not-idempotent" && e.key === "alterType:book.title"));
    const allowed = plan(typed, libraryAt(1), { dialect: postgres }, { ...planOptions({ unguardable: "allow" }), manual: manual() });
    assert(allowed.kind === "ok");
  },
);

proves(
  ["0012-sql-idempotency FR-006"],
  "the transform is an extension that contributes through lifecycle.transform, is in the default composition, and can be left out or switched off",
  () => {
    const d = defaultIdempotency();
    assert(d.kind === "ok");
    if (d.kind !== "ok") return;
    same(
      d.value.map((e) => e.id),
      ["sql.lifecycle.idempotency"],
    );
    const c = compose(d.value);
    assert(c.kind === "ok");
    if (c.kind !== "ok") return;
    same(transformsFrom(c.value).length, 1);
    const withIt = plan(snap(1, sqlite), libraryAt(2), { dialect: sqlite }, { transforms: transformsFrom(c.value) });
    assert(withIt.kind === "ok" && withIt.value.steps.every((s) => s.idempotency !== undefined));
    const without = compose([]);
    assert(without.kind === "ok");
    if (without.kind === "ok") same(transformsFrom(without.value).length, 0);
    const off = idempotencyExtension({ mode: "off" });
    assert(off.kind === "ok");
    const offPlan = plan(snap(1, sqlite), libraryAt(2), { dialect: sqlite }, { transforms: [idempotency({ mode: "off" })] });
    assert(
      offPlan.kind === "ok" && offPlan.value.steps.every((s) => s.idempotency === undefined && s.up.every((u) => u.guard === undefined)),
    );
  },
);

proves(
  ["0012-sql-idempotency FR-008"],
  "a guarded statement is one block of plain SQL on PostgreSQL that does no harm run twice, and is refused where the dialect has no block",
  async () => {
    const noFk = edit(snap(1, postgres), "book", (t) => ({ ...t, constraints: t.constraints.filter((c) => c.kind !== "foreignKey") }));
    const step = planOf(noFk, 1, postgres).steps[0];
    const statement = step?.up[0];
    assert(statement?.guard !== undefined);
    if (statement === undefined) return;
    const inline = guardInline(statement, postgres);
    assert(
      inline.kind === "sql" && inline.sql.startsWith("DO $ifc_guard$") && inline.sql.includes("NOT EXISTS (SELECT 1 FROM pg_constraint"),
    );
    await withEngine("postgres", async (e) => {
      const b = bind(libraryAt(1), { dialect: postgres });
      assert(b.kind === "ok");
      if (b.kind === "ok") await load(e, b.value);
      if (inline.kind === "sql") {
        await e.run(inline.sql); // the key is there: nothing happens
        await e.run('ALTER TABLE "book" DROP CONSTRAINT "book_genre_code_fk"');
        await e.run(inline.sql); // it is made again
        await e.run(inline.sql); // and not twice
      }
      const n = await e.rows(`SELECT COUNT(*)::int AS n FROM pg_constraint WHERE conname = 'book_genre_code_fk'`);
      same(n[0]?.["n"], 1);
    });
    const none = planOf(snap(1, sqlite), 2, sqlite).steps.find((s) => s.kind === "addColumn")?.up[0];
    assert(none !== undefined);
    if (none !== undefined) {
      const r = guardInline(none, sqlite);
      assert(r.kind === "refused" && r.why.includes("no procedural block"));
    }
    same(guardInline({ group: "table", origin: "core", sql: "SELECT 1;", of: [] }, sqlite), { kind: "sql", sql: "SELECT 1;" });
  },
);

proves(
  ["0012-sql-idempotency FR-009"],
  "on three real engines every step can be run twice without the ledger with the result of running it once, and so can a whole plan",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const d = driverOf(e);
        let from: State | undefined;
        for (const v of [1, 2, 3] as const) {
          const p = planOf(from, v, dialect);
          assert(
            p.steps.every((s) => s.idempotency === "natural" || s.idempotency === "guarded"),
            `${name} v${v}: every step is natural or guarded`,
          );
          for (const s of p.steps) {
            for (const st of s.up) await applyStatement(d, st);
            const once = await shape(e);
            for (const st of s.up) await applyStatement(d, st);
            same(await shape(e), once, `${name} v${v}: ${s.name} run twice`);
          }
          // the whole plan again
          const again = await shape(e);
          for (const s of p.steps) for (const st of s.up) await applyStatement(d, st);
          same(await shape(e), again, `${name} v${v}: the whole plan again`);
          from = snap(v, dialect);
        }
        same(stateHash(from ?? emptyState(dialect.name, { names: "snake", codes: "snake" })), stateHash(snap(3, dialect)));
        const codes = await e.rows(`SELECT "code" FROM "genre" ORDER BY "code"`);
        same(
          codes.map((r) => r["code"]),
          ["drama", "fiction", "poetry"],
          `${name}: the reference rows are not doubled`,
        );
      });
    }
    // a key added twice, on PostgreSQL, and the steps that undo what was done
    await withEngine("postgres", async (e) => {
      const d = driverOf(e);
      const b = bind(libraryAt(1), { dialect: postgres });
      assert(b.kind === "ok");
      if (b.kind === "ok") await load(e, b.value);
      const noFk = edit(snap(1, postgres), "book", (t) => ({ ...t, constraints: t.constraints.filter((c) => c.kind !== "foreignKey") }));
      const p = planOf(noFk, 1, postgres);
      for (const s of p.steps) for (const up of s.up) await applyStatement(d, up);
      for (const s of p.steps) for (const down of s.down ?? []) await applyStatement(d, down);
      for (const s of p.steps) for (const down of s.down ?? []) await applyStatement(d, down);
      same((await e.rows(`SELECT COUNT(*)::int AS n FROM pg_constraint WHERE contype = 'f'`))[0]?.["n"], 0);
      for (const s of p.steps) for (const up of s.up) await applyStatement(d, up);
      for (const s of p.steps) for (const up of s.up) await applyStatement(d, up);
      same((await e.rows(`SELECT COUNT(*)::int AS n FROM pg_constraint WHERE contype = 'f'`))[0]?.["n"], 2);
    });
  },
);
