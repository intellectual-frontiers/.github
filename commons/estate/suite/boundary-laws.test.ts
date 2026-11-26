/**
 * The laws of the algebra of boundaries (commons estate 0010-estate-boundaries FR-011, FR-040, FR-041), each one a named property test with generated assets, selectors, links and boundaries. Every name is made up
 * (`synthetic-asset-NN`, `synthetic-boundary-NN`), and nothing reads a clock, a file or the network.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  BOTTOM,
  DATA_CLASSES,
  IMPACTS,
  outOfScope,
  parseBoundaryId,
  parseExternalSystemId,
  parseInterconnectionId,
  parsePrincipalId,
  sel,
  type AnyBoundary,
  type AssetFacts,
  type Boundary,
  type Categorization,
  type Selector,
  actsByRole,
  PERSON_ROLES_OF,
  ROLES_OF,
} from "../src/governance/boundaries.ts";
import { parseAssetId, type AssetId } from "../src/governance/ids.ts";
import {
  apply,
  approve,
  boundaryAsOf,
  categorizationOf,
  classify,
  closureOf,
  compose,
  coverageOf,
  crossings,
  crossingsBetween,
  decide,
  diff,
  dispositionOf,
  findingsOf,
  foldJournal,
  hasPartCycle,
  invert,
  join,
  meet,
  membersOf,
  overlapOf,
  permits,
  planOf,
  select,
  unscopedOf,
  verified,
  atMost,
  type AssetLink,
  type JournalEntry,
} from "../src/logical/boundaries.ts";

const must = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }): T => {
  if (r.kind === "err") throw new Error(String(r.error));
  return r.value;
};
const aid = (n: number): AssetId => must(parseAssetId(`synthetic-asset-${String(n).padStart(2, "0")}`));
const bid = (n: number) => must(parseBoundaryId(`synthetic-boundary-${String(n).padStart(2, "0")}`));
const who = must(parsePrincipalId("synthetic-person-01"));
const other = must(parsePrincipalId("synthetic-person-02"));
const AT = "2026-01-01T00:00:00.000Z";
const LATER = "2026-06-01T00:00:00.000Z";
const SEED = 20261126;
const jeq = (x: unknown, y: unknown): boolean => JSON.stringify(x) === JSON.stringify(y);
const RUNS = { seed: SEED, numRuns: 60 };

const kindArb = fc.constantFrom("server", "network-device", "cloud-account");
const tagArb = fc.subarray(["a", "b", "c"]);
const factsArb: fc.Arbitrary<AssetFacts> = fc.record({
  n: fc.integer({ min: 0, max: 11 }),
  kind: kindArb,
  tags: tagArb,
  realm: fc.option(fc.constantFrom("r1", "r2"), { nil: undefined }),
  segment: fc.option(fc.constantFrom("s1", "s2"), { nil: undefined }),
  owner: fc.option(fc.constantFrom("o1", "o2"), { nil: undefined }),
  dataClasses: fc.subarray([...DATA_CLASSES].slice(0, 4)),
  location: fc.option(fc.constantFrom("US", "DE"), { nil: undefined }),
  sources: fc.subarray(["x", "y"]),
}).map((r): AssetFacts => ({
  id: aid(r.n),
  kind: r.kind,
  tags: r.tags,
  dataClasses: r.dataClasses,
  sources: r.sources,
  ...(r.realm === undefined ? {} : { realm: r.realm }),
  ...(r.segment === undefined ? {} : { segment: r.segment }),
  ...(r.owner === undefined ? {} : { owner: r.owner }),
  ...(r.location === undefined ? {} : { location: r.location }),
}));
const universeArb = fc.array(factsArb, { maxLength: 12 }).map((xs) => [...new Map(xs.map((x) => [x.id, x])).values()]);

const atomArb: fc.Arbitrary<Selector> = fc.oneof(
  fc.constantFrom("server", "network-device").map(sel.class),
  fc.constantFrom("a", "b", "c").map(sel.tag),
  fc.constantFrom("r1", "r2").map(sel.realm),
  fc.constantFrom("s1", "s2").map(sel.segment),
  fc.constantFrom("o1", "o2").map(sel.owner),
  fc.constantFrom("US", "DE").map(sel.location),
  fc.constantFrom("x", "y").map(sel.source),
  fc.integer({ min: 0, max: 11 }).map((n) => sel.id(aid(n))),
);
const selArb: fc.Arbitrary<Selector> = fc.letrec<{ s: Selector }>((tie) => ({
  s: fc.oneof(
    { depthSize: "small", maxDepth: 3 },
    atomArb,
    fc.array(tie("s"), { maxLength: 3 }).map((of) => sel.and(...of)),
    fc.array(tie("s"), { maxLength: 3 }).map((of) => sel.or(...of)),
    tie("s").map(sel.not),
  ),
})).s;

const same = (a: readonly string[], b: readonly string[]): boolean => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const inter = (a: readonly string[], b: readonly string[]) => a.filter((x) => b.includes(x));
const uni = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];

proves(["0010-estate-boundaries FR-011", "0010-estate-boundaries FR-040"], "selectors form a Boolean algebra of sets: commutative, associative, idempotent, with identities, absorption, double negation and De Morgan's laws", () => {
  fc.assert(
    fc.property(universeArb, selArb, selArb, selArb, (u, a, b, c) => {
      const S = (s: Selector) => select(s, u);
      assert(same(S(sel.and(a, b)), S(sel.and(b, a))) && same(S(sel.or(a, b)), S(sel.or(b, a))), "commutative");
      assert(same(S(sel.and(sel.and(a, b), c)), S(sel.and(a, sel.and(b, c)))) && same(S(sel.or(sel.or(a, b), c)), S(sel.or(a, sel.or(b, c)))), "associative");
      assert(same(S(sel.and(a, a)), S(a)) && same(S(sel.or(a, a)), S(a)), "idempotent");
      assert(same(S(sel.and()), u.map((x) => x.id)) && S(sel.or()).length === 0, "the empty and is every asset, the empty or none");
      assert(same(S(sel.and(a, sel.or(a, b))), S(a)) && same(S(sel.or(a, sel.and(a, b))), S(a)), "absorption");
      assert(same(S(sel.not(sel.not(a))), S(a)), "double negation");
      assert(same(S(sel.not(sel.and(a, b))), S(sel.or(sel.not(a), sel.not(b)))) && same(S(sel.not(sel.or(a, b))), S(sel.and(sel.not(a), sel.not(b)))), "De Morgan");
      assert(same(S(sel.and(a, b)), inter(S(a), S(b))) && same(S(sel.or(a, b)), uni(S(a), S(b))), "and is the intersection and or the union");
      assert(same(S(sel.not(a)), u.map((x) => x.id).filter((x) => !S(a).includes(x))), "not is the complement in the estate");
    }),
    RUNS,
  );
});

const emptyBoundary = (n: number, over: Partial<Boundary<"organizational">> = {}): Boundary<"organizational"> => ({
  id: bid(n),
  kind: "organizational",
  name: `synthetic boundary ${n}`,
  owner: who,
  roles: { owner: [who] },
  categorization: BOTTOM,
  include: sel.or(),
  exclude: sel.or(),
  overrides: [],
  decisions: [],
  parents: [],
  constraints: [],
  interconnections: [],
  inheritances: [],
  accepted: [],
  version: 1,
  ...over,
});

proves(["0010-estate-boundaries FR-011"], "membership does not depend on the order of the assets or the selectors, is a subset of the include plus the overrides that add, keeps out the excluded, and an override beats a selector", () => {
  fc.assert(
    fc.property(universeArb, selArb, selArb, fc.integer({ min: 0, max: 11 }), (u, inc, exc, n) => {
      const b = emptyBoundary(1, { include: inc, exclude: exc });
      const m = membersOf(b, u);
      assertEquals(membersOf(b, [...u].reverse()), m);
      assert(same(membersOf(emptyBoundary(1, { include: sel.or(inc, sel.or()), exclude: sel.and(exc, exc) }), u), m), "the form of the selector does not matter");
      const included = select(inc, u);
      assert(m.every((x) => included.includes(x)), "a subset of the include");
      const excluded = select(exc, u);
      assert(m.every((x) => !excluded.includes(x)), "no member is excluded");
      const add = emptyBoundary(1, { include: inc, exclude: exc, overrides: [{ asset: aid(n), effect: "add", by: who, at: AT, reason: "the owner says so" }] });
      assert(membersOf(add, u).includes(aid(n)) === u.some((x) => x.id === aid(n)), "an override that adds beats an exclusion");
      const remove = emptyBoundary(1, { include: inc, exclude: exc, overrides: [{ asset: aid(n), effect: "remove", by: who, at: AT, reason: "the owner says so" }] });
      assert(!membersOf(remove, u).includes(aid(n)), "an override that removes beats an inclusion");
    }),
    RUNS,
  );
});

proves(["0010-estate-boundaries FR-011"], "a disposition is total and single-valued, an asset not mentioned is undecided, and coverage is one exactly when no member is undecided", () => {
  fc.assert(
    fc.property(universeArb, fc.array(fc.integer({ min: 0, max: 11 }), { maxLength: 8 }), (u, decided) => {
      const base = emptyBoundary(1, { include: sel.and() });
      const decisions = decided.map((n, i) => ({ asset: aid(n), disposition: { t: "in-scope", role: "owned" } as const, by: who, at: `2026-01-0${(i % 9) + 1}T00:00:00.000Z` }));
      const b = emptyBoundary(1, { include: sel.and(), decisions });
      for (const a of u) assert(["in-scope", "undecided"].includes(dispositionOf(b, a.id).t));
      assertEquals(dispositionOf(base, aid(0)).t, "undecided");
      const c = coverageOf(b, u);
      assert((c.ratio === 1) === (c.undecided.length === 0), "one exactly when none is undecided");
      assert(c.decided + c.undecided.length === c.members);
    }),
    RUNS,
  );
  const conflicting = emptyBoundary(1, {
    include: sel.and(),
    decisions: [
      { asset: aid(1), disposition: { t: "in-scope", role: "owned" }, by: who, at: "2026-01-01T00:00:00.000Z" },
      { asset: aid(1), disposition: { t: "in-scope", role: "leased" }, by: who, at: "2026-02-01T00:00:00.000Z" },
    ],
  });
  assertEquals(dispositionOf(conflicting, aid(1)), { t: "in-scope", role: "leased" });
});

proves(["0010-estate-boundaries FR-011"], "overlap is computed: both, one and not the other, and unscoped assets are those no boundary decides; a fleet with no boundary leaves every asset unscoped", () => {
  fc.assert(
    fc.property(universeArb, selArb, selArb, (u, i1, i2) => {
      const dec = (inc: Selector) => ({ include: inc, decisions: u.map((a) => ({ asset: a.id, disposition: { t: "in-scope", role: "owned" } as const, by: who, at: AT })) });
      const a = emptyBoundary(1, dec(i1));
      const b = emptyBoundary(2, dec(i2));
      const o = overlapOf(a, b, u);
      assert(same(o.both, inter(select(i1, u), select(i2, u))));
      assert(same(uni(o.both, o.onlyA), select(i1, u)) && same(uni(o.both, o.onlyB), select(i2, u)));
      assertEquals(unscopedOf({ boundaries: [] }, u).length, u.length);
      assert(same(unscopedOf({ boundaries: [a, b] }, u), u.map((x) => x.id).filter((x) => !select(i1, u).includes(x) && !select(i2, u).includes(x))));
    }),
    RUNS,
  );
});

proves(["0010-estate-boundaries FR-011"], "nesting: a part whose members are within its whole raises no finding, an asset outside raises part-outside-whole, and a cycle of parts is refused", () => {
  const u: AssetFacts[] = [1, 2, 3].map((n) => ({ id: aid(n), kind: "server", tags: [], dataClasses: [], sources: [] }));
  const dec = (ids: readonly number[]) => ids.map((n) => ({ asset: aid(n), disposition: { t: "in-scope", role: "owned" } as const, by: who, at: AT }));
  const whole = emptyBoundary(1, { include: sel.or(sel.id(aid(1)), sel.id(aid(2))), decisions: dec([1, 2]) });
  const inside = emptyBoundary(2, { include: sel.id(aid(1)), decisions: dec([1]), parents: [bid(1)] });
  const outside = emptyBoundary(3, { include: sel.id(aid(3)), decisions: dec([3]), parents: [bid(1)] });
  assertEquals(findingsOf(inside, u, [], AT, { boundaries: [whole] }).filter((f) => f.kind === "part-outside-whole").length, 0);
  assertEquals(findingsOf(outside, u, [], AT, { boundaries: [whole] }).filter((f) => f.kind === "part-outside-whole").map((f) => f.subject), [aid(3)]);
  const a = emptyBoundary(4, { parents: [bid(5)] });
  const b = emptyBoundary(5, { parents: [bid(4)] });
  assert(hasPartCycle({ boundaries: [a, b] }) && !hasPartCycle({ boundaries: [whole, inside] }));
});

const catArb: fc.Arbitrary<Categorization> = fc.record({ confidentiality: fc.constantFrom(...IMPACTS), integrity: fc.constantFrom(...IMPACTS), availability: fc.constantFrom(...IMPACTS) });

proves(["0010-estate-boundaries FR-006", "0010-estate-boundaries FR-011"], "categorization is a bounded join-semilattice: join is commutative, associative and idempotent with the bottom as identity, and adding a type never lowers an objective", () => {
  fc.assert(
    fc.property(catArb, catArb, catArb, fc.array(catArb, { maxLength: 5 }), (a, b, c, types) => {
      assert(jeq(join(a, b), join(b, a)));
      assert(jeq(join(join(a, b), c), join(a, join(b, c))));
      assert(jeq(join(a, a), a));
      assert(jeq(join(a, BOTTOM), a));
      assert(jeq(meet(a, a), a));
      assert(atMost(a, join(a, b)) && atMost(meet(a, b), a));
      assert(atMost(categorizationOf(types), categorizationOf([...types, a])), "adding a type never lowers an objective");
      assert(jeq(categorizationOf(types), types.reduce(join, BOTTOM)));
    }),
    RUNS,
  );
});

const linkArb = fc.record({ f: fc.integer({ min: 0, max: 11 }), t: fc.integer({ min: 0, max: 11 }) }).map((r): AssetLink => ({ from: aid(r.f), to: aid(r.t), kind: "network" }));

proves(["0010-estate-boundaries FR-011"], "crossings are symmetric, no link between two members is one, and a link between a member and a non-member is exactly one", () => {
  fc.assert(
    fc.property(universeArb, selArb, selArb, fc.array(linkArb, { maxLength: 10 }), (u, i1, i2, links) => {
      const dec = (inc: Selector) => ({ include: inc, decisions: u.map((a) => ({ asset: a.id, disposition: { t: "in-scope", role: "owned" } as const, by: who, at: AT })) });
      const a = emptyBoundary(1, dec(i1));
      const b = emptyBoundary(2, dec(i2));
      assertEquals(crossingsBetween(a, b, u, links), crossingsBetween(b, a, u, links));
      const ids = new Set(u.map((x) => x.id));
      const members = new Set(membersOf(a, u));
      const cs = crossings(a, u, links);
      for (const l of links) {
        const f = members.has(l.from);
        const t = members.has(l.to);
        const n = cs.filter((c) => c.link === l).length;
        if (f === t) assertEquals(n, 0);
        else assertEquals(n, 1);
      }
      assert(cs.every((c) => ids.has(c.inside)));
    }),
    RUNS,
  );
});

proves(["0010-estate-boundaries FR-011", "0010-estate-boundaries FR-014"], "findings are monotone: approving an interconnection never adds an unapproved crossing, and removing a link never adds a finding", () => {
  const u: AssetFacts[] = [1, 2, 3].map((n) => ({ id: aid(n), kind: "server", tags: [], dataClasses: [], sources: [] }));
  const ext = must(parseExternalSystemId("synthetic-provider-01"));
  const ic = (approved: boolean) => ({ id: must(parseInterconnectionId("synthetic-link-01")), from: { t: "boundary", id: bid(1) } as const, to: { t: "external", id: ext } as const, direction: "two-way" as const, dataClasses: [], protocols: ["https"], agreement: "service-level-agreement" as const, reviewEveryDays: 365, ...(approved ? { approvedBy: who, approvedAt: AT } : {}) });
  const base = emptyBoundary(1, {
    include: sel.or(sel.id(aid(1)), sel.id(aid(2))),
    decisions: [
      { asset: aid(1), disposition: { t: "in-scope", role: "owned" }, by: who, at: AT },
      { asset: aid(2), disposition: { t: "in-scope", role: "owned" }, by: who, at: AT },
      { asset: aid(3), disposition: { t: "external", system: ext }, by: who, at: AT },
    ],
  });
  const links: AssetLink[] = [{ from: aid(2), to: aid(3), kind: "network" }];
  const unapproved = (b: Boundary<"organizational">, l: readonly AssetLink[]) => findingsOf(b, u, l, LATER).filter((f) => f.kind === "unapproved-crossing").length;
  assertEquals(unapproved(base, links), 1);
  assertEquals(unapproved({ ...base, interconnections: [ic(false)] }, links), 1, "an unapproved interconnection covers nothing");
  assertEquals(unapproved({ ...base, interconnections: [ic(true)] }, links), 0, "an approved one covers the crossing");
  assertEquals(unapproved({ ...base, interconnections: [ic(true)] }, []), 0);
  const count = (b: Boundary<"organizational">, l: readonly AssetLink[]) => findingsOf(b, u, l, LATER).filter((f) => f.kind !== "interconnection-unused").length;
  assert(count({ ...base, interconnections: [ic(true)] }, links) <= count(base, links), "approving adds no finding");
  assert(count(base, []) <= count(base, links), "removing a link adds no finding");
  const overdue = findingsOf({ ...base, interconnections: [{ ...ic(true), reviewEveryDays: 30 }] }, u, links, LATER);
  assert(overdue.some((f) => f.kind === "interconnection-review-overdue"));
  const expired = findingsOf({ ...base, interconnections: [{ ...ic(true), expires: AT }] }, u, links, LATER);
  assert(expired.some((f) => f.kind === "unapproved-crossing"), "an expired interconnection is none");
});

proves(["0010-estate-boundaries FR-011"], "a difference is exact: apply(diff(a, b), a) is b, diff(a, a) is empty, differences compose, and the inverse of diff(a, b) is diff(b, a)", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 8 }), fc.string({ maxLength: 8 }), fc.string({ maxLength: 8 }), fc.integer({ min: 1, max: 9 }), (n1, n2, n3, v) => {
      const a = emptyBoundary(1, { name: n1 });
      const b = emptyBoundary(1, { name: n2, version: v });
      const c = emptyBoundary(1, { name: n3, version: v + 1, include: sel.tag("a") });
      assertEquals(diff(a, a), []);
      const ab = diff(a, b);
      const applied = apply(ab, a);
      assert(applied.kind === "ok" && JSON.stringify(applied.value) === JSON.stringify(b));
      assertEquals(compose(diff(a, b), diff(b, c)), diff(a, c));
      assertEquals(invert(diff(a, b)), diff(b, a));
      assert(apply(diff(b, c), a).kind === "err" || diff(a, b).length === 0, "a difference does not apply to a boundary that is not the one it was made from");
    }),
    RUNS,
  );
});

proves(["0010-estate-boundaries FR-011"], "as of: the boundary at an instant is the fold of its journal up to it, and folding the journal in two parts gives the state of folding it in one", () => {
  const states = [emptyBoundary(1), emptyBoundary(1, { name: "two", version: 2 }), emptyBoundary(1, { name: "three", version: 3, include: sel.tag("a") })];
  const journal: JournalEntry[] = [
    { at: "2026-02-01T00:00:00.000Z", by: who, diff: diff(states[0]!, states[1]!) },
    { at: "2026-03-01T00:00:00.000Z", by: who, diff: diff(states[1]!, states[2]!) },
  ];
  const whole = foldJournal(states[0]!, journal);
  const first = foldJournal(states[0]!, journal.slice(0, 1));
  assert(whole.kind === "ok" && first.kind === "ok");
  const second = foldJournal(first.value, journal.slice(1));
  assert(second.kind === "ok" && JSON.stringify(second.value) === JSON.stringify(whole.value));
  const mid = boundaryAsOf(states[0]!, journal, "2026-02-15T00:00:00.000Z");
  assert(mid.kind === "ok" && mid.value.name === "two");
  const before = boundaryAsOf(states[0]!, journal, "2026-01-01T00:00:00.000Z");
  assert(before.kind === "ok" && before.value.name === states[0]!.name);
});

proves(["0010-estate-boundaries FR-011"], "the data-flow closure contains its seeds, is idempotent and is monotone in the links", () => {
  fc.assert(
    fc.property(fc.array(fc.integer({ min: 0, max: 11 }).map(aid), { maxLength: 4 }), fc.array(linkArb, { maxLength: 10 }), fc.array(linkArb, { maxLength: 4 }), (seeds, links, more) => {
      const c = closureOf(seeds, links);
      assert(seeds.every((s) => c.includes(s)));
      assertEquals(closureOf(c, links), c);
      const bigger = closureOf(seeds, [...links, ...more]);
      assert(c.every((x) => bigger.includes(x)));
    }),
    RUNS,
  );
});

proves(["0010-estate-boundaries FR-030", "0010-estate-boundaries FR-011"], "the interlock never permits a target an approved boundary excludes, whatever the order, never serves another action or target, and an unapproved boundary never permits", async () => {
  const scope = (n: number, role: "target" | "excluded-target", ids: readonly number[], actions: readonly ("scan" | "pentest")[], over: Partial<Boundary<"engagement-scope">> = {}): Boundary<"engagement-scope"> => ({
    id: bid(n),
    kind: "engagement-scope",
    name: `synthetic engagement ${n}`,
    owner: who,
    roles: { "client-approver": [who] },
    categorization: BOTTOM,
    include: sel.or(),
    exclude: sel.or(),
    overrides: [],
    decisions: ids.map((i) => ({ asset: aid(i), disposition: { t: "in-scope", role } as const, by: who, at: AT })),
    parents: [],
    constraints: [],
    interconnections: [],
    inheritances: [],
    accepted: [],
    actions,
    window: { from: AT, until: "2027-01-01T00:00:00.000Z" },
    version: 1,
    ...over,
  });
  const approvedOf = async (b: AnyBoundary) => {
    const p = await planOf(b);
    const r = await approve(b, p.hash, b.owner, AT, true);
    assert(r.kind === "ok");
    return verified(r.value);
  };
  const allow = await approvedOf(scope(1, "target", [1, 2], ["scan", "pentest"]));
  const exclude = await approvedOf(scope(2, "excluded-target", [2], ["scan", "pentest"]));
  const draft = await verified(scope(3, "target", [5], ["scan"]));
  const NOW = "2026-06-01T00:00:00.000Z";
  assert(permits("scan", aid(1), [allow, exclude], NOW).kind === "ok");
  for (const order of [[allow, exclude], [exclude, allow]]) {
    const r = permits("scan", aid(2), order, NOW);
    assert(r.kind === "err" && r.error.code === "E-BOUNDARY-EXCLUDED", "an exclusion wins, whatever the order");
  }
  const apply1 = permits("apply", aid(1), [allow], NOW);
  assert(apply1.kind === "err" && apply1.error.code === "E-BOUNDARY-NOT-IN-SCOPE", "a permit for an action is not one for another");
  const none = permits("scan", aid(9), [allow], NOW);
  assert(none.kind === "err" && none.error.code === "E-BOUNDARY-NOT-IN-SCOPE");
  const unapproved = permits("scan", aid(5), [allow, draft], NOW);
  assert(unapproved.kind === "err" && unapproved.error.code === "E-BOUNDARY-NOT-APPROVED", "an unapproved boundary never permits");
  const late = permits("scan", aid(1), [allow], "2028-01-01T00:00:00.000Z");
  assert(late.kind === "err" && late.error.code === "E-BOUNDARY-EXPIRED");
  const ok1 = permits("scan", aid(1), [allow], NOW);
  assert(ok1.kind === "ok" && ok1.value.target === aid(1) && ok1.value.action === "scan" && ok1.value.expires > NOW);
  const changed = await verified({ ...scope(1, "target", [1, 2], ["scan", "pentest"]), name: "changed after approval", ...(allow.boundary.approval === undefined ? {} : { approval: allow.boundary.approval }) });
  assert(!changed.approved, "an approval of another plan is not an approval");
  const org = await approvedOf(emptyBoundary(7, { decisions: [{ asset: aid(4), disposition: { t: "in-scope", role: "owned" }, by: who, at: AT }] }));
  assert(permits("apply", aid(4), [org], NOW).kind === "ok" && permits("scan", aid(4), [org], NOW).kind === "err");
});

proves(["0010-estate-boundaries FR-033", "0045-boundaries FR-091"], "the scope of a system, an environment or a company carries the authority to act, and the scope of a privacy regime, a zone or a threat model, or a role that names another party's system, does not", async () => {
  const NOW = "2026-06-01T00:00:00.000Z";
  const kinds = ["authorization", "cui-environment", "ephi-environment", "cardholder-data-environment", "soc2-system", "organizational", "privacy", "network-zone", "trust"] as const;
  for (const kind of kinds) {
    for (const role of ROLES_OF[kind]) {
      const b = { ...emptyBoundary(3), kind, roles: { [PERSON_ROLES_OF[kind][0]]: [who] }, decisions: [{ asset: aid(4), disposition: { t: "in-scope", role }, by: who, at: AT }] } as unknown as AnyBoundary;
      const approved = await approve(b, (await planOf(b)).hash, b.owner, AT, true);
      assert(approved.kind === "ok", `${kind} is approved by its owner`);
      const v = await verified(approved.value);
      for (const action of ["apply", "install", "enroll-active"] as const) {
        const got = permits(action, aid(4), [v], NOW);
        assertEquals(got.kind === "ok", actsByRole(kind, role as string), `${kind}/${role}/${action}`);
      }
      assert(permits("scan", aid(4), [v], NOW).kind === "err", "an acting scope never permits a scan or a pentest");
    }
  }
  assert(actsByRole("authorization", "component") && !actsByRole("soc2-system", "subservice-system") && !actsByRole("ephi-environment", "business-associate-system") && !actsByRole("privacy", "processing-system"));
});

proves(["0010-estate-boundaries FR-005", "0010-estate-boundaries FR-012", "0045-boundaries FR-003"], "an out-of-scope decision needs its justification, a disposition is a person's decision, and a boundary of an unread regime or one approved by an agent or a stranger is refused", async () => {
  assert(outOfScope({ rule: "", evidence: [], by: who, at: AT, expires: AT }).kind === "err");
  assert(outOfScope({ rule: "separated and not connected", evidence: ["synthetic-evidence-01"], by: who, at: AT, expires: LATER }).kind === "ok");
  const b = emptyBoundary(1);
  assert(decide(b, aid(1), { t: "in-scope", role: "owned" }, who, AT, false).kind === "err", "an agent proposes and does not decide");
  assert(decide(b, aid(1), { t: "in-scope", role: "owned" }, who, AT, true).kind === "ok");
  const plan = await planOf(b);
  assert((await approve(b, plan.hash, who, AT, false)).kind === "err");
  assert((await approve(b, plan.hash, other, AT, true)).kind === "err", "only the owner approves");
  assert((await approve(b, "0".repeat(64), who, AT, true)).kind === "err", "an approval is of a hash");
  assert((await approve(b, plan.hash, who, AT, true)).kind === "ok");
  const privacy = (regime: "gdpr" | "lgpd"): Boundary<"privacy"> => ({ ...(emptyBoundary(2) as unknown as Boundary<"privacy">), kind: "privacy", roles: { "controller-contact": [who] }, regime });
  const unread = privacy("lgpd");
  assert((await approve(unread, (await planOf(unread)).hash, who, AT, true)).kind === "err", "an unread regime cannot be approved");
  const read = privacy("gdpr");
  assert((await approve(read, (await planOf(read)).hash, who, AT, true)).kind === "ok");
});

proves(["0010-estate-boundaries FR-012", "0010-estate-boundaries FR-014"], "rules only propose a role, and a person holding two roles of a kind is a finding unless a person accepted it with a reason and an expiry", () => {
  const u: AssetFacts[] = [{ id: aid(1), kind: "server", tags: [], dataClasses: ["cui"], sources: [] }, { id: aid(2), kind: "server", tags: ["security-function"], dataClasses: [], sources: [] }];
  assertEquals(classify(u).map((p) => p.role), ["cui-asset", "security-protection-asset"]);
  const roles = emptyBoundary(1, { roles: { owner: [who], delegate: [who] } });
  assert(findingsOf(roles, [], [], AT).some((f) => f.kind === "roles-not-separate"));
  const accepted = { ...roles, accepted: [{ finding: "roles-not-separate" as const, reason: "one person answers for the whole system", by: who, expires: LATER }] };
  assert(!findingsOf(accepted, [], [], AT).some((f) => f.kind === "roles-not-separate"));
  assert(findingsOf(accepted, [], [], "2027-01-01T00:00:00.000Z").some((f) => f.kind === "roles-not-separate"), "an accepted finding expires");
});
