/**
 * The relational engine of aide (commons lang-sql 0010-aide FR-010): any rows asked in SQL, read-only, errors as values.
 *
 * Spec: 0010-aide FR-010
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { createEngine, providerOf } from "@intellectual-frontiers/lang-sql/aide/relational";

const tables = {
  Checks: { columns: ["id", "host", "ok"], rows: [[1, "a", true], [2, "a", false], [3, "b", false], [4, "c", null]] },
  Hosts: { columns: ["host", "env"], rows: [["a", "prod"], ["b", "dev"]] },
} as const;
const engine = createEngine(providerOf({ Checks: { columns: [...tables.Checks.columns], rows: tables.Checks.rows.map((r) => [...r]) }, Hosts: { columns: [...tables.Hosts.columns], rows: tables.Hosts.rows.map((r) => [...r]) } }));

proves(["0010-aide FR-010"], "the engine answers a query over the relations of a provider: joins, grouping, a subquery and a common table expression, with the logic of SQL, and a name is found without regard to case", () => {
  const joined = engine.run("SELECT h.env, count(*) AS n FROM checks c JOIN hosts h ON h.host = c.host WHERE c.ok = FALSE GROUP BY h.env ORDER BY h.env");
  assertEquals(joined.kind === "ok" ? joined.value.rows : "err", [["dev", 1], ["prod", 1]]);
  const left = engine.run("SELECT c.id, h.env FROM checks c LEFT JOIN hosts h ON h.host = c.host WHERE h.env IS NULL");
  assertEquals(left.kind === "ok" ? left.value.rows : "err", [[4, null]]);
  const sub = engine.run("WITH bad AS (SELECT host FROM checks WHERE ok = FALSE) SELECT env FROM hosts WHERE host IN (SELECT host FROM bad) ORDER BY env");
  assertEquals(sub.kind === "ok" ? sub.value.rows : "err", [["dev"], ["prod"]]);
});

proves(["0010-aide FR-010"], "what is not one query is an error value: a write, two statements, a table that is not there and a clause the engine does not have", () => {
  for (const bad of ["DELETE FROM checks", "SELECT 1; SELECT 2", "SELECT * FROM nowhere", "SELECT * FROM checks NATURAL JOIN hosts", ""]) {
    const r = engine.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});
