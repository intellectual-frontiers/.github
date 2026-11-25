// Spec: 0009-form-reconcile FR-007, FR-008, FR-009, FR-010
/**
 * The executor of the reconcile form: it runs a pass of a loop, level-triggered. Each call observes the actual and the desired state again, diffs them, plans the changes and hashes the plan; where there is nothing to change
 * the pass applies nothing and verifies; where there is, the pass parks at the approval, naming the approver, the deadline and the hash of the plan, and goes on only when an event of a person approves that hash. The apply
 * runs once for a hash in a pass, by that hash as its idempotency key, and only for changes its declared effect covers; then the verification reads again. Every fact is a planning event on the work order, and what the pass is
 * is the fold of them.
 *
 * @example
 * ```ts
 * import { runReconcile } from "./run.ts";
 * // const state = await runReconcile(loop, deps)
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { Actor, ItemId } from "@intellectual-frontiers/planning/governance";
import { authored, type Effect, type Executor, type Finding, modeRank, storeRef, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { effectAutonomy } from "@intellectual-frontiers/workload/logical";
import { type Change, check, diffStates, foldReconcile, levelsOf, makeReconcileEvent, planText, type Reconcile, type ReconcileEvent, type ReconcileNode, type ReconcileState, reconcileFinding, requiredMode } from "@intellectual-frontiers/workload/forms/reconcile";
import type { EventSink, ResolvedInputs, Source, VerbBindings } from "../../ports.ts";
import { runVerb } from "../../verb-runner.ts";

/** How many hours a person has to approve a plan. */
export const APPROVAL_HOURS = 24;

/** What the executor is given: no agent, no workshop; the verbs, the place events are kept, the clock and who runs. */
export type ReconcileDeps = {
  readonly registry?: VerbRegistry;
  readonly bindings: VerbBindings;
  readonly sink: EventSink;
  readonly source: Source;
  /** Who runs: a person, or an agent acting for one. */
  readonly actor: Actor;
  /** The work order. */
  readonly item: ItemId;
  readonly inputs: ResolvedInputs;
};

type Flow = "ok" | "parked" | "skip" | { readonly failed: string } | { readonly fatal: string };
const failed = (f: Flow): f is { readonly failed: string } => typeof f === "object" && "failed" in f;
const fatal = (f: Flow): f is { readonly fatal: string } => typeof f === "object" && "fatal" in f;

const READ: Effect = { store: authored(storeRef("check-reads")), class: "ephemeral", mode: "read", reversible: true };

const canonical = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => (typeof x === "object" && x !== null && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

/** Runs, or resumes, the pass on the work order `deps.item`, and gives its state: the fold of its events. */
export async function runReconcile(loop: Reconcile, deps: ReconcileDeps): Promise<Result<ReconcileState, readonly Finding[] | string>> {
  const registry = deps.registry ?? VERBS;
  const found = check(loop, registry);
  if (found.length > 0) return err(found);
  const levels = new Map(levelsOf(loop).map((l) => [String(l.id), l.autonomy]));
  const outputs = new Map<string, Readonly<Record<string, string | number | boolean>>>();
  let changes: readonly Change[] = [];
  let planHash = "";
  let nothing = false;
  const stateOf = async (): Promise<ReconcileState> => foldReconcile(deps.item, await deps.sink.read(deps.item));

  const record = async (e: ReconcileEvent): Promise<Result<void, string>> => {
    const made = makeReconcileEvent({ id: deps.source.nextEventId(), item: deps.item, at: deps.source.now(), actor: deps.actor }, e);
    return made.kind === "err" ? err(`the event is refused: ${made.error.kind}`) : deps.sink.append(made.value);
  };
  const fail = async (node: string, reason: string): Promise<Flow> => {
    const r = await record({ kind: "failed", node, reason });
    return r.kind === "err" ? { fatal: r.error } : { failed: reason };
  };
  const resolve = (n: Extract<ReconcileNode, { readonly inputs: unknown }>): Result<ResolvedInputs, string> => {
    const res: Record<string, string | number | boolean> = {};
    for (const [name, v] of Object.entries(n.inputs)) {
      switch (v.kind) {
        case "literal":
          res[name] = v.value;
          break;
        case "store":
          res[name] = v.store;
          break;
        case "input": {
          const x = deps.inputs[v.name];
          if (x === undefined) return err(`the run has no input ${v.name}`);
          res[name] = x;
          break;
        }
        case "output": {
          const x = outputs.get(v.step)?.[v.name];
          if (x === undefined) return err(`${v.step} gave no output ${v.name}`);
          res[name] = x;
          break;
        }
        default:
          return absurd(v);
      }
    }
    return ok(res);
  };

  const walk = async (n: ReconcileNode): Promise<Flow> => {
    switch (n.kind) {
      case "observe": {
        const inputs = resolve(n);
        if (inputs.kind === "err") return fail(n.id, inputs.error);
        const r = await runVerb(registry, deps.bindings, n.using, n.inputs, inputs.value, READ);
        if (r.kind === "err") return fail(n.id, r.error.kind === "refused" ? r.error.finding.message : r.error.reason);
        outputs.set(n.id, r.value.outputs);
        const rec = await record({ kind: "observed", node: n.id, digest: await sha256(canonical(r.value.outputs)) });
        return rec.kind === "err" ? { fatal: rec.error } : "ok";
      }
      case "diff": {
        changes = diffStates(outputs.get(n.actual) ?? {}, outputs.get(n.desired) ?? {});
        const rec = await record({ kind: "diffed", node: n.id, changes: changes.length });
        return rec.kind === "err" ? { fatal: rec.error } : "ok";
      }
      case "plan": {
        const text = planText(changes);
        planHash = await sha256(text);
        nothing = changes.length === 0;
        outputs.set(n.id, { hash: planHash, count: changes.length, changes: text });
        const rec = await record({ kind: "planned", node: n.id, hash: planHash, changes: changes.length });
        return rec.kind === "err" ? { fatal: rec.error } : "ok";
      }
      case "approve": {
        if (nothing) return "skip";
        const now = await stateOf();
        if (now.approved.includes(planHash)) return "ok";
        if (now.declined.includes(planHash)) return fail(n.id, `the plan ${planHash} was declined`);
        if (now.nodes[n.id]?.status === "parked" && now.nodes[n.id]?.parkedFor === planHash) return "parked";
        const rec = await record({ kind: "parked", node: n.id, approver: n.approver, deadline: deps.source.instantAfterHours(deps.source.now(), APPROVAL_HOURS), plan: planHash });
        return rec.kind === "err" ? { fatal: rec.error } : "parked";
      }
      case "apply": {
        if (nothing) return "skip";
        const now = await stateOf();
        if (now.applied.includes(planHash)) return "ok";
        if (modeRank(requiredMode(changes)) > modeRank(n.effect.mode)) return fail(n.id, reconcileFinding("E-RC-APPLY-EXCEEDS-PLAN", n.id, `${n.id}: the plan needs ${requiredMode(changes)} and the effect declares ${n.effect.mode}`).message);
        const level = levels.get(n.id) ?? "human-only";
        if (effectAutonomy(n.effect) !== "agent-autonomous" && !now.approved.includes(planHash)) return fail(n.id, `${n.id} is ${level} and the plan ${planHash} is not approved`);
        const inputs = resolve(n);
        if (inputs.kind === "err") return fail(n.id, inputs.error);
        const r = await runVerb(registry, deps.bindings, n.verb, n.inputs, inputs.value, n.effect);
        if (r.kind === "err") return fail(n.id, r.error.kind === "refused" ? r.error.finding.message : r.error.reason);
        const rec = await record({ kind: "applied", node: n.id, plan: planHash, digests: r.value.digests });
        return rec.kind === "err" ? { fatal: rec.error } : "ok";
      }
      case "verify": {
        const inputs = resolve(n);
        if (inputs.kind === "err") return fail(n.id, inputs.error);
        const r = await runVerb(registry, deps.bindings, n.using, n.inputs, inputs.value, READ);
        if (r.kind === "err") return fail(n.id, r.error.kind === "refused" ? r.error.finding.message : r.error.reason);
        const holds = r.value.holds !== false;
        const rec = await record({ kind: "verified", node: n.id, holds });
        if (rec.kind === "err") return { fatal: rec.error };
        return holds ? "ok" : fail(n.id, `the assertion does not hold: ${n.asserts}`);
      }
      default:
        return absurd(n);
    }
  };

  let state = await stateOf();
  if (state.passes === 0 || state.finished !== undefined) {
    const r = await record({ kind: "pass-started", loop: loop.id, version: loop.version });
    if (r.kind === "err") return err(r.error);
    state = await stateOf();
  }
  const late = Object.entries(state.nodes).filter(([, r]) => r.status === "parked" && r.deadline !== undefined && r.deadline < deps.source.now());
  if (late.length > 0) {
    for (const [k] of late) await record({ kind: "expired", node: k });
    await record({ kind: "finished", outcome: "parked" });
    return ok(await stateOf());
  }
  let flow: Flow = "ok";
  for (const n of loop.nodes) {
    flow = await walk(n);
    if (fatal(flow)) return err(flow.fatal);
    if (flow === "parked" || failed(flow)) break;
  }
  if (failed(flow)) await record({ kind: "finished", outcome: "failed" });
  else if (flow !== "parked") await record({ kind: "finished", outcome: "converged" });
  return ok(await stateOf());
}

/** The executor of the reconcile form, behind the port of the core. */
export const RECONCILE_EXECUTOR: Executor<Reconcile, ReconcileDeps, ReconcileState> = { form: "reconcile", run: runReconcile };
