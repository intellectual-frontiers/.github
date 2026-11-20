// Spec: 0063-operating-model FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016
/**
 * The operating model at work (commons data 0063-operating-model): the code that works on the tables of the operations model (`models/operations`). What the work waits on is listed with a status that is computed from its
 * dates; a decision that replaces another says so and the other is marked; limits and expiries are found when the time to act has come; copies of data with no owner or no refresh are found; a release is promoted only through
 * the environments in order, and the versions in each environment are compared; a signal is checked against the catalog before it is emitted; the freshness of a source is computed from its latest load; and the statements of
 * a workload are replayed and compared with what they gave.
 *
 * @module
 */
import { sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import { asc, desc, eq, from, insertInto, type Runner, update } from "@intellectual-frontiers/data/sql/typed";
import { flow, operations } from "@intellectual-frontiers/data/sql/typed/models";

const { dataCopy, decision, freshnessRule, limit, promotion, release, runtimeEnvironment, signal, waiting, workload, workloadStatement } = operations;

const time = (t: string | Date): number => new Date(t).getTime();
const iso = (t: string | Date): string => new Date(t).toISOString();
const DAY = 86_400_000;

/** One thing the work waits on, with the status its dates give it. */
export interface Wait {
  readonly waitingId: string;
  readonly what: string;
  readonly onWhom: string;
  readonly status: "waiting" | "overdue";
  readonly daysWaiting: number;
}

/** What the work waits on, the oldest first: overdue where it was needed by a date that has passed. */
export async function waitingOn(on: Runner, asOf: string | Date = new Date()): Promise<readonly Wait[]> {
  const rows = await from(waiting).where((s) => eq(s.waiting.status, "open")).select((s) => ({ id: s.waiting.waitingId, what: s.waiting.what, who: s.waiting.onWhom, since: s.waiting.since, by: s.waiting.neededBy })).orderBy((s) => [asc(s.waiting.since)]).run(on);
  const now = time(asOf);
  return rows.map((r) => ({ waitingId: r.id, what: r.what, onWhom: r.who, status: r.by !== null && time(r.by) < now ? ("overdue" as const) : ("waiting" as const), daysWaiting: Math.floor((now - time(r.since)) / DAY) }));
}

/** Records that what was waited on has come. */
export async function resolveWait(on: Runner, waitingId: string, at: string | Date = new Date()): Promise<void> {
  await update(waiting).set(() => ({ status: "resolved", resolvedAt: iso(at) })).where((c) => eq(c.waitingId, waitingId)).run(on);
}

/** Records that a decision replaces another: the new one is accepted and says what it replaced, and the old one is marked superseded. */
export async function supersede(on: Runner, newId: string, oldId: string): Promise<void> {
  await update(decision).set(() => ({ status: "accepted", supersedesDecisionId: oldId })).where((c) => eq(c.decisionId, newId)).run(on);
  await update(decision).set(() => ({ status: "superseded" })).where((c) => eq(c.decisionId, oldId)).run(on);
}

/** The decisions in force: accepted and not replaced. */
export async function decisionsInForce(on: Runner): Promise<readonly string[]> {
  return (await from(decision).where((s) => eq(s.decision.status, "accepted")).select((s) => ({ id: s.decision.decisionId })).orderBy((s) => [asc(s.decision.decisionId)]).run(on)).map((r) => r.id);
}

/** A limit that needs someone to act. */
export interface DueLimit {
  readonly limitId: string;
  readonly name: string;
  readonly owner: string;
  readonly expiresAt: string;
  readonly status: "expired" | "act-now";
  readonly daysLeft: number;
}

/** Finds the limits whose time to act has come: expired, or within the days of notice that its owner needs; the soonest first. */
export async function limitsDue(on: Runner, asOf: string | Date = new Date()): Promise<readonly DueLimit[]> {
  const rows = await from(limit).select((s) => ({ id: s.limit.limitId, name: s.limit.name, owner: s.limit.owner, at: s.limit.expiresAt, lead: s.limit.renewalLeadDays })).run(on);
  const now = time(asOf);
  return rows
    .filter((r) => r.at !== null)
    .map((r) => ({ limitId: r.id, name: r.name, owner: r.owner, expiresAt: iso(r.at!), daysLeft: Math.floor((time(r.at!) - now) / DAY), lead: Number(r.lead) }))
    .filter((r) => r.daysLeft <= r.lead)
    .map(({ lead: _lead, ...r }) => ({ ...r, status: r.daysLeft < 0 ? ("expired" as const) : ("act-now" as const) }))
    .sort((a, b) => time(a.expiresAt) - time(b.expiresAt));
}

/** A copy that nobody answers for or that has not been refreshed. */
export interface CopyFinding {
  readonly dataCopyId: string;
  readonly dataset: string;
  readonly location: string;
  readonly why: "no owner" | "never refreshed" | "stale";
}

/** Finds the copies of data with no owner, never refreshed or not refreshed within the days given. */
export async function copyFindings(on: Runner, maxAgeDays: number, asOf: string | Date = new Date()): Promise<readonly CopyFinding[]> {
  const rows = await from(dataCopy).select((s) => ({ id: s.dataCopy.dataCopyId, dataset: s.dataCopy.dataset, location: s.dataCopy.location, owner: s.dataCopy.owner, at: s.dataCopy.refreshedAt })).orderBy((s) => [asc(s.dataCopy.dataCopyId)]).run(on);
  const now = time(asOf);
  const out: CopyFinding[] = [];
  for (const r of rows) {
    const base = { dataCopyId: r.id, dataset: r.dataset, location: r.location };
    if (r.owner === null) out.push({ ...base, why: "no owner" });
    else if (r.at === null) out.push({ ...base, why: "never refreshed" });
    else if ((now - time(r.at)) / DAY > maxAgeDays) out.push({ ...base, why: "stale" });
  }
  return out;
}

/** The order a release is promoted through. */
export const PROMOTION_ORDER = ["development", "test", "staging", "production"] as const;

/** What a promotion was told. */
export interface Promote {
  readonly promotionId: string;
  readonly releaseId: string;
  readonly environmentId: string;
  readonly by: string;
  readonly evidenceRef?: string;
  readonly at?: string | Date;
}

/** Whether a promotion was made, and why not where it was not. */
export type Promoted = { readonly kind: "promoted" } | { readonly kind: "refused"; readonly why: string };

/**
 * Promotes a release to an environment and adds it to the log, unless an environment before it in the order (development, test, staging, production) has not had it, or it has no evidence for production: then it is refused
 * and nothing is written.
 */
export async function promote(on: Runner, p: Promote): Promise<Promoted> {
  const env = await from(runtimeEnvironment).where((s) => eq(s.runtimeEnvironment.runtimeEnvironmentId, p.environmentId)).select((s) => ({ kind: s.runtimeEnvironment.kind })).first(on);
  if (env === undefined) return { kind: "refused", why: `there is no environment ${p.environmentId}` };
  const rel = await from(release).where((s) => eq(s.release.releaseId, p.releaseId)).select((s) => ({ evidence: s.release.evidenceRef })).first(on);
  if (rel === undefined) return { kind: "refused", why: `there is no release ${p.releaseId}` };
  const rank = PROMOTION_ORDER.indexOf(env.kind as never);
  if (env.kind === "production" && (p.evidenceRef === undefined && rel.evidence === null)) return { kind: "refused", why: "a release goes to production with evidence" };
  const had = await from(promotion)
    .innerJoin(runtimeEnvironment, (s) => eq(s.promotion.targetRuntimeEnvironmentId, s.runtimeEnvironment.runtimeEnvironmentId))
    .where((s) => eq(s.promotion.releaseId, p.releaseId))
    .select((s) => ({ kind: s.runtimeEnvironment.kind }))
    .run(on);
  const kinds = new Set(had.map((h) => h.kind));
  const missing = rank > 0 ? PROMOTION_ORDER[rank - 1]! : undefined;
  if (missing !== undefined && !kinds.has(missing)) return { kind: "refused", why: `the release has not been in ${missing}` };
  await insertInto(promotion).values({ promotionId: p.promotionId, promotedBy: p.by, promotedAt: iso(p.at ?? new Date()), evidenceRef: p.evidenceRef ?? null, releaseId: p.releaseId, targetRuntimeEnvironmentId: p.environmentId } as never).run(on);
  return { kind: "promoted" };
}

/** What runs in each environment. */
export interface Parity {
  readonly artifact: string;
  readonly versions: Readonly<Record<string, string>>;
  /** The environments that are not at the version of the last environment of the order that has one. */
  readonly behind: readonly string[];
}

/** The version of an artifact that each environment last received, and which environments are behind the furthest one. */
export async function parity(on: Runner, artifact: string): Promise<Parity> {
  const rows = await from(promotion)
    .innerJoin(release, (s) => eq(s.promotion.releaseId, s.release.releaseId))
    .innerJoin(runtimeEnvironment, (s) => eq(s.promotion.targetRuntimeEnvironmentId, s.runtimeEnvironment.runtimeEnvironmentId))
    .where((s) => eq(s.release.artifact, artifact))
    .select((s) => ({ env: s.runtimeEnvironment.name, kind: s.runtimeEnvironment.kind, version: s.release.version, at: s.promotion.promotedAt }))
    .orderBy((s) => [desc(s.promotion.promotedAt)])
    .run(on);
  const latest = new Map<string, { version: string; kind: string }>();
  for (const r of rows) if (!latest.has(r.env)) latest.set(r.env, { version: r.version, kind: r.kind });
  const top = [...latest.values()].sort((a, b) => PROMOTION_ORDER.indexOf(b.kind as never) - PROMOTION_ORDER.indexOf(a.kind as never))[0];
  return { artifact, versions: Object.fromEntries([...latest].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.version])), behind: top === undefined ? [] : [...latest].filter(([, v]) => v.version !== top.version).map(([k]) => k).sort() };
}

/** Environments that hold real data and are not production. */
export async function realDataOutsideProduction(on: Runner): Promise<readonly string[]> {
  const rows = await from(runtimeEnvironment).select((s) => ({ name: s.runtimeEnvironment.name, kind: s.runtimeEnvironment.kind, real: s.runtimeEnvironment.holdsRealData })).orderBy((s) => [asc(s.runtimeEnvironment.name)]).run(on);
  return rows.filter((r) => (r.real === true || (r.real as unknown) === 1) && r.kind !== "production").map((r) => r.name);
}

/** A signal as the catalog defines it. */
export interface SignalDef {
  readonly name: string;
  readonly kind: string;
  readonly unit: string;
  readonly attributes: readonly string[];
}

/** Reads the catalog of signals. */
export async function catalog(on: Runner): Promise<ReadonlyMap<string, SignalDef>> {
  const rows = await from(signal).select((s) => ({ name: s.signal.signalId, kind: s.signal.kind, unit: s.signal.unit, attrs: s.signal.attributeNames })).run(on);
  return new Map(rows.map((r) => [r.name, { name: r.name, kind: r.kind, unit: r.unit, attributes: r.attrs === "" ? [] : r.attrs.split(",").map((a) => a.trim()) }]));
}

/** One sample of a signal, ready to be handed to whatever sends telemetry. */
export interface Sample {
  readonly name: string;
  readonly kind: string;
  readonly unit: string;
  readonly value: number;
  readonly attributes: Readonly<Record<string, string>>;
  readonly at: string;
}

/** Makes a sample of a signal, and throws where the catalog does not allow it: a name it does not have, attributes that are not exactly the signal's, or a counter that goes down. */
export function sample(defs: ReadonlyMap<string, SignalDef>, name: string, value: number, attributes: Readonly<Record<string, string>> = {}, at: string | Date = new Date()): Sample {
  const d = defs.get(name);
  if (d === undefined) throw new TypeError(`the signal ${name} is not in the catalog`);
  const given = Object.keys(attributes).sort();
  if (given.join(",") !== [...d.attributes].sort().join(",")) throw new TypeError(`the signal ${name} carries ${d.attributes.join(", ") || "no attributes"}, and was given ${given.join(", ") || "none"}`);
  if (d.kind === "counter" && value < 0) throw new TypeError(`the counter ${name} cannot go down`);
  return { name, kind: d.kind, unit: d.unit, value, attributes, at: iso(at) };
}

/** How fresh one source is. */
export interface Freshness {
  readonly source: string;
  readonly status: "fresh" | "stale" | "never-loaded";
  readonly ageHours: number | null;
  readonly maxAgeHours: number;
  readonly owner: string;
}

/** Computes the freshness of each source from the latest of its loads that was not undone (the loads of the flow model): fresh, stale, or never loaded. */
export async function freshness(on: Runner, asOf: string | Date = new Date()): Promise<readonly Freshness[]> {
  const rules = await from(freshnessRule).select((s) => ({ source: s.freshnessRule.source, max: s.freshnessRule.maxAgeHours, owner: s.freshnessRule.owner })).orderBy((s) => [asc(s.freshnessRule.source)]).run(on);
  const loads = await from(flow.load).select((s) => ({ source: s.load.source, at: s.load.startedAt, undone: s.load.rolledBackAt })).run(on);
  const now = time(asOf);
  return rules.map((r) => {
    const latest = loads.filter((l) => l.source === r.source && l.undone === null && time(l.at) <= now).reduce<number | undefined>((a, l) => (a === undefined || time(l.at) > a ? time(l.at) : a), undefined);
    const max = Number(r.max);
    if (latest === undefined) return { source: r.source, status: "never-loaded" as const, ageHours: null, maxAgeHours: max, owner: r.owner };
    const age = (now - latest) / 3_600_000;
    return { source: r.source, status: age > max ? ("stale" as const) : ("fresh" as const), ageHours: Math.round(age * 10) / 10, maxAgeHours: max, owner: r.owner };
  });
}

/** What replaying one statement found. */
export interface Replayed {
  readonly workloadStatementId: string;
  readonly rows: number;
  readonly baselineRows: number;
  readonly same: boolean;
  readonly ms: number;
}

const SELECT_ONLY = /^\s*(select|with)\b/i;

/**
 * Replays the recorded statements of a workload against the database and compares the rows each gives with the number and hash recorded. Only a single select is run: a statement that is anything else, or has more
 * than one statement, is refused and not run.
 */
export async function replayWorkload(on: Runner, workloadId: string): Promise<readonly Replayed[]> {
  const rows = await from(workloadStatement).where((s) => eq(s.workloadStatement.workloadId, workloadId)).select((s) => ({ id: s.workloadStatement.workloadStatementId, sql: s.workloadStatement.statement, n: s.workloadStatement.baselineRows, h: s.workloadStatement.baselineHash })).orderBy((s) => [asc(s.workloadStatement.workloadStatementId)]).run(on);
  const out: Replayed[] = [];
  for (const r of rows) {
    if (!SELECT_ONLY.test(r.sql) || r.sql.replace(/;\s*$/, "").includes(";")) throw new TypeError(`the statement ${r.id} is not a single select, and is not replayed`);
    const t0 = performance.now();
    const got = await on.driver.query(r.sql);
    out.push({ workloadStatementId: r.id, rows: got.length, baselineRows: Number(r.n), same: got.length === Number(r.n) && (await hashOf(got)) === r.h, ms: Math.round(performance.now() - t0) });
  }
  return out;
}

/** The SHA-256 of the rows a statement gave, in the order given: what a baseline records. */
export async function hashOf(rows: readonly Record<string, unknown>[]): Promise<string> {
  return sha256Hex(JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
}

/** Registers a workload's workloadId lookup so that a caller can name what it replays. */
export async function workloads(on: Runner) {
  return from(workload).select((s) => ({ id: s.workload.workloadId, name: s.workload.name, owner: s.workload.owner, criticality: s.workload.criticality })).orderBy((s) => [asc(s.workload.criticality), asc(s.workload.workloadId)]).run(on);
}
