/**
 * The records of Tier 2 on the `quality` branch, with real `git` (commons 0021-ifqs FR-038 to FR-041): a plan registered, a sample drawn from
 * what the branch holds and attested by a person, a mutation report ingested, and the judgement of every run against the plan it names. Each
 * record is one more file of the ledger (`host/ledger-branch.ts`), chained, in a commit that Git signs where it is set to sign.
 *
 * @remarks
 * Where a record stands on the branch is where its commit stands among the commits of the branch (`listCommits`): a plan registered before a
 * run is a plan whose commit comes before the commit of the run's file. Nothing here reads a clock; the day of each record is an argument.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { blobAt, branchTip, listCommits } from "../host/branch.ts";
import { appendEvents, type LedgerHostError, type LedgerRead, readLedger } from "../host/ledger-branch.ts";
import { parseEvidencePath } from "../pure/chain.ts";
import { parseRecordPath } from "../pure/ledger.ts";
import { readQuality } from "../pure/record.ts";
import { agentStanding, type AgentStanding } from "./agents.ts";
import type { PersonRef, SampleSubject } from "../pure/tier2-events.ts";
import { mutationEvent, readMutationReport } from "./mutation.ts";
import {
  judgePlanRun,
  planEvent,
  type PlanFinding,
  planOfRecord,
  type PlanRegistration,
  type PlanRun,
  readPlan,
  registrations,
} from "./plan.ts";
import { type Assurance, agentReviewIds, attestEvent, foldAssurance, ledgerRecordIds, nextId } from "./rules.ts";
import { drawEvent, freshSeed, verifyDraw } from "./sample.ts";

/** Why a record of Tier 2 could not be read or kept. */
export type Tier2Error = LedgerHostError | { readonly kind: "tier2"; readonly reason: string };

const refused = (reason: string): { readonly kind: "tier2"; readonly reason: string } => ({ kind: "tier2", reason });

/** A Tier 2 error as one sentence. */
export function formatTier2Error(e: Tier2Error): string {
  return e.kind === "tier2" ? e.reason : e.kind === "ledger" ? `the ledger: ${e.reason}` : JSON.stringify(e);
}

/** Where the branch stands: the ledger, its Tier 2 records, the plans as registered and each run judged against the plan it names. */
export type Tier2State = {
  readonly ledger: LedgerRead;
  readonly assurance: Assurance;
  readonly plans: readonly PlanRegistration[];
  readonly runs: readonly PlanRun[];
  readonly findings: readonly PlanFinding[];
  /** The trace ids of the runs kept, in the order they were kept. */
  readonly runIds: readonly string[];
  /** Where the commit of each ledger record stands on the branch, by the record's number. */
  readonly recordOrder: ReadonlyMap<number, number>;
};

/** What reading the state is given. */
export type ReadOptions = {
  /** Whether a plan must be in a signed commit (FR-039): where Git is set to sign, true is the harness's choice. */
  readonly requireSigned?: boolean;
  readonly allowedSigners?: string;
};

/** Reads the branch and judges every run against the plan it names. */
export async function readTier2(repo: string, options: ReadOptions = {}): Promise<Result<Tier2State, Tier2Error>> {
  const ledger = await readLedger(repo);
  if (ledger.kind === "err") return ledger;
  const folded = foldAssurance(ledger.value.events);
  if (folded.kind === "err") return err(refused(`record ${folded.error.seq}: ${folded.error.reason}`));
  const tip = await branchTip(repo);
  if (tip.kind === "err") return tip;
  if (tip.value === undefined)
    return ok({ ledger: ledger.value, assurance: folded.value, plans: [], runs: [], findings: [], runIds: [], recordOrder: new Map() });
  const commits = await listCommits(repo, options.allowedSigners === undefined ? {} : { allowedSigners: options.allowedSigners });
  if (commits.kind === "err") return commits;
  const bySeq = new Map<number, { order: number; signed: boolean }>();
  const runs: PlanRun[] = [];
  for (const [order, c] of commits.value.entries()) {
    const signed = options.allowedSigners === undefined ? c.signature !== "N" && c.signature !== "" : c.signature === "G";
    for (const change of c.changes) {
      const rec = parseRecordPath(change.path);
      if (rec !== undefined) bySeq.set(rec.seq, { order, signed });
      const p = parseEvidencePath(change.path);
      if (p.kind === "err") continue;
      const body = await blobAt(repo, c.commit, change.path);
      if (body.kind === "err") return body;
      const q = readQuality(body.value);
      if (q.kind === "err") continue;
      const plan = planOfRecord(body.value);
      runs.push({
        traceId: q.value.traceId,
        ...(plan === undefined ? {} : { plan }),
        order,
        cases: q.value.cases.map((x) => ({ name: x.name, outcome: x.outcome })),
      });
    }
  }
  const plans = await registrations(folded.value, bySeq);
  if (plans.kind === "err") return err(refused(plans.error));
  const findings = runs.flatMap((r) =>
    judgePlanRun(plans.value, r, options.requireSigned === undefined ? {} : { requireSigned: options.requireSigned }),
  );
  return ok({
    ledger: ledger.value,
    assurance: folded.value,
    plans: plans.value,
    runs,
    findings,
    runIds: runs.map((r) => r.traceId),
    recordOrder: new Map([...bySeq].map(([seq, v]) => [seq, v.order])),
  });
}

/** What every record is kept with. */
export type Tier2KeepOptions = { readonly sign?: boolean };

async function keep(
  repo: string,
  event: Parameters<typeof appendEvents>[1][number],
  options: Tier2KeepOptions,
): Promise<Result<LedgerRead, Tier2Error>> {
  return appendEvents(repo, [event], options.sign === undefined ? {} : { sign: options.sign });
}

/** Registers a plan from the text of its file (FR-039); the record is its title and cases, and the hash a run will name is returned with the record's number. */
export async function registerPlan(
  repo: string,
  planText: string,
  by: PersonRef,
  day: string,
  options: Tier2KeepOptions = {},
): Promise<Result<{ readonly id: string; readonly read: LedgerRead }, Tier2Error>> {
  const plan = readPlan(planText);
  if (plan.kind === "err") return err(refused(`the plan does not read: ${plan.error}`));
  const read = await readLedger(repo);
  if (read.kind === "err") return read;
  const event = planEvent(read.value.events, plan.value, by, day);
  if (event.kind === "err") return err(refused(event.error));
  const kept = await keep(repo, event.value, options);
  if (kept.kind === "err") return kept;
  return ok({ id: event.value.kind === "plan-registered" ? event.value.id : "", read: kept.value });
}

/** What a sample is drawn with. */
export type DrawRequest = {
  readonly subject: SampleSubject;
  readonly by: PersonRef;
  readonly day: string;
  /** The seed a person gives; fresh random bytes where not given. It is recorded either way. */
  readonly seed?: string;
  readonly size?: number;
  readonly ratePermille?: number;
};

/** The population a sample of a subject is drawn from, as the branch holds it before the record that will keep the sample. */
export async function populationOf(repo: string, subject: SampleSubject): Promise<Result<readonly string[], Tier2Error>> {
  const state = await readTier2(repo);
  if (state.kind === "err") return state;
  switch (subject) {
    case "runs":
      return ok(state.value.runIds);
    case "records":
      return ok(ledgerRecordIds(state.value.ledger.events));
    case "agent-reviews":
      return ok(agentReviewIds(state.value.ledger.events));
    default:
      return err(refused(`${String(subject)} is not a subject of a sample`));
  }
}

/** Draws a sample of what the branch holds and keeps it as a record (FR-038): the rule, the seed, the population's count and digest and the items. */
export async function drawAndKeep(
  repo: string,
  request: DrawRequest,
  options: Tier2KeepOptions = {},
): Promise<Result<{ readonly id: string; readonly items: readonly string[]; readonly seed: string }, Tier2Error>> {
  const population = await populationOf(repo, request.subject);
  if (population.kind === "err") return population;
  const state = await readTier2(repo);
  if (state.kind === "err") return state;
  const seed = request.seed ?? freshSeed();
  const id = nextId("SAMPLE", state.value.assurance.samples.length);
  const event = await drawEvent({
    id,
    subject: request.subject,
    population: population.value,
    seed,
    by: request.by,
    day: request.day,
    ...(request.size === undefined ? {} : { size: request.size }),
    ...(request.ratePermille === undefined ? {} : { ratePermille: request.ratePermille }),
  });
  if (event.kind === "err") return err(refused(event.error));
  const kept = await keep(repo, event.value, options);
  if (kept.kind === "err") return kept;
  return ok({ id, items: event.value.kind === "sample-drawn" ? event.value.items : [], seed });
}

/** Keeps a person's attestation of a sample (FR-038): a verdict on each item, the person's name and role and the day. */
export async function attestAndKeep(
  repo: string,
  input: {
    readonly sample: string;
    readonly results: readonly { readonly item: string; readonly verdict: "pass" | "fail"; readonly note?: string }[];
    readonly person: PersonRef;
    readonly day: string;
  },
  options: Tier2KeepOptions = {},
): Promise<Result<LedgerRead, Tier2Error>> {
  const read = await readLedger(repo);
  if (read.kind === "err") return read;
  const event = attestEvent(input, read.value.events);
  if (event.kind === "err") return err(refused(event.error));
  return keep(repo, event.value, options);
}

/** Whether every sample drawn on the branch is the one its seed and population give, drawn again from the population as it stood (FR-038). */
export async function verifySamples(repo: string): Promise<Result<readonly string[], Tier2Error>> {
  const state = await readTier2(repo);
  if (state.kind === "err") return state;
  const events = state.value.ledger.events;
  const checked: string[] = [];
  for (const [i, e] of events.entries()) {
    if (e.kind !== "sample-drawn") continue;
    const before = i + 1;
    const population =
      e.subject === "runs"
        ? runsBefore(state.value, before)
        : e.subject === "records"
          ? ledgerRecordIds(events, before)
          : agentReviewIds(events, before);
    const same = await verifyDraw(e, population);
    if (same.kind === "err") return err(refused(same.error));
    checked.push(e.id);
  }
  return ok(checked);
}

/** The runs kept before the commit of the ledger record number `seq`. */
function runsBefore(state: Tier2State, seq: number): readonly string[] {
  const at = state.recordOrder.get(seq) ?? Number.MAX_SAFE_INTEGER;
  return state.runs.filter((r) => r.order < at).map((r) => r.traceId);
}

/** Ingests the report of a mutation tool as a record (FR-040): the tool is named by the report, the rows by requirement. */
export async function ingestMutation(
  repo: string,
  reportText: string,
  day: string,
  options: Tier2KeepOptions = {},
): Promise<Result<{ readonly id: string }, Tier2Error>> {
  const report = readMutationReport(reportText);
  if (report.kind === "err") return err(refused(`the mutation report does not read: ${report.error}`));
  const read = await readLedger(repo);
  if (read.kind === "err") return read;
  const event = mutationEvent(read.value.events, report.value, day);
  if (event.kind === "err") return err(refused(event.error));
  const kept = await keep(repo, event.value, options);
  if (kept.kind === "err") return kept;
  return ok({ id: event.value.kind === "mutation-run" ? event.value.id : "" });
}

/** Where the sampling of the agents' reviews stands against the rate a harness states (FR-041). */
export async function agentsOf(repo: string, ratePermille: number): Promise<Result<AgentStanding, Tier2Error>> {
  const state = await readTier2(repo);
  if (state.kind === "err") return state;
  return ok(agentStanding(state.value.ledger.events, state.value.assurance, ratePermille));
}
