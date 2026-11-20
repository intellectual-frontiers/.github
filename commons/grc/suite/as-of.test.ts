/**
 * Tests of the as-of view (0010-grc-as-of): the state of every control at an instant from what was recorded up to it, with expirations at the instant, and the properties that the view at the end of
 * the ledger is the current view, that a later event never changes an earlier view, and that the order of the events does not matter.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Exception } from "@intellectual-frontiers/grc/governance";
import { appendEntry, asOf, type AsOfInput, canonicalize, currentView, GENESIS, latestInstant, type LedgerEntry, type Result as Outcome, risk, type Risk, type Status, STATUSES } from "@intellectual-frontiers/grc/logical";
import { A1, A2, aCheck, anException, aResult, ex, must, walk } from "./fixtures.ts";

const day = (d: number, h = 0): string => `2026-06-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`;
const head = { schema: "1", provenance: { producer: { name: "test", version: "1" }, inputs: [] } };

function aRisk(id: string, level: string, createdAt: string, reviewBy: string): Risk {
  return must(risk.decode, { ...head, kind: "grc.risk", id, createdAt, title: id, description: "d", likelihood: level, impact: level, level, treatment: "mitigate", owner: "o", reviewBy, controls: [A1] });
}
const base: AsOfInput = { frameworks: [ex], crosswalks: [walk], checks: [aCheck("c-a1", [A1])], results: [], exceptions: [], risks: [], ledger: [] };
const view = (input: AsOfInput, at: string) => {
  const r = asOf(input, at);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const stateA1 = (input: AsOfInput, at: string) => view(input, at).controls.find((c) => c.control === A1);
const result = (status: Status, observedAt: string): Outcome => aResult("c-a1", "host-1", status, { observedAt });

async function chain(days: readonly number[]): Promise<readonly LedgerEntry[]> {
  const out: LedgerEntry[] = [];
  let last: LedgerEntry | undefined;
  for (const d of days) {
    last = await appendEntry(last, { at: day(d), type: "observation", subject: "host-1", evidence: "ab".repeat(32) });
    out.push(last);
  }
  return out;
}

proves(["0010-grc-as-of FR-001"], "every control has a state at an instant, with the head and length of the ledger; an instant that is not one is an error value", async () => {
  const ledger = await chain([2, 4, 6]);
  const v = view({ ...base, results: [result("pass", day(3))], ledger }, day(5));
  assertEquals(v.controls.map((c) => c.control), [A1, A2, "urn:grc:ex:1:B-1"]);
  assertEquals([v.ledger.length, v.ledger.head], [2, ledger[1]?.digest]);
  assertEquals(asOf(base, "yesterday").kind, "err");
  assertEquals(currentView(base, "now").kind, "err");
});

proves(["0010-grc-as-of FR-002"], "events after the instant are ignored: results, risks, exceptions and ledger entries", async () => {
  const input: AsOfInput = {
    ...base,
    results: [result("fail", day(10))],
    exceptions: [anException({ id: "exc-late", excuses: { type: "control", ref: A1 }, subjects: ["host-*"], grantedAt: day(12), expiresAt: day(25) })],
    risks: [aRisk("r-late", "high", day(12), day(30))],
    ledger: await chain([2, 11, 13]),
  };
  const at11 = stateA1(input, day(11, 12));
  assertEquals([at11?.status, at11?.exceptions, at11?.risk], ["fail", [], undefined]);
  assertEquals(view(input, day(11, 12)).ledger.length, 2);
  const at13 = stateA1(input, day(13));
  assertEquals([at13?.status, at13?.exceptions, at13?.risk], ["accepted", ["exc-late"], "high"]);
  const before = stateA1(input, day(1));
  assertEquals([before?.status, before?.freshness, before?.newestAt, before?.coverage], ["gap", "unobserved", undefined, "untested"]);
  assertEquals(view(input, day(1)).ledger, { length: 0, head: GENESIS });
});

proves(["0010-grc-as-of FR-003"], "expirations are evaluated at the instant: exceptions, freshness and the review of a risk", () => {
  const input: AsOfInput = {
    ...base,
    results: [result("fail", day(10))],
    exceptions: [anException({ id: "exc", excuses: { type: "control", ref: A1 }, subjects: ["host-*"], grantedAt: day(11), expiresAt: day(20) })],
    risks: [aRisk("r", "moderate", day(10), day(15))],
  };
  assertEquals(stateA1(input, day(19, 23))?.exceptions, ["exc"]);
  assertEquals([stateA1(input, day(20))?.exceptions, stateA1(input, day(20))?.status], [[], "fail"]);
  assertEquals([stateA1(input, day(11, 12))?.freshness, stateA1(input, day(16, 23))?.freshness, stateA1(input, day(17))?.freshness], ["fresh", "due", "stale"]);
  assertEquals([stateA1(input, day(14))?.risksDue, stateA1(input, day(15))?.risksDue], [[], ["r"]]);
});

proves(["0010-grc-as-of FR-004"], "the status joins the newest results with the exceptions of the instant applied; the risk is the highest level up to it", () => {
  const input: AsOfInput = {
    ...base,
    results: [result("fail", day(5)), result("pass", day(9)), aResult("c-a1", "host-2", "warn", { observedAt: day(8) })],
    risks: [aRisk("r1", "low", day(2), day(30)), aRisk("r2", "very-high", day(6), day(30))],
  };
  assertEquals(stateA1(input, day(6))?.status, "fail");
  assertEquals(stateA1(input, day(7))?.risk, "very-high");
  assertEquals(stateA1(input, day(8, 1))?.status, "fail");
  assertEquals([stateA1(input, day(10))?.status, stateA1(input, day(10))?.newestAt], ["warn", day(9)]);
  assertEquals(stateA1(input, day(10))?.risk, "very-high");
  assertEquals(stateA1(input, day(3))?.risk, "low");
});

const statusArb = fc.constantFrom<Status>(...STATUSES);
const dayArb = fc.integer({ min: 1, max: 28 });
const ledgerAll = await chain([2, 5, 8, 11, 14, 17, 20, 23]);
const inputArb: fc.Arbitrary<AsOfInput> = fc
  .record({
    results: fc.uniqueArray(fc.record({ d: dayArb, status: statusArb, subject: fc.constantFrom("host-1", "host-2") }), { selector: (r) => `${r.d}${r.subject}`, maxLength: 10 }),
    exceptions: fc.array(fc.record({ g: dayArb, len: fc.integer({ min: 1, max: 10 }), ref: fc.constantFrom(A1, "c-a1") }), { maxLength: 3 }),
    risks: fc.array(fc.record({ d: dayArb, review: dayArb, level: fc.constantFrom("low", "moderate", "high") }), { maxLength: 3 }),
    prefix: fc.integer({ min: 0, max: ledgerAll.length }),
  })
  .map((g) => ({
    ...base,
    results: g.results.map((r) => aResult("c-a1", r.subject, r.status, { observedAt: day(r.d) })),
    exceptions: g.exceptions.map((e, i): Exception => anException({ id: `exc-${i}`, excuses: e.ref === A1 ? { type: "control", ref: A1 } : { type: "check", ref: "c-a1" }, subjects: ["host-*"], grantedAt: day(e.g), expiresAt: day(Math.min(28, e.g + e.len), 1) })),
    risks: g.risks.map((r, i) => aRisk(`risk-${i}`, r.level, day(r.d), day(r.review))),
    ledger: ledgerAll.slice(0, g.prefix),
  }));

proves(["0010-grc-as-of FR-005"], "the view is the same for any order of results, entries, exceptions and risks, and the current view is the same computation unfiltered", () => {
  fc.assert(
    fc.property(inputArb, dayArb, fc.nat(), (input, d, seed) => {
      const rot = <T>(xs: readonly T[]): readonly T[] => (xs.length === 0 ? xs : [...xs.slice(seed % xs.length), ...xs.slice(0, seed % xs.length)].reverse());
      const shuffled: AsOfInput = { ...input, results: rot(input.results), exceptions: rot(input.exceptions), risks: rot(input.risks), ledger: rot(input.ledger) };
      return canonicalize(view(input, day(d))) === canonicalize(view(shuffled, day(d)));
    }),
  );
  const input: AsOfInput = { ...base, results: [result("pass", day(3))] };
  const now = currentView(input, day(9));
  assert(now.kind === "ok" && canonicalize(now.value) === canonicalize(view(input, day(9))));
});

proves(["0010-grc-as-of FR-006"], "the as-of view at the end equals the current view, and adding events later than the instant never changes an earlier view", () => {
  fc.assert(
    fc.property(inputArb, (input) => {
      const end = latestInstant(input);
      if (end === undefined) return true;
      const now = currentView(input, end);
      return now.kind === "ok" && canonicalize(view(input, end)) === canonicalize(now.value);
    }),
  );
  fc.assert(
    fc.property(inputArb, inputArb, dayArb, (a, b, d) => {
      const at = day(d);
      const later = (t: string): boolean => Date.parse(t) > Date.parse(at);
      const extra: AsOfInput = {
        ...a,
        results: [...a.results, ...b.results.filter((r) => later(r.observedAt)).map((r) => ({ ...r, id: `${r.id}:later` }))],
        exceptions: [...a.exceptions, ...b.exceptions.filter((e) => later(e.grantedAt)).map((e) => ({ ...e, id: `${e.id}:later` }))],
        risks: [...a.risks, ...b.risks.filter((r) => later(r.createdAt)).map((r) => ({ ...r, id: `${r.id}:later` }))],
        ledger: a.ledger,
      };
      return canonicalize(view(a, at)) === canonicalize(view(extra, at));
    }),
  );
  assertEquals(latestInstant(base), undefined);
});
