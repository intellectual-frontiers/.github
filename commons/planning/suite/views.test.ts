/**
 * Tests of the query algebra, the views, the matrix of what a source can hold and the renderers (commons planning 0003-planning-reconcile FR-011 to FR-013).
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { agent, type Item, type ItemEvent, makeEvent, person, type Trace } from "@intellectual-frontiers/planning/governance";
import { blockGraph, citationsOf, FIELDS, fold, matrixFindings, matrixMarkdown, requirementMatrix, responsibility, roadmap, runQuery } from "@intellectual-frontiers/planning/logical";
import { renderJson5, renderMarkdown } from "@intellectual-frontiers/planning/records";
import { ADA, eventIds, itemId, must } from "./support.ts";
import { at } from "./support.ts";

const ids = eventIds(40);
let n = 0;
const nextId = () => {
  const id = ids[n++];
  assert(id !== undefined, "an id");
  return id;
};
const claude = must(agent("claude", "Claude", ADA, "session"));

function make(title: string, options: { readonly origin?: "declared" | "inferred"; readonly by?: "ada" | "claude"; readonly more?: readonly ItemEvent["data"][]; readonly body?: string; readonly cites?: readonly string[] } = {}): Item {
  const item = itemId(n + 1);
  const actor = options.by === "claude" ? claude : ADA;
  const opened = must(makeEvent({ id: nextId(), item, at: at(n), actor }, { type: "opened", kind: "task", title, body: options.body ?? "", labels: ["x"], assignees: [], origin: options.origin ?? "declared", ...(options.cites === undefined ? {} : { cites: options.cites }) }));
  const rest = (options.more ?? []).map((d) => must(makeEvent({ id: nextId(), item, at: at(n), actor: ADA }, d)));
  return must(fold([opened, ...rest]));
}

proves(["0003-planning-reconcile FR-011"], "a query filters, orders and limits items, events, links and traces, and does not count a proposal unless told", () => {
  const a = make("Alpha");
  const b = make("Bravo", { more: [{ type: "closed", reason: "completed" }, { type: "severity-set", severity: "error" }] });
  const p = make("Proposed one", { origin: "inferred", by: "claude" });
  const trace: Trace = { item: a.id, source: "md", fingerprint: "f", locator: { kind: "url", url: "u" }, contentHash: "h", observed: { kind: "task", title: "Alpha", body: "", labels: [], assignees: [], state: { kind: "open" }, origin: "derived", external: [] }, presence: "present" };
  const data = { items: [a, b, p], traces: [trace] };
  assertEquals(runQuery(data, { from: "items" }).length, 2);
  assertEquals(runQuery(data, { from: "items", where: { includeProposed: true } }).length, 3);
  assertEquals(runQuery(data, { from: "items", where: { state: ["closed"] } }).map((r) => (r.kind === "item" ? r.item.title : "")), ["Bravo"]);
  assertEquals(runQuery(data, { from: "items", where: { label: "x" }, order: { by: "title", desc: true }, limit: 1 }).map((r) => (r.kind === "item" ? r.item.title : "")), ["Bravo"]);
  assertEquals(runQuery(data, { from: "items", where: { severity: ["error"] } }).length, 1);
  assertEquals(runQuery(data, { from: "events", type: ["closed"] }).length, 1);
  assertEquals(runQuery(data, { from: "traces" }).length, 1);
  assertEquals(runQuery(data, { from: "items-traces" }).map((r) => r.kind), ["item-trace"]);
  assertEquals(runQuery(data, { from: "links" }).length, 0);
});

proves(["0003-planning-reconcile FR-012"], "the roadmap puts each item after every item that blocks it, a cycle is refused with its items, and the graph reads both ways", () => {
  const c = itemId(900);
  const b = itemId(901);
  const a = itemId(902);
  const open = (id: typeof a, title: string, to?: typeof a): Item => {
    const opened = must(makeEvent({ id: nextId(), item: id, at: at(n), actor: ADA }, { type: "opened", kind: "task", title, body: "", labels: [], assignees: [], origin: "declared" }));
    const link = to === undefined ? [] : [must(makeEvent({ id: nextId(), item: id, at: at(n + 1), actor: ADA }, { type: "linked", change: "add", link: "blocks", to }))];
    return must(fold([opened, ...link]));
  };
  // c blocks b, b blocks a
  const items = [open(a, "last"), open(b, "middle", a), open(c, "first", b)];
  const r = roadmap(items);
  assert(r.kind === "ok", "a roadmap");
  assertEquals(r.value.map((i) => i.title), ["first", "middle", "last"]);
  const g = blockGraph(items);
  assert(g.kind === "ok", "a graph");
  assertEquals(g.value.get(b)?.blockedBy, [c]);
  assertEquals(g.value.get(b)?.blocks, [a]);
  const cyc = [open(a, "x", b), open(b, "y", a)];
  const bad = roadmap(cyc);
  assert(bad.kind === "err", "a cycle");
  assertEquals([...bad.error.items].sort(), [a, b].sort());
  assertEquals(roadmap([make("Proposed", { origin: "inferred", by: "claude" })]), { kind: "ok", value: [] });
});

proves(["0003-planning-reconcile FR-012"], "the matrix finds a requirement no item cites and an item that cites one that does not exist, and responsibility groups the agents' events and proposals by person", () => {
  assertEquals(citationsOf("see 0037-planning FR-014 and FR-002, FR-002"), ["0037-planning FR-014", "FR-002"]);
  const a = make("Do FR-001", { body: "Also 0003-planning FR-009", cites: ["0099-nothing FR-001"] });
  const m = requirementMatrix([a], ["0003-planning FR-001", "0003-planning FR-009", "0003-planning FR-010"]);
  assertEquals(m.rows.find((r) => r.requirement === "0003-planning FR-001")?.items, [a.id]);
  assertEquals(m.uncovered, ["0003-planning FR-010"]);
  assertEquals(m.unknown, [{ item: a.id, citation: "0099-nothing FR-001" }]);
  const p = make("A proposal", { origin: "inferred", by: "claude", more: [] });
  const r = responsibility([p, a]);
  assertEquals(r.map((x) => x.person), ["ada@example.test"]);
  assertEquals(r[0]?.byAgent, [{ agent: "claude", events: 1 }]);
  assertEquals(r[0]?.proposals, [{ item: p.id, agent: "claude" }]);
});

proves(["0003-planning-reconcile FR-013"], "a field a source gives no cell for is a finding, an unexpressed one needs its reason, and the matrix is a table", () => {
  const full = Object.fromEntries(FIELDS.map((f) => [f, { outcome: "expressed" as const }]));
  assertEquals(matrixFindings([{ source: "ok", cells: full }]), []);
  const { principal: _dropped, ...rest } = full;
  const missing = matrixFindings([{ source: "partial", cells: { ...rest, severity: { outcome: "unexpressed", reason: " " } } }]);
  assertEquals(missing.map((f) => `${f.source}:${f.field}`).sort(), ["partial:principal", "partial:severity"]);
  assert(matrixMarkdown([{ source: "ok", cells: full }]).includes("| title | expressed |"), "a row for a field");
});

proves(["0003-planning-reconcile FR-013"], "Markdown says what it cannot hold and JSON5 holds the events", () => {
  const a = make("Alpha", { more: [{ type: "closed", reason: "completed" }] });
  const md = renderMarkdown([a]);
  assert(md.text.startsWith("- [x] Alpha"), "a closed item is checked");
  assertEquals(md.unexpressed.map((u) => u.field), ["events", "principal", "external"]);
  assert(md.text.includes("unexpressed in Markdown"), "it says so");
  const js = renderJson5([a]);
  assert(js.text.includes("closed"), "the events are in it");
  assertEquals(js.unexpressed, []);
  assert(person("x", "X").kind === "ok", "a person");
});
