// Spec: 0015-sql-safety FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012
/**
 * The safety features (commons data 0015-sql-safety), on real engines: a verification that fails rolls a step back; a step is tried again on a lock timeout and given up on; a dropped column and a
 * dropped table are kept in quarantine and come back when the step is undone; a purge destroys only a quarantine table; a step asks for its locks with a timeout; a constraint is added without
 * checking and then checked; and each step says what must be true after it.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { compose } from "@intellectual-frontiers/data/engine";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { idempotency } from "@intellectual-frontiers/data/sql/extensions/idempotency";
import { protection } from "@intellectual-frontiers/data/sql/extensions/protected-access";
import { safety, safetyExtension, settingsOf } from "@intellectual-frontiers/data/sql/extensions/safety";
import {
  applyStatement,
  type Driver,
  emptyState,
  execute,
  plan,
  type Plan,
  readLedger,
  snapshotOf,
  type State,
  type StepTransform,
  stateHash,
  transformsFrom,
} from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const SNAKE = { names: "snake", codes: "snake" } as const;
const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const stateOf = (v: 1 | 2 | 3, d: Dialect): State => must(snapshotOf(libraryAt(v), { dialect: d }));
const emptyOf = (d: Dialect): string => stateHash(emptyState(d.name, SNAKE));
const s = safety();
const planOf = (
  d: Dialect,
  from: State | undefined,
  v: 1 | 2 | 3,
  transforms: readonly StepTransform[] = [...s.transforms, idempotency()],
  allow = false,
): Plan => must(plan(from, libraryAt(v), { dialect: d }, { transforms, ...(allow ? { allow: { destructive: true } } : {}) }));
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};
const tables = async (e: Engine): Promise<string[]> =>
  (e.name === "postgres"
    ? await e.rows("SELECT table_name n FROM information_schema.tables WHERE table_schema = 'public'")
    : e.name === "duckdb"
      ? await e.rows("SELECT table_name n FROM duckdb_tables()")
      : await e.rows("SELECT name n FROM sqlite_master WHERE type = 'table'")
  )
    .map((r) => String(r["n"]))
    .sort();
const reach = async (e: Engine, d: Dialect, v: 1 | 2): Promise<void> => {
  let from: State | undefined;
  for (const x of [1, 2] as const) {
    if (x > v) break;
    const r = await execute(planOf(d, from, x), driverOf(e), d, { empty: emptyOf(d) });
    assert(r.kind === "ok", `${d.name} v${x}: ${JSON.stringify(r)}`);
    from = stateOf(x, d);
  }
};

proves(
  ["0015-sql-safety FR-001"],
  "a step's verification is run in its transaction, a check that fails rolls the step back and records nothing, and the verification is part of the step's identifier",
  async () => {
    const base = planOf(sqlite, undefined, 1);
    const first = base.steps[0];
    assert(first !== undefined);
    if (first === undefined) return;
    const withChecks = (checks: NonNullable<Plan["steps"][number]["verify"]>): Plan => ({
      ...base,
      steps: base.steps.map((st, i) => (i === 0 ? { ...st, verify: checks } : st)),
    });
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const d = driverOf(e);
        const empty = emptyOf(dialect);
        const p = planOf(dialect, undefined, 1);
        const table = p.steps[0]?.change.kind === "createTable" ? p.steps[0].change.table.name : "x";
        const bad = {
          ...p,
          steps: p.steps.map((st, i) =>
            i === 0
              ? {
                  ...st,
                  verify: {
                    before: [{ key: "n", query: `SELECT COUNT(*) FROM ${dialect.quote(table)}`.replace(/FROM .*/, "FROM (SELECT 1) t") }],
                    after: [{ describe: "the table has what it must not", query: "SELECT 1 WHERE 1 = 0", expect: "rows" as const }],
                  },
                }
              : st,
          ),
        };
        const failed = await execute(bad, d, dialect, { empty });
        assert(
          failed.kind === "err" &&
            failed.error[0]?.kind === "step" &&
            failed.error[0].message.includes("verification failed: the table has what it must not"),
          `${name}: ${JSON.stringify(failed)}`,
        );
        assert(!(await tables(e)).includes(table), `${name}: the step was rolled back`);
        same((await readLedger(d, dialect)).length, 0, `${name}: and nothing was recorded`);
        // a check that holds, and one that compares with a value read before
        const good = {
          ...p,
          steps: p.steps.map((st, i) =>
            i === 0
              ? {
                  ...st,
                  verify: {
                    before: [{ key: "n", query: "SELECT 3" }],
                    after: [
                      { describe: "the table exists", query: dialect.probes?.table(table) ?? "SELECT 1", expect: "rows" as const },
                      { describe: "three", query: "SELECT 3", expect: { sameAs: "n" } },
                      { describe: "none", query: "SELECT 1 WHERE 1 = 0", expect: "none" as const },
                    ],
                  },
                }
              : st,
          ),
        };
        const ok = await execute(good, d, dialect, { empty });
        assert(ok.kind === "ok", `${name}: ${JSON.stringify(ok)}`);
      });
    }
    const unequal = withChecks({
      before: [{ key: "n", query: "SELECT 1" }],
      after: [{ describe: "x", query: "SELECT 2", expect: { sameAs: "n" } }],
    });
    await withEngine("sqlite", async (e) => {
      const r = await execute(unequal, driverOf(e), sqlite, { empty: emptyOf(sqlite) });
      assert(
        r.kind === "err" && r.error[0]?.kind === "step" && r.error[0].message.includes("verification failed: x"),
        "a value that differs from the one read before",
      );
    });
    const plain = planOf(sqlite, undefined, 1, []);
    assert(plain.steps.every((st) => st.verify === undefined));
    assert(withChecks({ after: [] }).steps[0]?.id === first.id, "an identifier is only made when the plan is");
    const a = planOf(sqlite, undefined, 1, [(d) => ({ ...d, verify: { after: [{ describe: "a", query: "SELECT 1", expect: "rows" }] } })]);
    const b = planOf(sqlite, undefined, 1, [(d) => ({ ...d, verify: { after: [{ describe: "a", query: "SELECT 2", expect: "rows" }] } })]);
    assert(a.steps[0]?.id !== b.steps[0]?.id, "two steps that differ only in their verification are two steps");
  },
);

proves(
  ["0015-sql-safety FR-002"],
  "a step is tried again when its error is of the kind the project names, a number of times with a pause, and the last error is returned where it still fails",
  async () => {
    await withEngine("sqlite", async (e) => {
      const inner = driverOf(e);
      let failures = 0;
      const flaky = (times: number): Driver => ({
        query: inner.query,
        exec: (sql) => {
          if (sql.startsWith('CREATE TABLE IF NOT EXISTS "genre"') && failures < times) {
            failures++;
            return Promise.reject(new Error("canceling statement due to lock timeout"));
          }
          return inner.exec(sql);
        },
      });
      const pauses: number[] = [];
      const retry = {
        attempts: 3,
        delayMs: 100,
        when: (m: string) => m.includes("lock timeout"),
        sleep: (ms: number) => (pauses.push(ms), Promise.resolve()),
      };
      const p = planOf(sqlite, undefined, 1);
      const ok = await execute(p, flaky(2), sqlite, { empty: emptyOf(sqlite), retry });
      assert(ok.kind === "ok", JSON.stringify(ok));
      same(failures, 2, "tried twice more");
      same(pauses, [100, 200], "with a longer pause each time");
    });
    await withEngine("sqlite", async (e) => {
      const inner = driverOf(e);
      let failures = 0;
      const always: Driver = {
        query: inner.query,
        exec: (sql) => {
          if (sql.startsWith('CREATE TABLE IF NOT EXISTS "genre"')) {
            failures++;
            return Promise.reject(new Error(`canceling statement due to lock timeout ${failures}`));
          }
          return inner.exec(sql);
        },
      };
      const r = await execute(planOf(sqlite, undefined, 1), always, sqlite, {
        empty: emptyOf(sqlite),
        retry: { attempts: 3, delayMs: 0, when: (m) => m.includes("lock timeout"), sleep: () => Promise.resolve() },
      });
      assert(r.kind === "err" && r.error[0]?.kind === "step" && r.error[0].message.endsWith("3"), "the last error");
      same(failures, 3);
    });
    await withEngine("sqlite", async (e) => {
      let tries = 0;
      const inner = driverOf(e);
      const other: Driver = {
        query: inner.query,
        exec: (sql) =>
          sql.startsWith('CREATE TABLE IF NOT EXISTS "genre"') ? (tries++, Promise.reject(new Error("syntax error"))) : inner.exec(sql),
      };
      const r = await execute(planOf(sqlite, undefined, 1), other, sqlite, {
        empty: emptyOf(sqlite),
        retry: { attempts: 3, delayMs: 0, when: (m) => m.includes("lock timeout"), sleep: () => Promise.resolve() },
      });
      assert(r.kind === "err");
      same(tries, 1, "an error of another kind is not tried again");
    });
  },
);

proves(["0015-sql-safety FR-003"], "a destructive step that a transform has made safe is not refused", () => {
  const v2 = stateOf(2, postgres);
  const refused = plan(v2, libraryAt(3), { dialect: postgres });
  assert(refused.kind === "err" && refused.error.some((e) => e.kind === "refused"));
  const safe: StepTransform = (d) => (d.class === "destructive" ? { ...d, class: "data-dependent" } : d);
  assert(plan(v2, libraryAt(3), { dialect: postgres }, { transforms: [safe] }).kind === "ok");
});

const bornOf = async (e: Engine, table: string): Promise<unknown[]> =>
  (await e.rows(`SELECT "id", "born" FROM ${table} ORDER BY "id"`)).map((r) => [r["id"], r["born"]]);

proves(
  ["0015-sql-safety FR-004", "0015-sql-safety FR-012"],
  "dropping a column keeps its values in a quarantine table, does not copy again, is data-dependent and quarantine-reversible, and undoing the step restores the values",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        await reach(e, dialect, 2);
        await e.run(`INSERT INTO "author" ("id", "name", "born") VALUES ('a1', 'Ann', '1990-01-02'), ('a2', 'Bo', NULL)`);
        const p = planOf(dialect, stateOf(2, dialect), 3);
        const drop = p.steps.find((x) => x.kind === "dropColumn");
        assert(
          drop !== undefined &&
            drop.class === "data-dependent" &&
            drop.reversibility === "quarantine" &&
            drop.why?.includes("author_born_quarantine"),
          `${name}: classified`,
        );
        const copy = drop?.up.find((x) => x.sql.startsWith("CREATE TABLE IF NOT EXISTS"));
        assert(
          copy?.sql === 'CREATE TABLE IF NOT EXISTS "author_born_quarantine" AS SELECT "id", "born" FROM "author";' &&
            copy.guard?.skipWhen === "rows" &&
            drop?.up.indexOf(copy) !== undefined &&
            drop.up.indexOf(copy) < drop.up.findIndex((x) => x.sql.includes("DROP COLUMN")),
          `${name}: copied first, once`,
        );
        const before = await bornOf(e, '"author"');
        const r = await execute(p, driverOf(e), dialect, { empty: emptyOf(dialect) });
        assert(r.kind === "ok", `${name}: ${JSON.stringify(r)}`);
        assert(await refusesColumn(e, "born"), `${name}: the column is gone`);
        same(await bornOf(e, '"author_born_quarantine"'), before, `${name}: its values are kept`);
        // the step run again does not copy again
        for (const st of drop?.up ?? []) await applyStatement(driverOf(e), st);
        same(await bornOf(e, '"author_born_quarantine"'), before, `${name}: still the same values`);
        // undone: the column comes back with its values
        for (const st of drop?.down ?? []) await applyStatement(driverOf(e), st);
        same(await bornOf(e, '"author"'), before, `${name}: restored`);
      });
    }
  },
);

const refusesColumn = async (e: Engine, column: string): Promise<boolean> => {
  try {
    await e.rows(`SELECT "${column}" FROM "author"`);
    return false;
  } catch {
    return true;
  }
};

proves(
  ["0015-sql-safety FR-005", "0015-sql-safety FR-006", "0015-sql-safety FR-012"],
  "dropping a table renames it to its quarantined name with its rows, undoing brings it back, and a purge drops a quarantine table and nothing else",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const withScratch = must(snapshotOf(libraryAt(1, true, true), { dialect }));
        const made = await execute(
          must(plan(undefined, libraryAt(1, true, true), { dialect }, { transforms: [...s.transforms, idempotency()] })),
          driverOf(e),
          dialect,
          { empty: emptyOf(dialect) },
        );
        assert(made.kind === "ok", `${name}: ${JSON.stringify(made)}`);
        await e.run(`INSERT INTO "scratch" VALUES ('s1'), ('s2')`);
        const p = planOf(dialect, withScratch, 1);
        const drop = p.steps[0];
        assert(
          drop?.kind === "dropTable" &&
            drop.class === "data-dependent" &&
            drop.reversibility === "quarantine" &&
            drop.up.some((x) => x.sql === 'ALTER TABLE "scratch" RENAME TO "scratch_quarantined";'),
          `${name}: ${JSON.stringify(drop?.up)}`,
        );
        const r = await execute(p, driverOf(e), dialect, { empty: emptyOf(dialect) });
        assert(r.kind === "ok", `${name}: ${JSON.stringify(r)}`);
        assert((await tables(e)).includes("scratch_quarantined") && !(await tables(e)).includes("scratch"), `${name}: renamed`);
        same(
          (await e.rows(`SELECT "id" FROM "scratch_quarantined" ORDER BY "id"`)).map((x) => x["id"]),
          ["s1", "s2"],
          `${name}: its rows are there`,
        );
        for (const st of drop?.down ?? []) await applyStatement(driverOf(e), st);
        assert((await tables(e)).includes("scratch") && !(await tables(e)).includes("scratch_quarantined"), `${name}: brought back`);
        // a purge
        for (const st of drop?.up ?? []) await applyStatement(driverOf(e), st);
        const purge = s.purge({ from: stateHash(stateOf(1, dialect)), names: ["scratch_quarantined"], dialect });
        assert(purge.kind === "ok");
        if (purge.kind !== "ok") return;
        const done = await execute(purge.value, driverOf(e), dialect, { empty: emptyOf(dialect) });
        assert(done.kind === "ok" && done.value.steps.length === 1, `${name}: ${JSON.stringify(done)}`);
        assert(!(await tables(e)).includes("scratch_quarantined"), `${name}: purged`);
        const again = await execute(purge.value, driverOf(e), dialect, { empty: emptyOf(dialect) });
        assert(again.kind === "ok" && again.value.steps.length === 0, `${name}: not run twice`);
      });
    }
    const refused = s.purge({ from: "f", names: ["author", "book_title_quarantine", "scratch_quarantined"], dialect: sqlite });
    assert(refused.kind === "err" && refused.error.length === 1 && refused.error[0]?.name === "author", "only a quarantine table");
    // governance's retention is said in the step
    assert(
      planOf(postgres, must(snapshotOf(libraryAt(1, true, true), { dialect: postgres })), 1).steps[0]?.why?.includes(
        "until a person purges it",
      ),
    );
  },
);

proves(
  ["0015-sql-safety FR-007", "0015-sql-safety FR-011"],
  "with quarantine off a drop is destructive again and refused; every feature is on by default and each setting can be changed",
  () => {
    const off = safety({ quarantine: "off" });
    const refused = plan(stateOf(2, postgres), libraryAt(3), { dialect: postgres }, { transforms: off.transforms });
    assert(refused.kind === "err" && refused.error.some((e) => e.kind === "refused" && e.key === "dropColumn:author.born"));
    const allowed = must(
      plan(stateOf(2, postgres), libraryAt(3), { dialect: postgres }, { transforms: off.transforms, allow: { destructive: true } }),
    );
    assert(allowed.steps.find((x) => x.kind === "dropColumn")?.reversibility === "irreversible");
    same(settingsOf(), {
      quarantine: true,
      suffixes: { column: "quarantine", table: "quarantined" },
      locks: true,
      lockTimeoutMs: 5000,
      statementTimeoutMs: 60000,
      attempts: 3,
      delayMs: 1000,
      validateLater: true,
      verify: true,
    });
    const custom = settingsOf({
      quarantine: "off",
      suffixes: { column: "kept", table: "old" },
      locks: "off",
      lockTimeoutMs: 10,
      statementTimeoutMs: 20,
      attempts: 5,
      delayMs: 7,
      validateLater: "off",
      verify: "off",
    });
    same(custom, {
      quarantine: false,
      suffixes: { column: "kept", table: "old" },
      locks: false,
      lockTimeoutMs: 10,
      statementTimeoutMs: 20,
      attempts: 5,
      delayMs: 7,
      validateLater: false,
      verify: false,
    });
    const k = safety({ suffixes: { column: "kept", table: "old" } });
    assert(
      must(plan(stateOf(2, postgres), libraryAt(3), { dialect: postgres }, { transforms: k.transforms }))
        .steps.find((x) => x.kind === "dropColumn")
        ?.up.some((u) => u.sql.includes('"author_born_kept"')),
    );
    assert(safety({ locks: "off", validateLater: "off", verify: "off", quarantine: "off" }).transforms.every((t) => t !== undefined));
    const ext = safetyExtension();
    assert(ext.kind === "ok");
    if (ext.kind === "ok") same(transformsFrom(must(compose([ext.value]))).length, 4, "the extension contributes the four transforms");
  },
);

proves(
  ["0015-sql-safety FR-008"],
  "a step that changes a table asks for its locks with a timeout where the dialect has them, and gives the run a retry for a lock timeout",
  async () => {
    const p = planOf(postgres, stateOf(1, postgres), 2);
    const add = p.steps.find((x) => x.kind === "addColumn");
    same(
      add?.up.slice(0, 2).map((x) => x.sql),
      ["SELECT set_config('lock_timeout', '5000', true);", "SELECT set_config('statement_timeout', '60000', true);"],
    );
    same(
      add?.down?.slice(0, 2).map((x) => x.sql),
      ["SELECT set_config('lock_timeout', '5000', true);", "SELECT set_config('statement_timeout', '60000', true);"],
      "undoing asks for the locks too",
    );
    assert(
      !p.steps.find((x) => x.kind === "createTable")?.up.some((x) => x.sql.includes("lock_timeout")),
      "a table that is made needs no timeout",
    );
    assert(
      planOf(sqlite, stateOf(1, sqlite), 2).steps.every((x) => !x.up.some((u) => u.sql.includes("timeout"))),
      "SQLite has none",
    );
    const tuned = safety({ lockTimeoutMs: 250, statementTimeoutMs: 9000 });
    assert(
      planOf(postgres, stateOf(1, postgres), 2, [...tuned.transforms])
        .steps.find((x) => x.kind === "addColumn")
        ?.up[0]?.sql.includes("'250'"),
    );
    same(
      planOf(postgres, stateOf(1, postgres), 2, [...safety({ locks: "off" }).transforms])
        .steps.find((x) => x.kind === "addColumn")
        ?.up.some((u) => u.sql.includes("timeout")),
      false,
    );
    const retry = s.retry(postgres);
    assert(
      retry !== undefined &&
        retry.attempts === 3 &&
        retry.when("ERROR: canceling statement due to lock timeout") &&
        !retry.when("syntax error"),
    );
    same(s.retry(sqlite), undefined);
    same(safety({ locks: "off" }).retry(postgres), undefined);
    await withEngine("postgres", async (e) => {
      await e.run("BEGIN");
      for (const x of add?.up.slice(0, 2) ?? []) await e.run(x.sql);
      same((await e.rows(`SELECT current_setting('lock_timeout') AS t`))[0]?.["t"], "5s", "the engine took the timeout");
      await e.run("ROLLBACK");
      same((await e.rows(`SELECT current_setting('lock_timeout') AS t`))[0]?.["t"], "0", "and only for the transaction");
    });
  },
);

proves(
  ["0015-sql-safety FR-009"],
  "a foreign key or a check is added without checking the rows and then checked, and the step's verification says the constraint is valid",
  async () => {
    const noFk: State = {
      ...stateOf(1, postgres),
      tables: stateOf(1, postgres).tables.map((t) =>
        t.name === "book" ? { ...t, constraints: t.constraints.filter((c) => c.kind !== "foreignKey") } : t,
      ),
    };
    const p = planOf(postgres, noFk, 1);
    assert(p.steps.length === 2 && p.steps.every((x) => x.kind === "addConstraint"));
    for (const st of p.steps) {
      const sql = st.up.map((u) => u.sql);
      assert(sql.some((x) => /ADD CONSTRAINT .* NOT VALID;$/.test(x)) && sql.some((x) => /VALIDATE CONSTRAINT/.test(x)), sql.join("\n"));
      assert(
        st.verify?.after.some((c) => c.query.includes("convalidated")),
        "valid, not merely there",
      );
      assert(st.idempotency === "guarded");
    }
    await withEngine("postgres", async (e) => {
      const empty = emptyOf(postgres);
      const first = await execute(planOf(postgres, undefined, 1), driverOf(e), postgres, { empty });
      assert(first.kind === "ok");
      await e.run(`ALTER TABLE "book" DROP CONSTRAINT "book_author_id_fk"`);
      const r = await execute(
        {
          ...p,
          from: stateHash(stateOf(1, postgres)),
          steps: p.steps.map((x, i) => (i === 0 ? { ...x, from: stateHash(stateOf(1, postgres)) } : x)),
        },
        driverOf(e),
        postgres,
        { empty },
      );
      assert(r.kind === "ok", JSON.stringify(r));
      same((await e.rows(`SELECT COUNT(*)::int AS n FROM pg_constraint WHERE contype = 'f' AND convalidated`))[0]?.["n"], 2);
    });
    const off = planOf(postgres, noFk, 1, [...safety({ validateLater: "off" }).transforms]);
    assert(off.steps.every((x) => !x.up.some((u) => /NOT VALID/.test(u.sql))));
    const lite = stateOf(1, sqlite);
    assert(planOf(sqlite, lite, 1).steps.length === 0);
  },
);

proves(
  ["0015-sql-safety FR-010"],
  "each step says what must be true after it, and a step that changes the structure and not the data finds the same number of rows, on three engines",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        await reach(e, dialect, 1);
        await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a1', 'Ann'), ('a2', 'Bo')`);
        const p = planOf(dialect, stateOf(1, dialect), 2);
        const add = p.steps.find((x) => x.kind === "addColumn" && x.name.includes("born"));
        assert(
          add?.verify !== undefined &&
            add.verify.after.some((c) => c.describe.includes("author.born exists")) &&
            add.verify.after.some((c) => c.describe.includes("same number of rows")),
          `${name}: says what must be true`,
        );
        assert(p.steps.find((x) => x.kind === "createTable")?.verify?.after.some((c) => c.describe.includes("publisher exists")));
        const r = await execute(p, driverOf(e), dialect, { empty: emptyOf(dialect) });
        assert(r.kind === "ok", `${name}: ${JSON.stringify(r)}`);
      });
    }
    const v3 = planOf(postgres, stateOf(2, postgres), 3);
    const rename = v3.steps.find((x) => x.kind === "renameColumn");
    assert(
      rename?.verify?.after.some((c) => c.describe.includes("author.name is gone")) &&
        rename.verify.after.some((c) => c.describe.includes("author.full_name exists")),
    );
    const drop = v3.steps.find((x) => x.kind === "dropColumn");
    assert(
      drop?.verify?.after.some((c) => c.describe.includes("author.born is gone")) &&
        drop.verify.after.some((c) => c.describe.includes("author_born_quarantine")),
      "a drop says its quarantine table is there",
    );
    assert(planOf(postgres, stateOf(1, postgres), 2, [...safety({ verify: "off" }).transforms]).steps.every((x) => x.verify === undefined));
    const noVerify = planOf(sqlite, undefined, 1, [...safety().transforms]);
    assert(noVerify.steps.every((x) => x.verify !== undefined));
  },
);

proves(
  ["0015-sql-safety FR-012"],
  "with the protection layer and idempotency, dropping a column on three engines leaves the values in quarantine, the view without the column, and the step safe to run twice",
  async () => {
    const kit = protection();
    const all = [...s.transforms, ...kit.transforms, idempotency()];
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const d = driverOf(e);
        const emptyQ = stateHash(emptyState(dialect.name, SNAKE, dialect.features.includes("schemas") ? "data" : undefined));
        const st = (v: 1 | 2 | 3): State => must(snapshotOf(libraryAt(v), { dialect, schema: "data" }));
        const mk = (from: State | undefined, v: 1 | 2 | 3): Plan =>
          must(plan(from, libraryAt(v), { dialect, ...kit.desired }, { transforms: all }));
        for (const [from, v] of [
          [undefined, 1],
          [st(1), 2],
        ] as const) {
          const r = await execute(mk(from, v), d, dialect, { empty: emptyQ, before: kit.session(dialect) });
          assert(r.kind === "ok", `${name} v${v}: ${JSON.stringify(r)}`);
        }
        const base = name === "sqlite" ? '"data_author"' : '"data"."author"';
        await e.run(`INSERT INTO ${base} ("id", "name", "born") VALUES ('a1', 'Ann', '1990-01-02')`);
        const p3 = mk(st(2), 3);
        const r = await execute(p3, d, dialect, { empty: emptyQ, before: kit.session(dialect) });
        assert(r.kind === "ok", `${name} v3: ${JSON.stringify(r)}`);
        const quarantine = name === "sqlite" ? '"data_author_born_quarantine"' : '"data"."author_born_quarantine"';
        same(
          (await e.rows(`SELECT "id", "born" FROM ${quarantine}`)).map((x) => [
            x["id"],
            x["born"] instanceof Date ? x["born"].toISOString().slice(0, 10) : x["born"],
          ]),
          [["a1", "1990-01-02"]],
          `${name}: the values are kept`,
        );
        assert(
          p3.steps.every((x) => x.idempotency !== "ledger-only"),
          `${name}: every step is safe to run twice`,
        );
        if (name === "postgres") await e.run(`SELECT set_config('lifecycle.migrating', 'on', false)`);
        for (const x of p3.steps) for (const stmt of x.up) await applyStatement(d, stmt);
        same(
          (await e.rows(`SELECT "full_name" FROM ${name === "sqlite" ? '"author"' : '"api"."author"'}`)).map((x) => x["full_name"]),
          ["Ann"],
          `${name}: the view reads after the steps run again`,
        );
      });
    }
  },
);
