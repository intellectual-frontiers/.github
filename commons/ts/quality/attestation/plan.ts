/**
 * Pre-registered test plans (commons 0021-ifqs FR-039): a plan names its cases and what makes each pass, is kept on the `quality` branch
 * (in a commit that Git signs where it is set to sign) BEFORE the run it governs, and the run records the plan's hash. A run that did not
 * follow its plan is a finding: it names a plan the branch does not hold, the plan was registered after the run, a case ran that the plan does
 * not hold, or a planned case did not run (which the run must report as `not_run`, with its reason).
 *
 * @remarks
 * The plan's hash is the SHA-256 of its canonical JSON (RFC 8785), so that the same plan is the same hash on every host. The order of two
 * records is the order of the commits that keep them: `PlanRegistration.order` and `PlanRun.order` are the positions of those commits on the
 * branch, which the host layer reads from Git; nothing here reads a clock.
 *
 * @example
 * ```ts
 * import { planHash } from "./plan.ts";
 * // const hash = await planHash({ title: "release", cases: [{ name: "a", requirements: ["0021-ifqs FR-005"], acceptance: "passes" }] });
 * ```
 *
 * @module
 */
import { absurd, formatDecodeError, json, err, ok, type Result } from "@intellectual-frontiers/core";
import { canonicalize as jcs } from "../../kernel/evidence.ts";
import { decodeTraces } from "@intellectual-frontiers/telemetry/otlp";
import { attributeText } from "../../kernel/test-record.ts";
import { type Sha256, sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { LedgerEvent } from "../pure/ledger.ts";
import type { NotRun } from "../pure/record.ts";
import { dayOfText } from "../pure/time.ts";
import { type PersonRef, planDecoder, type TestPlan } from "../pure/tier2-events.ts";
import { type Assurance, formatAssuranceError, foldAssurance, nextId } from "./rules.ts";

/** The resource attribute a run carries to name the plan that governs it: the SHA-256 of the plan (FR-039). */
export const PLAN_ATTR = "ifc.quality.plan.sha256";

/** The hash of a plan: the SHA-256 of its canonical JSON. */
export async function planHash(plan: TestPlan): Promise<Result<Sha256, string>> {
  const c = jcs(plan);
  return c.kind === "ok" ? ok(await sha256(c.value)) : err(c.error.reason);
}

/** A plan read from the file a person committed (`ifqs-plan/1`: a title and its cases), or why it is not one. */
export function readPlan(text: string): Result<TestPlan, string> {
  const r = json(text, planDecoder);
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/** The plan a run's record names, where it names one: the resource attribute `ifc.quality.plan.sha256`. */
export function planOfRecord(text: string): string | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  const t = decodeTraces(value);
  if (t.kind === "err") return undefined;
  for (const b of t.value) {
    const v = attributeText(b.resource.attributes, PLAN_ATTR);
    if (v !== undefined) return v;
  }
  return undefined;
}

/** The event that registers a plan, with the next identifier; refused where it does not follow the ledger (FR-039). */
export function planEvent(events: readonly LedgerEvent[], plan: TestPlan, by: PersonRef, day: string): Result<LedgerEvent, string> {
  const d = dayOfText(day);
  if (d.kind === "err") return d;
  const before = foldAssurance(events);
  if (before.kind === "err") return err(formatAssuranceError(before.error));
  const event: LedgerEvent = { kind: "plan-registered", id: nextId("PLAN", before.value.plans.length), plan, by, day: d.value };
  const after = foldAssurance([...events, event]);
  return after.kind === "ok" ? ok(event) : err(formatAssuranceError(after.error));
}

/** A plan as the branch holds it: its hash, where its commit stands on the branch and whether that commit is signed. */
export type PlanRegistration = {
  readonly id: string;
  readonly sha256: Sha256;
  readonly plan: TestPlan;
  readonly order: number;
  readonly signed: boolean;
};

/** The registrations of an assurance's plans, hashed; `order` and `signed` are what the host read of each plan's commit. */
export async function registrations(
  a: Assurance,
  commits: ReadonlyMap<number, { readonly order: number; readonly signed: boolean }>,
): Promise<Result<readonly PlanRegistration[], string>> {
  const out: PlanRegistration[] = [];
  for (const p of a.plans) {
    const h = await planHash(p.plan);
    if (h.kind === "err") return h;
    const c = commits.get(p.seq);
    out.push({ id: p.id, sha256: h.value, plan: p.plan, order: c?.order ?? Number.MAX_SAFE_INTEGER, signed: c?.signed ?? false });
  }
  return ok(out);
}

/** A run as the plan's judgement reads it: the plan it names, where its commit stands on the branch and its cases. */
export type PlanRun = {
  readonly traceId: string;
  readonly plan?: string;
  readonly order: number;
  readonly cases: readonly { readonly name: string; readonly outcome: string }[];
};

/** What a run that did not follow its plan did (FR-039). */
export type PlanFinding =
  | { readonly kind: "unknown-plan"; readonly run: string; readonly plan: string }
  | { readonly kind: "registered-after"; readonly run: string; readonly plan: string }
  | { readonly kind: "unsigned-plan"; readonly run: string; readonly plan: string }
  | { readonly kind: "case-not-in-plan"; readonly run: string; readonly plan: string; readonly name: string }
  | { readonly kind: "planned-not-run"; readonly run: string; readonly plan: string; readonly name: string };

/** A finding as one sentence. */
export function formatPlanFinding(f: PlanFinding): string {
  switch (f.kind) {
    case "unknown-plan":
      return `run ${f.run} names the plan ${f.plan}, and the quality branch holds no such plan`;
    case "registered-after":
      return `run ${f.run} names the plan ${f.plan}, which was registered after the run: a plan is committed before its run`;
    case "unsigned-plan":
      return `the plan ${f.plan} of run ${f.run} is not in a signed commit`;
    case "case-not-in-plan":
      return `run ${f.run} ran ${JSON.stringify(f.name)}, which the plan ${f.plan} does not hold`;
    case "planned-not-run":
      return `run ${f.run} did not run ${JSON.stringify(f.name)}, which the plan ${f.plan} holds, and did not report it as not_run`;
    default:
      return absurd(f);
  }
}

/** What the judgement of a run is given besides the run. */
export type PlanOptions = { readonly requireSigned?: boolean };

/**
 * Whether a run followed the plan it names (FR-039): the plan is registered, before the run and (where asked) signed; every case of the run
 * is a case of the plan; every case of the plan is in the run, as a result or as `not_run`. A run that names no plan has no finding: a plan
 * is optional, and a run that does not use one is judged as any other.
 */
export function judgePlanRun(plans: readonly PlanRegistration[], run: PlanRun, options: PlanOptions = {}): readonly PlanFinding[] {
  if (run.plan === undefined) return [];
  const p = plans.find((x) => x.sha256 === run.plan);
  if (p === undefined) return [{ kind: "unknown-plan", run: run.traceId, plan: run.plan }];
  const out: PlanFinding[] = [];
  if (p.order >= run.order) out.push({ kind: "registered-after", run: run.traceId, plan: p.id });
  if (options.requireSigned === true && !p.signed) out.push({ kind: "unsigned-plan", run: run.traceId, plan: p.id });
  const planned = new Set(p.plan.cases.map((c) => c.name));
  const ran = new Set(run.cases.map((c) => c.name));
  for (const c of run.cases) if (!planned.has(c.name)) out.push({ kind: "case-not-in-plan", run: run.traceId, plan: p.id, name: c.name });
  for (const c of p.plan.cases) if (!ran.has(c.name)) out.push({ kind: "planned-not-run", run: run.traceId, plan: p.id, name: c.name });
  return out;
}

/**
 * The cases of a plan that a run did not report, as the `not_run` cases the run must carry (FR-039): each with the requirements the plan gives
 * it and the reason that the plan holds it and the run did not run it. A run is kept with these so that nothing planned goes unseen.
 */
export function notRunOfPlan(id: string, plan: TestPlan, ran: readonly string[]): readonly NotRun[] {
  const seen = new Set(ran);
  return plan.cases
    .filter((c) => !seen.has(c.name))
    .map((c) => ({
      requirements: c.requirements,
      name: c.name,
      reason: `planned in ${id} and not run`,
      ...(c.file === undefined ? {} : { file: c.file }),
    }));
}
