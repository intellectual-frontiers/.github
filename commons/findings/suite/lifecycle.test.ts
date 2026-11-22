// Spec: 0004-findings-lifecycle FR-001
/**
 * Tests of the lifecycle (commons findings 0004-findings-lifecycle) over Planning's own events and fold: a finding is opened as an item of the kind `finding`, each action is the events Planning has (comments, labels, closing, deferring, reopening), the state of an item is read back in the words of a security review, an
 * action that cannot follow the state is refused with every reason, a retest settles a claimed fix, and the controls and the rows of the posture come from the views. Every name is made up.
 *
 * @module
 */
import { parseReplicaId } from "@intellectual-frontiers/anyfs/governance";
import { agent, makeEvent, instantOfMs, parseDay, person, tool, type Actor, type EventData, type Item, type ItemEvent } from "@intellectual-frontiers/planning/governance";
import { fold, mintEventId, mintItemId, newClock, type Clock } from "@intellectual-frontiers/planning/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Finding } from "../src/governance/mod.ts";
import { controlsOf, eventsOf, FINGERPRINT_SOURCE, LABEL, OPEN_STATUSES, openedOf, problemsOf, retestsOf, rowsByAsset, statusOf, viewOf, type Action } from "../src/logical/mod.ts";

const NOW = "2026-12-01T12:00:00Z";
const unwrap = <T, E>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: E }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const ADA = unwrap(person("ada", "Ada"));
const IMPORTER = unwrap(tool("opsfolio-findings", "opsfolio findings", ADA));
const F = (id: string, over: Partial<Finding> = {}): Finding => ({ id, rule: "40012", title: `Title ${id}`, severity: "high", asset: "portal", location: "https://app.example.test/search", description: "XSS is possible.", solution: "Encode output.", cwe: ["CWE-79"], cve: [], evidence: "Cookie: [redacted]", source: { tool: "zap", version: "2.15.0", file: "zap.json" }, ...over });

/** A finding opened and then acted on, as Planning's events, folded. */
class Life {
  #clock: Clock = newClock(unwrap(parseReplicaId("0123456789abcdef0123456789abcdef")));
  #ms = Date.parse("2026-11-20T10:00:00Z");
  readonly events: ItemEvent[] = [];
  readonly id;
  readonly finding: Finding;
  constructor(finding: Finding, actor: Actor = IMPORTER) {
    this.finding = finding;
    const minted = unwrap(mintItemId(this.#clock, this.#ms));
    this.#clock = minted.clock;
    this.id = minted.id;
    this.add(openedOf(finding), actor);
  }
  add(data: EventData, actor: Actor = ADA): void {
    this.#ms += 1000;
    const e = unwrap(mintEventId(this.#clock, this.#ms));
    this.#clock = e.clock;
    this.events.push(unwrap(makeEvent({ id: e.id, item: this.id, at: unwrap(instantOfMs(this.#ms)), actor }, data)));
  }
  do(a: Action, actor: Actor = ADA): this {
    for (const d of unwrap(eventsOf(a))) this.add(d, actor);
    return this;
  }
  get item(): Item {
    return unwrap(fold(this.events));
  }
  status(now = NOW) {
    return viewOf(this.item, now);
  }
}

proves(["0004-findings-lifecycle FR-001"], "a finding is opened as an item of the kind finding with the report's severity kept, the facts that make it the same finding in the labels and the source, and the fingerprint as its external id; Planning's fold gives it open", () => {
  const life = new Life(F("3fa9c1d2e4b5a697"));
  const item = life.item;
  assertEquals([item.kind, item.state.kind, item.origin, item.severity], ["finding", "open", "derived", "error"]);
  assertEquals(item.sourceSeverity, "high");
  assertEquals(item.labels, ["asset:portal", "cwe:CWE-79", "rule:40012", "severity:high", "tool:zap"]);
  assertEquals(item.source, { tool: "zap", rule: "40012", asset: "portal", fingerprint: "3fa9c1d2e4b5a697", file: "zap.json", version: "2.15.0", location: "https://app.example.test/search" });
  assertEquals(item.target, { file: "https://app.example.test/search" });
  assertEquals(item.evidence, ["Cookie: [redacted]"]);
  assert(item.body.includes("XSS is possible.") && item.body.includes("Solution: Encode output."));
  const v = life.status();
  assertEquals([v.status, v.severity, v.asset, v.tool, v.cwe, v.fingerprint], ["open", "high", "portal", "zap", ["CWE-79"], "3fa9c1d2e4b5a697"]);
  assertEquals(FINGERPRINT_SOURCE, "opsfolio-findings");
  for (const [sev, planning] of [["critical", "error"], ["high", "error"], ["medium", "warning"], ["low", "note"], ["info", "note"]] as const) assertEquals(new Life(F("a", { severity: sev })).item.severity, planning, sev);
  assertEquals(new Life(F("a", { severity: "critical" })).status().severity, "critical", "the five levels survive the three of Planning");
  const agentActor = unwrap(agent("scanner", "a scanner", ADA, "session"));
  assertEquals(new Life(F("a"), agentActor).item.openedBy, agentActor, "an agent acts for a person, which Planning requires");
});

proves(["0004-findings-lifecycle FR-001"], "each action is Planning's events and reads back as a state: confirmed, a false positive and a duplicate closed as Planning closes, an accepted risk deferred, a claimed fix, a retest that settles it, a reopening", () => {
  const confirmed = new Life(F("a")).do({ kind: "triage", as: "confirmed", reason: "reproduced on staging" });
  assertEquals(confirmed.status().status, "confirmed");
  assertEquals(confirmed.item.state.kind, "open");
  assert(confirmed.item.comments.some((c) => c.body === "Confirmed: reproduced on staging"));
  const fp = new Life(F("a")).do({ kind: "triage", as: "false-positive", reason: "a test page" });
  assertEquals([fp.status().status, fp.item.state.kind], ["false-positive", "closed"]);
  assertEquals(fp.item.state.kind === "closed" ? fp.item.state.reason : "", "not-planned");
  const dup = new Life(F("a")).do({ kind: "triage", as: "duplicate", reason: "same as the other", duplicateOf: "x" });
  assertEquals(dup.status().status, "duplicate");
  const accepted = new Life(F("a")).do({ kind: "accept", reason: "behind the VPN", until: "2027-02-01" });
  assertEquals(accepted.item.state.kind, "deferred");
  const s = accepted.status();
  assertEquals([s.status, s.until, s.lapsed], ["accepted", "2027-02-01", false]);
  assert(s.reason?.includes("behind the VPN"));
  const fixed = new Life(F("a")).do({ kind: "triage", as: "confirmed", reason: "r" }).do({ kind: "fix", ref: "PR-12" });
  assertEquals(fixed.status().status, "fixed");
  assertEquals(fixed.do({ kind: "retest", result: "still-present", source: "zap-2.json" }).status().status, "reopened");
  const verified = new Life(F("a")).do({ kind: "fix" }).do({ kind: "retest", result: "not-found", source: "zap-2.json" });
  assertEquals([verified.status().status, verified.item.state.kind], ["verified", "closed"]);
  assertEquals(verified.item.state.kind === "closed" ? verified.item.state.reason : "", "completed");
  const back = verified.do({ kind: "reopen", reason: "it came back" });
  assertEquals([back.status().status, back.item.state.kind], ["reopened", "open"]);
  const un = new Life(F("a")).do({ kind: "accept", reason: "r", until: "2027-02-01" }).do({ kind: "reopen", reason: "no longer true" });
  assertEquals([un.status().status, un.item.state.kind], ["reopened", "open"]);
  const fpBack = new Life(F("a")).do({ kind: "triage", as: "false-positive", reason: "x" }).do({ kind: "reopen", reason: "it was real" });
  assertEquals(fpBack.status().status, "reopened");
  assertEquals(OPEN_STATUSES, ["open", "confirmed", "reopened", "fixed"]);
  assert(eventsOf({ kind: "triage", as: "duplicate", reason: "r" }).kind === "err" && eventsOf({ kind: "accept", reason: "r", until: "soon" }).kind === "err");
});

proves(["0004-findings-lifecycle FR-002"], "a deferral with the label of an accepted risk and no day is not an acceptance: it is open and the acceptance lapsed", () => {
  const life = new Life(F("a")).do({ kind: "accept", reason: "reviewed quarterly", until: "2027-02-01" });
  const noDay: Item = { ...life.item, state: { kind: "deferred" } };
  const s = statusOf(noDay, "2026-11-22T00:00:00Z");
  assertEquals([s.status, s.lapsed, s.until], ["open", true, undefined], "no risk is accepted without an end day");
});

proves(["0004-findings-lifecycle FR-002"], "an acceptance is Planning's deferral until a day, the last day is still accepted, and the finding is open again, saying the acceptance lapsed, after it", () => {
  const life = new Life(F("a")).do({ kind: "accept", reason: "reviewed quarterly", until: "2027-02-01" });
  assertEquals(life.status("2027-02-01T23:59:59Z").status, "accepted");
  const lapsed = life.status("2027-02-02T00:00:00Z");
  assertEquals([lapsed.status, lapsed.lapsed, lapsed.until], ["open", true, "2027-02-01"]);
  assert(statusOf(life.item, "2027-02-02T00:00:00Z").lapsed);
  assert(parseDay("2027-02-01").kind === "ok");
});

proves(["0004-findings-lifecycle FR-003"], "an action is refused with every reason where it does not say who, when or why, has a bad acceptance, a duplicate of nothing, no finding, or cannot follow the state", () => {
  const open = new Life(F("a")).status();
  const check = (a: Action, view = open, by = "ada", at = NOW) => problemsOf(a, view, by, at, NOW);
  assertEquals(check({ kind: "triage", as: "confirmed", reason: "reproduced" }), []);
  assertEquals(problemsOf({ kind: "fix" }, undefined, "ada", NOW, NOW), ["there is no such finding"]);
  assertEquals(check({ kind: "triage", as: "confirmed", reason: " " }, open, "", "soon").length, 3);
  assert(check({ kind: "fix" }, open, "ada", "2027-01-01T00:00:00Z").some((m) => m.includes("future")));
  assertEquals(check({ kind: "accept", reason: "r", until: "2027-02-01" }), []);
  assert(check({ kind: "accept", reason: "r", until: "soon" })[0]?.includes("YYYY-MM-DD"));
  assert(check({ kind: "accept", reason: "r", until: "2026-12-01" })[0]?.includes("ends after the day"));
  assert(check({ kind: "accept", reason: "r", until: "2028-01-01" })[0]?.includes("at most a year"));
  assert(check({ kind: "triage", as: "duplicate", reason: "same" }).some((m) => m.includes("of which finding")));
  const fixed = new Life(F("a")).do({ kind: "fix" }).status();
  assert(check({ kind: "triage", as: "confirmed", reason: "r" }, fixed).some((m) => m.includes("cannot follow fixed")));
  assert(check({ kind: "retest", result: "not-found", source: "z" }, open).some((m) => m.includes("cannot follow open")));
  assertEquals(check({ kind: "retest", result: "not-found", source: "z" }, fixed), []);
  const lapsed = new Life(F("a")).do({ kind: "accept", reason: "r", until: "2026-11-25" }).status();
  assertEquals(lapsed.status, "open");
  assert(check({ kind: "retest", result: "not-found", source: "z" }, lapsed)[0]?.includes("the acceptance lapsed"));
});

proves(["0004-findings-lifecycle FR-004"], "a retest gives an action for each finding claimed fixed, by its fingerprint, and for no other", () => {
  const views = [
    new Life(F("aaaaaaaaaaaaaaaa")).do({ kind: "fix" }).status(),
    new Life(F("bbbbbbbbbbbbbbbb")).do({ kind: "fix" }).status(),
    new Life(F("cccccccccccccccc")).status(),
    new Life(F("dddddddddddddddd")).do({ kind: "accept", reason: "r", until: "2027-01-01" }).status(),
  ];
  const r = retestsOf(views, new Set(["aaaaaaaaaaaaaaaa", "cccccccccccccccc", "dddddddddddddddd"]), "zap-2.json");
  assertEquals(r.map((x) => `${x.view.fingerprint} ${x.action.kind === "retest" ? x.action.result : ""}`), ["aaaaaaaaaaaaaaaa still-present", "bbbbbbbbbbbbbbbb not-found"]);
});

proves(["0004-findings-lifecycle FR-005"], "the controls are RA-5, SI-2 for a CVE and those of the weakness, and the rows are fail for what counts, accepted for an accepted risk and none for a false positive, a duplicate or a verified fix", () => {
  assertEquals(controlsOf({ cwe: [], cve: [] }), ["RA-5"]);
  assertEquals(controlsOf({ cwe: ["CWE-89"], cve: [] }), ["RA-5", "SI-10"]);
  assertEquals(controlsOf({ cwe: ["CWE-639", "CWE-327"], cve: ["CVE-2024-1"] }), ["AC-3", "AC-6", "RA-5", "SC-13", "SI-2"]);
  assertEquals(controlsOf({ cwe: ["CWE-99999"], cve: [] }), ["RA-5"]);
  const views = [
    new Life(F("aaaaaaaaaaaaaaaa")).status(),
    new Life(F("bbbbbbbbbbbbbbbb")).do({ kind: "triage", as: "false-positive", reason: "x" }).status(),
    new Life(F("cccccccccccccccc")).do({ kind: "accept", reason: "r", until: "2027-01-01" }).status(),
    new Life(F("dddddddddddddddd")).do({ kind: "fix" }).do({ kind: "retest", result: "not-found", source: "z" }).status(),
    new Life(F("eeeeeeeeeeeeeeee")).do({ kind: "fix" }).status(),
    new Life(F("ffffffffffffffff", { asset: "api", cwe: ["CWE-89"], cve: [] })).status(),
  ];
  const rows = rowsByAsset(views);
  assertEquals([...rows.keys()].sort(), ["api", "portal"]);
  assertEquals((rows.get("portal") ?? []).map((r) => `${r.id} ${r.status}`), ["finding-aaaaaaaaaaaaaaaa fail", "finding-cccccccccccccccc accepted", "finding-eeeeeeeeeeeeeeee fail"]);
  assertEquals(rows.get("api")?.[0]?.controls, ["RA-5", "SI-10"]);
  assert(rows.get("portal")?.[0]?.detail.includes("high: Title aaaaaaaaaaaaaaaa at https://app.example.test/search (zap, open)"));
  assert(LABEL.fixClaimed === "fix-claimed");
});
