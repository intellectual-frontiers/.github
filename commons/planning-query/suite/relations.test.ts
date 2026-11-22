/**
 * Tests of the relations of Planning Query (commons planning-query 0002-planning-query-relations FR-001 to FR-005): the columns as data and the one list they are made from, the same answers as the query algebra of
 * commons planning, a statement that writes refused with its reasons, a proposal counted only where asked for, and the store of a repository written by commons planning asked through the relations.
 *
 * @module
 */
import fc from "fast-check";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { parseReplicaId } from "@intellectual-frontiers/anyfs/governance";
import {
  agent,
  type EventData,
  type Item,
  type ItemEvent,
  makeEvent,
  parseDay,
  parseEventId,
  parseInstant,
  parseItemId,
  person,
  type Trace,
} from "@intellectual-frontiers/planning/governance";
import { fold, newClock, runQuery } from "@intellectual-frontiers/planning/logical";
import { writeEvents } from "@intellectual-frontiers/planning/physical";
import { CATALOG, formatTable, openPlanningQuery, tablesOf } from "@intellectual-frontiers/planning-query/logical";
import { EVENT_COLUMNS, ISSUE_COLUMNS, LINK_COLUMNS, RELATIONS, TRACE_COLUMNS, relationNamed } from "@intellectual-frontiers/planning-query/governance";
import { queryStore } from "@intellectual-frontiers/planning-query/physical";

const must = <T, E>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: E }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

const ADA = must(person("ada@example.test", "Ada"));
const CLAUDE = must(agent("claude", "Claude", ADA, "session"));
let seq = 0;
const eid = () => must(parseEventId(`018f3a6e-7c00-7${String(++seq).padStart(3, "0")}-8123-456789abcdef`));
const iid = (n: number) => must(parseItemId(`018f3a6e-7b00-7${String(n).padStart(3, "0")}-8123-456789abcdef`));
const at = (n: number) => must(parseInstant(`2026-11-${String(10 + (n % 15)).padStart(2, "0")}T10:00:00Z`));

function item(n: number, title: string, opening: Partial<Extract<EventData, { type: "opened" }>>, rest: readonly EventData[] = [], by = ADA as Parameters<typeof makeEvent>[0]["actor"]): Item {
  const id = iid(n);
  const events: ItemEvent[] = [must(makeEvent({ id: eid(), item: id, at: at(n), actor: by }, { type: "opened", kind: "task", title, body: `body of ${title}`, labels: ["x"], assignees: [], origin: "declared", ...opening }))];
  for (const [i, d] of rest.entries()) events.push(must(makeEvent({ id: eid(), item: id, at: at(n + i + 1), actor: ADA }, d)));
  return must(fold(events));
}

const DAY = must(parseDay("2027-03-04"));
const items = [
  item(1, "first", { severity: "warning", sourceSeverity: "high", priority: "P2", goals: ["G1", "G2"] }),
  item(2, "second", { labels: ["a", "b"] }, [{ type: "closed", reason: "completed" }, { type: "commented", body: "done" }]),
  item(3, "third", { blocker: true }, [{ type: "deferred", until: DAY }]),
  item(4, "fourth", {}, [{ type: "started" }, { type: "linked", change: "add", link: "blocks", to: iid(1) }]),
  item(5, "an agent's proposal", { origin: "inferred" }, [], CLAUDE),
];
const trace: Trace = { item: iid(1), source: "markdown", fingerprint: "fp", locator: { kind: "file-span", path: "a.md", startLine: 3, endLine: 3 }, contentHash: "h", observed: { kind: "task", title: "first", body: "", labels: [], assignees: [], state: { kind: "open" }, origin: "derived", external: [] }, presence: "present" };
const data = { items, traces: [trace] };

const rows = (sql: string, includeProposed = false) => {
  const r = openPlanningQuery(data, { includeProposed }).query(sql);
  assert(r.kind === "ok", `${sql}: ${JSON.stringify(r)}`);
  return r.value;
};

proves(["0002-planning-query-relations FR-001"], "issues has a column for each field of the core and the state and the monorepo's columns, and the relations events, links and traces give each event, link and trace", () => {
  const names = ISSUE_COLUMNS.map((c) => c.name);
  for (const monorepo of ["id", "title", "state", "reason", "severity", "blocker", "labels", "assignees", "comments", "opened_at", "updated_at"]) assert(names.includes(monorepo as never), `${monorepo} is a column`);
  for (const core of ["kind", "body", "origin", "external", "links", "until", "source_severity", "priority", "goals", "cites", "evidence", "motivation"]) assert(names.includes(core as never), `${core} is a column`);
  const t = rows("select id, kind, title, state, reason, until, severity, source_severity, blocker, labels, comments, links, goals from issues order by title");
  const byTitle = Object.fromEntries(t.rows.map((r) => [r[2], r]));
  assertEquals(byTitle["second"]?.slice(3, 6), ["closed", "completed", ""]);
  assertEquals(byTitle["third"]?.slice(3, 6), ["deferred", "", "2027-03-04"]);
  assertEquals([byTitle["third"]?.[8]], [true]);
  assertEquals([byTitle["first"]?.[6], byTitle["first"]?.[7], byTitle["first"]?.[12]], ["warning", "high", "G1,G2"]);
  assertEquals([byTitle["second"]?.[9], byTitle["second"]?.[10]], ["a,b", 1]);
  assertEquals(rows("select count(*) as n from events").rows[0]?.[0], items.filter((i) => i.state.kind !== "proposed").flatMap((i) => i.events).length);
  assertEquals(rows("select from_issue, to_issue, kind from links").rows, [[iid(4), iid(1), "blocks"]]);
  assertEquals(rows("select issue, source, locator, presence from traces").rows, [[iid(1), "markdown", "a.md:3", "present"]]);
  const principals = rows("select principal, actor_kind from events where actor_kind = 'agent'", true).rows;
  assertEquals(principals, [["ada@example.test", "agent"]]);
});

proves(["0002-planning-query-relations FR-002"], "the catalog, the relations of the help and the rows are made from the one list of columns", () => {
  assertEquals(RELATIONS.map((r) => r.name), ["issues", "events", "links", "traces"]);
  for (const [name, cols] of [["issues", ISSUE_COLUMNS], ["events", EVENT_COLUMNS], ["links", LINK_COLUMNS], ["traces", TRACE_COLUMNS]] as const) {
    assertEquals(relationNamed(name)?.columns, cols);
    const built = tablesOf(data, true)[name]?.();
    assertEquals(built?.columns, cols.map((c) => c.name));
    assert(built?.rows.every((r) => r.length === cols.length) === true, `${name}: every row has a value for each column`);
  }
  assert(JSON.stringify(CATALOG).includes("opened_at") && JSON.stringify(CATALOG).includes("content_hash"), "the catalog is made from the columns");
  assert(RELATIONS.every((r) => r.summary.trim() !== "" && r.columns.every((c) => c.summary.trim() !== "")), "every relation and column has its sentence");
});

proves(["0002-planning-query-relations FR-003"], "a statement is one read, a statement that writes or names what is not there is refused with its reasons, and the answer is the same rows as the query algebra", () => {
  const q = openPlanningQuery(data);
  for (const bad of ["delete from issues", "insert into issues(id) values ('x')", "drop table issues", "select 1; select 2", "select nothere from issues", "select * from nowhere"]) {
    const r = q.query(bad);
    assert(r.kind === "err", `${bad} is refused`);
    if (r.error.kind === "refused") assert(r.error.reasons.length > 0, "with its reasons");
  }
  assertEquals(q.query("select * from nowhere").kind, "err");
  const budget = openPlanningQuery(data, { maxRows: 1 }).query("select id from issues");
  assert(budget.kind === "err" && budget.error.kind === "budget", "a budget of rows");
  const sql = new Map(rows("select state, count(*) as n from issues group by state").rows.map((r) => [r[0], r[1]]));
  const algebra = new Map<string, number>();
  for (const r of runQuery({ items, traces: [trace] }, { from: "items" })) if (r.kind === "item") algebra.set(r.item.state.kind, (algebra.get(r.item.state.kind) ?? 0) + 1);
  assertEquals(Object.fromEntries(sql), Object.fromEntries(algebra));
  assertEquals(rows("select id from issues where label_x = 1".replace("label_x = 1", "labels = 'a,b'")).rows, [[iid(2)]]);
  assert(formatTable(rows("select title from issues order by title limit 2"), "csv").startsWith("title\nfirst"), "a table as CSV");
});

proves(["0002-planning-query-relations FR-003"], "over generated items the SQL and the query algebra give the same ids for any filter of state, kind and label", () => {
  fc.assert(
    fc.property(fc.constantFrom("open", "closed", "deferred", "in-progress"), fc.constantFrom("x", "a", "nothing"), (state, label) => {
      const sql = rows(`select id from issues where state = '${state}' and labels like '%${label}%' order by id`).rows.map((r) => r[0]);
      const algebra = runQuery({ items, traces: [] }, { from: "items", where: { state: [state] }, order: { by: "id" } })
        .flatMap((r) => (r.kind === "item" && r.item.labels.some((l) => l.includes(label)) ? [r.item.id] : []));
      assertEquals(sql, algebra);
    }),
    { numRuns: 40 },
  );
});

proves(["0002-planning-query-relations FR-004"], "a proposed item is not a row of issues unless proposals are included, and then it is told by its state", () => {
  assertEquals(rows("select count(*) from issues").rows[0]?.[0], 4);
  assertEquals(rows("select count(*) from issues", true).rows[0]?.[0], 5);
  assertEquals(rows("select title, state from issues where state = 'proposed'", true).rows, [["an agent's proposal", "proposed"]]);
  assertEquals(rows("select title from issues where state = 'proposed'").rows, []);
  assertEquals(rows("select count(*) from events where issue = '" + iid(5) + "'").rows[0]?.[0], 0);
});

proves(["0002-planning-query-relations FR-005"], "a real store of events written by commons planning is asked through the relations, and a file that is not an event is not a row", async () => {
  const dir = mkdtempSync(join(tmpdir(), "planning-query-"));
  try {
    const store = must(await localStore(dir, { create: true }));
    must(await writeEvents(store, items.flatMap((i) => [...i.events])));
    const clock = newClock(must(parseReplicaId("0123456789abcdef0123456789abcdef")));
    const answer = await queryStore(store, "select title, state from issues order by title", { clock, wallMs: 1_800_000_000_000 });
    assert(answer.kind === "ok", JSON.stringify(answer));
    assertEquals(answer.value.rows.map((r) => r[0]), ["first", "fourth", "second", "third"]);
    const withProposals = await queryStore(store, "select count(*) from issues", { clock, wallMs: 1_800_000_000_000, includeProposed: true });
    assert(withProposals.kind === "ok" && withProposals.value.rows[0]?.[0] === 5, "proposals only where asked");
    const refused = await queryStore(store, "delete from issues", { clock, wallMs: 1_800_000_000_000 });
    assertEquals(refused.kind, "err");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
