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
  for (const bad of ["DELETE FROM checks", "SELECT 1; SELECT 2", "SELECT * FROM nowhere", "SELECT DISTINCT ON (host) host FROM checks", ""]) {
    const r = engine.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

const sets = createEngine(providerOf({
  A: { columns: ["x"], rows: [[1], [1], [2], [null], [null], [3]] },
  B: { columns: ["x"], rows: [[1], [null], [3], [3], [4]] },
}));
const ask = (e: ReturnType<typeof createEngine>, sql: string, params: readonly (string | number)[] = []) => {
  const r = e.run(sql, params);
  if (r.kind === "err") throw new Error(`${sql}: ${r.error.message}`);
  return r.value;
};

proves(["0010-aide FR-012"], "UNION, INTERSECT and EXCEPT give each row once and with ALL by their counts, a null equals a null, INTERSECT binds tighter, and the ORDER BY, LIMIT and OFFSET of the whole are applied to the answer", () => {
  assertEquals(ask(sets, "SELECT x FROM a UNION ALL SELECT x FROM b").rows.length, 11);
  assertEquals(ask(sets, "SELECT x FROM a UNION SELECT x FROM b ORDER BY x").rows, [[null], [1], [2], [3], [4]]);
  assertEquals(ask(sets, "SELECT x FROM a INTERSECT SELECT x FROM b ORDER BY x").rows, [[null], [1], [3]]);
  assertEquals(ask(sets, "SELECT x FROM a INTERSECT ALL SELECT x FROM b ORDER BY x").rows, [[null], [1], [3]]);
  assertEquals(ask(sets, "SELECT x FROM a EXCEPT SELECT x FROM b").rows, [[2]]);
  assertEquals(ask(sets, "SELECT x FROM a EXCEPT ALL SELECT x FROM b ORDER BY x").rows, [[null], [1], [2]]);
  assertEquals(ask(sets, "SELECT 1 AS x UNION SELECT 2 INTERSECT SELECT 3").rows, [[1]]);
  assertEquals(ask(sets, "SELECT x FROM a UNION SELECT x FROM b ORDER BY x DESC LIMIT 2 OFFSET 1").rows, [[3], [2]]);
  assertEquals(ask(sets, "SELECT x AS n FROM a UNION SELECT x FROM b ORDER BY n NULLS LAST LIMIT 1").columns, ["n"]);
  assertEquals(ask(sets, "SELECT x FROM a UNION SELECT x FROM b ORDER BY 1 NULLS LAST").rows.at(-1), [null]);
  assertEquals(ask(sets, "VALUES (1, 'a'), (2, 'b')"), { columns: ["column1", "column2"], rows: [[1, "a"], [2, "b"]] });
  assertEquals(ask(sets, "SELECT * FROM (VALUES (1), (2)) AS v(n) WHERE n > 1").rows, [[2]]);
  assertEquals(ask(sets, "SELECT x FROM b WHERE x IN (SELECT 3 UNION SELECT 4)").rows, [[3], [3], [4]]);
  for (const bad of ["SELECT x FROM a UNION SELECT x, x FROM b", "VALUES (1), (2, 3)", "SELECT x FROM a UNION SELECT x FROM nowhere", "SELECT x FROM a UNION BY NAME SELECT x FROM b", "SELECT x FROM a UNION SELECT x FROM b ORDER BY x + 1"]) {
    const r = sets.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

const emps = createEngine(providerOf({
  e: {
    columns: ["name", "dept", "pay"],
    rows: [["ann", "a", 10], ["bob", "a", 20], ["cy", "a", 20], ["di", "b", 5], ["ed", "b", null], ["flo", "b", 7]],
  },
}));

proves(["0010-aide FR-013"], "the ranking functions number each partition by its ORDER BY, with peers sharing a rank, and ntile, percent_rank and cume_dist follow the standard", () => {
  const r = ask(emps, "SELECT name, row_number() OVER (PARTITION BY dept ORDER BY pay DESC, name) AS rn, rank() OVER (PARTITION BY dept ORDER BY pay DESC) AS rk, dense_rank() OVER (PARTITION BY dept ORDER BY pay DESC) AS dr FROM e ORDER BY name");
  assertEquals(r.rows, [["ann", 3, 3, 2], ["bob", 1, 1, 1], ["cy", 2, 1, 1], ["di", 2, 2, 2], ["ed", 3, 3, 3], ["flo", 1, 1, 1]]);
  assertEquals(ask(emps, "SELECT name, rank() OVER (ORDER BY pay) AS rk FROM e ORDER BY rk, name").rows, [["ed", 1], ["di", 2], ["flo", 3], ["ann", 4], ["bob", 5], ["cy", 5]]);
  assertEquals(ask(emps, "SELECT name, dense_rank() OVER (ORDER BY pay) AS d FROM e ORDER BY d, name").rows.map((x) => x[1]), [1, 2, 3, 4, 5, 5]);
  assertEquals(ask(emps, "SELECT name, ntile(4) OVER (ORDER BY name) AS b FROM e ORDER BY name").rows.map((x) => x[1]), [1, 1, 2, 2, 3, 4]);
  assertEquals(ask(emps, "SELECT name, percent_rank() OVER (ORDER BY name) AS p FROM e ORDER BY name").rows.map((x) => x[1]), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assertEquals(ask(emps, "SELECT name, cume_dist() OVER (ORDER BY pay NULLS LAST) AS c FROM e WHERE dept = 'a' ORDER BY name").rows.map((x) => x[1]), [1 / 3, 1, 1]);
  assertEquals(ask(emps, "SELECT name, row_number() OVER (ORDER BY pay DESC NULLS LAST, name) AS n FROM e ORDER BY n").rows.map((x) => x[0]), ["bob", "cy", "ann", "flo", "di", "ed"]);
});

proves(["0010-aide FR-013"], "lag and lead read the row before and after in the partition (with an offset and a default), and first_value, last_value and nth_value read the frame", () => {
  assertEquals(ask(emps, "SELECT name, lag(pay) OVER (PARTITION BY dept ORDER BY name) AS p, lead(pay, 1, -1) OVER (PARTITION BY dept ORDER BY name) AS n FROM e ORDER BY name").rows, [
    ["ann", null, 20], ["bob", 10, 20], ["cy", 20, -1], ["di", null, null], ["ed", 5, 7], ["flo", null, -1],
  ]);
  assertEquals(ask(emps, "SELECT name, lag(pay, 2, 0) OVER (ORDER BY name) AS p FROM e ORDER BY name").rows.map((x) => x[1]), [0, 0, 10, 20, 20, 5]);
  assertEquals(ask(emps, "SELECT name, first_value(name) OVER (PARTITION BY dept ORDER BY name) AS f, last_value(name) OVER (PARTITION BY dept ORDER BY name) AS l, last_value(name) OVER (PARTITION BY dept ORDER BY name ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS lf FROM e ORDER BY name").rows.slice(0, 3), [
    ["ann", "ann", "ann", "cy"], ["bob", "ann", "bob", "cy"], ["cy", "ann", "cy", "cy"],
  ]);
  assertEquals(ask(emps, "SELECT name, nth_value(name, 2) OVER (ORDER BY name) AS s FROM e ORDER BY name").rows.map((x) => x[1]), [null, "bob", "bob", "bob", "bob", "bob"]);
});

proves(["0010-aide FR-013"], "aggregates run over the frame: the whole partition without an ORDER BY, the start to the last peer with one, a ROWS frame by its bounds, a RANGE frame by the current row's peers, with a named window and a FILTER", () => {
  assertEquals(ask(emps, "SELECT name, sum(pay) OVER (PARTITION BY dept) AS s, count(*) OVER () AS c FROM e ORDER BY name").rows.map((x) => [x[1], x[2]]), [[50, 6], [50, 6], [50, 6], [12, 6], [12, 6], [12, 6]]);
  assertEquals(ask(emps, "SELECT name, sum(pay) OVER (ORDER BY pay, name) AS running FROM e WHERE dept = 'a' ORDER BY name").rows.map((x) => x[1]), [10, 30, 50]);
  assertEquals(ask(emps, "SELECT name, sum(pay) OVER (ORDER BY pay) AS running FROM e WHERE dept = 'a' ORDER BY name").rows.map((x) => x[1]), [10, 50, 50]);
  assertEquals(ask(emps, "SELECT name, sum(pay) OVER (ORDER BY name ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS s FROM e ORDER BY name").rows.map((x) => x[1]), [30, 50, 45, 25, 12, 7]);
  assertEquals(ask(emps, "SELECT name, count(pay) OVER (ORDER BY name ROWS 2 PRECEDING) AS n FROM e ORDER BY name").rows.map((x) => x[1]), [1, 2, 3, 3, 2, 2]);
  assertEquals(ask(emps, "SELECT name, avg(pay) OVER (PARTITION BY dept ORDER BY pay RANGE BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING) AS a FROM e WHERE dept = 'a' ORDER BY name").rows.map((x) => x[1]), [50 / 3, 20, 20]);
  assertEquals(ask(emps, "SELECT name, min(pay) OVER w AS lo, max(pay) OVER (w) AS hi FROM e WINDOW w AS (PARTITION BY dept) ORDER BY name").rows.map((x) => [x[1], x[2]]), [[10, 20], [10, 20], [10, 20], [5, 7], [5, 7], [5, 7]]);
  assertEquals(ask(emps, "SELECT name, row_number() OVER (w ORDER BY name DESC) AS r FROM e WINDOW w AS (PARTITION BY dept) ORDER BY name").rows.map((x) => x[1]), [3, 2, 1, 3, 2, 1]);
  assertEquals(ask(emps, "SELECT name, count(*) FILTER (WHERE pay > 6) OVER (PARTITION BY dept) AS n FROM e ORDER BY name").rows.map((x) => x[1]), [3, 3, 3, 1, 1, 1]);
  assertEquals(ask(emps, "SELECT dept, count(*) FILTER (WHERE pay IS NOT NULL) AS n, count(*) AS m FROM e GROUP BY dept ORDER BY dept").rows, [["a", 3, 3], ["b", 2, 3]]);
});

proves(["0010-aide FR-013"], "a window function runs over the groups of a query that groups, may stand in the ORDER BY, and is refused in the WHERE, the HAVING and the GROUP BY, as are GROUPS and EXCLUDE frames, a RANGE with a distance, IGNORE NULLS and a name that is no window function", () => {
  assertEquals(ask(emps, "SELECT dept, sum(pay) AS s, rank() OVER (ORDER BY sum(pay) DESC) AS r FROM e GROUP BY dept ORDER BY dept").rows, [["a", 50, 1], ["b", 12, 2]]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY row_number() OVER (ORDER BY name DESC)").rows.map((x) => x[0]), ["flo", "ed", "di", "cy", "bob", "ann"]);
  for (const bad of [
    "SELECT name FROM e WHERE row_number() OVER (ORDER BY name) = 1",
    "SELECT dept FROM e GROUP BY dept HAVING rank() OVER (ORDER BY dept) = 1",
    "SELECT sum(pay) OVER (ORDER BY name GROUPS 1 PRECEDING) FROM e",
    "SELECT sum(pay) OVER (ORDER BY name ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE TIES) FROM e",
    "SELECT sum(pay) OVER (ORDER BY pay RANGE 1 PRECEDING) FROM e",
    "SELECT sum(pay) IGNORE NULLS OVER (ORDER BY name) FROM e",
    "SELECT lower(name) OVER (ORDER BY name) FROM e",
    "SELECT sum(pay) OVER nowhere FROM e",
    "SELECT ntile(0) OVER (ORDER BY name) FROM e",
    "SELECT sum(DISTINCT pay) OVER (ORDER BY name) FROM e",
  ]) {
    const r = emps.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

const shop = createEngine(providerOf({
  c: { columns: ["id", "name"], rows: [[1, "ann"], [2, "bob"], [3, "cy"]] },
  o: { columns: ["id", "cust", "total"], rows: [[10, 1, 5], [11, 1, 7], [12, 2, 9], [13, 9, 1], [14, null, 2]] },
  p: { columns: ["id", "name", "tag"], rows: [[1, "ann", "x"], [2, "zed", "y"], [4, "dee", "z"]] },
}));

proves(["0010-aide FR-014"], "RIGHT and FULL outer joins keep the rows of a side that has no partner, with nulls for the other side, and an unmatched null key matches nothing", () => {
  assertEquals(ask(shop, "SELECT c.name, o.id FROM c RIGHT JOIN o ON o.cust = c.id ORDER BY o.id").rows, [["ann", 10], ["ann", 11], ["bob", 12], [null, 13], [null, 14]]);
  assertEquals(ask(shop, "SELECT c.name, o.id FROM c FULL OUTER JOIN o ON o.cust = c.id ORDER BY o.id NULLS LAST, c.name").rows, [["ann", 10], ["ann", 11], ["bob", 12], [null, 13], [null, 14], ["cy", null]]);
  assertEquals(ask(shop, "SELECT count(*) AS n FROM c FULL JOIN o ON o.cust = c.id AND o.total > 100").rows, [[8]]);
  assertEquals(ask(shop, "SELECT c.name FROM c LEFT JOIN o ON o.cust = c.id WHERE o.id IS NULL").rows, [["cy"]]);
});

proves(["0010-aide FR-014"], "USING and NATURAL joins compare the shared columns, show each once and first in *, read the side that has the row for an unqualified name in a RIGHT or FULL join, and keep a qualified name on its own side", () => {
  assertEquals(ask(shop, "SELECT * FROM c JOIN p USING (id) ORDER BY id"), { columns: ["id", "name", "name", "tag"], rows: [[1, "ann", "ann", "x"], [2, "bob", "zed", "y"]] });
  assertEquals(ask(shop, "SELECT id, c.name, p.tag FROM c JOIN p USING (id) ORDER BY id").rows, [[1, "ann", "x"], [2, "bob", "y"]]);
  assertEquals(ask(shop, "SELECT id, c.id AS cid, p.id AS pid FROM c FULL JOIN p USING (id) ORDER BY id").rows, [[1, 1, 1], [2, 2, 2], [3, 3, null], [4, null, 4]]);
  assertEquals(ask(shop, "SELECT id, tag FROM c RIGHT JOIN p USING (id) ORDER BY id").rows, [[1, "x"], [2, "y"], [4, "z"]]);
  assertEquals(ask(shop, "SELECT * FROM c NATURAL JOIN p ORDER BY id"), { columns: ["id", "name", "tag"], rows: [[1, "ann", "x"]] });
  assertEquals(ask(shop, "SELECT c.*, tag FROM c JOIN p USING (id, name) ORDER BY c.id").rows, [[1, "ann", "x"]]);
  assertEquals(ask(shop, "SELECT * FROM c NATURAL JOIN o").rows.length, 0);
  assertEquals(ask(shop, "SELECT c.name, p.tag, o.total FROM c JOIN p USING (id) JOIN o ON o.cust = c.id ORDER BY o.id").rows, [["ann", "x", 5], ["ann", "x", 7], ["bob", "y", 9]]);
  assertEquals(ask(shop, "SELECT id, a.name, tag FROM (SELECT id, name FROM c) AS a JOIN p USING (id) ORDER BY id").rows, [[1, "ann", "x"], [2, "bob", "y"]]);
  for (const bad of ["SELECT * FROM c JOIN p USING (cust)", "SELECT * FROM c JOIN o USING (name)", "SELECT id FROM c, p WHERE id = 1"]) {
    const r = shop.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

const tree = createEngine(providerOf({
  e: { columns: ["id", "boss"], rows: [[1, null], [2, 1], [3, 1], [4, 2], [5, 4], [6, 3]] },
  g: { columns: ["a", "b"], rows: [[1, 2], [2, 3], [3, 1], [3, 4]] },
}));

proves(["0010-aide FR-016"], "a recursive common table expression runs its anchor once and its step on the last round's rows until a round makes none, UNION stops where a round adds nothing new (a cycle), and one that does not end is an error value", () => {
  assertEquals(ask(tree, "WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 5) SELECT n FROM r").rows, [[1], [2], [3], [4], [5]]);
  assertEquals(ask(tree, "WITH RECURSIVE f(n, a, b) AS (SELECT 1, 0, 1 UNION ALL SELECT n + 1, b, a + b FROM f WHERE n < 8) SELECT a FROM f ORDER BY n").rows.map((x) => x[0]), [0, 1, 1, 2, 3, 5, 8, 13]);
  assertEquals(ask(tree, "WITH RECURSIVE sub AS (SELECT id, 0 AS depth FROM e WHERE id = 2 UNION ALL SELECT e.id, sub.depth + 1 FROM e JOIN sub ON e.boss = sub.id) SELECT id, depth FROM sub ORDER BY depth, id").rows, [[2, 0], [4, 1], [5, 2]]);
  assertEquals(ask(tree, "WITH RECURSIVE walk(n) AS (SELECT 1 UNION SELECT g.b FROM g JOIN walk ON g.a = walk.n) SELECT n FROM walk ORDER BY n").rows, [[1], [2], [3], [4]]);
  assertEquals(ask(tree, "WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT n FROM r ORDER BY n DESC LIMIT 2").rows, [[3], [2]]);
  assertEquals(ask(tree, "WITH RECURSIVE r AS (SELECT 1 AS n UNION ALL SELECT n * 2 FROM r WHERE n < 100), s AS (SELECT max(n) AS m FROM r) SELECT m FROM s").rows, [[128]]);
  for (const bad of [
    "WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r) SELECT n FROM r",
    "WITH RECURSIVE r(n) AS (SELECT n FROM r UNION ALL SELECT 1) SELECT n FROM r",
    "WITH RECURSIVE r(n, m) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT n FROM r",
    "WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n, n FROM r WHERE n < 3) SELECT n FROM r",
  ]) {
    const r = tree.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

proves(["0010-aide FR-015"], "NULLS FIRST and NULLS LAST order the nulls where they say (and as before where they do not), and OFFSET n ROWS and FETCH FIRST n ROWS ONLY page the answer", () => {
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay NULLS FIRST, name").rows.map((x) => x[0]), ["ed", "di", "flo", "ann", "bob", "cy"]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay NULLS LAST, name").rows.map((x) => x[0]), ["di", "flo", "ann", "bob", "cy", "ed"]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay DESC NULLS FIRST, name").rows.map((x) => x[0]), ["ed", "bob", "cy", "ann", "flo", "di"]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay DESC, name").rows.map((x) => x[0]), ["bob", "cy", "ann", "flo", "di", "ed"]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay, name").rows.map((x) => x[0]).at(0), "ed");
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY name FETCH FIRST 2 ROWS ONLY").rows, [["ann"], ["bob"]]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY name OFFSET 4 ROWS").rows, [["ed"], ["flo"]]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY name OFFSET 1 ROWS FETCH NEXT 2 ROWS ONLY").rows, [["bob"], ["cy"]]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY name FETCH FIRST ROW ONLY").rows, [["ann"]]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay FETCH FIRST 2 ROWS WITH TIES").rows.length, 2);
});

const NOW = new Date(Date.UTC(2026, 10, 21, 13, 45, 7));
const clock = createEngine(providerOf({ d: { columns: ["day", "ts", "n"], rows: [["2024-01-31", "2024-03-10 08:30:00", 3], ["2024-02-29", "2023-12-31 23:59:59.5", null]] } }), new Map(), { now: () => NOW });

proves(["0010-aide FR-017"], "the current date and time are the moment of the clock given, once for a statement, and dates, timestamps and intervals compare as the moments do", () => {
  assertEquals(ask(clock, "SELECT current_date, current_time, localtime, current_timestamp, localtimestamp, current_timestamp(3)").rows, [["2026-11-21", "13:45:07", "13:45:07", "2026-11-21 13:45:07", "2026-11-21 13:45:07", "2026-11-21 13:45:07"]]);
  assertEquals(ask(clock, "SELECT current_date = DATE '2026-11-21' AS a, current_timestamp > TIMESTAMP '2026-11-21 13:45:06' AS b, DATE '2026-11-21' = TIMESTAMP '2026-11-21 00:00:00' AS c, DATE '2026-11-21' < TIMESTAMP '2026-11-21 00:00:01' AS d").rows, [[true, true, true, true]]);
  assertEquals(ask(clock, "SELECT INTERVAL '10' DAY > INTERVAL '2' DAY AS a, INTERVAL '1' MONTH < INTERVAL '31' DAY AS b, INTERVAL '2' HOUR = INTERVAL '120' MINUTE AS c").rows, [[true, true, true]]);
  assertEquals(ask(clock, "SELECT day FROM d WHERE day > current_date - INTERVAL '3' YEAR ORDER BY day").rows, [["2024-01-31"], ["2024-02-29"]]);
  assertEquals(ask(clock, "SELECT day FROM d ORDER BY ts").rows, [["2024-02-29"], ["2024-01-31"]]);
  assertEquals(ask(clock, "SELECT 'P1D' < 'P2D' AS a, '2024-1-1' < '2024-1-2' AS b, 'abc' < 'abd' AS c").rows, [[true, true, true]]);
});

proves(["0010-aide FR-018"], "date and time literals, casts and arithmetic follow the calendar: months clamp to the end of a month, a date plus an interval with a time is a timestamp, differences are days or intervals, and what is not a date is an error value", () => {
  const one = (sql: string) => ask(clock, sql).rows[0]?.[0];
  assertEquals(one("SELECT DATE '2024-01-31' + INTERVAL '1' MONTH"), "2024-02-29");
  assertEquals(one("SELECT DATE '2023-01-31' + INTERVAL '1' MONTH"), "2023-02-28");
  assertEquals(one("SELECT DATE '2024-03-31' - INTERVAL '1' MONTH"), "2024-02-29");
  assertEquals(one("SELECT DATE '2024-02-29' + INTERVAL '1' YEAR"), "2025-02-28");
  assertEquals(one("SELECT DATE '2024-12-31' + 1"), "2025-01-01");
  assertEquals(one("SELECT DATE '2024-03-01' - 1"), "2024-02-29");
  assertEquals(one("SELECT DATE '2024-03-01' + INTERVAL '1 02:03:04' DAY TO SECOND"), "2024-03-02 02:03:04");
  assertEquals(one("SELECT TIMESTAMP '2024-03-01 10:00:00' + INTERVAL '90' MINUTE"), "2024-03-01 11:30:00");
  assertEquals(one("SELECT INTERVAL '1' DAY + TIMESTAMP '2024-03-01 10:00:00'"), "2024-03-02 10:00:00");
  assertEquals(one("SELECT TIME '23:30:00' + INTERVAL '1' HOUR"), "00:30:00");
  assertEquals(one("SELECT DATE '2024-03-01' - DATE '2024-02-01'"), 29);
  assertEquals(one("SELECT TIMESTAMP '2024-03-02 12:00:00' - TIMESTAMP '2024-03-01 06:00:00'"), "P1DT6H");
  assertEquals(one("SELECT TIME '10:30:00' - TIME '08:00:00'"), "PT2H30M");
  assertEquals(one("SELECT INTERVAL '1' YEAR + INTERVAL '2' MONTH + INTERVAL '3' DAY"), "P1Y2M3D");
  assertEquals(one("SELECT INTERVAL '1' DAY * 3"), "P3D");
  assertEquals(one("SELECT 2 * INTERVAL '90' MINUTE"), "PT3H");
  assertEquals(one("SELECT INTERVAL '1' DAY / 2"), "PT12H");
  assertEquals(one("SELECT INTERVAL '1' MONTH * 1.5"), "P1M15D");
  assertEquals(one("SELECT -INTERVAL '1-2' YEAR TO MONTH"), "P-1Y-2M");
  assertEquals(one("SELECT INTERVAL '1 year 2 months -3 days 04:05:06'"), "P1Y2M-3DT4H5M6S");
  assertEquals(one("SELECT INTERVAL 'P1Y2M3DT4H5M6.5S'"), "P1Y2M3DT4H5M6.5S");
  assertEquals(one("SELECT INTERVAL '-1 02:03' DAY TO MINUTE"), "P-1DT-2H-3M");
  assertEquals(one("SELECT CAST('2024-03-10 08:30:00' AS DATE)"), "2024-03-10");
  assertEquals(one("SELECT CAST(DATE '2024-03-10' AS TIMESTAMP)"), "2024-03-10 00:00:00");
  assertEquals(one("SELECT CAST(ts AS TIME) FROM d WHERE n = 3"), "08:30:00");
  assertEquals(one("SELECT CAST('2 days' AS INTERVAL)"), "P2D");
  assertEquals(one("SELECT CAST(DATE '2024-03-10' AS VARCHAR)"), "2024-03-10");
  assertEquals(one("SELECT day + n FROM d WHERE n = 3"), "2024-02-03");
  assertEquals(one("SELECT n + 1 FROM d WHERE n = 3"), 4);
  assertEquals(ask(clock, "SELECT day + n FROM d ORDER BY day").rows, [["2024-02-03"], [null]]);
});

proves(["0010-aide FR-018"], "EXTRACT reads the parts of a date, a timestamp, a time and an interval, and a null gives a null", () => {
  const x = (field: string, v: string) => ask(clock, `SELECT EXTRACT(${field} FROM ${v})`).rows[0]?.[0];
  const t = "TIMESTAMP '2024-02-29 13:45:07.25'";
  assertEquals([x("YEAR", t), x("QUARTER", t), x("MONTH", t), x("DAY", t), x("HOUR", t), x("MINUTE", t), x("SECOND", t)], [2024, 1, 2, 29, 13, 45, 7.25]);
  assertEquals([x("DOW", t), x("ISODOW", t), x("DOY", t), x("WEEK", t), x("EPOCH", "TIMESTAMP '1970-01-02 00:00:00'")], [4, 4, 60, 9, 86400]);
  assertEquals([x("DOW", "DATE '2024-03-03'"), x("ISODOW", "DATE '2024-03-03'"), x("WEEK", "DATE '2021-01-03'"), x("WEEK", "DATE '2020-12-31'")], [0, 7, 53, 53]);
  assertEquals([x("MILLISECOND", t), x("MICROSECOND", t)], [7250, 7250000]);
  assertEquals([x("HOUR", "TIME '10:20:30'"), x("MINUTE", "TIME '10:20:30'"), x("SECOND", "TIME '10:20:30'")], [10, 20, 30]);
  assertEquals([x("YEAR", "INTERVAL '1-2' YEAR TO MONTH"), x("MONTH", "INTERVAL '1-2' YEAR TO MONTH"), x("DAY", "INTERVAL '3' DAY"), x("EPOCH", "INTERVAL '1' DAY")], [1, 2, 3, 86400]);
  assertEquals(ask(clock, "SELECT EXTRACT(MONTH FROM n) FROM d WHERE n IS NULL").rows, [[null]]);
  assertEquals(ask(clock, "SELECT EXTRACT(YEAR FROM day) AS y, count(*) AS c FROM d GROUP BY EXTRACT(YEAR FROM day)").rows, [[2024, 2]]);
  for (const bad of ["SELECT DATE '2024-02-30'", "SELECT DATE 'nope'", "SELECT TIMESTAMP '2024-01-01 25:00:00'", "SELECT TIMESTAMP WITH TIME ZONE '2024-01-01 00:00:00+01'", "SELECT INTERVAL '1' FORTNIGHT", "SELECT INTERVAL 'x' DAY", "SELECT EXTRACT(YEAR FROM 'abc')", "SELECT EXTRACT(DOW FROM INTERVAL '1' DAY)", "SELECT EXTRACT(HOUR FROM DATE '2024-01-01') + EXTRACT(FOO FROM DATE '2024-01-01')", "SELECT DATE '2024-01-01' * 2", "SELECT DATE '2024-01-01' + DATE '2024-01-02'", "SELECT CAST('x' AS DATE)", "SELECT CAST(1 AS DATE)", "SELECT INTERVAL '1' DAY / 0"]) {
    const r = clock.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

const sales = createEngine(providerOf({
  s: { columns: ["region", "shop", "amt"], rows: [["n", "a", 1], ["n", "a", 2], ["n", "b", 4], ["s", "c", 8], ["s", "c", 16]] },
  empty: { columns: ["region", "amt"], rows: [] },
}));

proves(["0010-aide FR-019"], "ROLLUP, CUBE and GROUPING SETS group each set on its own, with nulls for the columns a set leaves out, the empty set giving a row over no rows, GROUPING telling the rows apart, and plain expressions put with them", () => {
  assertEquals(ask(sales, "SELECT region, shop, sum(amt) AS t FROM s GROUP BY ROLLUP (region, shop) ORDER BY region NULLS LAST, shop NULLS LAST").rows, [["n", "a", 3], ["n", "b", 4], ["n", null, 7], ["s", "c", 24], ["s", null, 24], [null, null, 31]]);
  assertEquals(ask(sales, "SELECT region, shop, sum(amt) AS t FROM s GROUP BY CUBE (region, shop) ORDER BY region NULLS LAST, shop NULLS LAST").rows, [["n", "a", 3], ["n", "b", 4], ["n", null, 7], ["s", "c", 24], ["s", null, 24], [null, "a", 3], [null, "b", 4], [null, "c", 24], [null, null, 31]]);
  assertEquals(ask(sales, "SELECT region, shop, sum(amt) FROM s GROUP BY GROUPING SETS ((region), (shop), ())").rows, [["n", null, 7], ["s", null, 24], [null, "a", 3], [null, "b", 4], [null, "c", 24], [null, null, 31]]);
  assertEquals(ask(sales, "SELECT region, shop, sum(amt) FROM s GROUP BY region, ROLLUP (shop) ORDER BY region, shop NULLS LAST").rows, [["n", "a", 3], ["n", "b", 4], ["n", null, 7], ["s", "c", 24], ["s", null, 24]]);
  assertEquals(ask(sales, "SELECT region, shop, GROUPING(region) AS gr, GROUPING(shop) AS gs, GROUPING(region, shop) AS g FROM s GROUP BY ROLLUP (region, shop) ORDER BY g, region, shop").rows, [["n", "a", 0, 0, 0], ["n", "b", 0, 0, 0], ["s", "c", 0, 0, 0], ["n", null, 0, 1, 1], ["s", null, 0, 1, 1], [null, null, 1, 1, 3]]);
  assertEquals(ask(sales, "SELECT region, sum(amt) AS t FROM s GROUP BY ROLLUP (region) HAVING sum(amt) > 10 ORDER BY t").rows, [["s", 24], [null, 31]]);
  assertEquals(ask(sales, "SELECT region, sum(amt) AS t FROM s GROUP BY ROLLUP (region) HAVING GROUPING(region) = 1").rows, [[null, 31]]);
  assertEquals(ask(sales, "SELECT upper(region) AS r, count(*) AS c FROM s GROUP BY ROLLUP (upper(region)) ORDER BY c").rows, [["S", 2], ["N", 3], [null, 5]]);
  assertEquals(ask(sales, "SELECT region, shop, count(*) FROM s GROUP BY ROLLUP ((region, shop)) ORDER BY region NULLS LAST, shop").rows, [["n", "a", 2], ["n", "b", 1], ["s", "c", 2], [null, null, 5]]);
  assertEquals(ask(sales, "SELECT region, count(*) FROM s GROUP BY GROUPING SETS (ROLLUP (region), CUBE (region)) ORDER BY region NULLS LAST").rows, [["n", 3], ["n", 3], ["s", 2], ["s", 2], [null, 5], [null, 5]]);
  assertEquals(ask(sales, "SELECT region, sum(amt) FROM empty GROUP BY ROLLUP (region)").rows, [[null, null]]);
  assertEquals(ask(sales, "SELECT region, sum(amt) FROM empty GROUP BY region").rows, []);
  assertEquals(ask(sales, "SELECT sum(amt) FROM s GROUP BY ()").rows, [[31]]);
  assertEquals(ask(sales, "SELECT region, GROUPING(region) AS g, rank() OVER (ORDER BY sum(amt) DESC) AS r FROM s GROUP BY ROLLUP (region) ORDER BY r").rows, [[null, 1, 1], ["s", 0, 2], ["n", 0, 3]]);
  assertEquals(ask(sales, "SELECT GROUPING(region) FROM s GROUP BY region ORDER BY 1").rows, [[0], [0]]);
  for (const bad of ["SELECT GROUPING(shop) FROM s GROUP BY region", "SELECT GROUPING(region) FROM s", "SELECT region FROM s GROUP BY CUBE (region, shop, amt, region, shop, amt, region, shop, amt, region, shop, amt, region)", "SELECT region FROM s GROUP BY ROLLUP (*)"]) {
    const r = sales.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

const quant = createEngine(providerOf({
  t: { columns: ["a"], rows: [[1], [5], [10], [null]] },
  u: { columns: ["b"], rows: [[3], [7]] },
  n: { columns: ["b"], rows: [[3], [null]] },
  z: { columns: ["b"], rows: [] },
}));

proves(["0010-aide FR-020"], "ANY, SOME and ALL compare with a subquery or an array by the logic of SQL, a null among the values giving null where nothing decides, and none giving false for ANY and true for ALL", () => {
  assertEquals(ask(quant, "SELECT a FROM t WHERE a > ANY (SELECT b FROM u) ORDER BY a").rows, [[5], [10]]);
  assertEquals(ask(quant, "SELECT a FROM t WHERE a > SOME (SELECT b FROM u) ORDER BY a").rows, [[5], [10]]);
  assertEquals(ask(quant, "SELECT a FROM t WHERE a > ALL (SELECT b FROM u) ORDER BY a").rows, [[10]]);
  assertEquals(ask(quant, "SELECT a FROM t WHERE a = ANY (SELECT b FROM u) ORDER BY a").rows, []);
  assertEquals(ask(quant, "SELECT a FROM t WHERE a <> ALL (SELECT b FROM u) ORDER BY a").rows, [[1], [5], [10]]);
  assertEquals(ask(quant, "SELECT a FROM t WHERE a = ANY (ARRAY[1, 10]) ORDER BY a").rows, [[1], [10]]);
  assertEquals(ask(quant, "SELECT a FROM t WHERE a >= ALL (ARRAY[1, 5]) ORDER BY a").rows, [[5], [10]]);
  assertEquals(ask(quant, "SELECT a, a < ANY (SELECT b FROM n) AS x, a < ALL (SELECT b FROM n) AS y FROM t ORDER BY a").rows, [[null, null, null], [1, true, null], [5, null, false], [10, null, false]]);
  assertEquals(ask(quant, "SELECT a, a = ANY (SELECT b FROM z) AS x, a = ALL (SELECT b FROM z) AS y FROM t ORDER BY a").rows.map((r) => [r[1], r[2]]), [[false, true], [false, true], [false, true], [false, true]]);
  assertEquals(ask(quant, "SELECT a FROM t WHERE NOT a = ANY (SELECT b FROM n) ORDER BY a").rows, []);
  assertEquals(ask(quant, "SELECT count(*) FROM t WHERE a < ALL (SELECT b FROM u WHERE b > a)").rows, [[4]]);
  for (const bad of ["SELECT a FROM t WHERE a > ANY (SELECT b, b FROM u)", "SELECT a FROM t WHERE a LIKE ANY (SELECT b FROM u)", "SELECT a FROM t WHERE a > ANY (1)", "SELECT a FROM t WHERE a + 1 = ANY (SELECT b FROM u) + 1"]) {
    const r = quant.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

const text = createEngine(providerOf({ one: { columns: ["x"], rows: [[1]] } }));
const sx = (sql: string) => ask(text, `SELECT ${sql} FROM one`).rows[0]?.[0];

proves(["0010-aide FR-021"], "the string functions follow the standard: SUBSTRING counts a part before the start in its length, POSITION and TRIM take their keywords, OVERLAY places, nulls give nulls (but for concat), and what is not a whole number is an error value", () => {
  assertEquals([sx("char_length('héllo')"), sx("character_length('😀a')"), sx("octet_length('héllo')")], [5, 2, 6]);
  assertEquals([sx("SUBSTRING('hello' FROM 2 FOR 3)"), sx("SUBSTRING('hello' FROM 0 FOR 3)"), sx("SUBSTRING('hello' FROM -1 FOR 4)"), sx("SUBSTRING('hello' FROM 4)"), sx("SUBSTRING('hello' FROM 10)"), sx("substring('hello', 2, 2)"), sx("substring('hello', 2)")], ["ell", "he", "he", "lo", "", "el", "ello"]);
  assertEquals([sx("POSITION('l' IN 'hello')"), sx("POSITION('z' IN 'hello')"), sx("POSITION('' IN 'x')"), sx("POSITION('lo' IN 'hello')")], [3, 0, 1, 4]);
  assertEquals([sx("TRIM(BOTH 'x' FROM 'xxaxx')"), sx("TRIM(LEADING 'x' FROM 'xxaxx')"), sx("TRIM(TRAILING 'x' FROM 'xxaxx')"), sx("TRIM(LEADING FROM '  a ')"), sx("TRIM('x' FROM 'xax')"), sx("trim('  a  ')"), sx("ltrim('xxa', 'x')"), sx("rtrim('axx', 'x')"), sx("TRIM(BOTH 'xy' FROM 'yxaxy')")], ["a", "axx", "xxa", "a ", "a", "a", "a", "a", "a"]);
  assertEquals([sx("OVERLAY('abcdef' PLACING 'XY' FROM 3)"), sx("OVERLAY('abcdef' PLACING 'XY' FROM 3 FOR 0)"), sx("OVERLAY('abcdef' PLACING 'XY' FROM 3 FOR 4)"), sx("OVERLAY('abcdef' PLACING 'XY' FROM 1 FOR 2)")], ["abXYef", "abXYcdef", "abXY", "XYcdef"]);
  assertEquals([sx("concat('a', NULL, 'b')"), sx("concat()"), sx("left('hello', 2)"), sx("left('hello', -2)"), sx("right('hello', 2)"), sx("right('hello', -2)"), sx("repeat('ab', 3)"), sx("reverse('abc')"), sx("lpad('7', 3, '0')"), sx("rpad('ab', 5, 'xy')"), sx("lpad('abcdef', 3)"), sx("lpad('a', 4)")], ["ab", "", "he", "hel", "lo", "llo", "ababab", "cba", "007", "abxyx", "abc", "   a"]);
  assertEquals([sx("char_length(NULL)"), sx("SUBSTRING(NULL FROM 1)"), sx("SUBSTRING('a' FROM NULL)"), sx("POSITION(NULL IN 'a')"), sx("TRIM(BOTH NULL FROM 'a')"), sx("OVERLAY('a' PLACING NULL FROM 1)"), sx("left(NULL, 1)"), sx("repeat('a', NULL)"), sx("lpad('a', NULL)")], [null, null, null, null, null, null, null, null, null]);
  assertEquals(ask(text, "SELECT upper(substring(name FROM 1 FOR 1)) || substring(name FROM 2) AS n FROM (VALUES ('ann'), ('bob')) AS t(name)").rows, [["Ann"], ["Bob"]]);
  for (const bad of ["SELECT SUBSTRING('abc' FROM 1.5)", "SELECT SUBSTRING('abc' FROM 1 FOR -1)", "SELECT left('abc', 'x')", "SELECT repeat('a', 1000000)", "SELECT POSITION('a')", "SELECT OVERLAY('a' PLACING 'b')", "SELECT SUBSTRING('abc' FOR 2)"]) {
    const r = text.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

proves(["0010-aide FR-022"], "LISTAGG, STRING_AGG and GROUP_CONCAT join the values in the order given, with DISTINCT and a FILTER, a separator is required where the standard has none, and an ORDER BY on any other aggregate is an error value", () => {
  assertEquals(ask(sales, "SELECT region, listagg(shop, '|') WITHIN GROUP (ORDER BY shop DESC) AS l FROM s GROUP BY region ORDER BY region").rows, [["n", "b|a|a"], ["s", "c|c"]]);
  assertEquals(ask(sales, "SELECT region, listagg(DISTINCT shop, '|') WITHIN GROUP (ORDER BY shop DESC) AS l FROM s GROUP BY region ORDER BY region").rows, [["n", "b|a"], ["s", "c"]]);
  assertEquals(ask(sales, "SELECT region, string_agg(shop, ',' ORDER BY amt DESC) AS l FROM s GROUP BY region ORDER BY region").rows, [["n", "b,a,a"], ["s", "c,c"]]);
  assertEquals(ask(sales, "SELECT group_concat(shop ORDER BY shop) AS l FROM s").rows, [["a,a,b,c,c"]]);
  assertEquals(ask(sales, "SELECT string_agg(shop, '' ORDER BY amt) FILTER (WHERE amt > 1) AS l FROM s").rows, [["abcc"]]);
  assertEquals(ask(sales, "SELECT listagg(region, ',') AS l FROM empty").rows, [[null]]);
  assertEquals(ask(sales, "SELECT string_agg(region, ',' ORDER BY region NULLS FIRST) AS l FROM (VALUES ('b'), (NULL), ('a')) AS t(region)").rows, [["a,b"]]);
  assertEquals(ask(sales, "SELECT shop, group_concat(shop, '-') OVER (ORDER BY amt ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS l FROM s WHERE region = 'n' ORDER BY amt").rows, [["a", "a"], ["a", "a-a"], ["b", "a-a-b"]]);
  for (const bad of ["SELECT listagg(shop) FROM s", "SELECT string_agg(shop) FROM s", "SELECT sum(amt ORDER BY amt) FROM s", "SELECT sum(amt) WITHIN GROUP (ORDER BY amt) FROM s", "SELECT listagg(shop, ',') WITHIN GROUP (ORDER BY shop) OVER () FROM s"]) {
    const r = sales.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

const ign = createEngine(providerOf({ v: { columns: ["id", "x"], rows: [[1, 1], [2, null], [3, 3], [4, null], [5, null], [6, 6]] } }));

proves(["0010-aide FR-022"], "IGNORE NULLS counts only the rows whose value is not null for lag, lead, first_value, last_value and nth_value, RESPECT NULLS is as none, and any other function refuses it", () => {
  const col = (sql: string) => ask(ign, sql).rows.map((r) => r[0]);
  assertEquals(col("SELECT lag(x) IGNORE NULLS OVER (ORDER BY id) FROM v ORDER BY id"), [null, 1, 1, 3, 3, 3]);
  assertEquals(col("SELECT lead(x) IGNORE NULLS OVER (ORDER BY id) FROM v ORDER BY id"), [3, 3, 6, 6, 6, null]);
  assertEquals(col("SELECT lag(x, 2, -1) IGNORE NULLS OVER (ORDER BY id) FROM v ORDER BY id"), [-1, -1, -1, 1, 1, 1]);
  assertEquals(col("SELECT lag(x) OVER (ORDER BY id) FROM v ORDER BY id"), [null, 1, null, 3, null, null]);
  assertEquals(col("SELECT lag(x) RESPECT NULLS OVER (ORDER BY id) FROM v ORDER BY id"), [null, 1, null, 3, null, null]);
  assertEquals(col("SELECT last_value(x) IGNORE NULLS OVER (ORDER BY id) FROM v ORDER BY id"), [1, 1, 3, 3, 3, 6]);
  assertEquals(col("SELECT last_value(x) OVER (ORDER BY id) FROM v ORDER BY id"), [1, null, 3, null, null, 6]);
  assertEquals(col("SELECT first_value(x) IGNORE NULLS OVER (ORDER BY id DESC) FROM v ORDER BY id"), [6, 6, 6, 6, 6, 6]);
  assertEquals(col("SELECT nth_value(x, 2) IGNORE NULLS OVER (ORDER BY id) FROM v ORDER BY id"), [null, null, 3, 3, 3, 3]);
  assertEquals(col("SELECT first_value(x) IGNORE NULLS OVER (ORDER BY id ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING) FROM v ORDER BY id"), [3, 3, 6, 6, 6, null]);
  for (const bad of ["SELECT sum(x) IGNORE NULLS OVER () FROM v", "SELECT row_number() IGNORE NULLS OVER (ORDER BY id) FROM v"]) {
    const r = ign.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

proves(["0010-aide FR-023"], "FETCH FIRST n PERCENT takes the ceiling of the percent of the rows after the offset, WITH TIES takes the rows that equal the last on the keys of the ORDER BY, both work in a set operation, and what makes no sense is an error value", () => {
  const names = (sql: string) => ask(emps, sql).rows.map((r) => r[0]);
  const by = "SELECT name FROM e ORDER BY pay DESC NULLS LAST, name";
  assertEquals(names(`${by} FETCH FIRST 2 ROWS ONLY`), ["bob", "cy"]);
  assertEquals(names("SELECT name FROM e ORDER BY pay DESC NULLS LAST FETCH FIRST 2 ROWS WITH TIES"), ["bob", "cy"]);
  assertEquals(names("SELECT name FROM e ORDER BY pay DESC NULLS LAST FETCH FIRST 1 ROWS WITH TIES").length, 2);
  assertEquals(names("SELECT name FROM e ORDER BY pay DESC NULLS LAST FETCH FIRST 3 ROWS WITH TIES").length, 3);
  assertEquals(names("SELECT name FROM e ORDER BY pay FETCH FIRST 1 ROW WITH TIES"), ["ed"]);
  assertEquals([50, 10, 0, 100, 34, 17].map((p) => names(`${by} FETCH FIRST ${p} PERCENT ROWS ONLY`).length), [3, 1, 0, 6, 3, 2]);
  assertEquals(names(`${by} OFFSET 1 ROWS FETCH FIRST 50 PERCENT ROWS ONLY`), ["cy", "ann", "flo"]);
  assertEquals(names("SELECT name FROM e ORDER BY pay DESC NULLS LAST FETCH FIRST 10 PERCENT ROWS WITH TIES").length, 2);
  assertEquals(ask(emps, "SELECT pay FROM e UNION ALL SELECT pay FROM e ORDER BY pay DESC FETCH FIRST 1 ROWS WITH TIES").rows, [[20], [20], [20], [20]]);
  assertEquals(ask(emps, "SELECT pay FROM e UNION ALL SELECT pay FROM e ORDER BY pay DESC FETCH FIRST 25 PERCENT ROWS ONLY").rows, [[20], [20], [20]]);
  for (const bad of ["SELECT name FROM e FETCH FIRST 3 ROWS WITH TIES", "SELECT name FROM e ORDER BY name FETCH FIRST 101 PERCENT ROWS ONLY", "SELECT name FROM e ORDER BY name FETCH FIRST -1 PERCENT ROWS ONLY", "SELECT pay FROM e UNION SELECT pay FROM e FETCH FIRST 1 ROWS WITH TIES"]) {
    const r = emps.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

proves(["0010-aide FR-024"], "SIMILAR TO matches the whole text by the pattern of the standard: wildcards, alternation, repetition, classes (named too), an escape that is only where it is given, a dot that is a dot, and null for null", () => {
  const sim = (text: string, pattern: string, escape = "") => ask(text0, `SELECT '${text}' SIMILAR TO '${pattern}'${escape === "" ? "" : ` ESCAPE '${escape}'`}`).rows[0]?.[0];
  assertEquals([sim("abc", "abc"), sim("abc", "a%"), sim("abc", "a_c"), sim("abc", "(a|x)bc"), sim("abbbc", "ab+c"), sim("ac", "ab?c"), sim("abc", "b"), sim("a.c", "a.c"), sim("abc", "a.c")], [true, true, true, true, true, true, false, true, false]);
  assertEquals([sim("ab", "[a-c][a-c]"), sim("a1", "[[:alpha:]][[:digit:]]"), sim("A1", "[[:lower:]]1"), sim("ab12", "[a-z]{2}[0-9]{2}"), sim("ad", "a[^b-c]"), sim("ab", "a[^b-c]"), sim("a-", "a[-]")], [true, true, false, true, true, false, true]);
  assertEquals([sim("a%", "a\\%", "\\"), sim("ab", "a\\%", "\\"), sim("a|b", "a#|b", "#"), sim("(x)", "#(x#)", "#")], [true, false, true, true]);
  assertEquals(ask(text0, "SELECT 'abc' NOT SIMILAR TO 'a%', 'abc' NOT SIMILAR TO 'x%', NULL SIMILAR TO 'a', 'a' SIMILAR TO NULL").rows, [[false, true, null, null]]);
  assertEquals(ask(text0, "SELECT x FROM (VALUES ('apple'), ('banana'), ('cherry')) AS t(x) WHERE x SIMILAR TO '(a|b)%' ORDER BY x").rows, [["apple"], ["banana"]]);
  for (const bad of ["SELECT 'a' SIMILAR TO '('", "SELECT 'a' SIMILAR TO '[abc'", "SELECT 'a' SIMILAR TO '[[:foo:]]'", "SELECT 'a' SIMILAR TO 'a{'"]) {
    const r = text0.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

const text0 = createEngine(providerOf({ one: { columns: ["x"], rows: [[1]] } }));
const big = createEngine(providerOf({ n: { columns: ["i"], rows: Array.from({ length: 400 }, (_, i) => [i]) } }));

proves(["0010-aide FR-025"], "TABLESAMPLE keeps the rows a seeded generator lets through: all at 100 percent, none at 0, the same rows for the same seed, others for another seed, about the percent, with an alias or without, and a method or size that is none is an error value", () => {
  const sample = (sql: string) => ask(big, sql).rows.map((r) => r[0]);
  assertEquals(sample("SELECT i FROM n TABLESAMPLE BERNOULLI (100)").length, 400);
  assertEquals(sample("SELECT i FROM n TABLESAMPLE BERNOULLI (0)").length, 0);
  const a = sample("SELECT i FROM n TABLESAMPLE BERNOULLI (25) REPEATABLE (7)");
  assertEquals(sample("SELECT i FROM n TABLESAMPLE BERNOULLI (25) REPEATABLE (7)"), a);
  assert(a.length > 60 && a.length < 140, `about a quarter: ${a.length}`);
  assert(JSON.stringify(sample("SELECT i FROM n TABLESAMPLE BERNOULLI (25) REPEATABLE (8)")) !== JSON.stringify(a), "another seed");
  assertEquals(sample("SELECT i FROM n TABLESAMPLE SYSTEM (25) REPEATABLE (7)"), a);
  assertEquals(sample("SELECT x.i FROM n AS x TABLESAMPLE BERNOULLI (25) REPEATABLE (7) WHERE x.i < 100"), a.filter((v) => Number(v) < 100));
  assertEquals(sample("SELECT i FROM n TABLESAMPLE BERNOULLI (50)"), sample("SELECT i FROM n TABLESAMPLE BERNOULLI (50) REPEATABLE (0)"));
  for (const bad of ["SELECT i FROM n TABLESAMPLE BLOCK (10)", "SELECT i FROM n TABLESAMPLE BERNOULLI (101)", "SELECT i FROM n TABLESAMPLE BERNOULLI (-1)", "SELECT i FROM n TABLESAMPLE BERNOULLI (x)", "SELECT i FROM n TABLESAMPLE BERNOULLI (10) REPEATABLE (1.5)"]) {
    const r = big.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});

proves(["0010-aide FR-026"], "a LATERAL subquery is run for each row before it and may name its columns: cross and inner joins keep the rows it gives, a left join keeps the row once with nulls, a comma in the FROM works the same, and a right or full join is an error value", () => {
  assertEquals(ask(shop, "SELECT c.name, x.total FROM c CROSS JOIN LATERAL (SELECT total FROM o WHERE o.cust = c.id ORDER BY total DESC LIMIT 1) AS x ORDER BY c.name").rows, [["ann", 7], ["bob", 9]]);
  assertEquals(ask(shop, "SELECT c.name, x.total FROM c LEFT JOIN LATERAL (SELECT total FROM o WHERE o.cust = c.id ORDER BY total DESC LIMIT 1) AS x ON TRUE ORDER BY c.name").rows, [["ann", 7], ["bob", 9], ["cy", null]]);
  assertEquals(ask(shop, "SELECT c.name, x.n FROM c, LATERAL (SELECT count(*) AS n FROM o WHERE o.cust = c.id) AS x ORDER BY c.name").rows, [["ann", 2], ["bob", 1], ["cy", 0]]);
  assertEquals(ask(shop, "SELECT c.id, y.k FROM c JOIN LATERAL (SELECT c.id * 10 AS k) AS y ON y.k > 10 ORDER BY c.id").rows, [[2, 20], [3, 30]]);
  assertEquals(ask(shop, "SELECT c.name, o.id, x.t FROM c JOIN o ON o.cust = c.id, LATERAL (SELECT o.total + 1 AS t) AS x ORDER BY o.id").rows, [["ann", 10, 6], ["ann", 11, 8], ["bob", 12, 10]]);
  assertEquals(ask(shop, "SELECT c.name, x.n FROM c LEFT JOIN LATERAL (SELECT count(*) AS n FROM o WHERE o.cust = c.id AND o.total > 100) AS x ON TRUE WHERE x.n = 0 ORDER BY c.name").rows.length, 3);
  assertEquals(ask(shop, "SELECT * FROM (SELECT 1 AS a) AS s, LATERAL (SELECT a + 1 AS b) AS l").rows, [[1, 2]]);
  for (const bad of ["SELECT * FROM c RIGHT JOIN LATERAL (SELECT 1) AS x ON TRUE", "SELECT * FROM c FULL JOIN LATERAL (SELECT 1) AS x ON TRUE", "SELECT * FROM c, LATERAL (SELECT nope) AS x"]) {
    const r = shop.run(bad);
    assert(r.kind === "err" && r.error.message !== "", bad);
  }
});
