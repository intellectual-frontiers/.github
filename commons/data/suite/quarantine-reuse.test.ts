// Spec: 0015-sql-safety FR-004
/**
 * Quarantine instead of drop (commons data 0015-sql-safety FR-004), where the same column is dropped twice: the values the second drop would put in quarantine must not be lost to the values of
 * the first. Found by an adversarial review: the quarantine table already existed, the copy was skipped, the count of rows matched, and the new values were destroyed while the step reported success.
 * On SQLite and PostgreSQL (DuckDB refuses to alter a table other tables refer to).
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { idempotency } from "@intellectual-frontiers/data/sql/extensions/idempotency";
import { safety } from "@intellectual-frontiers/data/sql/extensions/safety";
import { execute, plan, snapshotOf, stateHash, type StepTransform } from "@intellectual-frontiers/data/sql/lifecycle";
import { bind, naming } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const day = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);
const transforms: readonly StepTransform[] = [...safety().transforms, idempotency()];

proves(
  ["0015-sql-safety FR-004"],
  "a column dropped a second time does not lose its new values to the quarantine of the first drop: the step fails its verification, is rolled back, and says what to do",
  async () => {
    for (const { name, dialect } of DIALECTS.filter((d) => d.name !== "duckdb")) {
      const e = await openEngine(name);
      try {
        const v2 = libraryAt(2);
        const v1 = libraryAt(1);
        const b = bind(v2, { dialect });
        assert(b.kind === "ok");
        if (b.kind === "ok") await load(e, b.value);
        await e.run(`INSERT INTO "author" ("id", "name", "born") VALUES ('a1', 'Ann', '1990-01-02')`);
        const from = snapshotOf(v2, { dialect });
        assert(from.kind === "ok");
        if (from.kind !== "ok") return;
        const toV1 = () => {
          const p = plan(from.value, v1, { dialect }, { transforms, allow: { destructive: true } });
          assert(p.kind === "ok", JSON.stringify(p));
          return p.kind === "ok" ? p.value : (undefined as never);
        };
        // the first drop: the value is kept in quarantine
        const first = await execute(toV1(), driverOf(e), dialect, { empty: stateHash(from.value) });
        assert(first.kind === "ok", `${name}: ${JSON.stringify(first)}`);
        same((await e.rows(`SELECT "born" b FROM "author_born_quarantine"`)).map((r) => day(r["b"])), ["1990-01-02"], name);
        // the column comes back, with a value that has never been anywhere else, and is dropped again
        await e.run(`ALTER TABLE "author" ADD COLUMN "born" DATE`);
        await e.run(`UPDATE "author" SET "born" = '2001-02-03' WHERE "id" = 'a1'`);
        await e.run(`DROP TABLE "lifecycle_ledger"`);
        const second = await execute(toV1(), driverOf(e), dialect, { empty: stateHash(from.value) });
        assert(second.kind === "err", `${name}: the second drop must not report success: ${JSON.stringify(second)}`);
        assert(JSON.stringify(second).includes("verification failed") && JSON.stringify(second).includes("purge"), `${name}: it says what to do: ${JSON.stringify(second)}`);
        same((await e.rows(`SELECT "born" b FROM "author"`)).map((r) => day(r["b"])), ["2001-02-03"], `${name}: the new value is still there`);
        void naming;
      } finally {
        await e.close();
      }
    }
  },
);
