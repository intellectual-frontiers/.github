// Spec: 0008-form-runbook FR-017, FR-018, FR-019, FR-020, FR-021
/**
 * The runner of a runbook: it walks the steps in order and holds each to the autonomy derived for it. A verb is called by id through the verb runner; a check reads and asserts; a judge goes to the agent and is only recorded
 * as a proposal; an ask and a gate park the run as a planning event naming the approver and the deadline, and the run goes on when a person answers; a store is attached by the capabilities it needs and detached when the run
 * ends, well, failed or parked past its deadline; and a failure runs the compensations of the steps that succeeded, in the reverse order. Every fact is a planning event on the work order, and what the run is, is the fold of them.
 *
 * @example
 * ```ts
 * import { runRunbook } from "./run.ts";
 * // const state = await runRunbook(runbook, deps)
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Actor, ItemId } from "@intellectual-frontiers/planning/governance";
import { authored, type Effect, type Executor, type Finding, storeRef, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { disposable, type ProposedValue } from "@intellectual-frontiers/workload/logical";
import { canFinish, check, type EachKind, flatten, foldRun, levelsOf, makeRunEvent, type RunEvent, runbookFinding, type Runbook, type RunState, type Step } from "@intellectual-frontiers/workload/forms/runbook";
import { runJudge } from "../../agent-runner.ts";
import type { AgentPort, EventSink, ResolvedInputs, Source, StoreCatalog, VerbBindings, WorkshopPort } from "../../ports.ts";
import { attachStore as attachTo, detachStore } from "../../stores.ts";
import { runVerb } from "../../verb-runner.ts";

/** How many hours a person has to answer where the step names no deadline. */
export const DEFAULT_DEADLINE_HOURS = 24;

/** What the runner is given. */
export type RunDeps = {
  readonly registry?: VerbRegistry;
  readonly bindings: VerbBindings;
  readonly agent: AgentPort;
  readonly sink: EventSink;
  readonly stores: StoreCatalog;
  readonly workshop: WorkshopPort;
  readonly source: Source;
  /** Who runs: a person, or an agent acting for one. */
  readonly actor: Actor;
  /** The work order. */
  readonly item: ItemId;
  readonly inputs: ResolvedInputs;
  /** The members an `each` fans out over, for a source; none where absent. */
  readonly fleet?: (over: EachKind, source: string | undefined) => readonly string[];
};

const READ: Effect = { store: authored(storeRef("check-reads")), class: "ephemeral", mode: "read", reversible: true };

type Flow = "ok" | "parked" | { readonly failed: string } | { readonly fatal: string };
const failed = (f: Flow): f is { readonly failed: string } => typeof f === "object" && "failed" in f;
const fatal = (f: Flow): f is { readonly fatal: string } => typeof f === "object" && "fatal" in f;

/** Runs, or resumes, the run on the work order `deps.item`, and gives its state: the fold of its events. */
export async function runRunbook(runbook: Runbook, deps: RunDeps): Promise<Result<RunState, readonly Finding[] | string>> {
  const registry = deps.registry ?? VERBS;
  const found = check(runbook, registry);
  if (found.length > 0) return err(found);
  const levels = new Map(levelsOf(runbook).map((l) => [String(l.id), l.autonomy]));
  const undos = new Map(flatten(runbook.steps).filter((s) => s.kind === "undo").map((s) => [s.kind === "undo" ? String(s.compensates) : "", s]));
  const guardedBy = new Map<string, string[]>();
  for (const g of flatten(runbook.steps)) if (g.kind === "gate") for (const id of g.guards) guardedBy.set(id, [...(guardedBy.get(id) ?? []), g.id]);
  const outputs = new Map<string, Readonly<Record<string, ProposedValue | string | number | boolean>>>();
  const done: Step[] = [];
  const stateOf = async (): Promise<RunState> => foldRun(deps.item, await deps.sink.read(deps.item));

  const record = async (e: RunEvent): Promise<Result<void, string>> => {
    const made = makeRunEvent({ id: deps.source.nextEventId(), item: deps.item, at: deps.source.now(), actor: deps.actor }, e);
    return made.kind === "err" ? err(`the event is refused: ${made.error.kind}`) : deps.sink.append(made.value);
  };

  const resolve = (s: Step & { readonly kind: "verb" | "check" | "undo" }, key: string): Result<ResolvedInputs, string> => {
    const out: Record<string, string | number | boolean> = {};
    for (const [name, v] of Object.entries(s.inputs)) {
      switch (v.kind) {
        case "literal":
          out[name] = v.value;
          break;
        case "store":
          out[name] = v.store;
          break;
        case "input": {
          const x = deps.inputs[v.name];
          if (x === undefined) return err(`the run has no input ${v.name}`);
          out[name] = x;
          break;
        }
        case "output": {
          const suffix = key.slice(s.id.length);
          const x = (outputs.get(`${v.step}${suffix}`) ?? outputs.get(v.step))?.[v.name];
          if (x === undefined || typeof x === "object") return err(`${v.step} gave no output ${v.name}`);
          out[name] = x;
          break;
        }
        default:
          return absurd(v);
      }
    }
    return ok(out);
  };

  const attachStore = async (ref: string): Promise<Flow> => {
    const a = await attachTo(runbook.stores, deps.stores, deps.workshop, ref);
    if (a.kind === "err") return { failed: a.error };
    const r = await record({ kind: "attached", store: ref, class: a.value });
    return r.kind === "err" ? { fatal: r.error } : "ok";
  };

  const detachAll = async (only?: string): Promise<Flow> => {
    for (const a of (await stateOf()).attached) {
      if (only !== undefined && a.store !== only) continue;
      const d = await detachStore(deps.workshop, a.store);
      const r = await record({ kind: "detached", store: a.store });
      if (r.kind === "err") return { fatal: r.error };
      if (d.kind === "err") return { failed: d.error };
    }
    return "ok";
  };

  const park = async (key: string, approver: string, hours: number): Promise<Flow> => {
    const r = await record({ kind: "parked", step: key, approver, deadline: deps.source.instantAfterHours(deps.source.now(), hours) });
    return r.kind === "err" ? { fatal: r.error } : "parked";
  };

  const apply = async (s: Step, key: string): Promise<Flow> => {
    const started = await record({ kind: "step-started", step: key });
    if (started.kind === "err") return { fatal: started.error };
    const finish = async (digests: readonly string[], out?: Readonly<Record<string, string | number | boolean>>): Promise<Flow> => {
      const r = await record({ kind: "step-succeeded", step: key, digests, ...(out === undefined || Object.keys(out).length === 0 ? {} : { outputs: out }) });
      return r.kind === "err" ? { fatal: r.error } : "ok";
    };
    const fail = async (reason: string): Promise<Flow> => {
      const r = await record({ kind: "step-failed", step: key, reason });
      return r.kind === "err" ? { fatal: r.error } : { failed: reason };
    };
    switch (s.kind) {
      case "verb":
      case "undo":
      case "check": {
        const id = s.kind === "check" ? s.using : s.verb;
        const verb = registry.get(id);
        const inputs = resolve(s, key);
        if (inputs.kind === "err") return fail(inputs.error);
        if (s.kind !== "check" && verb?.role === "attach") return (await attachStore(String(inputs.value["store"]))) === "ok" ? finish([]) : fail(`the store ${String(inputs.value["store"])} could not be attached`);
        if (s.kind !== "check" && verb?.role === "detach") {
          const d = await detachAll(String(inputs.value["store"]));
          return d === "ok" ? finish([]) : fail("the store was not detached");
        }
        if (s.kind !== "check" && verb?.role === "dispose") {
          const now = await stateOf();
          if (!disposable(now.attached)) return fail(runbookFinding("E-RB-WORKSHOP-NOT-DISPOSABLE", s.id, `${s.id}: a store that is not ephemeral is attached`).message);
          const d = await detachAll();
          if (d !== "ok") return fail("a store was not detached");
        }
        const r = await runVerb(registry, deps.bindings, id, s.inputs, inputs.value, s.kind === "check" ? READ : s.effect);
        if (r.kind === "err") return fail(r.error.kind === "refused" ? r.error.finding.message : r.error.reason);
        outputs.set(key, r.value.outputs);
        if (s.kind === "check" && r.value.holds === false) return fail(`the assertion does not hold: ${s.asserts}`);
        return finish(r.value.digests, r.value.outputs);
      }
      case "judge": {
        const p = await runJudge(s, deps.agent);
        if (p.kind === "err") return fail(p.error);
        outputs.set(key, p.value);
        const r = await record({ kind: "proposed", step: key, output: p.value });
        if (r.kind === "err") return { fatal: r.error };
        return finish([]);
      }
      case "ask":
      case "gate":
      case "branch":
      case "each":
        return fail(`${s.kind} is not applied`);
      default:
        return absurd(s);
    }
  };

  const runSteps = async (steps: readonly Step[], suffix: string): Promise<Flow> => {
    for (const s of steps) {
      if (s.kind === "undo") continue;
      const key = `${s.id}${suffix}`;
      const now = await stateOf();
      const rec = now.steps[key];
      if (rec?.status === "succeeded") continue;
      switch (s.kind) {
        case "ask":
        case "gate": {
          if (rec?.status === "answered") {
            if (s.kind === "gate" && !rec.passed) return { failed: `the gate ${s.id} was declined` };
            continue;
          }
          if (rec?.status === "parked") return "parked";
          if (rec?.status === "expired") return "parked";
          return park(key, s.approver, s.kind === "ask" ? s.deadlineHours : DEFAULT_DEADLINE_HOURS);
        }
        case "branch": {
          const value = (outputs.get(`${s.on}${suffix}`) ?? outputs.get(s.on))?.[s.output];
          if (value === undefined) return { failed: `${s.on} gave no output ${s.output} for the branch ${s.id}` };
          const f = await runSteps(value === s.equals ? s.then : s.otherwise, suffix);
          if (f !== "ok") return f;
          continue;
        }
        case "each": {
          const src = s.source.kind === "input" ? String(deps.inputs[s.source.name] ?? "") : s.source.kind === "literal" ? String(s.source.value) : undefined;
          for (const member of deps.fleet?.(s.over, src) ?? []) {
            const f = await runSteps(s.body, `${suffix}@${member}`);
            if (f !== "ok") return f;
          }
          continue;
        }
        case "verb":
        case "check":
        case "judge": {
          const level = levels.get(s.id) ?? "human-only";
          const needsPerson = deps.actor.kind !== "person" && (level === "human-only" || level === "agent-proposes") && s.kind === "verb";
          if (needsPerson) {
            const gated = (guardedBy.get(s.id) ?? []).some((g) => now.steps[`${g}${suffix}`]?.passed === true);
            if ((rec?.status === "answered" && rec.passed) || gated) {
              // a person approved this step, or the gate that guards it: apply it
            } else if (rec?.status === "parked" || rec?.status === "expired") return "parked";
            else return park(key, "person-with-authority", DEFAULT_DEADLINE_HOURS);
          }
          const f = await apply(s, key);
          if (f !== "ok") return f;
          done.push(s);
          continue;
        }
        default:
          return absurd(s);
      }
    }
    return "ok";
  };

  const compensate = async (): Promise<void> => {
    for (const s of [...done].reverse()) {
      const u = undos.get(s.id);
      if (u === undefined || u.kind !== "undo") continue;
      const level = levels.get(u.id) ?? "human-only";
      if (deps.actor.kind !== "person" && (level === "human-only" || level === "agent-proposes")) {
        await record({ kind: "step-failed", step: u.id, reason: "the compensation needs a person" });
        continue;
      }
      const f = await apply(u, u.id);
      if (f === "ok") await record({ kind: "compensated", step: u.id, for: s.id });
    }
  };

  let state = await stateOf();
  for (const [k, rec] of Object.entries(state.steps)) if (rec.outputs !== undefined || rec.proposal !== undefined) outputs.set(k, rec.outputs ?? rec.proposal ?? {});
  if (state.runbook === undefined) {
    const r = await record({ kind: "started", runbook: runbook.id, version: runbook.version });
    if (r.kind === "err") return err(r.error);
  }
  // a step parked past its deadline ends the run as parked
  state = await stateOf();
  const late = Object.entries(state.steps).filter(([, r]) => r.status === "parked" && r.deadline !== undefined && r.deadline < deps.source.now());
  let flow: Flow;
  if (late.length > 0) {
    for (const [k] of late) await record({ kind: "expired", step: k });
    flow = "parked";
    await detachAll();
    await record({ kind: "finished", outcome: "parked" });
    return ok(await stateOf());
  }
  flow = await runSteps(runbook.steps, "");
  if (fatal(flow)) return err(flow.fatal);
  if (failed(flow)) {
    await compensate();
    await detachAll();
    await record({ kind: "finished", outcome: "failed" });
  } else if (flow === "ok") {
    await detachAll();
    if (canFinish(await stateOf())) await record({ kind: "finished", outcome: "succeeded" });
  }
  return ok(await stateOf());
}

/** The executor of the runbook form, behind the port of the core: it runs, or resumes, a runbook and gives the state of its run. */
export const RUNBOOK_EXECUTOR: Executor<Runbook, RunDeps, RunState> = { form: "runbook", run: runRunbook };
