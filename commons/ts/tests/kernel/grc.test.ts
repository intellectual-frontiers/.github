/**
 * Tests of `kernel/grc.ts`: catalogs whose unknown ids do not compile and crosswalks typed by both ends, packs that run every control over
 * every subject (a throwing check `error` for its subject alone), the join-semilattice of outcomes property-tested, findings and their
 * sections, waivers refused, expired, applied and never applied to `error` or `gap`, and the instants, durations, roles and globs they use.
 *
 * @module
 */
import fc from "fast-check";
import {
  applyWaivers,
  byControl,
  byOutcome,
  byRequirement,
  type CatalogIds,
  type Checked,
  compareOutcomeKeys,
  type ControlRef,
  defineCatalog,
  defineControl,
  defineCrosswalk,
  definePack,
  defineWaiver,
  duration,
  type Finding,
  findingKey,
  glob,
  type Instant,
  instantOf,
  invertCrosswalk,
  join,
  joinAll,
  maxSeverity,
  type Outcome,
  OUTCOMES,
  parseDuration,
  roleOf,
  runPack,
  sections,
  type Status,
  STATUSES,
  verdict,
  type Waiver,
  waiverDecoder,
  waiverState,
} from "../../kernel/grc.ts";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type Equal, expectType } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertThrows, proves } from "@intellectual-frontiers/test";

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

const alpha = defineCatalog("alpha", "2.0", [
  { id: "AL-1", title: "Inventory of assets" },
  { id: "AL-2", title: "Encryption at rest", group: "data" },
  { id: "AL-3", title: "Access review" },
] as const);
const beta = defineCatalog("beta", "1.1", [
  { id: "B.1", title: "Know what you run" },
  { id: "B.2", title: "Protect stored data" },
] as const);

type Host = { readonly name: string; readonly encrypted: boolean | "unknown"; readonly explode?: boolean };

const encryption = defineControl({
  id: "disk-encryption",
  title: "Disks are encrypted",
  implements: [alpha.control("AL-2"), beta.control("B.2")],
  severity: "high",
  cadence: duration("P1D"),
  remediation: "turn on full-disk encryption",
  check: (h: Host): Checked => {
    if (h.explode === true) throw new Error(`cannot read ${h.name}`);
    if (h.encrypted === "unknown") return verdict("gap", { detail: "no evidence of the disk's state" });
    return verdict(h.encrypted ? "pass" : "fail");
  },
});
const inventory = defineControl({
  id: "inventory",
  title: "Hosts are inventoried",
  implements: [alpha.control("AL-1")],
  severity: "low",
  cadence: duration("P30D"),
  check: async (h: Host): Promise<Checked> => {
    await Promise.resolve();
    if (h.name === "rejects") return Promise.reject(new Error("the inventory is down"));
    return h.name.startsWith("lab-") ? [] : [verdict("pass"), verdict("warn", { title: "tag missing", severity: "medium" })];
  },
});
const pack = definePack({
  id: "hosts",
  title: "Hosts",
  subjectKind: "host",
  subjectId: (h: Host) => h.name,
  controls: [encryption, inventory],
});
const T0 = at("2026-03-15T12:00:00Z");

proves([FR("001")], "a catalog is a typed constant: an id it does not hold does not compile, and its entries keep their fields", () => {
  assertEquals(alpha.control("AL-1"), { catalog: "alpha", id: "AL-1" });
  assertEquals(alpha.get("AL-2").group, "data");
  assertEquals(alpha.ids, ["AL-1", "AL-2", "AL-3"]);
  assert(alpha.has("AL-3") && !alpha.has("XX-99"));
  expectType<Equal<CatalogIds<typeof alpha>, "AL-1" | "AL-2" | "AL-3">>();
  expectType<Equal<ReturnType<typeof alpha.control<"AL-1">>, ControlRef<"alpha", "AL-1">>>();
  // @ts-expect-error XX-99 is not a control of the alpha catalog
  alpha.control("XX-99");
  // @ts-expect-error a beta id is not an alpha id
  alpha.get("B.1");
  assertThrows(
    () =>
      defineCatalog("dup", "1", [
        { id: "A", title: "a" },
        { id: "A", title: "again" },
      ] as const),
    Error,
    "twice",
  );
});

proves(
  [FR("001")],
  "a crosswalk's mappings are STRM relationships with a strength, each end typed by its catalog, and read backwards",
  () => {
    const walk = defineCrosswalk(alpha, beta, [
      { from: "AL-1", to: "B.1", relationship: "equal", strength: 10 },
      { from: "AL-2", to: "B.2", relationship: "subset-of", strength: 7, rationale: "rest only" },
      { from: "AL-3", to: "B.1", relationship: "no-relationship", strength: 1 },
    ]);
    assertEquals(walk.from, { catalog: "alpha", version: "2.0" });
    assertEquals(walk.mappings[1], {
      from: { catalog: "alpha", id: "AL-2" },
      to: { catalog: "beta", id: "B.2" },
      relationship: "subset-of",
      strength: 7,
      rationale: "rest only",
    });
    const back = invertCrosswalk(walk);
    assertEquals(back.to.catalog, "alpha");
    assertEquals(
      back.mappings.map((m) => [m.from.id, m.relationship, m.to.id]),
      [
        ["B.1", "equal", "AL-1"],
        ["B.2", "superset-of", "AL-2"],
        ["B.1", "no-relationship", "AL-3"],
      ],
    );
    expectType<Equal<(typeof walk.mappings)[number]["to"], ControlRef<"beta", "B.1" | "B.2">>>();
    // @ts-expect-error B.9 is not a control of the beta catalog
    defineCrosswalk(alpha, beta, [{ from: "AL-1", to: "B.9", relationship: "equal", strength: 10 }]);
    // @ts-expect-error a strength is from 1 to 10
    defineCrosswalk(alpha, beta, [{ from: "AL-1", to: "B.1", relationship: "equal", strength: 11 }]);
    // @ts-expect-error "covers" is not an STRM relationship
    defineCrosswalk(alpha, beta, [{ from: "AL-1", to: "B.1", relationship: "covers", strength: 5 }]);
  },
);

proves([FR("002")], "a pack runs every control over every subject; a check that throws is error for that subject alone", async () => {
  const hosts: Host[] = Array.from({ length: 10 }, (_, i) => ({ name: `h${i}`, encrypted: i % 2 === 0, explode: i === 3 }));
  const run = await runPack(pack, hosts, { at: T0 });
  const enc = run.findings.filter((f) => f.control.id === "disk-encryption");
  assertEquals(enc.length, 10);
  assertEquals(
    enc.map((f) => f.status),
    ["pass", "fail", "pass", "error", "pass", "fail", "pass", "fail", "pass", "fail"],
  );
  assert(enc[3]?.detail.includes("cannot read h3"));
  assertEquals(run.findings.filter((f) => f.control.id === "inventory").length, 20);
  assertEquals(run.subjects[0], { kind: "host", id: "h0" });
  assertEquals(
    run.controls.map((c) => [c.id, c.cadence]),
    [
      ["disk-encryption", "P1D"],
      ["inventory", "P30D"],
    ],
  );
  const odd = await runPack(
    pack,
    [
      { name: "rejects", encrypted: true },
      { name: "lab-1", encrypted: true },
    ],
    { at: T0 },
  );
  assertEquals(
    odd.findings.map((f) => [f.control.id, f.subject.id, f.status]),
    [
      ["disk-encryption", "rejects", "pass"],
      ["disk-encryption", "lab-1", "pass"],
      ["inventory", "rejects", "error"],
      ["inventory", "lab-1", "not-applicable"],
    ],
  );
  assertThrows(() => definePack({ ...pack, controls: [encryption, encryption] }), Error, "twice");
  // @ts-expect-error a control of hosts is not a control of numbers
  definePack({ id: "n", title: "n", subjectKind: "n", subjectId: (n: number) => String(n), controls: [encryption] });
});

const outcome = fc.constantFrom(...OUTCOMES);

proves(
  [FR("003")],
  "join is a join-semilattice: associative, commutative, idempotent, not-applicable its identity, pass the identity of the applicable",
  () => {
    fc.assert(
      fc.property(outcome, outcome, outcome, (a, b, c) => {
        assertEquals(join(join(a, b), c), join(a, join(b, c)));
        assertEquals(join(a, b), join(b, a));
        assertEquals(join(a, a), a);
        assertEquals(join(a, "not-applicable"), a);
        if (a !== "not-applicable") assertEquals(join(a, "pass"), a);
        const j = join(a, b);
        assert(join(j, a) === j && join(j, b) === j, "the join is an upper bound of both");
      }),
    );
    const withShuffle = fc
      .array(outcome)
      .chain((xs) => fc.tuple(fc.constant(xs), fc.shuffledSubarray(xs, { minLength: xs.length, maxLength: xs.length })));
    fc.assert(fc.property(withShuffle, ([xs, shuffled]) => assertEquals(joinAll(shuffled), joinAll(xs))));
  },
);

proves([FR("003")], "the order is not-applicable < pass < accepted < warn < gap < fail < error; statuses join to a status", () => {
  for (let i = 0; i < OUTCOMES.length; i++)
    for (let j = i; j < OUTCOMES.length; j++) {
      const lo = OUTCOMES[i];
      const hi = OUTCOMES[j];
      if (lo !== undefined && hi !== undefined) assertEquals(join(lo, hi), hi);
    }
  assertEquals(join<Outcome>("fail", "pass"), "fail");
  assertEquals(join<Outcome>("pass", "not-applicable"), "pass");
  assertEquals(joinAll([]), "not-applicable");
  assertEquals(STATUSES.length, 6);
  const s: Status = "warn";
  expectType<Equal<ReturnType<typeof join<Status>>, Status>>();
  // @ts-expect-error accepted is an outcome, never a status a check gives
  verdict("accepted");
  void s;
  assertEquals(maxSeverity("low", "critical"), "critical");
  assertEquals(maxSeverity("info", "info"), "info");
});

proves(
  [FR("004")],
  "a finding carries the control, subject, status and outcome, severity, title, detail, evidence, remediation and time",
  async () => {
    const digest = await sha256("evidence");
    const withEvidence = defineControl({
      ...encryption,
      check: (h: Host) => verdict(h.encrypted === true ? "pass" : "fail", { detail: `${h.name} disk`, evidence: [digest] }),
    });
    const run = await runPack(definePack({ ...pack, controls: [withEvidence, inventory] }), [{ name: "h1", encrypted: false }], { at: T0 });
    const f = run.findings[0];
    assertEquals(f, {
      control: {
        id: "disk-encryption",
        title: "Disks are encrypted",
        implements: [
          { catalog: "alpha", id: "AL-2" },
          { catalog: "beta", id: "B.2" },
        ],
        severity: "high",
        cadence: "P1D",
      },
      subject: { kind: "host", id: "h1" },
      status: "fail",
      outcome: "fail",
      severity: "high",
      title: "Disks are encrypted",
      detail: "h1 disk",
      evidence: [digest],
      remediation: "turn on full-disk encryption",
      at: T0,
    });
    assertEquals(run.findings[2]?.severity, "medium");
    assertEquals(run.findings[2]?.title, "tag missing");
    assert(f !== undefined && findingKey(f) === JSON.stringify(["disk-encryption", "host", "h1"]));
  },
);

proves([FR("004")], "findings group into sections by a pure function, each with the join and the counts of its outcomes", async () => {
  const run = await runPack(
    pack,
    [
      { name: "a", encrypted: true },
      { name: "b", encrypted: false },
      { name: "c", encrypted: "unknown" },
    ],
    { at: T0 },
  );
  const byC = sections(run.findings, byControl);
  assertEquals(
    byC.map((s) => [s.key, s.outcome, s.findings.length]),
    [
      ["disk-encryption", "fail", 3],
      ["inventory", "warn", 6],
    ],
  );
  assertEquals(byC[0]?.counts, { "not-applicable": 0, pass: 1, accepted: 0, warn: 0, gap: 1, fail: 1, error: 0 });
  assertEquals(
    sections(run.findings, byOutcome, compareOutcomeKeys).map((s) => s.key),
    ["fail", "gap", "warn", "pass"],
  );
  assertEquals(
    sections(run.findings, byRequirement).map((s) => [s.key, s.findings.length]),
    [
      ["alpha:AL-1", 6],
      ["alpha:AL-2", 3],
      ["beta:B.2", 3],
    ],
  );
  assertEquals(sections(run.findings, byControl), sections(run.findings, byControl));
});

const security = role("security-lead");
const waiverOf = (fields: Partial<Waiver> = {}): Waiver => {
  const w = defineWaiver({
    id: "w-1",
    control: "disk-encryption",
    subjects: ["web-*"],
    reason: "hardware replaced next quarter",
    approvedBy: security,
    grantedAt: at("2026-03-01T00:00:00Z"),
    expiresAt: at("2026-03-31T00:00:00Z"),
    ...fields,
  });
  if (w.kind === "err") throw new Error(w.error.kind);
  return w.value;
};

proves([FR("005")], "a waiver with no expiry, or an expiry before its grant, is refused", () => {
  const base = { id: "w", control: "c", subjects: ["s"], reason: "r", approvedBy: security, grantedAt: at("2026-03-01T00:00:00Z") };
  assertEquals(defineWaiver(base), { kind: "err", error: { kind: "no-expiry", waiver: "w" } });
  assertEquals(defineWaiver({ ...base, expiresAt: at("2026-02-01T00:00:00Z") }), {
    kind: "err",
    error: { kind: "expires-before-grant", waiver: "w" },
  });
  assertEquals(defineWaiver({ ...base, expiresAt: base.grantedAt }).kind, "err");
  assertEquals(defineWaiver({ ...base, subjects: [], expiresAt: at("2026-04-01T00:00:00Z") }).kind, "err");
  assertEquals(defineWaiver({ ...base, expiresAt: at("2026-04-01T00:00:00Z") }).kind, "ok");
  assertEquals(roleOf("someone@example.com"), undefined);
  const decoded = waiverDecoder({ ...base, approvedBy: "security-lead" }, "$.waivers[0]");
  assert(decoded.kind === "err" && decoded.error.path === "$.waivers[0]" && decoded.error.found.includes("no expiry"));
  const bad = waiverDecoder({ ...base, grantedAt: "1 March" }, "$.waivers[1]");
  assert(bad.kind === "err" && bad.error.path === "$.waivers[1].grantedAt");
});

proves(
  [FR("005")],
  "an applying waiver turns fail or warn into accepted and keeps its id; never error or gap; an expired one does not apply",
  async () => {
    const hosts: Host[] = [
      { name: "web-1", encrypted: false },
      { name: "web-2", encrypted: "unknown" },
      { name: "web-3", encrypted: true, explode: true },
      { name: "db-1", encrypted: false },
    ];
    const w = waiverOf();
    const during = await runPack(pack, hosts, { at: at("2026-03-15T00:00:00Z") }, { waivers: [w] });
    const enc = (fs: readonly Finding[]): readonly (readonly [string, Outcome, string | undefined])[] =>
      fs.filter((f) => f.control.id === "disk-encryption").map((f) => [f.subject.id, f.outcome, f.waiver] as const);
    assertEquals(enc(during.findings), [
      ["web-1", "accepted", "w-1"],
      ["web-2", "gap", undefined],
      ["web-3", "error", undefined],
      ["db-1", "fail", undefined],
    ]);
    assertEquals(during.findings[0]?.status, "fail");
    const april = at("2026-04-01T00:00:00Z");
    assertEquals(waiverState(w, april), "expired");
    assertEquals(waiverState(w, at("2026-02-01T00:00:00Z")), "pending");
    assertEquals(enc(applyWaivers(during.findings, [w], april))[0], ["web-1", "fail", undefined]);
    const warns = applyWaivers(
      during.findings,
      [waiverOf({ id: "w-2", control: "inventory", subjects: ["db-1"] })],
      at("2026-03-20T00:00:00Z"),
    );
    assertEquals(
      warns.filter((f) => f.control.id === "inventory" && f.subject.id === "db-1").map((f) => [f.status, f.outcome, f.waiver]),
      [
        ["pass", "pass", undefined],
        ["warn", "accepted", "w-2"],
      ],
    );
  },
);

proves([FR("005"), FR("013")], "a glob's ** crosses folders, * and ? stay within one, everything else is itself", () => {
  const g = glob("infra/**");
  assert(g.test("infra/a") && g.test("infra/a/b.tf") && !g.test("infrastructure/a"));
  assert(glob("**/*.tf").test("main.tf") && glob("**/*.tf").test("a/b/main.tf") && !glob("**/*.tf").test("a/main.tfx"));
  assert(glob("web-?").test("web-1") && !glob("web-?").test("web-10") && !glob("src/*.ts").test("src/a/b.ts"));
  assert(glob("a+b(c).txt").test("a+b(c).txt") && !glob("a.b").test("axb"));
});

proves([FR("011")], "an instant is ISO 8601 with a zone, normalized to UTC with milliseconds; impossible dates are not instants", () => {
  assertEquals(instantOf("2026-03-01T01:30:00+01:30"), "2026-03-01T00:00:00.000Z");
  assertEquals(instantOf("2024-02-29T00:00:00.123456Z"), "2024-02-29T00:00:00.123Z");
  for (const bad of ["2025-02-29T00:00:00Z", "2026-03-01T24:00:00Z", "2026-03-01", "2026-03-01T00:00:00", "2026-13-01T00:00:00Z", "x"])
    assertEquals(instantOf(bad), undefined, bad);
  assertEquals(instantOf("0001-01-01T00:00:00Z"), "0001-01-01T00:00:00.000Z");
  fc.assert(
    fc.property(fc.date({ min: new Date("0001-01-01T00:00:00Z"), max: new Date("9999-12-31T23:59:59Z"), noInvalidDate: true }), (d) =>
      assertEquals(instantOf(d.toISOString()), d.toISOString()),
    ),
  );
  assertEquals(parseDuration("P1Y2M3W4DT5H6M7.5S"), {
    kind: "ok",
    value: { text: "P1Y2M3W4DT5H6M7.5S", years: 1, months: 2, weeks: 3, days: 4, hours: 5, minutes: 6, seconds: 7.5 },
  });
  for (const bad of ["P", "PT", "P1H", "1D", "P1DT", "P-1D", "p1d"]) assertEquals(parseDuration(bad).kind, "err", bad);
  assertThrows(() => duration("one day"), Error, "duration");
});
