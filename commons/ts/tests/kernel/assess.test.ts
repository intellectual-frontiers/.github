/**
 * Tests of `kernel/assess.ts`: coverage rolled up from findings, freshness against ISO 8601 cadences (with its `due` window and calendar
 * months), drift between declared and observed records in key order, the change-impact gate with each of its reasons, the risk register
 * against NIST SP 800-30 Rev. 1's Table I-2 as the publication prints it, and the trace of requirements to mechanisms to evidence.
 *
 * @module
 */
import fc from "fast-check";
import {
  controlCoverage,
  controlFreshness,
  drift,
  evidenceOfFindings,
  fieldChanges,
  formatGateReason,
  freshness,
  gate,
  newestOutcomes,
  RISK_LEVELS,
  RISK_MATRIX,
  riskDecoder,
  type RiskLevel,
  riskLevel,
  riskRegister,
  requirementCoverage,
  trace,
} from "../../kernel/assess.ts";
import {
  addDuration,
  type ControlSummary,
  defineCatalog,
  duration,
  type Finding,
  type Instant,
  instantFromEpochMs,
  instantOf,
  type Outcome,
  roleOf,
} from "../../kernel/grc.ts";
import { type Json, parseJson5 } from "../../kernel/json5.ts";
import { sha256 } from "../../kernel/sha256.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const FR = (n: string): `0007-grc FR-${string}` => `0007-grc FR-${n}`;

function at(text: string): Instant {
  const i = instantOf(text);
  if (i === undefined) throw new Error(`not an instant: ${text}`);
  return i;
}

function role(text: string): NonNullable<ReturnType<typeof roleOf>> {
  const r = roleOf(text);
  if (r === undefined) throw new Error(`not a role: ${text}`);
  return r;
}

const catalog = defineCatalog("demo", "1", [
  { id: "R-1", title: "one" },
  { id: "R-2", title: "two" },
  { id: "R-3", title: "three" },
  { id: "R-4", title: "four" },
  { id: "R-5", title: "five" },
] as const);

const control = (id: string, ...reqs: ("R-1" | "R-2" | "R-3" | "R-4" | "R-5")[]): ControlSummary => ({
  id,
  title: id,
  implements: reqs.map((r) => catalog.control(r)),
  severity: "medium",
  cadence: "P1D",
});

function finding(c: ControlSummary, subject: string, outcome: Outcome, when = "2026-03-01T00:00:00Z"): Finding {
  return {
    control: c,
    subject: { kind: "host", id: subject },
    status: outcome === "accepted" ? "fail" : outcome,
    outcome,
    severity: c.severity,
    title: c.title,
    detail: "",
    evidence: [],
    ...(outcome === "accepted" ? { waiver: "w" } : {}),
    at: at(when),
  };
}

proves([FR("010")], "coverage rolls up per requirement as gap, untested, partial, addressed or covered", () => {
  const covered = control("c-covered", "R-1");
  const partial = control("c-partial", "R-2");
  const addressed = control("c-addressed", "R-3");
  const untested = control("c-untested", "R-4");
  const findings = [
    finding(covered, "a", "pass"),
    finding(covered, "b", "not-applicable"),
    finding(partial, "a", "pass"),
    finding(partial, "b", "fail"),
    finding(addressed, "a", "pass"),
    finding(addressed, "b", "accepted"),
  ];
  const rows = requirementCoverage(catalog, [covered, partial, addressed, untested], findings);
  assertEquals(
    rows.map((r) => [r.requirement.id, r.status, r.outcome, r.controls]),
    [
      ["R-1", "covered", "pass", ["c-covered"]],
      ["R-2", "partial", "fail", ["c-partial"]],
      ["R-3", "addressed", "accepted", ["c-addressed"]],
      ["R-4", "untested", "not-applicable", ["c-untested"]],
      ["R-5", "gap", "not-applicable", []],
    ],
  );
  assertEquals(
    controlCoverage([covered, partial], findings).map((c) => c.status),
    ["covered", "partial"],
  );
  const healed = [...findings, finding(partial, "b", "pass", "2026-03-02T00:00:00Z")];
  assertEquals(requirementCoverage(catalog, [partial], healed)[1]?.status, "covered", "only the newest finding of each subject counts");
});

proves([FR("011")], "freshness against a cadence: fresh, due within its last tenth, stale after; and when it falls due", () => {
  const cadence = duration("P30D");
  const newest = at("2026-03-01T00:00:00Z");
  const after = (days: number): Instant => instantFromEpochMs(Date.parse(newest) + days * 86_400_000) ?? newest;
  assertEquals(freshness(cadence, [newest], after(10)).status, "fresh");
  assertEquals(freshness(cadence, [at("2026-01-01T00:00:00Z"), newest], after(29)), {
    status: "due",
    cadence: "P30D",
    newest,
    dueAt: at("2026-03-31T00:00:00Z"),
    dueFrom: at("2026-03-28T00:00:00Z"),
  });
  assertEquals(freshness(cadence, [newest], after(30)).status, "due");
  assertEquals(freshness(cadence, [newest], after(31)).status, "stale");
  assertEquals(freshness(cadence, [], newest), { status: "stale", cadence: "P30D", newest: null, dueAt: newest, dueFrom: newest });
  assertEquals(freshness(duration("P1Y"), [at("2024-02-29T00:00:00Z")], newest).dueAt, at("2025-02-28T00:00:00Z"));
  assertEquals(addDuration(at("2026-01-31T10:00:00Z"), duration("P1M")), at("2026-02-28T10:00:00Z"));
  assertEquals(addDuration(at("2026-03-01T00:00:00Z"), duration("PT36H")), at("2026-03-02T12:00:00Z"));
  assertEquals(addDuration(at("9999-12-31T00:00:00Z"), duration("P1D")), undefined);
  const rank = { fresh: 0, due: 1, stale: 2 } as const;
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (a, b) => {
      const [x, y] = a <= b ? [a, b] : [b, a];
      assert(
        rank[freshness(cadence, [newest], after(x)).status] <= rank[freshness(cadence, [newest], after(y)).status],
        "freshness only worsens",
      );
    }),
  );
  const fr = controlFreshness(
    [{ id: "c-covered", cadence: duration("P1D") }],
    [finding(control("c-covered"), "a", "pass")],
    at("2026-03-01T23:00:00Z"),
  );
  assertEquals(fr[0]?.freshness.status, "due");
});

proves(
  [FR("012")],
  "drift gives what was added, removed and changed, each change with its field's path and both values, in key order",
  () => {
    const declared: Record<string, Json> = {
      web: { port: 443, tls: { min: "1.2" }, users: ["ops", "deploy"] },
      db: { port: 5432 },
      cache: { port: 6379 },
    };
    const observed = new Map<string, Json>([
      ["web", { port: 443, tls: { min: "1.0", ciphers: "any" }, users: ["ops"] }],
      ["db", { port: 5432 }],
      ["queue", { port: 5672 }],
    ]);
    assertEquals(drift(declared, observed), {
      added: [{ key: "queue", value: { port: 5672 } }],
      removed: [{ key: "cache", value: { port: 6379 } }],
      changed: [
        {
          key: "web",
          changes: [
            { path: ["tls", "ciphers"], field: "$.tls.ciphers", observed: "any" },
            { path: ["tls", "min"], field: "$.tls.min", declared: "1.2", observed: "1.0" },
            { path: ["users", 1], field: "$.users[1]", declared: "deploy" },
          ],
        },
      ],
    });
    assertEquals(fieldChanges({ "a b": 1 }, { "a b": [1] }), [{ path: ["a b"], field: '$["a b"]', declared: 1, observed: [1] }]);
    const asJson = (v: unknown): Json => {
      const r = parseJson5(JSON.stringify(v));
      return r.kind === "ok" ? r.value : null;
    };
    const record = fc.dictionary(fc.string({ maxLength: 4 }), fc.jsonValue({ maxDepth: 2 }).map(asJson), { noNullPrototype: true });
    fc.assert(
      fc.property(record, record, (a, b) => {
        assertEquals(drift(a, a), { added: [], removed: [], changed: [] });
        const ab = drift(a, b);
        const ba = drift(b, a);
        assertEquals(ab.added, ba.removed);
        assertEquals(
          ab.changed.map((c) => c.key),
          ba.changed.map((c) => c.key),
        );
        const keys = [...ab.added, ...ab.removed].map((x) => x.key);
        assertEquals(keys.length, new Set(keys).size);
      }),
    );
  },
);

proves([FR("013")], "a change is blocked where a touched path is declared for a failing control, or a needed review was not given", () => {
  const declarations = [
    { paths: ["infra/**"], controls: ["network", "backups"] },
    { paths: ["**/*.sql"], controls: ["schema"] },
  ];
  const outcomes = new Map<string, Outcome>([
    ["network", "fail"],
    ["backups", "accepted"],
    ["schema", "gap"],
  ]);
  const blocked = gate(declarations, { paths: ["infra/vpc/main.tf", "README.md"] }, outcomes);
  assertEquals(blocked, {
    kind: "blocked",
    touched: [
      { control: "backups", paths: ["infra/vpc/main.tf"] },
      { control: "network", paths: ["infra/vpc/main.tf"] },
    ],
    reasons: [{ kind: "control", control: "network", outcome: "fail", paths: ["infra/vpc/main.tf"] }],
  });
  assert(blocked.kind === "blocked" && formatGateReason(blocked.reasons[0]).includes("network"));
  assertEquals(gate(declarations, { paths: ["docs/a.md"] }, outcomes), { kind: "allowed", touched: [] });
  assertEquals(gate(declarations, { paths: ["db/m.sql"] }, new Map()).kind, "allowed", "a control with no verdict does not block");
  const lead = role("security-lead");
  const review = gate(declarations, { paths: ["docs/a.md"], needsReview: [lead], reviewedBy: [] }, outcomes);
  assertEquals(review, { kind: "blocked", touched: [], reasons: [{ kind: "review", role: lead }] });
  assertEquals(gate(declarations, { paths: ["docs/a.md"], needsReview: [lead], reviewedBy: [lead] }, outcomes).kind, "allowed");
  const both = gate(declarations, { paths: ["db/m.sql", "infra/x"], needsReview: [lead] }, outcomes);
  assertEquals(both.kind === "blocked" ? both.reasons.map((r) => (r.kind === "control" ? r.control : r.role)) : [], [
    "network",
    "schema",
    "security-lead",
  ]);
  const net = control("network");
  assertEquals(
    newestOutcomes([finding(net, "a", "fail"), finding(net, "a", "pass", "2026-03-02T00:00:00Z"), finding(net, "b", "warn")]),
    new Map([["network", "warn"]]),
  );
});

proves([FR("014")], "the level of risk is NIST SP 800-30 Rev. 1 Table I-2, transcribed as the publication prints it", () => {
  // Rows: likelihood from very high to very low; columns: impact from very low to very high (Appendix I, page I-1).
  const table: readonly (readonly [RiskLevel, readonly RiskLevel[]])[] = [
    ["very-high", ["very-low", "low", "moderate", "high", "very-high"]],
    ["high", ["very-low", "low", "moderate", "high", "very-high"]],
    ["moderate", ["very-low", "low", "moderate", "moderate", "high"]],
    ["low", ["very-low", "low", "low", "low", "moderate"]],
    ["very-low", ["very-low", "very-low", "very-low", "low", "low"]],
  ];
  for (const [likelihood, row] of table)
    for (const [i, impact] of RISK_LEVELS.entries()) assertEquals(riskLevel(likelihood, impact), row[i], `${likelihood} x ${impact}`);
  assertEquals(Object.keys(RISK_MATRIX).length, 5);
  assertEquals(riskLevel("high", "very-high"), "very-high");
  const order = (l: RiskLevel): number => RISK_LEVELS.indexOf(l);
  const level = fc.constantFrom(...RISK_LEVELS);
  fc.assert(
    fc.property(level, level, level, (l, a, b) => {
      if (order(a) <= order(b)) assert(order(riskLevel(l, a)) <= order(riskLevel(l, b)), "risk grows with impact");
      if (order(a) <= order(b)) assert(order(riskLevel(a, l)) <= order(riskLevel(b, l)), "risk grows with likelihood");
    }),
  );
});

proves([FR("014")], "a register levels its risks, owned by roles, and reports those past their review date", () => {
  const owner = role("platform-owner");
  const reg = riskRegister(
    [
      { id: "r-b", title: "b", likelihood: "low", impact: "low", treatment: "accept", owner, reviewBy: at("2026-01-01T00:00:00Z") },
      {
        id: "r-a",
        title: "a",
        likelihood: "high",
        impact: "very-high",
        treatment: "mitigate",
        owner,
        reviewBy: at("2026-12-01T00:00:00Z"),
      },
      {
        id: "r-c",
        title: "c",
        likelihood: "moderate",
        impact: "very-high",
        treatment: "transfer",
        owner,
        reviewBy: at("2026-06-01T00:00:00Z"),
      },
    ],
    at("2026-07-01T00:00:00Z"),
  );
  assertEquals(
    reg.risks.map((r) => [r.id, r.level]),
    [
      ["r-a", "very-high"],
      ["r-c", "high"],
      ["r-b", "low"],
    ],
  );
  assertEquals(reg.overdue, [
    { risk: "r-c", owner, reviewBy: at("2026-06-01T00:00:00Z") },
    { risk: "r-b", owner, reviewBy: at("2026-01-01T00:00:00Z") },
  ]);
  const decoded = riskDecoder(
    { id: "r", title: "t", likelihood: "medium", impact: "low", treatment: "accept", owner: "x", reviewBy: "2026-01-01T00:00:00Z" },
    "$[0]",
  );
  assert(decoded.kind === "err" && decoded.error.path === "$[0].likelihood");
  const person = riskDecoder({
    id: "r",
    title: "t",
    likelihood: "low",
    impact: "low",
    treatment: "accept",
    owner: "someone@example.com",
    reviewBy: "2026-01-01T00:00:00Z",
  });
  assert(person.kind === "err" && person.error.path === "$.owner");
});

proves([FR("015")], "a trace relates each requirement to its mechanisms and their evidence, and names those with none", async () => {
  const d1 = await sha256("one");
  const d2 = await sha256("two");
  const t = trace(
    ["REQ-1", "REQ-2", "REQ-3"],
    [
      { id: "m-a", enforces: ["REQ-1", "REQ-2"] },
      { id: "m-b", enforces: ["REQ-1"] },
    ],
    [
      { mechanism: "m-b", digest: d2 },
      { mechanism: "m-b", digest: d1 },
      { mechanism: "m-b", digest: d2 },
    ],
  );
  assertEquals(t.requirements[0], {
    requirement: "REQ-1",
    status: "proven",
    mechanisms: [
      { id: "m-a", evidence: [] },
      { id: "m-b", evidence: [d1, d2].sort() },
    ],
  });
  assertEquals(t.unproven, [
    { requirement: "REQ-2", reason: "unevidenced" },
    { requirement: "REQ-3", reason: "unenforced" },
  ]);
  // @ts-expect-error REQ-9 is not one of the requirements traced
  trace(["REQ-1"], [{ id: "m", enforces: ["REQ-9"] }], []);
  const c = control("c-covered");
  assertEquals(evidenceOfFindings([{ ...finding(c, "a", "pass"), evidence: [d1] }]), [{ mechanism: "c-covered", digest: d1 }]);
});
