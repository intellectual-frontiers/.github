/**
 * ISLM: plans made by reading each engine's catalog, changes classified, an append-only ledger in the database, re-runs that apply
 * nothing, undo as a new step, a script by default, lint of a plan and teardown refused in production (commons 0009-sql-aide FR-035 to
 * FR-040).
 *
 * @module
 */
import { assert, assertEquals, assertRejects, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  apply,
  context,
  duckdb,
  index,
  inspect,
  integer,
  lintPlan,
  pk,
  type Plan,
  plan,
  planScript,
  postgres,
  raw,
  type Runner,
  type Sql,
  type Step,
  sqlite,
  SQL,
  step,
  table,
  teardown,
  text,
  undo,
  view,
} from "../../sql-aide/mod.ts";
import { eachEngine, golden, pgliteEngine } from "../helpers.ts";

const pg = context({ dialect: postgres() }),
  lite = context({ dialect: sqlite() }),
  duck = context({ dialect: duckdb() });
const contexts = { postgres: pg, sqlite: lite, duckdb: duck };

/** The first version of a small model. */
const account1 = table("account", { id: pk.text(), name: text(), credit: integer().nullable() });
const byName1 = index(account1, ["name"]);
const names1 = view("account_names", { name: text() }, SQL`SELECT ${account1.c.name} FROM ${account1}`, { from: [account1] });
const v1 = [account1, byName1, names1] as const;

/** The second: an address added, and credit made required. */
const account2 = table("account", { id: pk.text(), name: text(), credit: integer().default(0), email: text().nullable() });
const v2 = [account2, index(account2, ["name"]), names1] as const;

/** The third: the name is gone, so are its index and view. */
const account3 = table("account", { id: pk.text(), credit: integer().default(0), email: text().nullable() });

/** Every entity the tests here plan: their features are those all three dialects have. */
type Model = readonly ((typeof v1)[number] | (typeof v2)[number] | typeof account3)[];

async function planFor(
  entities: Model,
  runner: Runner,
  dialect: keyof typeof contexts,
  steps: readonly Step<Sql<"fragment">>[] = [],
): Promise<Plan> {
  const ctx = contexts[dialect];
  const catalog = await inspect(runner, ctx);
  assert(catalog.kind === "ok", catalog.kind === "err" ? catalog.error.message : "");
  return plan({ entities, steps }, catalog.value, ctx);
}

const nonIdempotent = (p: Plan): readonly string[] => p.changes.filter((c) => c.classification === "non-idempotent").map((c) => c.what);
const ledgerRows = async (runner: Runner): Promise<number> =>
  Number((await runner.query(`SELECT count(*) AS n FROM "ifcsql_ledger"`))[0]?.["n"]);

proves(
  ["0009-sql-aide FR-035", "0009-sql-aide FR-036", "0009-sql-aide FR-037", "0009-sql-aide FR-040"],
  "from empty every change is idempotent; applied, the catalog shows no drift and a second apply runs nothing, in every engine",
  async () => {
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      const first = await planFor(v1, engine, engine.dialect);
      assertEquals(first.changes.map((c) => `${c.what} ${c.step}`).length, 3, engine.name);
      assertEquals(nonIdempotent(first), [], `${engine.name}: from empty, nothing changes what exists`);
      if (engine.name !== "postgres") await golden(new URL(`./golden/islm-v1.${engine.dialect}.sql`, import.meta.url), planScript(first));
      const applied = await apply(first, engine, ctx, { actor: "the test" });
      assert(applied.kind === "ok", JSON.stringify(applied));
      assertEquals(applied.value.ran.length, 3);
      const again = await planFor(v1, engine, engine.dialect);
      assertEquals([again.changes, again.unplanned], [[], []], `${engine.name}: no drift`);
      const before = await ledgerRows(engine);
      assertEquals(await apply(again, engine, ctx, { actor: "the test" }), { kind: "ok", value: { ran: [] } });
      assertEquals(await ledgerRows(engine), before, `${engine.name}: a second apply records nothing`);
      const entries = await engine.query(
        `SELECT "step", "kind", "actor", "outcome", "duration_ms" FROM "ifcsql_ledger" ORDER BY "started_at", "entry_id"`,
      );
      assertEquals(
        entries.map((r) => [r["step"], r["kind"], r["actor"], r["outcome"], Number(r["duration_ms"]) >= 0]),
        [
          [
            `table:${engine.dialect === "sqlite" ? "main" : engine.dialect === "duckdb" ? "main" : "public"}.account`,
            "idempotent",
            "the test",
            "ok",
            true,
          ],
          [`index:${engine.dialect === "postgres" ? "public" : "main"}.account_name_idx`, "idempotent", "the test", "ok", true],
          [`view:${engine.dialect === "postgres" ? "public" : "main"}.account_names`, "idempotent", "the test", "ok", true],
        ],
        engine.name,
      );
    });
  },
);

proves(
  ["0009-sql-aide FR-035", "0009-sql-aide FR-036", "0009-sql-aide FR-039", "0009-sql-aide FR-040"],
  "a change of the model is the fewest non-idempotent changes, and one that destroys data is flagged and refused unless allowed",
  async () => {
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      assert((await apply(await planFor(v1, engine, engine.dialect), engine, ctx, { actor: "t" })).kind === "ok");
      await engine.exec(`INSERT INTO "account" ("id", "name", "credit") VALUES ('a1', 'Ada', 5)`);
      const second = await planFor(v2, engine, engine.dialect);
      // credit becomes required: PostgreSQL and DuckDB change it in place; SQLite cannot, and the plan says so
      const wanted = {
        sqlite: ["add-column"],
        duckdb: ["drop-index", "set-not-null", "add-column"],
        postgres: ["set-not-null", "add-column"],
      };
      assertEquals(nonIdempotent(second), wanted[engine.dialect], engine.name);
      assertEquals(second.unplanned.length, engine.dialect === "sqlite" ? 1 : 0, engine.name);
      assertEquals(lintPlan(second), []);
      const secondApplied = await apply(second, engine, ctx, { actor: "t" });
      assert(secondApplied.kind === "ok", `${engine.name}: ${JSON.stringify(secondApplied)}`);
      assertEquals(
        (await engine.query(`SELECT "email" FROM "account"`)).map((r) => r["email"]),
        [null],
      );

      const third = await planFor([account3], engine, engine.dialect);
      assertEquals(nonIdempotent(third), engine.dialect === "duckdb" ? ["drop-index", "drop-column"] : ["drop-column"], engine.name);
      const dropStep = third.changes.find((c) => c.what === "drop-column")?.step ?? "";
      assertEquals(
        lintPlan(third).map((f) => f.rule),
        ["destructive"],
      );
      assertStringIncludes(planScript(third), "(non-idempotent, destroys data)");
      assertEquals(await apply(third, engine, ctx, { actor: "t" }), { kind: "err", error: { kind: "destructive", steps: [dropStep] } });
      assertEquals((await engine.query(`SELECT "name" FROM "account"`)).length, 1, "a refused plan changes nothing");
      // the index on the column goes first, as a step a person writes; then the drop is allowed
      const dropIndex = step("2026-11-15 drop the index on the name", raw(`DROP INDEX IF EXISTS "account_name_idx"`), {
        destructive: true,
      });
      const dropView = step("2026-11-15 drop the names view", raw(`DROP VIEW IF EXISTS "account_names"`), { destructive: true });
      const thirdAgain = await planFor([account3], engine, engine.dialect, [dropView, dropIndex]);
      const ordered: Plan = {
        ...thirdAgain,
        changes: [...thirdAgain.changes.filter((c) => c.what === "step"), ...thirdAgain.changes.filter((c) => c.what !== "step")],
      };
      const dropped = await apply(ordered, engine, ctx, { actor: "t", allowDestructive: true });
      assert(dropped.kind === "ok", JSON.stringify(dropped));
      // forward only: the undo is a new step naming the one it reverses, and the ledger keeps both
      const restore = undo("2026-11-15 restore the name", dropStep, raw(`ALTER TABLE "account" ADD COLUMN "name" TEXT`));
      const undone = await apply(await planFor([account3], engine, engine.dialect, [restore]), engine, ctx, { actor: "t" });
      assert(undone.kind === "ok", JSON.stringify(undone));
      const kept = await engine.query(
        `SELECT "step", "reverses" FROM "ifcsql_ledger" WHERE "step" = '${dropStep}' OR "reverses" = '${dropStep}' ORDER BY "started_at", "entry_id"`,
      );
      assertEquals(
        kept.map((r) => [r["step"], r["reverses"]]),
        [
          [dropStep, null],
          ["2026-11-15 restore the name", dropStep],
        ],
        engine.name,
      );
      // a step applied is not applied again; changed, it is
      assertEquals(
        (await planFor([account3], engine, engine.dialect, [restore])).changes.filter((c) => c.what === "step"),
        [],
      );
      // the plan of the model now wants the name gone again: the restored column is in the database and not in the model
      assertEquals(nonIdempotent(await planFor([account3], engine, engine.dialect)), ["drop-column"]);
    });
  },
);

proves(
  ["0009-sql-aide FR-037", "0009-sql-aide FR-038"],
  "the ledger refuses to be changed or emptied, where the dialect has triggers",
  async () => {
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      assert((await apply(await planFor(v1, engine, engine.dialect), engine, ctx, { actor: "t" })).kind === "ok");
      if (engine.dialect === "duckdb") return; // DuckDB has no triggers: ISLM only appends, and nothing in the database holds it to that
      await assertRejects(() => engine.exec(`UPDATE "ifcsql_ledger" SET "outcome" = 'failed'`), Error, "append-only");
      await assertRejects(() => engine.exec(`DELETE FROM "ifcsql_ledger"`), Error, "append-only");
      assertEquals(await ledgerRows(engine), 3, engine.name);
    });
  },
);

proves(["0009-sql-aide FR-037"], "a step that fails is rolled back and recorded as failed, and the apply stops there", async () => {
  await eachEngine(async (engine) => {
    const ctx = contexts[engine.dialect];
    const bad = step("2026-11-15 broken", raw(`INSERT INTO "account" ("id", "name") VALUES ('x', 'X'); INSERT INTO "nowhere" VALUES (1)`));
    const later = step("2026-11-15 later", raw(`INSERT INTO "account" ("id", "name") VALUES ('y', 'Y')`));
    const p = await planFor(v1, engine, engine.dialect, [bad, later]);
    const result = await apply(p, engine, ctx, { actor: "t" });
    assert(result.kind === "err" && result.error.kind === "failed", engine.name);
    assertEquals([result.error.step, result.error.ran.length], ["2026-11-15 broken", 3]);
    assertEquals(
      (await engine.query(`SELECT count(*) AS n FROM "account"`)).map((r) => Number(r["n"])),
      [0],
      `${engine.name}: rolled back`,
    );
    assertEquals(
      (await engine.query(`SELECT "outcome" FROM "ifcsql_ledger" WHERE "step" LIKE '2026-11-15%'`)).map((r) => r["outcome"]),
      ["failed"],
    );
    // it is planned again, since it never applied
    assertEquals(
      (await planFor(v1, engine, engine.dialect, [bad, later])).changes.map((c) => c.step),
      ["2026-11-15 broken", "2026-11-15 later"],
    );
  });
});

proves(
  ["0009-sql-aide FR-039"],
  "an index built without a lock is flagged as unable to run in a transaction, and applies outside one",
  async () => {
    const quick = index(account1, ["credit"]).concurrently();
    const engine = await pgliteEngine();
    try {
      assert((await apply(await planFor(v1, engine, "postgres"), engine, pg, { actor: "t" })).kind === "ok");
      const catalog = await inspect(engine, pg);
      assert(catalog.kind === "ok");
      const p = await plan({ entities: [account1, quick] }, catalog.value, pg);
      assertEquals(
        lintPlan(p).map((f) => [f.rule, f.step]),
        [["non-transactional", "index:public.account_credit_idx"]],
      );
      assertStringIncludes(planScript(p), "outside a transaction");
      assert((await apply(p, engine, pg, { actor: "t" })).kind === "ok");
      assertEquals((await engine.query(`SELECT 1 FROM pg_indexes WHERE indexname = 'account_credit_idx'`)).length, 1);
    } finally {
      await engine.close();
    }
  },
);

proves(["0009-sql-aide FR-039"], "a teardown is refused in production, and elsewhere drops the model and keeps the ledger", async () => {
  const production = context({ dialect: postgres(), execution: "production" });
  assertEquals(await teardown(v1, production), {
    kind: "err",
    error: { kind: "refused", message: "a teardown is refused in a production context" },
  });
  await eachEngine(async (engine) => {
    const ctx = contexts[engine.dialect];
    assert((await apply(await planFor(v1, engine, engine.dialect), engine, ctx, { actor: "t" })).kind === "ok");
    const down = await teardown(v1, ctx);
    assert(down.kind === "ok");
    assertEquals(
      down.value.changes.map((c) => c.what),
      ["drop", "drop", "drop"],
    );
    assertEquals((await apply(down.value, engine, ctx, { actor: "t" })).kind, "err", "a teardown destroys data, so it must be allowed");
    assert((await apply(down.value, engine, ctx, { actor: "t", allowDestructive: true })).kind === "ok", engine.name);
    const catalog = await inspect(engine, ctx);
    assert(catalog.kind === "ok");
    assertEquals(
      [...catalog.value.tables.keys()].filter((k) => k.endsWith(".account")),
      [],
      engine.name,
    );
    assertEquals(await ledgerRows(engine), 6, `${engine.name}: three steps up, three down, all kept`);
    // and from there, the model is made again
    assertEquals(nonIdempotent(await planFor(v1, engine, engine.dialect)), []);
  });
});
