/**
 * Tests of the grading of evidence (commons assessment 0003-evidence-grading FR-001 to FR-005): the origin of a record and its rules, the grade of a record by origin and age and expiry, the grade of an objective from its best live passing record, the counts that are never a percentage, and the same answer every time.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Evidence, Objective } from "../src/governance/mod.ts";
import { countGrades, decodeRecord, encodeRecord, gradeObjectives, gradeOf, originOf, problemsOf } from "../src/logical/mod.ts";

const NOW = "2026-11-21T12:00:00Z";
const daysAgo = (n: number): string => new Date(Date.parse(NOW) - n * 86_400_000).toISOString().replace(".000Z", "Z");
const ev = (o: Partial<Evidence> & { id: string }): Evidence => ({ framework: "f", objective: "o1", method: "test", result: "pass", by: { kind: "tool", name: "probe" }, at: daysAgo(1), source: `s-${o.id}`, determines: false, ...o });
const person = (o: Partial<Evidence> & { id: string }): Evidence => ev({ method: "examine", by: { kind: "person", name: "Ann" }, ...o });

proves(["0003-evidence-grading FR-001"], "the origin defaults from the maker, a tool cannot attest or screenshot, and the origin is kept in the record's file", () => {
  assertEquals(originOf(ev({ id: "a" })), "machine");
  assertEquals(originOf(person({ id: "a" })), "attestation");
  assertEquals(originOf(ev({ id: "a", origin: "signed-record" })), "signed-record");
  assert(problemsOf(ev({ id: "a", origin: "screenshot" })).some((p) => p.includes("not an attestation or a screenshot")));
  assert(problemsOf(ev({ id: "a", origin: "attestation" })).length > 0);
  assertEquals(problemsOf(person({ id: "a", origin: "screenshot" })), []);
  assert(problemsOf({ ...person({ id: "a" }), origin: "hearsay" as never }).some((p) => p.includes("origin is one of")));
  const e = person({ id: "a", origin: "screenshot" });
  assertEquals(decodeRecord(encodeRecord(e)), { kind: "ok", value: e });
  assert(encodeRecord(e).includes("screenshot"));
});

proves(["0003-evidence-grading FR-002", "0003-evidence-grading FR-005"], "a record is graded by its origin, one lower past the age its origin keeps, weak past twice that, and expired when its validity ended", () => {
  assertEquals(gradeOf(ev({ id: "a" }), NOW), "strong");
  assertEquals(gradeOf(ev({ id: "a", at: daysAgo(7) }), NOW), "strong", "seven days is not over seven");
  assertEquals(gradeOf(ev({ id: "a", at: daysAgo(10) }), NOW), "moderate");
  assertEquals(gradeOf(ev({ id: "a", at: daysAgo(15) }), NOW), "weak");
  assertEquals(gradeOf(ev({ id: "a", origin: "signed-record", at: daysAgo(60) }), NOW), "strong");
  assertEquals(gradeOf(ev({ id: "a", origin: "signed-record", at: daysAgo(100) }), NOW), "moderate");
  assertEquals(gradeOf(person({ id: "a", at: daysAgo(100) }), NOW), "moderate");
  assertEquals(gradeOf(person({ id: "a", at: daysAgo(400) }), NOW), "weak");
  assertEquals(gradeOf(person({ id: "a", origin: "screenshot", at: daysAgo(1) }), NOW), "weak");
  assertEquals(gradeOf(person({ id: "a", origin: "screenshot", at: daysAgo(200) }), NOW), "weak");
  assertEquals(gradeOf(ev({ id: "a", at: daysAgo(3), validUntil: NOW }), NOW), "expired");
  assertEquals(gradeOf(ev({ id: "a", at: daysAgo(3) }), NOW), gradeOf(structuredClone(ev({ id: "a", at: daysAgo(3) })), NOW));
});

const OBJ: readonly Objective[] = [1, 2, 3, 4].map((n) => ({ id: `o${n}`, requirement: "r", statement: "s" }));

proves(["0003-evidence-grading FR-003", "0003-evidence-grading FR-004"], "an objective is graded by the best of its latest passing records with the record it rests on, a failure gives no grade, and grades are counted and not averaged", () => {
  const g = gradeObjectives(OBJ, [
    person({ id: "shot", objective: "o1", origin: "screenshot", at: daysAgo(7) }),
    ev({ id: "fresh", objective: "o2" }), person({ id: "word", objective: "o2" }),
    ev({ id: "old", objective: "o3", validUntil: daysAgo(1), at: daysAgo(30) }),
    ev({ id: "bad", objective: "o4", result: "fail" }),
  ], NOW);
  assertEquals(g.map((x) => [x.objective, x.grade]), [["o1", "weak"], ["o2", "strong"], ["o3", "expired"], ["o4", "none"]]);
  assertEquals(g[0], { objective: "o1", grade: "weak", basis: "shot", origin: "screenshot", ageDays: 7 });
  assertEquals(g[1]?.basis, "fresh");
  assertEquals(countGrades(g), { strong: 1, moderate: 0, weak: 1, expired: 1, none: 1 });
  assert(!JSON.stringify(countGrades(g)).includes("percent"));
  assertEquals(gradeObjectives(OBJ, [], NOW).every((x) => x.grade === "none"), true);
  const replaced = gradeObjectives([OBJ[0] as Objective], [ev({ id: "x", objective: "o1", source: "s", at: daysAgo(20), result: "fail" }), ev({ id: "y", objective: "o1", source: "s", at: daysAgo(1) })], NOW);
  assertEquals(replaced[0]?.grade, "strong", "a later passing record of one source replaces an earlier failure");
});
