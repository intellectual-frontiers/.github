/**
 * Tests of the plan of action and milestones and the work orders (commons planning 0006-planning-poam FR-001 to FR-008): the day a task is due as the field of its own that the kind task adds, kept by the records and the
 * matrix, and the views `poam` and `workOrders` over made-up items (`synthetic-finding-01`, `synthetic-task-01` and the like).
 *
 * @module
 */
import * as records from "@intellectual-frontiers/planning/records";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type Day, type EventData, type Item, type ItemKind, makeEvent, parseDay } from "@intellectual-frontiers/planning/governance";
import { canonical, fold, matrixFindings, poam, workOrders } from "@intellectual-frontiers/planning/logical";
import { SOURCE_ROWS } from "@intellectual-frontiers/planning/physical";
import { ADA, eventIds, itemId, must } from "./support.ts";
import { at } from "./support.ts";

const ids = eventIds(400);
let n = 0;
const nextId = () => {
  const id = ids[n++];
  assert(id !== undefined, "an id");
  return id;
};
const day = (text: string): Day => must(parseDay(text));

type Made = { readonly kind: ItemKind; readonly title: string; readonly labels?: readonly string[]; readonly assignees?: readonly string[]; readonly due?: string; readonly severity?: "error" | "warning" | "note" };

/** An item of the number `k`, opened with `made` and then the events `more`. */
function make(k: number, made: Made, more: readonly EventData[] = []): Item {
  const item = itemId(k);
  const opened = must(
    makeEvent(
      { id: nextId(), item, at: at(n), actor: ADA },
      { type: "opened", kind: made.kind, title: made.title, body: "", labels: made.labels ?? [], assignees: made.assignees ?? [], origin: "declared", ...(made.severity === undefined ? {} : { severity: made.severity }), ...(made.due === undefined ? {} : { due: day(made.due) }) },
    ),
  );
  return must(fold([opened, ...more.map((d) => must(makeEvent({ id: nextId(), item, at: at(n), actor: ADA }, d)))]));
}
const child = (k: number): EventData => ({ type: "linked", change: "add", link: "parent-of", to: itemId(k) });
const relates = (k: number): EventData => ({ type: "linked", change: "add", link: "relates-to", to: itemId(k) });

const AC2 = "control:urn:grc:synthetic-regime-a:1:AC-2";
const A515 = "control:urn:grc:synthetic-regime-b:2022:A.5.15";

proves(["0006-planning-poam FR-001"], "a task's due day is the opening's and then the last edit that sets it, another kind refuses it and an edit on another kind changes nothing", () => {
  const task = make(1, { kind: "task", title: "synthetic-task-01", due: "2027-03-01" });
  assertEquals(task.due, day("2027-03-01"));
  const moved = make(2, { kind: "task", title: "synthetic-task-02", due: "2027-03-01" }, [{ type: "edited", due: day("2027-04-01") }, { type: "edited", title: "renamed" }, { type: "edited", due: day("2027-05-01") }]);
  assertEquals([moved.due, moved.title], [day("2027-05-01"), "renamed"]);
  assertEquals(make(3, { kind: "task", title: "synthetic-task-03" }, [{ type: "edited", due: day("2027-06-01") }]).due, day("2027-06-01"));
  const refused = makeEvent({ id: nextId(), item: itemId(4), at: at(n), actor: ADA }, { type: "opened", kind: "finding", title: "synthetic-finding-01", body: "", labels: [], assignees: [], origin: "declared", due: day("2027-03-01") });
  assert(refused.kind === "err" && refused.error.kind === "due-on-a-non-task", "a finding has no day it is due");
  assertEquals(make(5, { kind: "finding", title: "synthetic-finding-02" }, [{ type: "edited", due: day("2027-03-01") }]).due, undefined);
  assertEquals(make(6, { kind: "task", title: "synthetic-task-04" }).due, undefined);
});

proves(["0006-planning-poam FR-002"], "a day due round-trips in JSON5 with its key in order, a day that is not a day is an error value, and every source says how the field ends for it", () => {
  const e = must(makeEvent({ id: nextId(), item: itemId(7), at: at(n), actor: ADA }, { type: "opened", kind: "task", title: "synthetic-task-05", body: "", labels: [], assignees: ["synthetic-person-01"], origin: "declared", due: day("2027-03-01") }));
  const text = records.encodeEvent(e);
  assertEquals(canonical(must(records.decodeEvent(text))), canonical(e));
  const data = text.slice(text.indexOf("data:"));
  assert(data.indexOf("body:") < data.indexOf("due:") && data.indexOf("due:") < data.indexOf("kind:"), "the keys of the data are in the order of their names");
  assertEquals(records.decodeEvent(text.replace("2027-03-01", "2027-02-30")).kind, "err");
  const edited = must(makeEvent({ id: nextId(), item: itemId(7), at: at(n), actor: ADA }, { type: "edited", due: day("2027-04-01") }));
  assertEquals(canonical(must(records.decodeEvent(records.encodeEvent(edited)))), canonical(edited));
  assertEquals(records.decodeEvent(records.encodeEvent(edited).replace("2027-04-01", "tomorrow")).kind, "err");
  assertEquals(matrixFindings(SOURCE_ROWS), []);
  for (const row of SOURCE_ROWS) assert(row.cells.due !== undefined, `${row.source} says how due ends`);
  assertEquals(matrixFindings([{ source: "synthetic-source-01", cells: {} }]).some((f) => f.field === "due"), true);
});

/** A finding with three milestones: one done, one not planned, two open (one past its day, one not). */
function plan(): readonly Item[] {
  return [
    make(10, { kind: "finding", title: "synthetic-finding-10", severity: "error", assignees: ["synthetic-person-01"], labels: [AC2, A515, "other"] }, [child(11), child(12), child(13), child(14)]),
    make(11, { kind: "task", title: "synthetic-milestone-11", due: "2027-03-01", assignees: ["synthetic-person-02"] }),
    make(12, { kind: "task", title: "synthetic-milestone-12", due: "2027-01-15", assignees: ["synthetic-person-03"] }),
    make(13, { kind: "task", title: "synthetic-milestone-13", due: "2027-01-10" }, [{ type: "closed", reason: "completed" }]),
    make(14, { kind: "task", title: "synthetic-milestone-14", due: "2027-06-01" }, [{ type: "closed", reason: "not-planned" }]),
  ];
}

proves(["0006-planning-poam FR-003", "0006-planning-poam FR-005", "0006-planning-poam FR-006"], "a finding is a row with its milestones, owners, days, statuses and scheduled completion, and a milestone not planned is not part of it", () => {
  const rows = poam(plan(), day("2027-02-01"));
  assertEquals(rows.length, 1);
  const row = rows[0];
  assert(row !== undefined, "a row");
  assertEquals([row.title, row.severity, row.state, row.owners], ["synthetic-finding-10", "error", "open", ["synthetic-person-01"]]);
  assertEquals(row.milestones.map((m) => [m.title, m.due, m.owners, m.status, m.state]), [
    ["synthetic-milestone-13", "2027-01-10", [], "completed", "closed"],
    ["synthetic-milestone-12", "2027-01-15", ["synthetic-person-03"], "delayed", "open"],
    ["synthetic-milestone-11", "2027-03-01", ["synthetic-person-02"], "open", "open"],
  ]);
  assertEquals(row.milestones[0]?.completedAt !== undefined, true);
  assertEquals(row.scheduledCompletion, day("2027-03-01"));
  assertEquals(row.status, "delayed");
  assertEquals(poam(plan(), day("2027-01-01"))[0]?.status, "open", "before any day due nothing is delayed");
  assertEquals(poam(plan(), day("2027-01-15"))[0]?.status, "open", "a milestone is delayed from the day after its day due");
});

proves(["0006-planning-poam FR-004"], "the controls of two regimes are the labels control: kept as written, sorted, and no other label is a control", () => {
  const row = poam(plan(), day("2027-02-01"))[0];
  assertEquals(row?.controls, ["urn:grc:synthetic-regime-a:1:AC-2", "urn:grc:synthetic-regime-b:2022:A.5.15"]);
});

proves(["0006-planning-poam FR-006"], "a finding whose milestones are all done is completed and still a row, a finding closed is not a row, and what is not a milestone is not one", () => {
  const done = [
    make(20, { kind: "finding", title: "synthetic-finding-20" }, [child(21), child(22)]),
    make(21, { kind: "task", title: "synthetic-milestone-21", due: "2027-01-01" }, [{ type: "closed", reason: "completed" }]),
    make(22, { kind: "task", title: "synthetic-milestone-22" }, [{ type: "closed", reason: "completed" }]),
  ];
  assertEquals(poam(done, day("2027-02-01")).map((r) => [r.title, r.status, r.scheduledCompletion]), [["synthetic-finding-20", "completed", "2027-01-01"]]);
  const closed = [make(30, { kind: "finding", title: "synthetic-finding-30" }, [child(31), { type: "closed", reason: "completed" }]), make(31, { kind: "task", title: "synthetic-milestone-31", due: "2027-01-01" })];
  assertEquals(poam(closed, day("2027-02-01")), []);
  // a link to an item that is not among the items, a link to an issue, a finding with no milestone and a task with no day due
  const missing = itemId(99);
  const odd = [
    make(40, { kind: "finding", title: "synthetic-finding-40" }, [{ type: "linked", change: "add", link: "parent-of", to: missing }, child(41), child(42)]),
    make(41, { kind: "issue", title: "synthetic-issue-41" }),
    make(42, { kind: "task", title: "synthetic-milestone-42" }),
    make(43, { kind: "finding", title: "synthetic-finding-43" }),
  ];
  assertEquals(poam(odd, day("2027-02-01")).map((r) => [r.title, r.milestones.map((m) => m.title), r.scheduledCompletion, r.status]), [
    ["synthetic-finding-40", ["synthetic-milestone-42"], undefined, "open"],
    ["synthetic-finding-43", [], undefined, "open"],
  ]);
});

proves(["0006-planning-poam FR-005"], "the rows are in the order of the scheduled completion with none last and then of the id, and the same items in any order give the same rows", () => {
  const a = [make(50, { kind: "finding", title: "synthetic-finding-50" }, [child(51)]), make(51, { kind: "task", title: "synthetic-milestone-51", due: "2027-05-01" })];
  const b = [make(52, { kind: "finding", title: "synthetic-finding-52" }, [child(53)]), make(53, { kind: "task", title: "synthetic-milestone-53", due: "2027-02-01" })];
  const none = [make(54, { kind: "finding", title: "synthetic-finding-54" })];
  const all = [...none, ...a, ...b];
  const expected = ["synthetic-finding-52", "synthetic-finding-50", "synthetic-finding-54"];
  assertEquals(poam(all, day("2027-01-01")).map((r) => r.title), expected);
  assertEquals(poam([...all].reverse(), day("2027-01-01")), poam(all, day("2027-01-01")));
  assertEquals(poam([b[1] as Item, none[0] as Item, a[0] as Item, b[0] as Item, a[1] as Item], day("2027-01-01")).map((r) => r.title), expected);
});

proves(["0006-planning-poam FR-007"], "a work order is a task with a workload label linked relates-to to what it serves, in either direction, ordered by its day due, and a task with no such label is not one", () => {
  const items = [
    make(60, { kind: "finding", title: "synthetic-finding-60" }),
    make(61, { kind: "task", title: "synthetic-work-order-61", labels: ["workload:synthetic-workload-01"], assignees: ["synthetic-person-01"], due: "2027-01-10" }, [relates(60)]),
    make(62, { kind: "task", title: "synthetic-work-order-62", labels: ["workload:synthetic-workload-02", "workload:synthetic-workload-01"], due: "2027-03-01" }),
    make(63, { kind: "task", title: "synthetic-task-63" }, [relates(60)]),
    make(64, { kind: "task", title: "synthetic-work-order-64", labels: ["workload:synthetic-workload-03"] }, [{ type: "closed", reason: "completed" }]),
    make(65, { kind: "task", title: "synthetic-work-order-65", labels: ["workload:synthetic-workload-03"] }, [{ type: "closed", reason: "not-planned" }]),
  ];
  // the finding links to the second work order: a link in the other direction serves too
  const finding = make(60, { kind: "finding", title: "synthetic-finding-60" }, [relates(62)]);
  const rows = workOrders([finding, ...items.slice(1)], day("2027-02-01"));
  assertEquals(rows.map((r) => [r.title, r.workloads, r.serves.length, r.due, r.status, r.owners]), [
    ["synthetic-work-order-61", ["synthetic-workload-01"], 1, "2027-01-10", "delayed", ["synthetic-person-01"]],
    ["synthetic-work-order-62", ["synthetic-workload-01", "synthetic-workload-02"], 1, "2027-03-01", "open", []],
    ["synthetic-work-order-64", ["synthetic-workload-03"], 0, undefined, "completed", []],
  ]);
  assertEquals(rows[0]?.serves, [itemId(60)]);
  assertEquals(rows[1]?.serves, [itemId(60)]);
});
