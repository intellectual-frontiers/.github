/**
 * Tests of the questions of records in SQL (0015-grc-query): the relations of the records, the guard that refuses what is not one read, the limit and the parameters.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { catalogOf, queryRecords, relationsOf, type Records } from "@intellectual-frontiers/grc/surfaces/query";
import { A1, A2, aCheck, anException, aResult, ex, walk } from "./fixtures.ts";

const records: Records = {
  frameworks: [ex],
  crosswalks: [walk],
  checks: [aCheck("c-a1", [A1]), aCheck("c-a2", [A2])],
  results: [
    aResult("c-a1", "host-1", "pass", { observedAt: "2026-05-01T00:00:00Z" }),
    aResult("c-a1", "host-2", "fail", { observedAt: "2026-05-02T00:00:00Z" }),
    aResult("c-a2", "host-1", "fail", { controls: [A2], observedAt: "2026-05-03T00:00:00Z" }),
  ],
  exceptions: [anException()],
  risks: [],
  ledger: [],
};
const rows = (sql: string, options = {}) => {
  const r = queryRecords(records, sql, options);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0015-grc-query FR-001", "0015-grc-query FR-002"], "the records are relations with the columns of the catalog, one row for each document and each element of a list, and the state of the controls is there", () => {
  const t = relationsOf(records);
  assertEquals(t["controls"]?.rows.length, 3);
  assertEquals(t["results"]?.rows.length, 3);
  assertEquals(t["result_controls"]?.rows.length, 3);
  assertEquals(t["exceptions"]?.rows[0]?.[1], "check");
  for (const [name, table] of Object.entries(t)) assertEquals(table.columns, Object.keys(catalogOf().tables[name]?.columns ?? {}), name);
  const states = rows("SELECT control, status FROM control_state ORDER BY control").rows;
  assert(states.length === 3 && states.some((s) => s[0] === A1), "every control has a state");
});

proves(["0015-grc-query FR-003", "0015-grc-query FR-004", "0015-grc-query FR-005"], "an auditor's questions are one line of SQL each, a question that writes or is not one read is refused as a value, an unknown column is named with its place, and the limit and the parameters hold", () => {
  const failing = rows("SELECT c.control, count(*) AS n FROM results r JOIN result_controls c ON c.result = r.id WHERE r.status = 'fail' GROUP BY c.control ORDER BY c.control");
  assertEquals(failing.rows, [[A1, 1], [A2, 1]]);
  const ending = rows("SELECT id FROM exceptions WHERE expires_at < ?", { params: ["2026-04-01T00:00:00Z"] });
  assertEquals(ending.rows, [["exc-1"]]);
  const cut = rows("SELECT id FROM results ORDER BY id", { limit: 2 });
  assert(cut.rows.length === 2 && cut.truncated, "cut at the limit");
  for (const bad of ["DELETE FROM results", "SELECT * FROM results; DROP TABLE results", "SELECT nope FROM results", "SELECT * FROM nowhere", "UPDATE results SET status = 'pass'"]) {
    const r = queryRecords(records, bad);
    assert(r.kind === "err" && r.error.length > 0, bad);
  }
  const unknown = queryRecords(records, "SELECT statu FROM results");
  assert(unknown.kind === "err" && unknown.error.includes("status") && unknown.error.includes("1"), unknown.kind === "err" ? unknown.error : "no error");
  assertEquals(records.results.length, 3);
});
