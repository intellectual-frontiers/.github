/**
 * The state of Tier 2's records and the rules that keep them honest (commons 0021-ifqs FR-038 to FR-041): the events of
 * `pure/tier2-events.ts` folded, in the order the ledger kept them, into the plans registered, the samples drawn with their attestations and
 * the mutation runs; an event that does not follow what came before is refused, and so nothing is written.
 *
 * - A plan has a name, cases (each with its acceptance criterion) that no other case of it repeats, and the person who registered it.
 * - A sample holds as many distinct items as its size says; it is attested once, by a named person, with a result on each of its items and
 *   no result on any other, and not before the day it was drawn. An attestation by no one, or by a name that is empty, is refused: the person
 *   is data, never inferred.
 * - A mutation run's rows account for every mutant they count.
 *
 * @remarks
 * Pure: the fold reads the events; the identifiers are the next number of each kind. `foldAssurance` is run by the host over the whole ledger
 * every time one is appended or read.
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import type { LedgerEvent } from "../pure/ledger.ts";
import { dayOfText } from "../pure/time.ts";
import type { MutationRow, PersonRef, SampleSubject, TestPlan } from "../pure/tier2-events.ts";

/** A plan as registered: where it stands in the ledger, who registered it and when. */
export type RegisteredPlan = {
  readonly id: string;
  readonly plan: TestPlan;
  readonly by: PersonRef;
  readonly day: string;
  readonly seq: number;
};

/** A person's attestation of a sample. */
export type Attestation = {
  readonly person: PersonRef;
  readonly day: string;
  readonly seq: number;
  readonly results: readonly { readonly item: string; readonly verdict: "pass" | "fail"; readonly note?: string }[];
};

/** A sample as drawn, with its attestation where a person has made one. */
export type DrawnSample = {
  readonly id: string;
  readonly subject: SampleSubject;
  readonly seed: string;
  readonly population: { readonly count: number; readonly sha256: string };
  readonly size: number;
  readonly items: readonly string[];
  readonly ratePermille?: number;
  readonly by: PersonRef;
  readonly day: string;
  readonly seq: number;
  readonly attested?: Attestation;
};

/** A mutation run as recorded. */
export type RecordedMutationRun = {
  readonly id: string;
  readonly tool: { readonly name: string; readonly version?: string };
  readonly revision: string;
  readonly rows: readonly MutationRow[];
  readonly day: string;
  readonly seq: number;
};

/** The records of Tier 2 as the ledger's events fold them. */
export type Assurance = {
  readonly plans: readonly RegisteredPlan[];
  readonly samples: readonly DrawnSample[];
  readonly mutations: readonly RecordedMutationRun[];
};

/** No record of Tier 2. */
export const emptyAssurance: Assurance = { plans: [], samples: [], mutations: [] };

/** Why a record of Tier 2 does not follow the ones before it. */
export type AssuranceError = { readonly seq: number; readonly kind: LedgerEvent["kind"]; readonly reason: string };

/** An assurance error as one sentence. */
export function formatAssuranceError(e: AssuranceError): string {
  return `record ${e.seq} (${e.kind}): ${e.reason}`;
}

/** The next identifier of a kind, `PLAN-0001`, `SAMPLE-0001`, `MUT-0001`. */
export function nextId(prefix: "PLAN" | "SAMPLE" | "MUT", count: number): string {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

/** The accounting of a mutation row: every mutant is killed, timed out, survived, uncovered or equivalent, and none is counted twice. */
export function rowProblem(r: MutationRow): string | undefined {
  const parts = [r.killed, r.survived, r.timeout ?? 0, r.noCoverage ?? 0, r.equivalent ?? 0];
  if (r.mutants < 1) return `${r.requirement} counts no mutant`;
  if (parts.some((n) => !Number.isInteger(n) || n < 0)) return `${r.requirement} counts a mutant a negative or fractional number of times`;
  const sum = parts.reduce((a, b) => a + b, 0);
  return sum === r.mutants ? undefined : `${r.requirement} counts ${r.mutants} mutants and accounts for ${sum}`;
}

/** The records of Tier 2 in a ledger's events (in order), or the first that does not follow the ones before it. */
export function foldAssurance(events: readonly LedgerEvent[]): Result<Assurance, AssuranceError> {
  const plans: RegisteredPlan[] = [];
  const samples: DrawnSample[] = [];
  const mutations: RecordedMutationRun[] = [];
  for (const [i, e] of events.entries()) {
    const seq = i + 1;
    const refuse = (reason: string): Result<Assurance, AssuranceError> => err({ seq, kind: e.kind, reason });
    switch (e.kind) {
      case "plan-registered": {
        if (plans.some((p) => p.id === e.id)) return refuse(`${e.id} is already registered`);
        if (e.by.name.trim() === "") return refuse("a plan is registered by a named person");
        if (e.plan.title.trim() === "") return refuse("a plan has a title");
        if (e.plan.cases.length === 0) return refuse("a plan names at least one case");
        const names = new Set<string>();
        for (const c of e.plan.cases) {
          if (c.name.trim() === "") return refuse("a case of a plan has a name");
          if (names.has(c.name)) return refuse(`the case ${JSON.stringify(c.name)} is named twice`);
          names.add(c.name);
          if (c.acceptance.trim() === "") return refuse(`the case ${JSON.stringify(c.name)} has no acceptance criterion`);
        }
        plans.push({ id: e.id, plan: e.plan, by: e.by, day: e.day, seq });
        break;
      }
      case "sample-drawn": {
        if (samples.some((s) => s.id === e.id)) return refuse(`${e.id} is already drawn`);
        if (e.by.name.trim() === "") return refuse("a sample is drawn by a named person");
        if (e.seed.trim() === "") return refuse("a sample records its seed");
        if (e.size < 1 || e.items.length !== e.size) return refuse(`${e.id} says its size is ${e.size} and lists ${e.items.length} items`);
        if (new Set(e.items).size !== e.items.length) return refuse(`${e.id} lists an item twice`);
        if (e.size > e.population.count) return refuse(`${e.id} holds more items than its population`);
        samples.push({
          id: e.id,
          subject: e.subject,
          seed: e.seed,
          population: e.population,
          size: e.size,
          items: e.items,
          ...(e.ratePermille === undefined ? {} : { ratePermille: e.ratePermille }),
          by: e.by,
          day: e.day,
          seq,
        });
        break;
      }
      case "sample-attested": {
        const at = samples.findIndex((s) => s.id === e.sample);
        const s = samples[at];
        if (s === undefined) return refuse(`${e.sample} is not drawn`);
        if (s.attested !== undefined) return refuse(`${e.sample} is already attested`);
        if (e.person.name.trim() === "") return refuse("a sample is attested by a named person");
        if (e.day < s.day) return refuse(`${e.sample} is attested on ${e.day}, before the day it was drawn, ${s.day}`);
        const seen = new Set(e.results.map((r) => r.item));
        if (seen.size !== e.results.length) return refuse("an item has two results");
        const missing = s.items.filter((x) => !seen.has(x));
        if (missing.length > 0) return refuse(`no result for ${missing.join(", ")}: an attestation gives a result on each item sampled`);
        const stray = e.results.filter((r) => !s.items.includes(r.item));
        if (stray.length > 0) return refuse(`${stray.map((r) => r.item).join(", ")} is not in ${e.sample}`);
        samples[at] = {
          ...s,
          attested: {
            person: e.person,
            day: e.day,
            seq,
            results: e.results.map((r) => ({ item: r.item, verdict: r.verdict, ...(r.note === undefined ? {} : { note: r.note }) })),
          },
        };
        break;
      }
      case "mutation-run": {
        if (mutations.some((m) => m.id === e.id)) return refuse(`${e.id} is already recorded`);
        if (e.tool.name.trim() === "") return refuse("a mutation run names the tool that made it");
        if (e.revision.trim() === "") return refuse("a mutation run names the revision it ran at");
        if (e.results.length === 0) return refuse("a mutation run has at least one row");
        for (const r of e.results) {
          const problem = rowProblem(r);
          if (problem !== undefined) return refuse(problem);
        }
        mutations.push({ id: e.id, tool: e.tool, revision: e.revision, rows: e.results, day: e.day, seq });
        break;
      }
      case "nonconformance-opened":
      case "nonconformance-linked":
      case "capa-opened":
      case "capa-verified":
      case "capa-closed":
      case "nonconformance-closed":
      case "statement":
      case "review":
      case "probe":
        break;
      default:
        return absurd(e);
    }
  }
  return ok({ plans, samples, mutations });
}

/** What a person's attestation is made with: a verdict on each item of the sample, and who gives them. */
export type AttestInput = {
  readonly sample: string;
  readonly results: readonly { readonly item: string; readonly verdict: "pass" | "fail"; readonly note?: string }[];
  readonly person: PersonRef;
  readonly day: string;
};

/** The event of a person's attestation of a sample, refused where it does not follow the ledger's events (FR-038). */
export function attestEvent(input: AttestInput, events: readonly LedgerEvent[]): Result<LedgerEvent, string> {
  const day = dayOfText(input.day);
  if (day.kind === "err") return day;
  const event: LedgerEvent = {
    kind: "sample-attested",
    sample: input.sample,
    results: input.results,
    person: input.person,
    day: day.value,
  };
  const folded = foldAssurance([...events, event]);
  return folded.kind === "ok" ? ok(event) : err(formatAssuranceError(folded.error));
}

/** The ledger's files as a sample's items name them,`000012-review`: the sequence number, six digits, and the kind. */
export function recordId(seq: number, kind: string): string {
  return `${String(seq).padStart(6, "0")}-${kind}`;
}

/** The files of the ledger in `events`, each as its item name, before the record number `before` (the population a sample drawn at that number is drawn from). */
export function ledgerRecordIds(events: readonly LedgerEvent[], before: number = events.length + 1): readonly string[] {
  return events.flatMap((e, i) => (i + 1 < before ? [recordId(i + 1, e.kind)] : []));
}

/** The reviews that agents made, each as its item name (FR-041). */
export function agentReviewIds(events: readonly LedgerEvent[], before: number = events.length + 1): readonly string[] {
  return events.flatMap((e, i) => (i + 1 < before && e.kind === "review" && e.by === "agent" ? [recordId(i + 1, e.kind)] : []));
}
