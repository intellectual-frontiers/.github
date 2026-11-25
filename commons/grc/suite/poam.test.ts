/**
 * Tests of the plan of action and milestones written from planned findings (0016-grc-poam): the planned findings are made by the real view `poam` of the library Planning over made-up items
 * (`synthetic-finding-01`, `synthetic-milestone-01` and the like), decoded, and written by the `oscal` serializer. The document is checked against NIST's published schema where the schema and ajv are at hand.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { crosswalk } from "@intellectual-frontiers/grc/governance";
import { assess, plannedFindings, type Assessment } from "@intellectual-frontiers/grc/logical";
import { oscal } from "@intellectual-frontiers/grc/serializers/oscal";
import { type EventData, type Item, type ItemKind, makeEvent, parseDay, parseEventId, parseInstant, parseItemId, person } from "@intellectual-frontiers/planning/governance";
import { fold, poam } from "@intellectual-frontiers/planning/logical";
import { A1, aResult, AT, B1, ex, must, other, OTHER1, walk } from "./fixtures.ts";

const ADA = (() => {
  const r = person("synthetic-person-01", "Synthetic Person 01");
  if (r.kind === "err") throw new Error("a person");
  return r.value;
})();
const take = <T, E>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: E }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const hex = (n: number): string => n.toString(16).padStart(12, "0");
const itemId = (n: number) => take(parseItemId(`0190a5b0-0000-7000-8000-${hex(n)}`));
let counter = 0;
const nextEventId = () => take(parseEventId(`0190a5b0-0001-7000-8000-${hex(++counter)}`));
const day = (t: string) => take(parseDay(t));
const instant = (n: number) => take(parseInstant(`2026-05-01T00:00:${String(n % 60).padStart(2, "0")}Z`));

type Made = { readonly kind: ItemKind; readonly title: string; readonly labels?: readonly string[]; readonly assignees?: readonly string[]; readonly due?: string; readonly body?: string; readonly severity?: "error" | "warning" | "note" };
function make(k: number, made: Made, more: readonly EventData[] = []): Item {
  const item = itemId(k);
  const head = () => ({ id: nextEventId(), item, at: instant(counter), actor: ADA });
  const opened = take(makeEvent(head(), { type: "opened", kind: made.kind, title: made.title, body: made.body ?? "", labels: made.labels ?? [], assignees: made.assignees ?? [], origin: "declared", ...(made.severity === undefined ? {} : { severity: made.severity }), ...(made.due === undefined ? {} : { due: day(made.due) }) }));
  return take(fold([opened, ...more.map((d) => take(makeEvent(head(), d)))]));
}
const child = (k: number): EventData => ({ type: "linked", change: "add", link: "parent-of", to: itemId(k) });

/** Two findings: one on controls of two frameworks with three milestones and owners, one with no milestone and no control. */
function items(): readonly Item[] {
  return [
    make(1, { kind: "finding", title: "synthetic-finding-01", body: "A synthetic finding.", severity: "error", assignees: ["synthetic-person-01"], labels: [`control:${A1}`, `control:${OTHER1}`, "other"] }, [child(2), child(3), child(4)]),
    make(2, { kind: "task", title: "synthetic-milestone-01", due: "2026-09-01", assignees: ["synthetic-person-02", "synthetic-person-03"] }),
    make(3, { kind: "task", title: "synthetic-milestone-02", due: "2026-07-15", assignees: ["synthetic-person-02"] }, [{ type: "closed", reason: "completed" }]),
    make(4, { kind: "task", title: "synthetic-milestone-03" }),
    make(5, { kind: "finding", title: "synthetic-finding-02" }),
  ];
}
/** The planned findings as Planning's view gives them, read as a value from outside. */
const planned = (list: readonly Item[] = items()): unknown => JSON.parse(JSON.stringify(poam(list, day("2026-10-01"))));

const EMPTY: Assessment = assess({ id: "assessment-0", title: "Empty", at: AT, frameworks: [], results: [] });
const base = (): Assessment => assess({ id: "assessment-p", title: "Planned", at: AT, frameworks: [ex, other], results: [aResult("disk-encrypted", "host-1", "fail")] });

async function written(a: Assessment, options: Record<string, unknown>, crosswalks = [] as readonly ReturnType<typeof walkEqual>[]): Promise<{ readonly doc: ReturnType<typeof JSON.parse>; readonly text: string }> {
  const w = await oscal.serialize(a, { crosswalks, options: { model: "plan-of-action-and-milestones", ...options } as never });
  assert(w.kind === "ok", w.kind === "err" ? w.error.message : "");
  return { doc: JSON.parse(w.value)["plan-of-action-and-milestones"], text: w.value };
}
const walkEqual = () => must(crosswalk.decode, { ...walk, mappings: [{ from: B1, to: OTHER1, relationship: "equal", strength: 9 }] });

proves(["0016-grc-poam FR-001"], "the planned findings of Planning's view decode as they are, and a bad day, status or control reference is an error that names the member", () => {
  const ok = plannedFindings(planned());
  assert(ok.kind === "ok");
  assertEquals(ok.value.map((p) => [p.title, p.status, p.controls, p.milestones.length, p.scheduledCompletion]), [
    ["synthetic-finding-01", "delayed", [A1, OTHER1], 3, "2026-09-01"],
    ["synthetic-finding-02", "open", [], 0, undefined],
  ]);
  const first = ok.value[0];
  assertEquals(first?.milestones.map((m) => [m.title, m.status, m.owners]), [
    ["synthetic-milestone-02", "completed", ["synthetic-person-02"]],
    ["synthetic-milestone-01", "delayed", ["synthetic-person-02", "synthetic-person-03"]],
    ["synthetic-milestone-03", "open", []],
  ]);
  const raw = JSON.parse(JSON.stringify(planned())) as { controls: string[]; status: string; milestones: { due?: string }[] }[];
  const edit = (f: (p: (typeof raw)[number]) => void): unknown => {
    const copy = JSON.parse(JSON.stringify(raw)) as typeof raw;
    const p = copy[0];
    if (p !== undefined) f(p);
    return copy;
  };
  const message = (v: unknown): string => {
    const r = plannedFindings(v);
    return r.kind === "err" ? r.error : "ok";
  };
  assertStringIncludes(message(edit((p) => (p.controls = ["AC-2"]))), "planned[0].controls[0]");
  assertStringIncludes(message(edit((p) => (p.status = "late"))), "planned[0].status");
  assertStringIncludes(message(edit((p) => (p.milestones[0] ? (p.milestones[0].due = "2026-02-30") : undefined))), "planned[0].milestones[0].due");
  assertStringIncludes(message({}), "a list of planned findings");
});

proves(["0016-grc-poam FR-002", "0016-grc-poam FR-003"], "a planned finding is a risk with the milestones of its remediation as tasks with their days, a finding for each control and a poam-item that relates them, the owners being parties", async () => {
  const { doc } = await written(base(), { planned: planned() });
  const risk = doc.risks.find((r: { title: string }) => r.title === "synthetic-finding-01");
  assertEquals([risk.status, risk.deadline, risk.statement], ["remediating", "2026-09-01T00:00:00Z", "synthetic-finding-01 (a-1, x-1)."]);
  const rem = risk.remediations[0];
  assertEquals(rem.lifecycle, "planned");
  assertEquals(rem.tasks.map((t: { title: string; type: string; timing?: { "on-date": { date: string } } }) => [t.title, t.type, t.timing?.["on-date"].date]), [
    ["synthetic-milestone-02", "milestone", "2026-07-15T00:00:00Z"],
    ["synthetic-milestone-01", "milestone", "2026-09-01T00:00:00Z"],
    ["synthetic-milestone-03", "milestone", undefined],
  ]);
  const two = rem.tasks.find((t: { title: string }) => t.title === "synthetic-milestone-01");
  assertEquals(two["responsible-roles"][0]["role-id"], "owner");
  assertEquals(two["responsible-roles"][0]["party-uuids"].length, 2);
  assertEquals(rem.tasks.find((t: { title: string }) => t.title === "synthetic-milestone-03")["responsible-roles"], undefined);
  assertEquals(two.props.find((p: { name: string }) => p.name === "status").value, "delayed");
  assertEquals(doc.metadata.roles, [{ id: "owner", title: "Owner" }]);
  assertEquals(doc.metadata.parties.map((p: { name: string; type: string }) => [p.name, p.type]), [["synthetic-person-01", "person"], ["synthetic-person-02", "person"], ["synthetic-person-03", "person"]]);
  const partyIds = new Set(doc.metadata.parties.map((p: { uuid: string }) => p.uuid));
  for (const id of two["responsible-roles"][0]["party-uuids"]) assert(partyIds.has(id), "a responsible party is a party");
  const item = doc["poam-items"].find((i: { title: string }) => i.title === "synthetic-finding-01");
  assertEquals(item["related-risks"], [{ "risk-uuid": risk.uuid }]);
  assertEquals(item["related-findings"].length, 2);
  const findings = doc.findings.filter((f: { "related-risks": { "risk-uuid": string }[] }) => f["related-risks"][0]?.["risk-uuid"] === risk.uuid);
  assertEquals(findings.map((f: { target: { "target-id": string } }) => f.target["target-id"]), ["a-1", "x-1"]);
  assertEquals(new Set(item["related-findings"].map((r: { "finding-uuid": string }) => r["finding-uuid"])), new Set(findings.map((f: { uuid: string }) => f.uuid)));
  const bare = doc["poam-items"].find((i: { title: string }) => i.title === "synthetic-finding-02");
  assertEquals([bare["related-findings"], bare["related-risks"].length], [undefined, 1]);
  const bareRisk = doc.risks.find((r: { title: string }) => r.title === "synthetic-finding-02");
  assertEquals([bareRisk.status, bareRisk.remediations, bareRisk.deadline], ["open", undefined, undefined]);
  const nobody = await written(base(), { planned: planned([make(7, { kind: "finding", title: "synthetic-finding-03" })]) });
  assertEquals([nobody.doc.metadata.roles, nobody.doc.metadata.parties], [undefined, undefined]);
});

proves(["0016-grc-poam FR-004"], "the same planned findings in any order give the same bytes, and every uuid is a version 5 UUID", async () => {
  const rows = planned() as unknown[];
  const one = await written(base(), { planned: rows });
  const two = await written(base(), { planned: [...rows].reverse() });
  assertEquals(one.text, two.text);
  const uuids = one.text.match(/"(?:uuid|risk-uuid|finding-uuid)": "([0-9a-f-]{36})"/g) ?? [];
  assert(uuids.length > 10, "uuids are written");
  for (const u of uuids) assert(/"[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"$/.test(u), u);
  assertEquals(new Set(uuids).size < uuids.length, true, "a risk and its references share a uuid");
  const all = [...one.text.matchAll(/"uuid": "([0-9a-f-]{36})"/g)].map((m) => m[1]);
  assertEquals(new Set(all).size, all.length, "no uuid of an element is written twice");
});

proves(["0016-grc-poam FR-005"], "controls of several frameworks are one document, a crosswalk writes the control of another framework, the findings and risks of the assessment are kept and an empty assessment says nothing is open", async () => {
  const { doc } = await written(base(), { planned: planned() });
  assertEquals(doc.findings.map((f: { props: { value: string }[] }) => f.props[0]?.value).sort(), ["ex", "other"]);
  assert(doc.risks.some((r: { title: string; status: string }) => !r.title.startsWith("synthetic") && r.status === "open"), "the open finding of the assessment is a risk");
  assertEquals(doc.risks.length, 2 + doc.risks.filter((r: { title: string }) => !r.title.startsWith("synthetic")).length);
  const crossed = await written(base(), { planned: planned(), framework: "other" }, [walkEqual()]);
  assertEquals(crossed.doc.findings.map((f: { target: { "target-id": string } }) => f.target["target-id"]).sort(), ["a-1", "x-1"], "a control with no mapping is written as it is");
  const none = await written(EMPTY, {});
  assertEquals(none.doc["poam-items"].length, 1);
  assertEquals(none.doc["poam-items"][0].title, "Nothing is open");
  const onlyPlanned = await written(EMPTY, { planned: planned() });
  assertEquals(onlyPlanned.doc["poam-items"].map((i: { title: string }) => i.title), ["synthetic-finding-01", "synthetic-finding-02"]);
});

proves(["0016-grc-poam FR-006"], "an option that is not planned findings is an invalid problem that names what is wrong and writes nothing, and another model ignores it", async () => {
  const bad = await oscal.serialize(base(), { options: { model: "plan-of-action-and-milestones", planned: [{ id: "x" }] } });
  assert(bad.kind === "err" && bad.error.kind === "invalid", "invalid");
  assertStringIncludes(bad.error.message, "planned[0]");
  const notList = await oscal.serialize(base(), { options: { model: "plan-of-action-and-milestones", planned: "no" } });
  assertEquals(notList.kind === "err" ? notList.error.kind : "ok", "invalid");
  const results = await oscal.serialize(base(), { options: { model: "assessment-results", planned: "no" } });
  assertEquals(results.kind, "ok");
});

proves(["0016-grc-poam FR-007"], "the document written with milestones, owners and two frameworks is valid against NIST's published schema, where the schema (OSCAL_SCHEMA, a file) and a Node with ajv (OSCAL_AJV, the folder that holds it) are at hand", async (t) => {
  const schema = process.env["OSCAL_SCHEMA"];
  const ajv = process.env["OSCAL_AJV"];
  if (schema === undefined || schema === "" || ajv === undefined || ajv === "") return t.skip("OSCAL_SCHEMA and OSCAL_AJV are not set: fetch oscal_complete_schema.json from NIST's OSCAL release and install ajv and ajv-formats in a folder");
  const docs = [(await written(base(), { planned: planned() })).text, (await written(EMPTY, { planned: planned() })).text, (await written(base(), {})).text];
  const { proc, fs, path } = await import("@intellectual-frontiers/system");
  await fs.withTempDir(async (dir) => {
    const script = path.join(dir, "v.mjs");
    await fs.writeTextFile(script, `import { createRequire } from "node:module";import { readFileSync } from "node:fs";const require = createRequire(${JSON.stringify(`${ajv}/`)});const Ajv = require("ajv");const add = require("ajv-formats");const a = new Ajv({ strict: false, allErrors: true });add(a);const v = a.compile(JSON.parse(readFileSync(${JSON.stringify(schema)}, "utf8")));const bad = [];for (const f of process.argv.slice(2)) { if (!v(JSON.parse(readFileSync(f, "utf8")))) bad.push(f + ": " + JSON.stringify(v.errors.slice(0, 5))); }console.log(bad.join("\\n"));process.exit(bad.length ? 1 : 0);`);
    const files: string[] = [];
    for (const [i, d] of docs.entries()) {
      const f = path.join(dir, `d${i}.json`);
      await fs.writeTextFile(f, d);
      files.push(f);
    }
    const r = await proc.run(["node", script, ...files], {});
    assert(r.success, r.stdout + r.stderr);
  });
});
