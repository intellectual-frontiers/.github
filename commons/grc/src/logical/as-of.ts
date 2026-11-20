// Spec: 0010-grc-as-of FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The as-of view (0010-grc-as-of): the state of every control at an instant, computed only from the results, exceptions, risks and ledger entries recorded up to that instant. Events after the instant
 * are ignored and expirations are evaluated at the instant, so the same events give the same view in any order and whatever came later. Pure: the instant is a parameter.
 *
 * @example
 * ```ts
 * import { asOf } from "./as-of.ts";
 * // const view = asOf({ frameworks, crosswalks: [], checks, results, exceptions: [], risks: [], ledger: [] }, "2026-03-01T00:00:00Z");
 * // view.kind === "ok" && view.value.controls.map((c) => c.status);
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type Check,
  type Crosswalk,
  controlUrns,
  type Exception,
  type Framework,
  instantMs,
  type Level,
  LEVELS,
  type Policy,
} from "@intellectual-frontiers/grc/governance";
import {
  applyExceptions,
  coverage,
  type CoverageState,
  freshness,
  type FreshnessState,
  newestResults,
  type Rollup,
  rollup,
  risksDue,
} from "./compute.ts";
import { joinAll } from "./evaluate.ts";
import { type LedgerEntry, type Result as Outcome, type Risk, type Status } from "./kinds.ts";
import { GENESIS } from "./ledger.ts";

/** Everything recorded: what the as-of view is computed from. */
export type AsOfInput = {
  readonly frameworks: readonly Framework[];
  readonly crosswalks: readonly Crosswalk[];
  readonly checks: readonly Check[];
  readonly policies?: readonly Policy[];
  readonly results: readonly Outcome[];
  readonly exceptions: readonly Exception[];
  readonly risks: readonly Risk[];
  readonly ledger: readonly LedgerEntry[];
};

/** How fresh the evidence of a control is, `unobserved` where nothing was observed. */
export type ControlFreshness = FreshnessState | "unobserved";

/** The state of a control at an instant. */
export type ControlState = {
  readonly control: string;
  readonly status: Status;
  readonly coverage: CoverageState;
  readonly freshness: ControlFreshness;
  /** The instant of the newest observation that shows the control. */
  readonly newestAt: string | undefined;
  /** The ids of the exceptions in force that excuse the control, its checks or a policy that names it. */
  readonly exceptions: readonly string[];
  /** The highest level of the risks that name the control. */
  readonly risk: Level | undefined;
  /** The ids of those risks whose review has come. */
  readonly risksDue: readonly string[];
};

/** The view at an instant. */
export type AsOfView = {
  readonly at: string;
  readonly controls: readonly ControlState[];
  /** The ledger up to the instant. */
  readonly ledger: { readonly length: number; readonly head: string };
  readonly rollup: Rollup;
};

const FRESHNESS_ORDER: readonly ControlFreshness[] = ["fresh", "due", "stale"];

function msOf(text: string): number {
  return instantMs(text) ?? Number.NaN;
}

function inForce(e: Exception, t: number): boolean {
  return msOf(e.grantedAt) <= t && t < msOf(e.expiresAt);
}

function states(input: AsOfInput, at: string, t: number): AsOfView {
  const applied = applyExceptions(newestResults(input.results), input.exceptions, at);
  const covered = new Map(coverage(input.frameworks, input.crosswalks, input.checks, applied, at).map((c) => [c.urn, c.state]));
  const due = new Set(risksDue(input.risks, at).map((r) => r.id));
  const controls = [...controlUrns(input.frameworks)].sort().map((urn): ControlState => {
    const shown = input.checks.filter((c) => c.controls.includes(urn));
    const own = applied.filter((r) => r.controls.includes(urn));
    const direct = applied.filter((r) => shown.some((c) => c.id === r.check));
    const fresh = direct.map((r): ControlFreshness => {
      const f = freshness(r.observedAt, shown.find((c) => c.id === r.check)?.freshness ?? "P0D", at);
      return f.kind === "ok" ? f.value.state : "stale";
    });
    const worst = fresh.reduce<ControlFreshness | undefined>((a, b) => (a === undefined || FRESHNESS_ORDER.indexOf(b) > FRESHNESS_ORDER.indexOf(a) ? b : a), undefined);
    const policyIds = (input.policies ?? []).filter((p) => p.controls.includes(urn)).map((p) => p.id);
    const excusing = input.exceptions.filter((e) => {
      const { type, ref } = e.excuses;
      const names = type === "control" ? ref === urn : type === "check" ? shown.some((c) => c.id === ref) : policyIds.includes(ref);
      return names && inForce(e, t);
    });
    const risks = input.risks.filter((r) => r.controls.includes(urn));
    return {
      control: urn,
      status: own.length === 0 ? "gap" : joinAll(own.map((r) => r.status)),
      coverage: covered.get(urn) ?? "gap",
      freshness: worst ?? "unobserved",
      newestAt: own.map((r) => r.observedAt).sort().at(-1),
      exceptions: excusing.map((e) => e.id).sort(),
      risk: risks.map((r) => r.level).reduce<Level | undefined>((a, b) => (a === undefined || LEVELS.indexOf(b) > LEVELS.indexOf(a) ? b : a), undefined),
      risksDue: risks.filter((r) => due.has(r.id)).map((r) => r.id).sort(),
    };
  });
  return { at, controls, ledger: ledgerUpTo(input.ledger, t), rollup: rollup(applied) };
}

function ledgerUpTo(entries: readonly LedgerEntry[], t: number): { readonly length: number; readonly head: string } {
  const bySeq = [...entries].sort((a, b) => a.seq - b.seq);
  const end = bySeq.findIndex((e) => !(msOf(e.createdAt) <= t));
  const prefix = end < 0 ? bySeq : bySeq.slice(0, end);
  return { length: prefix.length, head: prefix.at(-1)?.digest ?? GENESIS };
}

/**
 * The view at `at` from what was recorded up to it: results observed, risks and entries created and exceptions granted at or before it; an exception is in force until its expiry. An `at` that is not an instant is an error.
 *
 * @example
 * ```ts
 * // const view = asOf(input, "2026-03-01T00:00:00Z"); // events after the instant are ignored
 * ```
 */
export function asOf(input: AsOfInput, at: string): Result<AsOfView, string> {
  const t = instantMs(at);
  if (t === undefined) return err(`${at} is not an ISO 8601 instant`);
  const upTo = (text: string): boolean => msOf(text) <= t;
  return ok(
    states(
      {
        ...input,
        results: input.results.filter((r) => upTo(r.observedAt)),
        exceptions: input.exceptions.filter((e) => upTo(e.grantedAt)),
        risks: input.risks.filter((r) => upTo(r.createdAt)),
        ledger: input.ledger.filter((e) => upTo(e.createdAt)),
      },
      at,
      t,
    ),
  );
}

/**
 * The current view at `now`: the same computation with nothing filtered out by the instant.
 *
 * @example
 * ```ts
 * // currentView(input, "2026-03-01T00:00:00Z"); // nothing filtered by the instant
 * ```
 */
export function currentView(input: AsOfInput, now: string): Result<AsOfView, string> {
  const t = instantMs(now);
  return t === undefined ? err(`${now} is not an ISO 8601 instant`) : ok(states(input, now, t));
}

/**
 * The latest instant any event of the input has (an observation, a grant, the creation of a risk or an entry); `undefined` where there is none.
 *
 * @example
 * ```ts
 * // latestInstant(input); // the instant after which the as-of view no longer changes
 * ```
 */
export function latestInstant(input: AsOfInput): string | undefined {
  const all = [...input.results.map((r) => r.observedAt), ...input.exceptions.map((e) => e.grantedAt), ...input.risks.map((r) => r.createdAt), ...input.ledger.map((e) => e.createdAt)];
  return all.reduce<string | undefined>((a, b) => (a === undefined || msOf(b) > msOf(a) ? b : a), undefined);
}
