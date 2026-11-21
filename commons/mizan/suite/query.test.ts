/**
 * Questions of the trace in SQL (commons mizan 0002-mizan-query): the relations of the findings, the baseline and the specifications, the questions that are answered and refused, the library at a folder and the tool, and the one place the SQL library is named.
 *
 * @module
 */
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { main, queryLibrary } from "../src/host/query.ts";
import { queryTrace, traceCatalog, traceRelations, type TraceRecords } from "../src/query.ts";
import { finding, parseSpec } from "../src/trace.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");

const a = finding("trace/unproved", "spec-kit/specs/001-demo/spec.md", 5, "FR-001 is not proved", "001-demo FR-001");
const b = finding("trace/no-spec-line", "src/a.ts", 1, "it has no Spec: line");
const c = finding("trace/no-spec-line", "src/b.ts", 1, "it has no Spec: line");
const records: TraceRecords = {
  findings: [a, b, c],
  baseline: [b.key, "trace/no-spec-line src/gone.ts"],
  specs: [parseSpec("001-demo", "**Status:** Active\n\n- **FR-001**: It MUST work.\n- **FR-002**: It MUST stay.\n", "001-demo FR-002\treviewed by a person\n"), parseSpec("002-old", "**Status:** Draft\n\n- **FR-001**: It MUST.\n")],
};
const rows = (sql: string, params: readonly (string | number)[] = []) => {
  const r = queryTrace(records, sql, { params });
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0002-mizan-query FR-001", "0002-mizan-query FR-002"], "the findings are fresh or held as the baseline says, its keys are held or stale, the specifications and their requirements are rows, and every relation has the columns of the catalog", () => {
  const t = traceRelations(records);
  assertEquals(t["findings"]?.rows.map((r) => r[5]), ["fresh", "held", "fresh"]);
  assertEquals(t["baseline"]?.rows, [["trace/no-spec-line src/a.ts", "held"], ["trace/no-spec-line src/gone.ts", "stale"]]);
  assertEquals(t["specs"]?.rows, [["001-demo", "Active", true, 2], ["002-old", "Draft", false, 1]]);
  assertEquals(t["requirements"]?.rows.map((r) => [r[0], r[1], r[3]]), [["001-demo", "FR-001", false], ["001-demo", "FR-002", true], ["002-old", "FR-001", false]]);
  for (const [name, table] of Object.entries(t)) assertEquals(table.columns, Object.keys(traceCatalog().tables[name]?.columns ?? {}), name);
});

proves(["0002-mizan-query FR-003"], "a question is one line of SQL (the new findings by rule, the requirements nobody reviewed, the stale keys), the answer is cut at the limit, and a write, two statements and an unknown column are refused as values", () => {
  assertEquals(rows("SELECT rule, count(*) AS n FROM findings WHERE status = 'fresh' GROUP BY rule ORDER BY rule").rows, [["trace/no-spec-line", 1], ["trace/unproved", 1]]);
  assertEquals(rows("SELECT s.slug, r.id FROM requirements r JOIN specs s ON s.slug = r.spec WHERE s.in_force AND NOT r.reviewed").rows, [["001-demo", "FR-001"]]);
  assertEquals(rows("SELECT key FROM baseline WHERE status = 'stale'").rows, [["trace/no-spec-line src/gone.ts"]]);
  assertEquals(rows("SELECT file FROM findings WHERE rule = ?", ["trace/unproved"]).rows, [["spec-kit/specs/001-demo/spec.md"]]);
  const cut = queryTrace(records, "SELECT file FROM findings ORDER BY file", { limit: 1 });
  assert(cut.kind === "ok" && cut.value.rows.length === 1 && cut.value.truncated, "cut");
  for (const bad of ["DELETE FROM findings", "SELECT 1; SELECT 2", "SELECT nope FROM findings", "SELECT * FROM nowhere"]) assert(queryTrace(records, bad).kind === "err", bad);
  const unknown = queryTrace(records, "SELECT statu FROM findings");
  assert(unknown.kind === "err" && unknown.error.includes("status"), unknown.kind === "err" ? unknown.error : "ok");
});

proves(["0002-mizan-query FR-004"], "the library at a folder is asked (its own findings are all held by its baseline), and the command line gives 0 for an answer, 1 for a refused question and 2 for a line that does not fit", async () => {
  const held = await queryLibrary(ROOT, "SELECT count(*) AS n FROM findings WHERE status = 'fresh'");
  assertEquals(held, { kind: "ok", value: { columns: ["n"], rows: [[0]], truncated: false } });
  const ok = await main(["SELECT count(*) AS n FROM specs"], ROOT);
  assertEquals(ok.code, 0);
  assert(ok.lines[0]?.startsWith("n"), "a table");
  assertEquals((await main(["DELETE FROM findings"], ROOT)).code, 1);
  assertEquals((await main([], ROOT)).code, 2);
  assertEquals((await main(["--limit", "x", "SELECT 1"], ROOT)).code, 2);
});

proves(["0002-mizan-query FR-005"], "only the module of the questions names the SQL language library", () => {
  const SRC = join(ROOT, "src");
  const walk = (dir: string, below = ""): string[] =>
    readDirSync(join(dir, below)).flatMap((e) => (e.isDirectory ? walk(dir, below === "" ? e.name : `${below}/${e.name}`) : e.isFile && e.name.endsWith(".ts") ? [below === "" ? e.name : `${below}/${e.name}`] : []));
  const naming = walk(SRC).filter((f) => readTextFileSync(join(SRC, f)).includes("@intellectual-frontiers/lang-sql"));
  assertEquals(naming, ["query.ts"]);
});
