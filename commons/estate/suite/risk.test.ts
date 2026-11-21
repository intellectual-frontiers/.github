/**
 * Tests of accepted risk and the status of a policy (commons estate 0003-estate-logical FR-005, FR-006): a risk is accepted only with a person, a reason and a date within a year, an accepted policy is never a pass,
 * the acceptance ends on its date, and a machine never observed is waiting. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { acceptRisk, judgePolicy, type AcceptedRisk, type PolicyOutcome } from "../src/logical/mod.ts";

const NOW = "2026-12-01T12:00:00Z";
const GOOD: AcceptedRisk = { policy: "disk-encryption", reason: "holds only open-source code", by: "an owner", until: "2027-03-01" };

proves(["0003-estate-logical FR-005"], "a risk is accepted only with a policy, a person, a reason of ten characters and a date after today within a year, and every reason for a refusal is given", () => {
  const ok = acceptRisk(GOOD, NOW);
  assert(ok.kind === "ok" && ok.value.reason === "holds only open-source code");
  assertEquals(acceptRisk({ ...GOOD, until: "2027-12-02" }, NOW).kind, "ok", "366 days is the limit");
  assertEquals(acceptRisk({ ...GOOD, until: "2027-12-03" }, NOW).kind, "err", "one day more is refused");
  assertEquals(acceptRisk({ ...GOOD, until: "2026-12-01" }, NOW).kind, "err", "today is refused");
  assertEquals(acceptRisk({ ...GOOD, until: "next spring" }, NOW).kind, "err");
  assertEquals(acceptRisk({ ...GOOD, reason: "no" }, NOW).kind, "err");
  const all = acceptRisk({ policy: " ", reason: "x", by: "", until: "soon" }, NOW);
  assert(all.kind === "err" && all.error.length === 4, "every reason is given");
  assertEquals(acceptRisk(GOOD, "yesterday").kind, "err");
});

proves(["0003-estate-logical FR-006"], "a machine never observed and an unknown policy are waiting, an accepted policy is never a pass and fails again after its date, and a pass is untouched", () => {
  const result = (status: PolicyOutcome["status"]): PolicyOutcome => ({ id: "disk-encryption", status, controls: ["CRY-05"] });
  const judge = (status: PolicyOutcome["status"], observed: boolean, now: string, accepted: readonly AcceptedRisk[] = [GOOD]) => judgePolicy({ result: result(status), observed, accepted, now });
  assertEquals(judge("fail", false, NOW).status, "waiting", "never observed is waiting, never a failure");
  assertEquals(judge("fail", false, NOW).detail, "not observed yet");
  assertEquals(judge("unknown", true, NOW).status, "waiting");
  assertEquals(judge("pass", true, NOW).status, "pass");
  assertEquals(judge("pass", true, "2028-01-01T00:00:00Z").status, "pass", "a pass is never changed");
  const accepted = judge("fail", true, NOW);
  assertEquals(accepted.status, "accepted");
  assert(accepted.detail.includes("accepted by an owner until 2027-03-01") && accepted.detail.includes("holds only open-source code"));
  assertEquals(judge("fail", true, "2027-03-01T12:00:00Z").status, "accepted", "the last day still counts");
  const ended = judge("fail", true, "2027-03-02T00:00:00Z");
  assertEquals(ended.status, "fail");
  assert(ended.detail.includes("the accepted risk ended 2027-03-01"));
  assertEquals(judge("warn", true, NOW, []).status, "warn");
  assertEquals(judge("fail", true, NOW, []).detail, "failing");
  assertEquals(judge("fail", true, NOW, []).controls, ["CRY-05"]);
});
