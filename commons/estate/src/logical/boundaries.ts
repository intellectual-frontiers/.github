// Spec: 0010-estate-boundaries FR-010, FR-011, FR-012, FR-014, FR-030
/**
 * The algebra of boundaries: pure, total, deterministic functions over strongly typed values. `select` evaluates a selector as a Boolean algebra of sets of assets; `membersOf`, `dispositionOf`,
 * `coverageOf` and `overlapOf` say who answers for what; `crossings` and `findingsOf` say where the rule is not met; `diff`, `apply`, `invert` and `foldJournal` are change control and the
 * auditor's as-of question; `closureOf` is the data-flow closure; and `permits` is the interlock that an active tool must pass. None reads a clock, a file, the network or a random source.
 *
 * @example
 * ```ts
 * import { select } from "./boundaries.ts";
 * import { sel } from "@intellectual-frontiers/estate/governance";
 * select(sel.and(), []); // [] : the empty `and` is every asset of the estate
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { canonicalize, digestOf } from "@intellectual-frontiers/grc/logical";
import {
  BOTTOM,
  IMPACTS,
  outOfScope,
  type AnyBoundary,
  type AssetAction,
  type AssetFacts,
  type AssetRoleOf,
  type Boundary,
  type BoundaryId,
  type BoundaryKind,
  type Categorization,
  type Decision,
  type Disposition,
  type Finding,
  type Impact,
  type Party,
  type Permit,
  type PrincipalId,
  type PrivacyRegime,
  type Refusal,
  type Selector,
  type Interconnection,
} from "@intellectual-frontiers/estate/governance";
import type { AssetId } from "@intellectual-frontiers/estate/governance";

/** The estate a selector reads: the facts of every asset. */
export type Universe = readonly AssetFacts[];
/** A link between two assets of the estate. */
export type AssetLink = { readonly from: AssetId; readonly to: AssetId; readonly kind: string };

/** The other boundaries of the fleet, for the selector `roleOf`, the parts of a boundary and the constraints between boundaries. */
export type Fleet = { readonly boundaries: readonly AnyBoundary[] };
const NONE: Fleet = { boundaries: [] };

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function sortedUnique<T extends string>(items: Iterable<T>): readonly T[] {
  return [...new Set(items)].sort(byText);
}

function roleIn(boundary: AnyBoundary | undefined, asset: AssetId): string | undefined {
  if (boundary === undefined) return undefined;
  const d = decisionOf(boundary, asset);
  return d !== undefined && d.disposition.t === "in-scope" ? d.disposition.role : undefined;
}

function matches(s: Selector, a: AssetFacts, fleet: Fleet): boolean {
  switch (s.t) {
    case "class":
      return a.kind === s.value;
    case "tag":
      return a.tags.includes(s.value);
    case "id":
      return a.id === s.value;
    case "realm":
      return a.realm === s.value;
    case "segment":
      return a.segment === s.value;
    case "owner":
      return a.owner === s.value;
    case "dataClass":
      return a.dataClasses.includes(s.value);
    case "location":
      return a.location === s.value;
    case "source":
      return a.sources.includes(s.value);
    case "roleOf":
      return roleIn(fleet.boundaries.find((b) => b.id === s.boundary), a.id) === s.role;
    case "and":
      return s.of.every((x) => matches(x, a, fleet));
    case "or":
      return s.of.some((x) => matches(x, a, fleet));
    case "not":
      return !matches(s.of, a, fleet);
  }
}

/** The ids of the assets of the estate that the selector takes in, sorted, whatever the order of the assets. The empty `and` takes every asset and the empty `or` none. */
export function select(selector: Selector, universe: Universe, fleet: Fleet = NONE): readonly AssetId[] {
  return sortedUnique(universe.filter((a) => matches(selector, a, fleet)).map((a) => a.id));
}

function latest<T extends { readonly at: string }>(items: readonly T[], key: (t: T) => string): T | undefined {
  let best: T | undefined;
  for (const item of items) {
    if (best === undefined) best = item;
    else if (item.at > best.at || (item.at === best.at && key(item) > key(best))) best = item;
  }
  return best;
}

/** The members of a boundary: `select(include) \ select(exclude)` with the overrides applied after (the latest wins, and a removal wins a tie); an override on an asset not in the estate adds nothing. Sorted. */
export function membersOf(boundary: AnyBoundary, universe: Universe, fleet: Fleet = NONE): readonly AssetId[] {
  const known = new Set<string>(universe.map((a) => a.id));
  const members = new Set<AssetId>(select(boundary.include, universe, fleet));
  for (const id of select(boundary.exclude, universe, fleet)) members.delete(id);
  const assets = sortedUnique(boundary.overrides.map((o) => o.asset));
  for (const asset of assets) {
    const mine = boundary.overrides.filter((o) => o.asset === asset);
    const last = latest(mine, (o) => (o.effect === "remove" ? "z" : "a"));
    if (last === undefined || !known.has(asset)) continue;
    if (last.effect === "add") members.add(asset);
    else members.delete(asset);
  }
  return [...members].sort(byText);
}

function decisionOf(boundary: AnyBoundary, asset: AssetId): Decision<BoundaryKind> | undefined {
  const mine = boundary.decisions.filter((d) => d.asset === asset);
  return latest(mine, (d) => canonicalize(d.disposition));
}

/** The disposition of an asset in a boundary: total and single-valued; the asset a boundary does not mention is `undecided`. */
export function dispositionOf<K extends BoundaryKind>(boundary: Boundary<K>, asset: AssetId): Disposition<K> {
  const d = decisionOf(boundary as AnyBoundary, asset);
  return d === undefined ? { t: "undecided" } : (d.disposition as Disposition<K>);
}

/** Whether an asset is in scope of a boundary: a member with a decided disposition of `in-scope`. */
export function inScope(boundary: AnyBoundary, asset: AssetId, universe: Universe, fleet: Fleet = NONE): boolean {
  return membersOf(boundary, universe, fleet).includes(asset) && dispositionOf(boundary, asset).t === "in-scope";
}

/** The coverage of a boundary: the share of its members that have a disposition other than `undecided`; `1` where it has no member. */
export function coverageOf(boundary: AnyBoundary, universe: Universe, fleet: Fleet = NONE): { readonly members: number; readonly decided: number; readonly ratio: number; readonly undecided: readonly AssetId[] } {
  const members = membersOf(boundary, universe, fleet);
  const undecided = members.filter((m) => dispositionOf(boundary, m).t === "undecided");
  const decided = members.length - undecided.length;
  return { members: members.length, decided, ratio: members.length === 0 ? 1 : decided / members.length, undecided };
}

/** The overlap of two boundaries, computed and never declared: the assets in scope of both, of one and not the other, and the role of each in each. */
export function overlapOf(a: AnyBoundary, b: AnyBoundary, universe: Universe, fleet: Fleet = NONE): { readonly both: readonly AssetId[]; readonly onlyA: readonly AssetId[]; readonly onlyB: readonly AssetId[] } {
  const inA = new Set(membersOf(a, universe, fleet).filter((x) => dispositionOf(a, x).t === "in-scope"));
  const inB = new Set(membersOf(b, universe, fleet).filter((x) => dispositionOf(b, x).t === "in-scope"));
  return {
    both: [...inA].filter((x) => inB.has(x)).sort(byText),
    onlyA: [...inA].filter((x) => !inB.has(x)).sort(byText),
    onlyB: [...inB].filter((x) => !inA.has(x)).sort(byText),
  };
}

/** The assets that belong to no boundary of the fleet in scope: every asset of a fleet with no boundary is unscoped, never in order. */
export function unscopedOf(fleet: Fleet, universe: Universe): readonly AssetId[] {
  const covered = new Set<string>();
  for (const b of fleet.boundaries) for (const m of membersOf(b, universe, fleet)) if (dispositionOf(b, m).t !== "undecided") covered.add(m);
  return sortedUnique(universe.map((a) => a.id).filter((id) => !covered.has(id)));
}

/** One crossing of a boundary: a link with one end in scope and the other not. */
export type Crossing = { readonly link: AssetLink; readonly inside: AssetId; readonly outside: AssetId };

/** The crossings of a boundary: a link between two members is not one, and a link between a member and a non-member is exactly one. Sorted. */
export function crossings(boundary: AnyBoundary, universe: Universe, links: readonly AssetLink[], fleet: Fleet = NONE): readonly Crossing[] {
  const inside = new Set(membersOf(boundary, universe, fleet).filter((m) => dispositionOf(boundary, m).t === "in-scope"));
  const out: Crossing[] = [];
  for (const link of links) {
    const f = inside.has(link.from);
    const t = inside.has(link.to);
    if (f && !t) out.push({ link, inside: link.from, outside: link.to });
    else if (t && !f) out.push({ link, inside: link.to, outside: link.from });
  }
  return out.sort((x, y) => byText(`${x.link.from}>${x.link.to}>${x.link.kind}`, `${y.link.from}>${y.link.to}>${y.link.kind}`));
}

/** The crossings between two boundaries: symmetric in its arguments. */
export function crossingsBetween(a: AnyBoundary, b: AnyBoundary, universe: Universe, links: readonly AssetLink[], fleet: Fleet = NONE): readonly AssetLink[] {
  const inA = new Set(membersOf(a, universe, fleet).filter((m) => dispositionOf(a, m).t === "in-scope"));
  const inB = new Set(membersOf(b, universe, fleet).filter((m) => dispositionOf(b, m).t === "in-scope"));
  return links.filter((l) => (inA.has(l.from) && inB.has(l.to)) || (inB.has(l.from) && inA.has(l.to)));
}

function inForce(i: Interconnection, at: string): boolean {
  if (i.approvedBy === undefined || i.approvedAt === undefined) return false;
  return i.expires === undefined || i.expires > at;
}

function partyOfOutside(boundary: AnyBoundary, outside: AssetId, fleet: Fleet, universe: Universe): readonly Party[] {
  const parties: Party[] = [];
  const d = dispositionOf(boundary, outside);
  if (d.t === "external") parties.push({ t: "external", id: d.system });
  for (const other of fleet.boundaries) if (other.id !== boundary.id && inScope(other, outside, universe, fleet)) parties.push({ t: "boundary", id: other.id });
  return parties;
}

function covers(i: Interconnection, mine: BoundaryId, parties: readonly Party[]): boolean {
  const ends = [i.from, i.to];
  const hasMe = ends.some((e) => e.t === "boundary" && e.id === mine);
  const other = ends.find((e) => !(e.t === "boundary" && e.id === mine));
  return hasMe && other !== undefined && parties.some((p) => p.t === other.t && p.id === other.id);
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

function personHolds(boundary: AnyBoundary): readonly { readonly principal: PrincipalId; readonly roles: readonly string[] }[] {
  const holders = new Map<string, string[]>();
  for (const [role, who] of Object.entries(boundary.roles as Readonly<Record<string, readonly PrincipalId[] | undefined>>)) for (const p of who ?? []) holders.set(p, [...(holders.get(p) ?? []), role]);
  return [...holders.entries()].map(([principal, roles]) => ({ principal: principal as PrincipalId, roles: roles.sort(byText) })).sort((x, y) => byText(x.principal, y.principal));
}

/** The findings of a boundary at an instant, in a stable order (0010-estate-boundaries FR-014): `no-disposition`, `override-orphaned`, `part-outside-whole`, `constraint-broken`, `unapproved-crossing`, `interconnection-unused`, `interconnection-review-overdue` and `roles-not-separate`. */
export function findingsOf(boundary: AnyBoundary, universe: Universe, links: readonly AssetLink[], at: string, fleet: Fleet = NONE): readonly Finding[] {
  const out: Finding[] = [];
  const id = boundary.id;
  const members = membersOf(boundary, universe, fleet);
  for (const m of members) if (dispositionOf(boundary, m).t === "undecided") out.push({ kind: "no-disposition", boundary: id, subject: m, detail: `${m} is a member of ${id} and has no disposition`, evidence: [m] });
  const known = new Set<string>(universe.map((a) => a.id));
  for (const o of boundary.overrides) if (!known.has(o.asset)) out.push({ kind: "override-orphaned", boundary: id, subject: o.asset, detail: `the override on ${o.asset} names an asset the estate does not hold`, evidence: [o.asset] });
  for (const parent of boundary.parents) {
    const whole = fleet.boundaries.find((b) => b.id === parent);
    if (whole === undefined) continue;
    const wholeMembers = new Set<string>(membersOf(whole, universe, fleet));
    for (const m of members) if (dispositionOf(boundary, m).t === "in-scope" && !wholeMembers.has(m)) out.push({ kind: "part-outside-whole", boundary: id, subject: m, detail: `${m} is in scope of ${id}, a part of ${parent}, and is not a member of ${parent}`, evidence: [m, parent] });
  }
  for (const c of boundary.constraints) {
    const mine = new Set<string>(members);
    const theirs = (b: BoundaryId): ReadonlySet<string> => new Set<string>(membersOf(fleet.boundaries.find((x) => x.id === b) ?? { ...boundary, include: { t: "or", of: [] }, exclude: { t: "or", of: [] }, overrides: [] }, universe, fleet));
    if (c.t === "within") for (const m of members) if (!theirs(c.b).has(m)) out.push({ kind: "constraint-broken", boundary: id, subject: m, detail: `${m} is a member of ${c.a} and not of ${c.b}, and ${c.a} is to be within ${c.b}`, evidence: [m, c.b] });
    if (c.t === "disjoint") for (const m of members) if (theirs(c.b).has(m)) out.push({ kind: "constraint-broken", boundary: id, subject: m, detail: `${m} is a member of ${c.a} and of ${c.b}, and they are to be disjoint`, evidence: [m, c.b] });
    if (c.t === "equals") {
      const other = theirs(c.b);
      for (const m of [...mine].filter((x) => !other.has(x)).concat([...other].filter((x) => !mine.has(x)))) out.push({ kind: "constraint-broken", boundary: id, subject: m, detail: `${m} is in one of ${c.a} and ${c.b} and not the other, and they are to be equal`, evidence: [m, c.b] });
    }
    if (c.t === "residency") for (const m of members) {
      const where = universe.find((a) => a.id === m)?.location;
      if (where === undefined || !c.jurisdictions.includes(where)) out.push({ kind: "constraint-broken", boundary: id, subject: m, detail: `${m} is located ${where === undefined ? "nowhere that is known" : `in ${where}`}, and ${c.a} allows ${c.jurisdictions.join(", ")}`, evidence: [m] });
    }
  }
  const used = new Set<string>();
  for (const x of crossings(boundary, universe, links, fleet)) {
    const parties = partyOfOutside(boundary, x.outside, fleet, universe);
    const covering = boundary.interconnections.filter((i) => inForce(i, at) && covers(i, id, parties));
    if (covering.length === 0) out.push({ kind: "unapproved-crossing", boundary: id, subject: `${x.link.from}>${x.link.to}`, detail: `the ${x.link.kind} link from ${x.link.from} to ${x.link.to} crosses ${id} and no approved interconnection covers it`, evidence: [x.link.from, x.link.to] });
    for (const c of covering) used.add(c.id);
  }
  for (const i of boundary.interconnections) {
    if (inForce(i, at) && !used.has(i.id)) out.push({ kind: "interconnection-unused", boundary: id, subject: i.id, detail: `no crossing uses the interconnection ${i.id}`, evidence: [i.id] });
    const reviewed = i.reviewedAt ?? i.approvedAt;
    if (inForce(i, at) && reviewed !== undefined && addDays(reviewed, i.reviewEveryDays) < at) out.push({ kind: "interconnection-review-overdue", boundary: id, subject: i.id, detail: `the interconnection ${i.id} was last reviewed ${reviewed} and is to be every ${i.reviewEveryDays} days`, evidence: [i.id] });
  }
  for (const h of personHolds(boundary)) {
    if (h.roles.length < 2) continue;
    const accepted = boundary.accepted.some((a) => a.finding === "roles-not-separate" && a.expires > at);
    if (!accepted) out.push({ kind: "roles-not-separate", boundary: id, subject: h.principal, detail: `${h.principal} holds ${h.roles.join(" and ")}, which a regime may ask to hold apart`, evidence: [h.principal] });
  }
  return out.sort((x, y) => byText(`${x.kind}|${x.subject}|${x.detail}`, `${y.kind}|${y.subject}|${y.detail}`));
}

/** The join of two categorizations (the greatest impact of each objective). */
export function join(a: Categorization, b: Categorization): Categorization {
  const g = (x: Impact, y: Impact): Impact => (IMPACTS.indexOf(x) >= IMPACTS.indexOf(y) ? x : y);
  return { confidentiality: g(a.confidentiality, b.confidentiality), integrity: g(a.integrity, b.integrity), availability: g(a.availability, b.availability) };
}
/** The meet of two categorizations (the least impact of each objective). */
export function meet(a: Categorization, b: Categorization): Categorization {
  const l = (x: Impact, y: Impact): Impact => (IMPACTS.indexOf(x) <= IMPACTS.indexOf(y) ? x : y);
  return { confidentiality: l(a.confidentiality, b.confidentiality), integrity: l(a.integrity, b.integrity), availability: l(a.availability, b.availability) };
}
/** Whether `a` is at most `b` for every objective. */
export function atMost(a: Categorization, b: Categorization): boolean {
  return IMPACTS.indexOf(a.confidentiality) <= IMPACTS.indexOf(b.confidentiality) && IMPACTS.indexOf(a.integrity) <= IMPACTS.indexOf(b.integrity) && IMPACTS.indexOf(a.availability) <= IMPACTS.indexOf(b.availability);
}
/** The categorization of a set of information types: the join of the types over the bottom (the high water mark). */
export function categorizationOf(types: readonly Categorization[]): Categorization {
  return types.reduce(join, BOTTOM);
}

/** One change of a field of a boundary. */
export type FieldChange = { readonly field: string; readonly from: unknown; readonly to: unknown };
/** The difference between two boundaries: the fields that differ, in the order of their names. */
export type BoundaryDiff = readonly FieldChange[];

function fieldsOf(b: AnyBoundary): Readonly<Record<string, unknown>> {
  return b as unknown as Readonly<Record<string, unknown>>;
}

/** The difference of two boundaries. */
export function diff(a: AnyBoundary, b: AnyBoundary): BoundaryDiff {
  const fa = fieldsOf(a);
  const fb = fieldsOf(b);
  const names = sortedUnique([...Object.keys(fa), ...Object.keys(fb)]);
  return names.filter((n) => canonicalize(fa[n]) !== canonicalize(fb[n])).map((field) => ({ field, from: fa[field], to: fb[field] }));
}

/** A boundary with a difference applied: refused where a field is not what the difference says it was. */
export function apply(d: BoundaryDiff, boundary: AnyBoundary): Result<AnyBoundary, string> {
  const next: Record<string, unknown> = { ...fieldsOf(boundary) };
  for (const c of d) {
    if (canonicalize(next[c.field]) !== canonicalize(c.from)) return err(`the field ${c.field} is not what the difference says it was`);
    if (c.to === undefined) delete next[c.field];
    else next[c.field] = c.to;
  }
  return ok(next as unknown as AnyBoundary);
}

/** The inverse of a difference. */
export function invert(d: BoundaryDiff): BoundaryDiff {
  return d.map((c) => ({ field: c.field, from: c.to, to: c.from }));
}

/** The composition of two differences: `diff(a, c)` is `compose(diff(a, b), diff(b, c))`. A field changed back is dropped. */
export function compose(first: BoundaryDiff, second: BoundaryDiff): BoundaryDiff {
  const fields = new Map<string, FieldChange>(first.map((c) => [c.field, c]));
  for (const c of second) {
    const earlier = fields.get(c.field);
    fields.set(c.field, { field: c.field, from: earlier === undefined ? c.from : earlier.from, to: c.to });
  }
  return [...fields.values()].filter((c) => canonicalize(c.from) !== canonicalize(c.to)).sort((x, y) => byText(x.field, y.field));
}

/** One entry of the journal of a boundary: a difference and the instant it was made. */
export type JournalEntry = { readonly at: string; readonly by: PrincipalId; readonly diff: BoundaryDiff };

/** The boundary after the entries of its journal, in order; refused where an entry does not apply. Folding the journal in two parts gives the same state as in one. */
export function foldJournal(base: AnyBoundary, entries: readonly JournalEntry[]): Result<AnyBoundary, string> {
  let state = base;
  for (const e of entries) {
    const next = apply(e.diff, state);
    if (next.kind === "err") return next;
    state = next.value;
  }
  return ok(state);
}

/** The boundary as of an instant: the fold of the entries made at or before it. */
export function boundaryAsOf(base: AnyBoundary, journal: readonly JournalEntry[], at: string): Result<AnyBoundary, string> {
  return foldJournal(base, journal.filter((e) => e.at <= at).sort((x, y) => byText(x.at, y.at)));
}

/** The plan of a boundary: the boundary as it is to be approved, and its hash (the digest of its canonical form without its approval). */
export type Plan = { readonly boundary: AnyBoundary; readonly hash: string };

/** The plan of a boundary. */
export async function planOf(boundary: AnyBoundary): Promise<Plan> {
  const { approval: _approval, ...rest } = boundary as AnyBoundary & { readonly approval?: unknown };
  return { boundary, hash: await digestOf(rest) };
}

/** The regimes whose text has been read; a boundary of another regime can be drafted and not approved (0045-boundaries FR-003). */
export const READ_REGIMES: readonly PrivacyRegime[] = ["gdpr", "uk-gdpr"];

/** A boundary with an approval, refused where the approver is not a person, the hash is not the plan's, the approver is not the owner, or the regime has not been read. */
export async function approve(boundary: AnyBoundary, planHash: string, by: PrincipalId, at: string, isPerson: boolean): Promise<Result<AnyBoundary, string>> {
  if (!isPerson) return err("a boundary is approved by a person; an agent proposes and reads");
  if (by !== boundary.owner) return err(`${by} is not the owner of ${boundary.id}, who is ${boundary.owner}`);
  if (boundary.kind === "privacy" && boundary.regime !== undefined && !READ_REGIMES.includes(boundary.regime)) return err(`the text of the regime ${boundary.regime} has not been read: a boundary of it can be drafted and not approved`);
  const plan = await planOf(boundary);
  if (plan.hash !== planHash) return err(`the approval is of the plan ${planHash} and the boundary's plan is ${plan.hash}`);
  return ok({ ...boundary, approval: { planHash, by, at } } as AnyBoundary);
}

/** A boundary whose approval is of its current plan: made only by `verified`. */
export type Verified = { readonly boundary: AnyBoundary; readonly approved: boolean };

/** Whether the approval a boundary carries is of its current plan. */
export async function verified(boundary: AnyBoundary): Promise<Verified> {
  if (boundary.approval === undefined) return { boundary, approved: false };
  const plan = await planOf(boundary);
  return { boundary, approved: plan.hash === boundary.approval.planHash };
}

/** A decision made by a person: refused where the maker is not a person. The only function that turns a disposition into a decision. */
export function decide<K extends BoundaryKind>(boundary: Boundary<K>, asset: AssetId, disposition: Disposition<K>, by: PrincipalId, at: string, isPerson: boolean): Result<Boundary<K>, string> {
  if (!isPerson) return err("a disposition is a person's decision; an agent proposes");
  if (disposition.t === "out-of-scope") {
    const checked = outOfScope<K>(disposition.justification);
    if (checked.kind === "err") return checked;
  }
  return ok({ ...boundary, decisions: [...boundary.decisions.filter((d) => d.asset !== asset), { asset, disposition, by, at }] });
}

/** A proposal of a role for an asset, with the rule and the evidence: never a decision. */
export type Proposal<K extends BoundaryKind> = { readonly asset: AssetId; readonly role: AssetRoleOf<K>; readonly rule: string; readonly evidence: readonly string[] };

/** The classification rules of the kind `cui-environment`, as data: a rule proposes a role from what an asset states. */
export const CUI_RULES: readonly { readonly rule: string; readonly role: AssetRoleOf<"cui-environment">; readonly when: (a: AssetFacts) => boolean }[] = [
  { rule: "processes, stores or transmits CUI", role: "cui-asset", when: (a) => a.dataClasses.includes("cui") },
  { rule: "provides security protection functions", role: "security-protection-asset", when: (a) => a.tags.includes("security-function") || a.dataClasses.includes("security-protection-data") },
  { rule: "can handle CUI by policy and is not meant to", role: "contractor-risk-managed-asset", when: (a) => a.tags.includes("risk-managed") },
  { rule: "cannot be fully secured", role: "specialized-asset", when: (a) => a.tags.includes("specialized") },
];

/** The proposals of the rules of `cui-environment` for the assets of a universe: sorted, one per asset (the first rule that fits). */
export function classify(universe: Universe): readonly Proposal<"cui-environment">[] {
  const out: Proposal<"cui-environment">[] = [];
  for (const a of universe) {
    const rule = CUI_RULES.find((r) => r.when(a));
    if (rule !== undefined) out.push({ asset: a.id, role: rule.role, rule: rule.rule, evidence: [a.id] });
  }
  return out.sort((x, y) => byText(x.asset, y.asset));
}

/** Whether the parts of the boundaries of a fleet form a cycle (a boundary that is, through its parts, a part of itself): a cycle is refused. */
export function hasPartCycle(fleet: Fleet): boolean {
  const parents = new Map<string, readonly BoundaryId[]>(fleet.boundaries.map((b) => [b.id, b.parents]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string): boolean => {
    if (done.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    for (const p of parents.get(id) ?? []) if (visit(p)) return true;
    visiting.delete(id);
    done.add(id);
    return false;
  };
  return [...parents.keys()].some(visit);
}

/** The data-flow closure: the seeds and every asset that a link connects to them, transitively. Sorted. */
export function closureOf(seeds: readonly AssetId[], links: readonly AssetLink[]): readonly AssetId[] {
  const reached = new Set<AssetId>(seeds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const l of links) {
      if (reached.has(l.from) && !reached.has(l.to)) {
        reached.add(l.to);
        grew = true;
      } else if (reached.has(l.to) && !reached.has(l.from)) {
        reached.add(l.from);
        grew = true;
      }
    }
  }
  return [...reached].sort(byText);
}

/** How long a permit is good for, at most: fifteen minutes. */
const PERMIT_MINUTES = 15;

/** A boundary the interlock consults, with whether its approval is of its current plan. */
export type Consulted = Verified;

/**
 * The interlock (0045-boundaries FR-090 to FR-094): a permit for an active action on a target, or the reason it is refused. A target is permitted when it is in scope in an approved boundary whose kind
 * allows the action (`scan` and `pentest` by an engagement-scope boundary inside its window; `apply`, `install` and `enroll-active` by an organizational boundary or by an engagement-scope that lists them),
 * and no approved boundary marks it `excluded-target` or out of scope: an exclusion wins, whatever the order of the boundaries. Pure: the caller records the permit or the refusal before the first effect.
 */
export function permits<A extends AssetAction>(action: A, target: AssetId, boundaries: readonly Consulted[], at: string): Result<Permit<A>, Refusal> {
  const consulted = boundaries.map((b) => b.boundary.id).sort(byText);
  const refuse = (code: Refusal["code"], reason: string): Result<Permit<A>, Refusal> => err({ code, action, target, consulted, reason });
  const approved = boundaries.filter((b) => b.approved).map((b) => b.boundary);
  for (const b of approved) {
    const d = dispositionOf(b, target);
    if (d.t === "out-of-scope" || (d.t === "in-scope" && (d.role as string) === "excluded-target")) return refuse("E-BOUNDARY-EXCLUDED", `${b.id} excludes ${target}`);
  }
  const allowing = approved.filter((b) => {
    const d = dispositionOf(b, target);
    if (d.t !== "in-scope") return false;
    if (b.kind === "engagement-scope") return b.actions !== undefined && b.actions.includes(action) && (d.role as string) === "target";
    if (b.kind === "organizational") return action === "apply" || action === "install" || action === "enroll-active";
    return false;
  });
  if (allowing.length === 0) {
    const unapproved = boundaries.filter((b) => !b.approved && dispositionOf(b.boundary, target).t === "in-scope");
    if (unapproved.length > 0) return refuse("E-BOUNDARY-NOT-APPROVED", `${unapproved.map((b) => b.boundary.id).join(", ")} holds ${target} and has no approval of its current plan`);
    return refuse("E-BOUNDARY-NOT-IN-SCOPE", `${target} is in scope of no approved boundary that allows ${action}`);
  }
  const live = allowing.filter((b) => b.window === undefined || (b.window.from <= at && at < b.window.until));
  if (live.length === 0) return refuse("E-BOUNDARY-EXPIRED", `the window of ${allowing.map((b) => b.id).join(", ")} is not now`);
  const limit = new Date(Date.parse(at) + PERMIT_MINUTES * 60_000).toISOString();
  const ends = live.flatMap((b) => (b.window === undefined ? [] : [b.window.until])).concat([limit]).sort(byText)[0] ?? limit;
  const permit = { action, target, boundaries: live.map((b) => ({ id: b.id, version: b.version })).sort((x, y) => byText(x.id, y.id)), at, expires: ends } as unknown as Permit<A>;
  return ok(permit);
}

/** Whether a permit is the one a call needs: for its action and its target and not past its expiry at the instant. The problem is said in a sentence, or nothing where the permit serves. A caller that acts refuses with it before its first effect. */
export function permitProblem(permit: Permit<AssetAction>, action: AssetAction, target: string, at: string): string | undefined {
  if (permit.action !== action) return `the permit is for ${permit.action}, and this is ${action}`;
  if (permit.target !== target) return `the permit is for ${permit.target}, and this is ${target}`;
  if (permit.expires <= at) return `the permit expired at ${permit.expires}`;
  return undefined;
}
