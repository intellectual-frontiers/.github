/**
 * What the tests of Tier 1 of the quality system (`quality-ladder.test.ts`, `quality-ledger.test.ts`, `quality-system.test.ts`) share: records
 * of runs made as `ifc test` makes them (through the fixtures of `quality-fixtures.ts`), and evidence judged as `gather` judges it. Nothing here
 * stands in for the code under test.
 *
 * @module
 */
import { type Instant, instantOf } from "@intellectual-frontiers/grc/grc";
import { DEFAULT_CADENCES, type FreshnessVerdict, freshnessOf } from "../src/pure/freshness.ts";
import { type Evidence, gradeOfEvidence, type Judged } from "../src/pure/ladder.ts";
import { canonicalize, type QualityRecord } from "../src/pure/record.ts";
import { assert } from "@intellectual-frontiers/test";
import { assembledRun, type CaseSpec, noon } from "./quality-fixtures.ts";

/** The day the tests judge at: the evening of 2026-11-17, the day `noon` makes the runs end on. */
export const TODAY = "2026-11-17";

/** An instant of a day and time, UTC. */
export function instant(text: string): Instant {
  const i = instantOf(text);
  assert(i !== undefined, `${text} is an instant`);
  return i;
}

/** A run as the quality system reads it: assembled as `ifc test` assembles it, made canonical. */
export async function recordOf(
  n: number,
  cases: readonly CaseSpec[],
  options: { readonly revision?: string; readonly endsAt?: bigint } = {},
): Promise<QualityRecord> {
  const c = await canonicalize({ record: await assembledRun(n, cases, { ...options, required: [] }) });
  assert(c.kind === "ok", "the record is made");
  return c.value.record;
}

/** A run that ended `days` days before the evening of `TODAY`. */
export function daysAgo(days: number): bigint {
  return noon(0) - BigInt(days) * 86_400n * 1_000_000_000n;
}

/** A piece of evidence judged by time (and by what changed, where `changes` names it) at the end of `day`. */
export function judge(e: Evidence, day = TODAY, changes: readonly string[] = []): Judged {
  const verdict: FreshnessVerdict = freshnessOf(e, changes, instant(`${day}T23:59:59.999Z`), DEFAULT_CADENCES);
  return { evidence: e, grade: gradeOfEvidence(e), freshness: verdict };
}
