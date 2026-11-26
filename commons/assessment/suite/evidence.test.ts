/**
 * Tests of the evidence against assessment objectives (commons assessment 0002-objective-evidence FR-001 to FR-007): the rules of a record, the standing of an objective from its records (latest of a source, expiry, failure, a person's determination, tools that only support), the roll-up of a requirement
 * and the strays, the binding of policy results, the same answer every time, and the records as files in a store on disk.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Evidence, Objective } from "../src/governance/mod.ts";
import { assess, decodeRecord, encodeRecord, evidenceFromPolicies, problemsOf, recordPath, standingOf } from "../src/logical/mod.ts";
import { addRecord, readStore } from "../src/physical/mod.ts";

const NOW = "2026-11-21T12:00:00Z";
const F = "nist-800-171a-r2";
const ev = (o: Partial<Evidence> & { id: string }): Evidence => ({ framework: F, objective: "3.1.1[a]", method: "test", result: "pass", by: { kind: "tool", name: "probe" }, at: "2026-11-20T00:00:00Z", source: "policy:synthetic-server-02:firewall", determines: false, ...o });
const person = (o: Partial<Evidence> & { id: string }): Evidence => ev({ method: "examine", by: { kind: "person", name: "Assessor" }, source: "doc:ssp", determines: true, ...o });

proves(["0002-objective-evidence FR-001"], "a record is refused where a tool determines, not-applicable is not a person's word with a reason, the validity does not end after the start, or the source or maker is not named", () => {
  assertEquals(problemsOf(ev({ id: "a" })), []);
  assertEquals(problemsOf(person({ id: "p" })), []);
  assert(problemsOf(ev({ id: "a", determines: true })).some((p) => p.includes("a tool does not determine")));
  assert(problemsOf(ev({ id: "a", result: "not-applicable" })).some((p) => p.includes("not-applicable")));
  assert(problemsOf(person({ id: "p", result: "not-applicable" })).some((p) => p.includes("reason")));
  assertEquals(problemsOf(person({ id: "p", result: "not-applicable", note: "No wireless in scope." })), []);
  assert(problemsOf(ev({ id: "a", validUntil: "2026-11-19T00:00:00Z" })).some((p) => p.includes("validUntil")));
  assert(problemsOf(ev({ id: "a", source: " " })).some((p) => p.includes("source")));
  assert(problemsOf(ev({ id: "a", by: { kind: "tool", name: "" } })).some((p) => p.includes("maker") || p.includes("who made")));
  assert(problemsOf(ev({ id: "a/b" })).some((p) => p.includes("id")));
});

proves(["0002-objective-evidence FR-002", "0002-objective-evidence FR-006"], "an objective stands from its records: none, stale, not met, supported by a tool, met by a person, not applicable by a person, with the latest of a source counting", () => {
  assertEquals(standingOf([], NOW), "no-evidence");
  assertEquals(standingOf([ev({ id: "a", validUntil: "2026-11-21T00:00:00Z" })], NOW), "stale");
  assertEquals(standingOf([ev({ id: "a", validUntil: NOW })], NOW), "stale", "a record that expires on the instant is not live");
  assertEquals(standingOf([ev({ id: "a" })], NOW), "supported");
  assertEquals(standingOf([ev({ id: "a" }), person({ id: "p" })], NOW), "met");
  assertEquals(standingOf([person({ id: "p" }), ev({ id: "f", result: "fail", at: "2026-11-21T01:00:00Z" })], NOW), "not-met", "a live failure beats a person's pass");
  assertEquals(standingOf([ev({ id: "f", result: "fail", at: "2026-11-20T01:00:00Z" }), ev({ id: "g", result: "pass", at: "2026-11-21T01:00:00Z" })], NOW), "supported", "the later result of one source replaces the earlier");
  assertEquals(standingOf([ev({ id: "x", at: "2026-11-20T00:00:00Z", result: "fail" }), ev({ id: "y", at: "2026-11-20T00:00:00Z", result: "pass" })], NOW), "supported", "the greater id counts at one instant");
  assertEquals(standingOf([person({ id: "n", result: "not-applicable", note: "Out of scope." })], NOW), "not-applicable");
  assertEquals(standingOf([person({ id: "p", determines: false })], NOW), "supported", "a person's record that does not determine only supports");
  assertEquals(standingOf([ev({ id: "a" }), ev({ id: "b", source: "policy:synthetic-server-03:firewall", result: "fail" })], NOW), "not-met");
});

const OBJECTIVES: readonly Objective[] = [
  { id: "3.1.1[a]", requirement: "3.1.1", statement: "authorized users are identified." },
  { id: "3.1.1[b]", requirement: "3.1.1", statement: "devices are identified." },
  { id: "3.1.2", requirement: "3.1.2", statement: "transactions are limited." },
  { id: "3.1.3[a]", requirement: "3.1.3", statement: "flow policies are defined." },
];

proves(["0002-objective-evidence FR-003", "0002-objective-evidence FR-004"], "a requirement rolls up from its objectives with the counts, no percentage, and the evidence for an objective the framework lacks is a stray and not counted", () => {
  const a = assess(F, OBJECTIVES, [
    person({ id: "p1", objective: "3.1.1[a]" }), person({ id: "p2", objective: "3.1.1[b]" }),
    ev({ id: "t1", objective: "3.1.2" }),
    ev({ id: "f1", objective: "3.1.3[a]", result: "fail" }),
    ev({ id: "s1", objective: "3.9.9[z]" }),
    { ...ev({ id: "o1", objective: "3.1.2" }), framework: "other" },
  ], NOW);
  const by = new Map(a.requirements.map((r) => [r.requirement, r]));
  assertEquals(by.get("3.1.1")?.rollup, "met");
  assertEquals(by.get("3.1.2")?.rollup, "partial", "supported by a tool is not met");
  assertEquals(by.get("3.1.3")?.rollup, "not-met");
  assertEquals(a.counts, { met: 2, "not-met": 1, "not-applicable": 0, supported: 1, stale: 0, "no-evidence": 0 });
  assertEquals(a.strays, ["3.9.9[z]"]);
  assert(!JSON.stringify(a).includes("percent"));
  const none = assess(F, OBJECTIVES, [], NOW);
  assert(none.requirements.every((r) => r.rollup === "no-evidence"));
  const half = assess(F, OBJECTIVES.slice(0, 2), [person({ id: "p1", objective: "3.1.1[a]" })], NOW);
  assertEquals(half.requirements[0]?.rollup, "partial");
  const na = assess(F, OBJECTIVES.slice(2, 3), [person({ id: "n", objective: "3.1.2", result: "not-applicable", note: "x" })], NOW);
  assertEquals(na.requirements[0]?.rollup, "not-applicable");
  assertEquals(assess(F, OBJECTIVES, [person({ id: "p1", objective: "3.1.1[a]" })], NOW), assess(F, OBJECTIVES, [person({ id: "p1", objective: "3.1.1[a]" })], NOW));
});

proves(["0002-objective-evidence FR-005"], "policy results give a test record by a tool for each bound objective from a pass or a fail, none from waiting, a warning or an accepted risk, and none determines", () => {
  const out = evidenceFromPolicies(
    [{ id: "firewall", status: "pass" }, { id: "disk-encryption", status: "fail" }, { id: "antivirus", status: "waiting" }, { id: "few-admins", status: "warn" }, { id: "osquery", status: "accepted" }, { id: "unbound", status: "pass" }],
    { firewall: ["3.13.1[a]", "3.13.1[b]"], "disk-encryption": ["3.13.16"], antivirus: ["3.14.2"], "few-admins": ["3.1.5"], osquery: ["3.3.1"] },
    { framework: F, at: NOW, tool: "synth-probe", asset: "synthetic-server-02" },
  );
  assertEquals(out.map((e) => [e.objective, e.result]), [["3.13.16", "fail"], ["3.13.1[a]", "pass"], ["3.13.1[b]", "pass"]]);
  assert(out.every((e) => e.method === "test" && e.by.kind === "tool" && !e.determines && e.source.startsWith("policy:synthetic-server-02:") && problemsOf(e).length === 0));
  assertEquals(evidenceFromPolicies([{ id: "firewall", status: "pass" }], { firewall: ["a"] }, { framework: F, at: NOW, tool: "t", asset: "x", validUntil: "2026-11-22T00:00:00Z" })[0]?.validUntil, "2026-11-22T00:00:00Z");
});

proves(["0002-objective-evidence FR-007"], "a record is a JSON5 file at its framework and objective, read back as it was written, and a file that is not a record is reported without losing the others", () => {
  const e = person({ id: "ev-1", objective: "3.13.8[b]", validUntil: "2027-01-01T00:00:00Z", note: "Seen on the 20th." });
  assertEquals(recordPath(e), `${F}/3.13.8_b/ev-1.json5`);
  assertEquals(decodeRecord(encodeRecord(e)), { kind: "ok", value: e });
  assertEquals(decodeRecord(encodeRecord(ev({ id: "t" }))), { kind: "ok", value: ev({ id: "t" }) });
  assert(decodeRecord("{ schema: 'other' }").kind === "err");
  assert(decodeRecord(encodeRecord({ ...ev({ id: "t" }), determines: true })).kind === "err", "a tool that determines is refused on reading");
  assert(decodeRecord("not json5 {").kind === "err");
});

proves(["0002-objective-evidence FR-007"], "the store reads the records in the order of their paths, reports a bad file, and refuses to write over a record", async () => {
  await fs.withTempDir(async (dir) => {
    assertEquals((await readStore(path.join(dir, "none"))).records, []);
    const a = await addRecord(dir, ev({ id: "ev-b", objective: "3.1.1[b]" }));
    const b = await addRecord(dir, ev({ id: "ev-a", objective: "3.1.1[a]" }));
    assert(a.kind === "ok" && b.kind === "ok");
    assert((await addRecord(dir, ev({ id: "ev-a", objective: "3.1.1[a]" }))).kind === "err");
    await fs.writeTextFile(path.join(dir, F, "3.1.1_a", "broken.json5"), "{ nope");
    const s = await readStore(dir);
    assertEquals(s.records.map((r) => r.id), ["ev-a", "ev-b"].sort());
    assertEquals(s.problems.length, 1);
    assert(s.problems[0]?.startsWith(`${F}/3.1.1_a/broken.json5`), s.problems[0]);
  });
});
