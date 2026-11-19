// Spec: 0017-sql-rewrite FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * Making a table again (commons data 0017-sql-rewrite), on real engines: what SQLite and DuckDB cannot change in place is made by making the table again in the step's transaction; a
 * change of type is cast where the project says so; what cannot be made safely is left to a person with the reason; and a step whose rows do not meet the change is rolled back whole.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { compose } from "@intellectual-frontiers/data/engine";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { idempotency } from "@intellectual-frontiers/data/sql/extensions/idempotency";
import { protection } from "@intellectual-frontiers/data/sql/extensions/protected-access";
import { rewrite, rewriteExtension, settingsOf } from "@intellectual-frontiers/data/sql/extensions/rewrite";
import {
  emptyState,
  execute,
  fallbackFrom,
  plan,
  type PlanOptions,
  snapshotOf,
  type State,
  type StateTable,
  stateHash,
  type StepTransform,
} from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import { openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt, type Variant } from "./lifecycle-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const stateOf = (d: Dialect, v: 1 | 2 | 3, variant: Variant = {}, schema?: string): State =>
  must(snapshotOf(libraryAt(v, true, false, false, variant), { dialect: d, ...(schema === undefined ? {} : { schema }) }));
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};
const planOf = (d: Dialect, from: State | undefined, v: 1 | 2 | 3, variant: Variant, options: PlanOptions = {}): ReturnType<typeof plan> =>
  plan(from, libraryAt(v, true, false, false, variant), { dialect: d }, { fallback: rewrite(), ...options });
const SNAKE = { names: "snake", codes: "snake" } as const;
const emptyOf = (d: Dialect): string => stateHash(emptyState(d.name, SNAKE));
/** A database that has been taken to a version, with rows. */
const reach = async (e: Engine, d: Dialect, v: 1 | 2, variant: Variant = {}): Promise<void> => {
  let from: State | undefined;
  for (const x of [1, 2] as const) {
    if (x > v) break;
    const r = await execute(must(planOf(d, from, x, variant)), driverOf(e), d, { empty: emptyOf(d) });
    assert(r.kind === "ok", `${d.name} v${x}: ${JSON.stringify(r)}`);
    from = stateOf(d, x, variant);
  }
};
const refuses = async (e: Engine, sql: string): Promise<boolean> => {
  try {
    await e.run(sql);
    return false;
  } catch {
    return true;
  }
};
const edit = (s: State, table: string, fn: (t: StateTable) => StateTable): State => ({
  ...s,
  tables: s.tables.map((t) => (t.name === table ? fn(t) : t)),
});

proves(
  ["0017-sql-rewrite FR-001"],
  "a change the core cannot make is offered to the fallback before it is an error, the step goes through the transforms, and a person's step takes its place",
  () => {
    const noFk = edit(stateOf(sqlite, 1), "book", (t) => ({ ...t, constraints: t.constraints.filter((c) => c.kind !== "foreignKey") }));
    const bare = plan(noFk, libraryAt(1), { dialect: sqlite });
    assert(
      bare.kind === "err" && bare.error.length === 2 && bare.error.every((e) => e.kind === "manual"),
      "without a fallback: two errors for a person",
    );
    const seen: string[] = [];
    const spy: StepTransform = (d) => (seen.push(`${d.kind}:${d.rebuild === true}`), d);
    const made = must(planOf(sqlite, noFk, 1, {}, { transforms: [spy] }));
    assert(made.steps.length === 2 && made.steps.every((s) => s.rebuild === true && s.kind === "addConstraint"));
    same(seen, ["addConstraint:true", "addConstraint:true"], "the transforms saw the rebuilt steps");
    const written = must(
      planOf(
        sqlite,
        noFk,
        1,
        {},
        { manual: [{ resolves: "addConstraint:book:foreignKey:book_genre_code_fk", name: "by hand", up: ["SELECT 1"] }] },
      ),
    );
    assert(
      written.steps.some((s) => s.manual && s.name === "by hand") && written.steps.some((s) => s.rebuild === true),
      "a person's step takes its place",
    );
    const c = compose([must(rewriteExtension())]);
    assert(c.kind === "ok");
    if (c.kind === "ok") {
      const f = fallbackFrom(c.value);
      assert(
        f !== undefined && plan(noFk, libraryAt(1), { dialect: sqlite }, { fallback: f }).kind === "ok",
        "contributed through the engine",
      );
    }
    assert(fallbackFrom(must(compose([]))) === undefined);
  },
);

proves(
  ["0017-sql-rewrite FR-002", "0017-sql-rewrite FR-003", "0017-sql-rewrite FR-005", "0017-sql-rewrite FR-008"],
  "on SQLite a key is added by making the table again, the rows and what refers to the table are kept, the new definition is enforced, and the step says what it is",
  async () => {
    await withEngine("sqlite", async (e) => {
      await reach(e, sqlite, 2);
      await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a1', 'Ann')`);
      await e.run(`INSERT INTO "book" ("id", "title", "genre_code", "author_id") VALUES ('b1', 'One', 'fiction', 'a1')`);
      // the database has the keys; the state says it has none, so the plan adds them
      const noFk = edit(stateOf(sqlite, 2), "book", (t) => ({ ...t, constraints: t.constraints.filter((c) => c.kind !== "foreignKey") }));
      await e.run(`DROP TABLE "book"`);
      await e.run(
        `CREATE TABLE "book" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "genre_code" TEXT NOT NULL, "pages" INTEGER, "author_id" TEXT NOT NULL)`,
      );
      await e.run(`INSERT INTO "book" ("id", "title", "genre_code", "author_id") VALUES ('b1', 'One', 'fiction', 'a1')`);
      const p = must(planOf(sqlite, noFk, 2, {}));
      const [first] = p.steps;
      assert(
        first?.rebuild === true && first.class === "data-dependent" && first.reversibility === "lossless" && first.down !== undefined,
        "classified",
      );
      assert(
        first?.up[0]?.sql === "PRAGMA defer_foreign_keys = ON;" &&
          first.up[1]?.sql.startsWith('CREATE TABLE "book_rebuild"') &&
          first.up[2]?.sql.startsWith('INSERT INTO "book_rebuild"') &&
          first.up[3]?.sql === 'DROP TABLE "book";' &&
          first.up[4]?.sql === 'ALTER TABLE "book_rebuild" RENAME TO "book";',
        "the statements, in order",
      );
      const again = must(planOf(sqlite, noFk, 2, {}));
      same(
        again.steps.map((s) => s.up.map((u) => u.sql)),
        p.steps.map((s) => s.up.map((u) => u.sql)),
        "the same every time",
      );
      const r = await execute(p, driverOf(e), sqlite, { empty: stateHash(noFk), ledgerTable: "changes" });
      assert(r.kind === "ok", JSON.stringify(r));
      same((await e.rows(`PRAGMA foreign_key_list('book')`)).length, 2, "both keys are there");
      same(
        (await e.rows(`SELECT "id", "title" FROM "book"`)).map((x) => [x["id"], x["title"]]),
        [["b1", "One"]],
        "the rows are kept",
      );
      assert(
        await refuses(e, `INSERT INTO "book" ("id", "title", "genre_code", "author_id") VALUES ('b2', 'Two', 'fiction', 'nobody')`),
        "the key is enforced",
      );
      assert(!(await e.rows(`SELECT name FROM sqlite_master WHERE name = 'book_rebuild'`)).length, "no temporary table is left");
      same((await e.rows(`SELECT COUNT(*) AS n FROM "author"`))[0]?.["n"], 1, "what refers to the table is kept");
    });
  },
);

proves(
  ["0017-sql-rewrite FR-002", "0017-sql-rewrite FR-008"],
  "a column made required is made by making the table again where the engine cannot, a row that does not meet it rolls the step back whole, and it succeeds once the row does",
  async () => {
    const loose: Variant = { looseTitle: true };
    await withEngine("sqlite", async (e) => {
      await reach(e, sqlite, 1, loose);
      await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a1', 'Ann')`);
      await e.run(
        `INSERT INTO "book" ("id", "title", "genre_code", "author_id") VALUES ('b1', NULL, 'fiction', 'a1'), ('b2', 'Two', 'fiction', 'a1')`,
      );
      const p = must(planOf(sqlite, stateOf(sqlite, 1, loose), 1, {}));
      assert(
        p.steps.length === 1 &&
          p.steps[0]?.kind === "alterNullable" &&
          p.steps[0].rebuild === true &&
          p.steps[0].class === "data-dependent",
      );
      const failed = await execute(p, driverOf(e), sqlite, { empty: stateHash(stateOf(sqlite, 1, loose)) });
      assert(failed.kind === "err" && failed.error[0]?.kind === "step", "a null title refuses the new table");
      same(
        (await e.rows(`SELECT "id" FROM "book" ORDER BY "id"`)).map((x) => x["id"]),
        ["b1", "b2"],
        "the old table is there with its rows",
      );
      assert(!(await e.rows(`SELECT name FROM sqlite_master WHERE name = 'book_rebuild'`)).length, "and nothing is left half made");
      await e.run(`UPDATE "book" SET "title" = 'One' WHERE "id" = 'b1'`);
      const done = await execute(p, driverOf(e), sqlite, { empty: stateHash(stateOf(sqlite, 1, loose)) });
      assert(done.kind === "ok", JSON.stringify(done));
      assert(
        await refuses(e, `INSERT INTO "book" ("id", "title", "genre_code", "author_id") VALUES ('b3', NULL, 'fiction', 'a1')`),
        "required now",
      );
      same((await e.rows(`SELECT COUNT(*) AS n FROM "book"`))[0]?.["n"], 2);
      // the step undone makes the table again as it was
      for (const s of p.steps[0]?.down ?? []) await e.run(s.sql);
      await e.run(`INSERT INTO "book" ("id", "title", "genre_code", "author_id") VALUES ('b3', NULL, 'fiction', 'a1')`);
    });
  },
);

proves(
  ["0017-sql-rewrite FR-004"],
  "what cannot be made safely is left to a person with the reason: a required column with no default, a table that others refer to where the engine stops it, and a type that is not allowed to be cast",
  () => {
    const strict: Variant = { requiredPages: true };
    const asked = planOf(sqlite, stateOf(sqlite, 1), 2, strict);
    assert(
      asked.kind === "err" &&
        asked.error.some((e) => e.kind === "manual" && e.key === "addColumn:book.pages" && e.why.includes("required column")),
      "SQLite cannot add a required column with no default",
    );
    // DuckDB: a table others refer to
    const withUnique = (s: State, table: string): State =>
      edit(s, table, (t) => ({
        ...t,
        constraints: [
          ...t.constraints,
          { id: "u", kind: "unique" as const, name: `${table}_x_uq`, signature: "uq:x", text: `CONSTRAINT "${table}_x_uq" UNIQUE ("id")` },
        ],
      }));
    const referred = planOf(duckdb, withUnique(stateOf(duckdb, 1), "author"), 1, {});
    assert(
      referred.kind === "err" && referred.error.some((e) => e.kind === "manual" && e.why.includes("duckdb cannot drop a constraint")),
      "author is referred to by book",
    );
    const free = must(planOf(duckdb, withUnique(stateOf(duckdb, 1), "book"), 1, {}));
    assert(free.steps.length === 1 && free.steps[0]?.rebuild === true, "book is not, so it is made again");
    // a type, with casts refused
    const typed = edit(stateOf(sqlite, 2), "book", (t) => ({
      ...t,
      columns: t.columns.map((c) => (c.name === "pages" ? { ...c, type: "TEXT" } : c)),
    }));
    const refused = planOf(sqlite, typed, 2, {});
    assert(
      refused.kind === "err" &&
        refused.error.some((e) => e.kind === "manual" && e.key === "alterType:book.pages" && e.why.includes("may lose data")),
    );
  },
);

proves(
  ["0017-sql-rewrite FR-006"],
  "a type is cast in place where the engine can alter a column and by making the table again where it cannot, when casts are allowed, and says that values may change",
  async () => {
    const allow = { fallback: rewrite({ casts: "allow" }) };
    for (const d of [postgres, duckdb, sqlite]) {
      const typed = edit(stateOf(d, 2), "book", (t) => ({
        ...t,
        columns: t.columns.map((c) => (c.name === "pages" ? { ...c, type: "TEXT" } : c)),
      }));
      const p = must(plan(typed, libraryAt(2), { dialect: d }, allow));
      const step = p.steps[0];
      assert(p.steps.length === 1 && step?.class === "data-dependent" && step.why?.includes("may change or refuse"), d.name);
      if (d.features.includes("alter-column"))
        assert(
          step?.up[0]?.sql.includes('SET DATA TYPE INTEGER USING CAST("pages" AS INTEGER)') && step.rebuild !== true,
          `${d.name}: in place`,
        );
      else
        assert(
          step?.rebuild === true && step.up.some((u) => u.sql.includes('CAST("pages" AS INTEGER)')),
          `${d.name}: made again with a cast`,
        );
    }
    // on real engines, with values that survive
    for (const [name, d] of [
      ["postgres", postgres],
      ["duckdb", duckdb],
      ["sqlite", sqlite],
    ] as const) {
      await withEngine(name, async (e) => {
        await reach(e, d, 2);
        await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a1', 'Ann')`);
        await e.run(`INSERT INTO "book" ("id", "title", "genre_code", "author_id", "pages") VALUES ('b1', 'One', 'fiction', 'a1', 120)`);
        if (name !== "sqlite") await e.run(`ALTER TABLE "book" ALTER COLUMN "pages" SET DATA TYPE TEXT`);
        const typed = edit(stateOf(d, 2), "book", (t) => ({
          ...t,
          columns: t.columns.map((c) => (c.name === "pages" ? { ...c, type: "TEXT" } : c)),
        }));
        const p = must(plan(typed, libraryAt(2), { dialect: d }, allow));
        const r = await execute(p, driverOf(e), d, { empty: stateHash(typed), ledgerTable: "changes" });
        assert(r.kind === "ok", `${name}: ${JSON.stringify(r)}`);
        same(Number((await e.rows(`SELECT "pages" FROM "book"`))[0]?.["pages"]), 120, `${name}: the value survived the cast`);
      });
    }
  },
);

proves(
  ["0017-sql-rewrite FR-007"],
  "the feature is on by default, can be switched off, and its settings have defaults and can be changed",
  () => {
    same(settingsOf(), { rewrite: true, casts: false, suffix: "rebuild" });
    same(settingsOf({ rewrite: "off", casts: "allow", suffix: "new" }), { rewrite: false, casts: true, suffix: "new" });
    const noFk = edit(stateOf(sqlite, 1), "book", (t) => ({ ...t, constraints: t.constraints.filter((c) => c.kind !== "foreignKey") }));
    const off = plan(noFk, libraryAt(1), { dialect: sqlite }, { fallback: rewrite({ rewrite: "off" }) });
    assert(off.kind === "err" && off.error.every((e) => e.kind === "manual"), "the core's error values");
    const named = must(plan(noFk, libraryAt(1), { dialect: sqlite }, { fallback: rewrite({ suffix: "new" }) }));
    assert(named.steps[0]?.up.some((u) => u.sql.startsWith('CREATE TABLE "book_new"')));
  },
);

proves(
  ["0017-sql-rewrite FR-003", "0017-sql-rewrite FR-008"],
  "the protection layer's views are dropped before and made again after a table is made again, and a step that makes a table again relies on the ledger alone",
  async () => {
    const kit = protection();
    const noFk = (d: Dialect): State =>
      edit(stateOf(d, 2, {}, "data"), d.features.includes("schemas") ? "book" : "data_book", (t) => ({
        ...t,
        constraints: t.constraints.filter((c) => c.kind !== "foreignKey"),
      }));
    await withEngine("sqlite", async (e) => {
      // the layer is a convention on SQLite, and the tables carry its words
      let from: State | undefined;
      for (const v of [1, 2] as const) {
        const p = must(
          plan(from, libraryAt(v), { dialect: sqlite, ...kit.desired }, { transforms: [...kit.transforms], fallback: rewrite() }),
        );
        const r = await execute(p, driverOf(e), sqlite, { empty: stateHash(emptyState("sqlite", SNAKE)) });
        assert(r.kind === "ok", JSON.stringify(r));
        from = must(snapshotOf(libraryAt(v), { dialect: sqlite, schema: "data" }));
      }
      await e.run(`INSERT INTO "data_author" ("id", "name") VALUES ('a1', 'Ann')`);
      await e.run(`INSERT INTO "data_book" ("id", "title", "genre_code", "author_id") VALUES ('b1', 'One', 'fiction', 'a1')`);
      const p = must(
        plan(
          noFk(sqlite),
          libraryAt(2),
          { dialect: sqlite, ...kit.desired },
          { transforms: [...kit.transforms, idempotency()], fallback: rewrite() },
        ),
      );
      const step = p.steps[0];
      assert(
        step?.rebuild === true &&
          step.up[0]?.sql === 'DROP VIEW IF EXISTS "book";' &&
          step.up.some((u) => u.sql.startsWith('CREATE VIEW "book"')),
        "the view is dropped before and made again after",
      );
      same(step?.idempotency, "ledger-only", "only the ledger keeps it from running twice");
      const strict = plan(
        noFk(sqlite),
        libraryAt(2),
        { dialect: sqlite, ...kit.desired },
        { transforms: [...kit.transforms, idempotency()], fallback: rewrite(), requireIdempotent: true },
      );
      assert(strict.kind === "err" && strict.error.some((x) => x.kind === "not-idempotent"), "and a project can refuse it");
      const r = await execute(p, driverOf(e), sqlite, { empty: stateHash(noFk(sqlite)), ledgerTable: "changes" });
      assert(r.kind === "ok", JSON.stringify(r));
      same(
        (await e.rows(`SELECT "title" FROM "book"`)).map((x) => x["title"]),
        ["One"],
        "the view reads the table that was made again",
      );
    });
  },
);

proves(
  ["0017-sql-rewrite FR-002", "0017-sql-rewrite FR-005"],
  "the statements are written from the states: the indexes are made after, the primary key is kept, and a column the tables have in common is copied",
  () => {
    const before = stateOf(sqlite, 1).tables.find((t) => t.name === "book") as StateTable;
    const indexed: StateTable = {
      ...before,
      constraints: [...before.constraints, { id: "i", kind: "index", name: "book_title_idx", signature: "ix:title", text: '"title"' }],
    };
    const state = (t: StateTable): State => ({
      ...stateOf(sqlite, 1),
      tables: stateOf(sqlite, 1).tables.map((x) => (x.name === "book" ? t : x)),
    });
    const f = rewrite();
    const change = {
      kind: "alterNullable" as const,
      key: "alterNullable:book.title",
      table: { words: ["book"], name: "book" },
      from: before.columns[1] as never,
      to: { ...(before.columns[1] as never as object), nullable: false } as never,
    };
    const made = f(change, "x", {
      dialect: sqlite,
      naming: { names: { name: "snake", write: (w: readonly string[]) => w.join("_") }, codes: "name" } as never,
      schema: libraryAt(1),
      before: state(before),
      after: state(indexed),
    } as never);
    const sql = made?.up.map((s) => s.sql) ?? [];
    assert(sql[sql.length - 1] === 'CREATE INDEX IF NOT EXISTS "book_title_idx" ON "book" ("title");', "the index is made last");
    assert(
      sql.some((s) => s.includes('PRIMARY KEY ("id")')) && sql.some((s) => s.startsWith('INSERT INTO "book_rebuild" ("id", "title"')),
      "the key, and the columns they have in common",
    );
    assert(sql.findIndex((s) => s.startsWith("DROP TABLE")) < sql.findIndex((s) => s.startsWith("ALTER TABLE")), "dropped before renamed");
  },
);

proves(
  ["0017-sql-rewrite FR-009"],
  "a table that has triggers is not made again without them: the step fails its verification, is rolled back whole, and the trigger and the rows are as they were",
  async () => {
    await withEngine("sqlite", async (e) => {
      await reach(e, sqlite, 2);
      await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a1', 'Ann')`);
      await e.run(`INSERT INTO "book" ("id", "title", "genre_code", "author_id") VALUES ('b1', 'One', 'fiction', 'a1')`);
      await e.run(`CREATE TRIGGER "book_keep" BEFORE DELETE ON "book" BEGIN SELECT RAISE(ABORT, 'books are kept'); END`);
      const noFk = edit(stateOf(sqlite, 2), "book", (t) => ({ ...t, constraints: t.constraints.filter((c) => c.kind !== "foreignKey") }));
      const p = must(planOf(sqlite, noFk, 2, {}));
      const rebuilt = p.steps.find((s) => s.rebuild === true);
      assert(rebuilt?.verify?.after.some((c) => c.describe.includes("triggers")), "the step says the triggers must be kept");
      const r = await execute(p, driverOf(e), sqlite, { empty: stateHash(noFk), ledgerTable: "changes" });
      assert(r.kind === "err" && JSON.stringify(r.error).includes("triggers of book"), `it does not go on and lose the trigger: ${JSON.stringify(r)}`);
      same((await e.rows(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'book'`)).map((x) => x["name"]), ["book_keep"], "the trigger is still there");
      same((await e.rows(`SELECT COUNT(*) AS n FROM "book"`))[0]?.["n"], 1, "and the rows");
      assert(await refuses(e, `DELETE FROM "book"`), "and it still refuses");
    });
  },
);
