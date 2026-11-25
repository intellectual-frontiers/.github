// Spec: 0008-form-runbook FR-009, FR-010, FR-011
/**
 * The static check of a runbook: the catalogs applied to its steps. It finds a step that cannot be taken back with no gate or undo, a mutation of a transactional store with no checkpoint before it, a store attached and
 * never detached, a disposal of a workshop that is not disposable and the proposal of a judge applied with no person between, and, with the checks every form shares, a step that cites nothing, a verb the registry does not hold,
 * inputs that do not fit, an effect above its verb's, a need of a verb nobody declares and a check that does more than read. Every finding is an error, and a runbook with a finding is not planned or run. Pure.
 *
 * @example
 * ```ts
 * import { check } from "./check.ts";
 * // check(runbook): [] where the runbook keeps every rule
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { AUTONOMY } from "@intellectual-frontiers/workbench/governance";
import { type Finding, finding, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { citationFinding, storeOf, verbFindings } from "@intellectual-frontiers/workload/logical";
import { runbookFinding } from "./catalog.ts";
import { decodeRunbook } from "./decode.ts";
import { defineRunbook } from "./define.ts";
import { levelsOf } from "./autonomy.ts";
import { flatten, type Runbook } from "./step.ts";

/** Every finding of a runbook, in the order of its steps. `registry` is the registry of verbs the runbook is held to. */
export function check(runbook: Runbook, registry: VerbRegistry = VERBS): readonly Finding[] {
  const out: Finding[] = [];
  const defined = defineRunbook(runbook);
  if (defined.kind === "err") out.push(...defined.error);
  const flat = flatten(runbook.steps);
  const levels = new Map(levelsOf(runbook).map((l) => [String(l.id), l]));
  const position = new Map(flat.map((s, i) => [String(s.id), i]));
  const stores = new Map(runbook.stores.map((s) => [String(s.ref), s]));
  const declared = new Set<string>(runbook.needs.map((n) => n.id));
  const guarded = new Set(flat.flatMap((s) => (s.kind === "gate" ? s.guards.map(String) : [])));
  const compensated = new Set(flat.flatMap((s) => (s.kind === "undo" ? [String(s.compensates)] : [])));
  const attached = new Map<string, string>();
  const judges = new Set(flat.filter((s) => s.kind === "judge").map((s) => String(s.id)));

  for (const [i, s] of flat.entries()) {
    const cited = citationFinding(s);
    if (cited !== undefined) out.push(cited);
    if (s.kind === "gate" && s.guards.length === 0) out.push(finding("E-WL-GATE-GUARDS-NOTHING", s.id, `the gate ${s.id} guards no step`));
    if (s.kind !== "verb" && s.kind !== "check" && s.kind !== "undo") continue;
    const verbId = s.kind === "verb" || s.kind === "undo" ? s.verb : s.using;
    const used = verbFindings({ head: s, verb: verbId, inputs: s.inputs, declared, reads: s.kind === "check", ...(s.kind === "check" ? {} : { effect: s.effect }) }, registry);
    out.push(...used.findings);
    if (used.spec === undefined || s.kind === "check") continue;
    const e = s.effect;
    if (e.mode !== "read" && e.class !== "ephemeral" && !e.reversible && !guarded.has(s.id) && !compensated.has(s.id) && e.compensation === undefined && s.kind === "verb") {
      out.push(runbookFinding("E-RB-STEP-IRREVERSIBLE-UNGUARDED", s.id, `${s.id} cannot be taken back and has no gate and no undo`));
    }
    if (s.kind === "verb" && e.class === "transactional" && (e.mode === "mutate" || e.mode === "destroy")) {
      const before = flat.slice(0, i).some((p) => p.kind === "verb" && registry.get(p.verb)?.role === "checkpoint" && (storeOf(p.inputs) ?? p.effect.store) === e.store);
      if (!before) out.push(runbookFinding("E-RB-STORE-NO-CHECKPOINT", s.id, `${s.id} changes the transactional store ${e.store} and no checkpoint of it comes before`, { store: e.store }));
    }
    if (s.kind === "verb") {
      switch (used.spec.role) {
        case "attach": {
          const st = storeOf(s.inputs);
          if (st !== undefined) attached.set(st, s.id);
          break;
        }
        case "detach": {
          const st = storeOf(s.inputs);
          if (st !== undefined) attached.delete(st);
          break;
        }
        case "dispose": {
          for (const [st] of attached) if (stores.get(st)?.class !== "ephemeral") out.push(runbookFinding("E-RB-WORKSHOP-NOT-DISPOSABLE", s.id, `${s.id} disposes of the workshop while ${st} is attached`, { store: st }));
          attached.clear();
          break;
        }
        case "checkpoint":
        case undefined:
          break;
        default:
          return absurd(used.spec.role);
      }
      const level = levels.get(s.id)?.autonomy ?? "human-only";
      if (AUTONOMY.indexOf(level) > AUTONOMY.indexOf("agent-proposes")) {
        for (const v of Object.values(s.inputs)) {
          if (v.kind !== "output" || !judges.has(v.step)) continue;
          const from = position.get(v.step) ?? 0;
          const person = flat.slice(from + 1, i).some((p) => p.kind === "gate" || p.kind === "ask");
          if (!person) out.push(finding("E-WL-JUDGE-APPLIED", s.id, `${s.id} applies the proposal of ${v.step} with no gate or ask between them`));
        }
      }
    }
  }
  for (const [st, by] of attached) out.push(runbookFinding("E-RB-STORE-NOT-DETACHED", by, `${st} is attached by ${by} and never detached`, { store: st }));
  return out;
}

/** The findings of a value that came from outside: the reasons it is not a runbook, or the findings of the runbook it is. */
export function checkValue(input: unknown, registry: VerbRegistry = VERBS): readonly Finding[] {
  const r = decodeRunbook(input);
  return r.kind === "err" ? r.error : check(r.value, registry);
}
