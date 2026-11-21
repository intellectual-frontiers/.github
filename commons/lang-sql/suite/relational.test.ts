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
    "SELECT lag(pay) IGNORE NULLS OVER (ORDER BY name) FROM e",
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

proves(["0010-aide FR-015"], "NULLS FIRST and NULLS LAST order the nulls where they say (and as before where they do not), OFFSET n ROWS and FETCH FIRST n ROWS ONLY page the answer, and WITH TIES is an error value", () => {
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay NULLS FIRST, name").rows.map((x) => x[0]), ["ed", "di", "flo", "ann", "bob", "cy"]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay NULLS LAST, name").rows.map((x) => x[0]), ["di", "flo", "ann", "bob", "cy", "ed"]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay DESC NULLS FIRST, name").rows.map((x) => x[0]), ["ed", "bob", "cy", "ann", "flo", "di"]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay DESC, name").rows.map((x) => x[0]), ["bob", "cy", "ann", "flo", "di", "ed"]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY pay, name").rows.map((x) => x[0]).at(0), "ed");
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY name FETCH FIRST 2 ROWS ONLY").rows, [["ann"], ["bob"]]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY name OFFSET 4 ROWS").rows, [["ed"], ["flo"]]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY name OFFSET 1 ROWS FETCH NEXT 2 ROWS ONLY").rows, [["bob"], ["cy"]]);
  assertEquals(ask(emps, "SELECT name FROM e ORDER BY name FETCH FIRST ROW ONLY").rows, [["ann"]]);
  const ties = emps.run("SELECT name FROM e ORDER BY pay FETCH FIRST 2 ROWS WITH TIES");
  assert(ties.kind === "err" && ties.error.message !== "", "WITH TIES");
});
