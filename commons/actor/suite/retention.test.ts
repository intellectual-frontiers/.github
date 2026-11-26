/**
 * Tests of the retention of the digests of agent sessions (commons actor 0003-actor-retention FR-001 to FR-003).
 *
 * @module
 */
import fc from "fast-check";
import { DEFAULT_RETENTION_YEARS, RETENTION_RULES } from "@intellectual-frontiers/actor/governance";
import { expire, expiryOf, isExpired, retentionOf } from "@intellectual-frontiers/actor/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

proves(["0003-actor-retention FR-001"], "the rules are data with a source, and only the Security Rule was read", () => {
  const hipaa = RETENTION_RULES.find((r) => r.regime === "hipaa");
  assert(hipaa !== undefined && hipaa.years === 6 && hipaa.status === "read" && hipaa.source.includes("164.316(b)(2)(i)"));
  for (const r of RETENTION_RULES) assert(r.source !== "" && r.basis !== "", r.regime);
  for (const r of RETENTION_RULES.filter((x) => x.status === "unread")) assertEquals(r.years, undefined, `${r.regime} fixes no period until it is read`);
});

proves(["0003-actor-retention FR-002"], "the period is the longest rule that was read, else six years; an override never goes under the floor", () => {
  const h = retentionOf({ regimes: ["hipaa"] });
  assert(h.kind === "ok" && h.value.years === 6 && h.value.setBy === "hipaa" && h.value.floor === 6 && h.value.unresolved.length === 0);
  const g = retentionOf({ regimes: ["gdpr", "hipaa", "made-up"] });
  assert(g.kind === "ok" && g.value.years === 6 && g.value.unresolved.join() === "gdpr,made-up");
  const none = retentionOf({ regimes: [] });
  assert(none.kind === "ok" && none.value.years === DEFAULT_RETENTION_YEARS && none.value.setBy === "default" && none.value.floor === 0);
  const longer = retentionOf({ regimes: ["hipaa"], overrideYears: 10 });
  assert(longer.kind === "ok" && longer.value.years === 10 && longer.value.setBy === "override");
  const shorter = retentionOf({ regimes: ["hipaa"], overrideYears: 3 });
  assert(shorter.kind === "err" && shorter.error.kind === "below-floor" && shorter.error.floor === 6);
  const free = retentionOf({ regimes: ["gdpr"], overrideYears: 2 });
  assert(free.kind === "ok" && free.value.years === 2, "an unread rule sets no floor");
  for (const bad of [0, -1, 1.5]) assert(retentionOf({ regimes: [], overrideYears: bad }).kind === "err", String(bad));
  fc.assert(fc.property(fc.integer({ min: 1, max: 40 }), (y) => {
    const r = retentionOf({ regimes: ["hipaa"], overrideYears: y });
    return y >= 6 ? r.kind === "ok" && r.value.years === y : r.kind === "err";
  }));
});

proves(["0003-actor-retention FR-003"], "dropping digests is a record, and never early", () => {
  assertEquals(expiryOf("2020-02-29T10:00:00.000Z", 6), "2026-03-01T10:00:00.000Z");
  assert(!isExpired("2020-06-01T00:00:00Z", "2026-05-31T23:59:59Z", 6) && isExpired("2020-06-01T00:00:00Z", "2026-06-01T00:00:00Z", 6));
  const by = { kind: "system", id: "synthetic-system-01" } as const;
  const early = expire({ digests: ["b".repeat(64)], createdAt: "2021-01-01T00:00:00Z", now: "2026-01-01T00:00:00Z", retention: { years: 6, setBy: "hipaa" }, by });
  assert(early.kind === "err" && early.error.includes("not yet"));
  const empty = expire({ digests: [], createdAt: "2019-01-01T00:00:00Z", now: "2026-01-01T00:00:00Z", retention: { years: 6, setBy: "hipaa" }, by });
  assert(empty.kind === "err");
  const done = expire({ digests: ["c".repeat(64), "b".repeat(64)], createdAt: "2019-01-01T00:00:00Z", now: "2026-01-01T00:00:00Z", retention: { years: 6, setBy: "hipaa" }, by });
  assert(done.kind === "ok" && done.value.digests[0] === "b".repeat(64) && done.value.retentionYears === 6 && done.value.setBy === "hipaa");
});
