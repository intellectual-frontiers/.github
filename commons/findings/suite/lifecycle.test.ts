// Spec: 0004-findings-lifecycle FR-001
/**
 * Tests of the lifecycle (commons findings 0004-findings-lifecycle): the state worked out from a log, the lapse of an acceptance, the refusal of an event with every reason, the retest that settles a claim of a fix, and the controls and the rows of the posture. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Finding } from "../src/governance/mod.ts";
import { controlsOf, OPEN_STATUSES, problemsOf, retestEvents, rowsByAsset, stateOf, type Event } from "../src/logical/mod.ts";

const NOW = "2026-12-01T12:00:00Z";
const ev = (e: { readonly kind: Event["kind"]; readonly at?: string; readonly finding?: string; readonly [k: string]: unknown }): Event => ({ finding: "f1", at: "2026-11-20T10:00:00Z", by: "ada", ...e }) as Event;

proves(["0004-findings-lifecycle FR-001"], "the state is worked out from the events in order, a finding is open when first read, a retest settles a claim of a fix, and an event that cannot follow the state is ignored and kept apart", () => {
  assertEquals(stateOf("f1", [], NOW).status, "open");
  assertEquals(stateOf("f1", [ev({ kind: "triage", as: "confirmed", reason: "reproduced" })], NOW).status, "confirmed");
  assertEquals(stateOf("f1", [ev({ kind: "triage", as: "false-positive", reason: "a test page" })], NOW).status, "false-positive");
  const fixed = [ev({ kind: "triage", as: "confirmed", reason: "r" }), ev({ kind: "fix", ref: "PR-12" })];
  assertEquals(stateOf("f1", fixed, NOW).status, "fixed");
  assertEquals(stateOf("f1", [...fixed, ev({ kind: "retest", result: "still-present", source: "zap-2.json" })], NOW).status, "reopened");
  assertEquals(stateOf("f1", [...fixed, ev({ kind: "retest", result: "not-found", source: "zap-2.json" })], NOW).status, "verified");
  const closed = stateOf("f1", [...fixed, ev({ kind: "retest", result: "not-found", source: "z" }), ev({ kind: "reopen", reason: "it came back" })], NOW);
  assertEquals(closed.status, "reopened");
  assertEquals(closed.reason, "it came back");
  const odd = stateOf("f1", [ev({ kind: "retest", result: "not-found", source: "z" }), ev({ kind: "reopen", reason: "x" }), ev({ kind: "fix" })], NOW);
  assertEquals(odd.status, "fixed");
  assertEquals(odd.ignored.map((e) => e.kind), ["retest", "reopen"]);
  assertEquals(odd.history.map((e) => e.kind), ["fix"]);
  assertEquals(stateOf("f1", [ev({ finding: "other", kind: "fix" })], NOW).status, "open", "another finding's events are not this one's");
  assertEquals(OPEN_STATUSES, ["open", "confirmed", "reopened", "fixed"]);
});

proves(["0004-findings-lifecycle FR-002"], "an acceptance ends on a day and the finding is open again, saying so, once the day has passed", () => {
  const accepted = [ev({ kind: "accept", reason: "a break-glass tool, reviewed quarterly", until: "2027-02-01" })];
  const s = stateOf("f1", accepted, NOW);
  assertEquals([s.status, s.until, s.lapsed, s.reason], ["accepted", "2027-02-01", false, "a break-glass tool, reviewed quarterly"]);
  assertEquals(stateOf("f1", accepted, "2027-02-01T23:59:59Z").status, "accepted", "the last day is still accepted");
  const lapsed = stateOf("f1", accepted, "2027-02-02T00:00:00Z");
  assertEquals([lapsed.status, lapsed.lapsed], ["open", true]);
});

proves(["0004-findings-lifecycle FR-003"], "an event is refused with every reason where it does not say who, when or why, has a bad acceptance, a duplicate of nothing, no finding, or cannot follow the state", () => {
  const open = stateOf("f1", [], NOW);
  assertEquals(problemsOf(ev({ kind: "triage", as: "confirmed", reason: "reproduced" }), open, NOW), []);
  assertEquals(problemsOf(ev({ kind: "triage", as: "confirmed", reason: "r" }), undefined, NOW), ["there is no finding f1"]);
  const bare = problemsOf({ kind: "triage", as: "confirmed", reason: " ", finding: "f1", at: "soon", by: "" } as Event, open, NOW);
  assertEquals(bare.length, 3);
  assert(problemsOf(ev({ kind: "fix", at: "2027-01-01T00:00:00Z" }), open, NOW).some((m) => m.includes("future")));
  const accept = (until: string, at = "2026-12-01T10:00:00Z") => problemsOf(ev({ kind: "accept", reason: "r", until, at }), open, NOW);
  assertEquals(accept("2027-02-01"), []);
  assert(accept("soon")[0]?.includes("YYYY-MM-DD"));
  assert(accept("2026-12-01")[0]?.includes("ends after the day"));
  assert(accept("2028-01-01")[0]?.includes("at most a year"));
  assert(problemsOf(ev({ kind: "triage", as: "duplicate", reason: "same" }), open, NOW).some((m) => m.includes("of which finding")));
  assertEquals(problemsOf(ev({ kind: "triage", as: "duplicate", reason: "same", duplicateOf: "f2" } as never), open, NOW), []);
  const fixed = stateOf("f1", [ev({ kind: "fix" })], NOW);
  assert(problemsOf(ev({ kind: "triage", as: "confirmed", reason: "r" }), fixed, NOW).some((m) => m.includes("cannot follow fixed")));
  assert(problemsOf(ev({ kind: "retest", result: "not-found", source: "z" }), open, NOW).some((m) => m.includes("cannot follow open")));
  const lapsed = stateOf("f1", [ev({ kind: "accept", reason: "r", until: "2026-11-25" })], NOW);
  assertEquals(lapsed.status, "open");
  assertEquals(problemsOf(ev({ kind: "retest", result: "not-found", source: "z" }), lapsed, NOW).length, 1);
});

proves(["0004-findings-lifecycle FR-004"], "a retest gives an event for each finding claimed fixed and for no other", () => {
  const states = [
    stateOf("a", [ev({ finding: "a", kind: "fix" })], NOW),
    stateOf("b", [ev({ finding: "b", kind: "fix" })], NOW),
    stateOf("c", [], NOW),
    stateOf("d", [ev({ finding: "d", kind: "accept", reason: "r", until: "2027-01-01" })], NOW),
  ];
  const events = retestEvents(states, new Set(["a", "c", "d"]), "bob", NOW, "zap-2.json");
  assertEquals(events.map((e) => `${e.finding} ${e.kind === "retest" ? e.result : ""}`), ["a still-present", "b not-found"]);
  assertEquals(events[0], { kind: "retest", finding: "a", at: NOW, by: "bob", result: "still-present", source: "zap-2.json" });
});

const F = (id: string, over: Partial<Finding> = {}): Finding => ({ id, rule: "r", title: `Title ${id}`, severity: "high", asset: "portal", description: "d", cwe: [], cve: [], source: { tool: "zap", file: "z.json" }, ...over });

proves(["0004-findings-lifecycle FR-005"], "the controls are RA-5, SI-2 for a CVE and those of the weakness, and the rows are fail for what counts, accepted for an accepted risk and none for a false positive, a duplicate or a verified fix", () => {
  assertEquals(controlsOf({ cwe: [], cve: [] }), ["RA-5"]);
  assertEquals(controlsOf({ cwe: ["CWE-89"], cve: [] }), ["RA-5", "SI-10"]);
  assertEquals(controlsOf({ cwe: ["CWE-639", "CWE-327"], cve: ["CVE-2024-1"] }), ["AC-3", "AC-6", "RA-5", "SC-13", "SI-2"]);
  assertEquals(controlsOf({ cwe: ["CWE-99999"], cve: [] }), ["RA-5"]);
  const findings = [F("a"), F("b"), F("c"), F("d"), F("e"), F("f", { asset: "api", cwe: ["CWE-79"] }), F("g")];
  const states = [
    stateOf("a", [], NOW),
    stateOf("b", [ev({ finding: "b", kind: "triage", as: "false-positive", reason: "x" })], NOW),
    stateOf("c", [ev({ finding: "c", kind: "accept", reason: "r", until: "2027-01-01" })], NOW),
    stateOf("d", [ev({ finding: "d", kind: "fix" }), ev({ finding: "d", kind: "retest", result: "not-found", source: "z" })], NOW),
    stateOf("e", [ev({ finding: "e", kind: "fix" })], NOW),
    stateOf("f", [], NOW),
  ];
  const rows = rowsByAsset(findings, states);
  assertEquals([...rows.keys()].sort(), ["api", "portal"]);
  assertEquals((rows.get("portal") ?? []).map((r) => `${r.id} ${r.status}`), ["finding-a fail", "finding-c accepted", "finding-e fail", "finding-g fail"]);
  assertEquals(rows.get("api")?.[0]?.controls, ["RA-5", "SI-10"]);
  assert(rows.get("portal")?.[0]?.detail.includes("high: Title a (zap, open)"));
});
