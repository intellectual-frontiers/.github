// Spec: 0006-runbooks-split FR-001, FR-003, FR-004, FR-005, FR-006, FR-008, FR-009
/**
 * The static check of a runbook: the closed catalog applied to its steps. It finds a step that cannot be taken back with no gate or undo, a mutation of a transactional store with no checkpoint before it, a store attached and
 * never detached, a disposal of a workshop that is not disposable, a step that cites nothing, a verb the registry does not hold, inputs that do not fit, an effect above its verb's, a need of a verb nobody declares, a check that
 * does more than read and the proposal of a judge applied with no person between. Every finding is an error, and a runbook with a finding is not planned or run. Pure.
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
import {
  decodeRunbook,
  defineRunbook,
  type Finding,
  finding,
  flatten,
  type InputSpec,
  type InputValue,
  type Inputs,
  modeRank,
  type Runbook,
  VERBS,
  type VerbRegistry,
  type VerbSpec,
} from "@intellectual-frontiers/runbooks/governance";
import { AUTONOMY } from "@intellectual-frontiers/workbench/governance";
import { levelsOf } from "./autonomy.ts";


const fits = (spec: InputSpec, v: InputValue): boolean => {
  switch (v.kind) {
    case "literal":
      switch (spec.type) {
        case "text":
        case "path":
          return typeof v.value === "string";
        case "integer":
          return typeof v.value === "number" && Number.isInteger(v.value);
        case "flag":
          return typeof v.value === "boolean";
        case "digest":
          return typeof v.value === "string" && /^[0-9a-f]{64}$/u.test(v.value);
        case "store":
          return false;
        default:
          return absurd(spec.type);
      }
    case "store":
      return spec.type === "store";
    case "output":
    case "input":
      return true;
    default:
      return absurd(v);
  }
};

/** What is wrong with the inputs given to a verb: one reason for each input that is missing, is not of its type or is not the verb's. */
export function inputProblems(verb: VerbSpec, inputs: Inputs): readonly string[] {
  const out: string[] = [];
  for (const spec of verb.inputs) {
    const v = inputs[spec.name];
    if (v === undefined) {
      if (spec.required) out.push(`${spec.name} is required`);
    } else if (!fits(spec, v)) out.push(`${spec.name} is not of the type ${spec.type}`);
  }
  for (const name of Object.keys(inputs)) if (!verb.inputs.some((i) => i.name === name)) out.push(`${name} is not an input of ${verb.id}`);
  return out;
}

const storeOf = (inputs: Inputs): string | undefined => {
  const v = inputs["store"];
  return v?.kind === "store" ? v.store : undefined;
};

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
    if (s.spec.length === 0 && (s.controls === undefined || s.controls.length === 0)) out.push(finding("E-RB-CITATION-MISSING", s.id, `${s.id} cites no requirement and no control`));
    if (s.kind === "gate" && s.guards.length === 0) out.push(finding("E-RB-GATE-GUARDS-NOTHING", s.id, `the gate ${s.id} guards no step`));
    if (s.kind !== "verb" && s.kind !== "check" && s.kind !== "undo") continue;
    const verbId = s.kind === "verb" || s.kind === "undo" ? s.verb : s.using;
    const verb = registry.get(verbId);
    if (verb === undefined) {
      out.push(finding("E-RB-VERB-UNKNOWN", s.id, `${s.id} calls ${verbId}, which is not registered`, { verb: verbId }));
      continue;
    }
    const bad = inputProblems(verb, s.inputs);
    if (bad.length > 0) out.push(finding("E-RB-VERB-INPUTS-INVALID", s.id, `${s.id}: ${bad.join("; ")}`, { verb: verbId }));
    for (const n of verb.needs) {
      if (!declared.has(n.id) && !(s.needs ?? []).some((x) => x.id === n.id)) out.push(finding("E-RB-NEED-MISSING", s.id, `${verbId} needs ${n.id} and neither ${s.id} nor the runbook declares it`, { verb: verbId }));
    }
    if (s.kind === "check") {
      if (verb.maxMode !== "read") out.push(finding("E-RB-CHECK-NOT-READ", s.id, `the check ${s.id} uses ${verbId}, which can ${verb.maxMode}`));
      continue;
    }
    const e = s.effect;
    if (!verb.classes.includes(e.class) || modeRank(e.mode) > modeRank(verb.maxMode)) {
      out.push(finding("E-RB-EFFECT-EXCEEDS-VERB", s.id, `${s.id} declares ${e.mode} of ${e.class}, and ${verbId} is registered for at most ${verb.maxMode} of ${verb.classes.join(", ")}`, { verb: verbId }));
    }
    if (e.mode !== "read" && e.class !== "ephemeral" && !e.reversible && !guarded.has(s.id) && !compensated.has(s.id) && e.compensation === undefined && s.kind === "verb") {
      out.push(finding("E-RB-STEP-IRREVERSIBLE-UNGUARDED", s.id, `${s.id} cannot be taken back and has no gate and no undo`));
    }
    if (s.kind === "verb" && e.class === "transactional" && (e.mode === "mutate" || e.mode === "destroy")) {
      const before = flat.slice(0, i).some((p) => p.kind === "verb" && registry.get(p.verb)?.role === "checkpoint" && (storeOf(p.inputs) ?? p.effect.store) === e.store);
      if (!before) out.push(finding("E-RB-STORE-NO-CHECKPOINT", s.id, `${s.id} changes the transactional store ${e.store} and no checkpoint of it comes before`, { store: e.store }));
    }
    if (s.kind === "verb") {
      switch (verb.role) {
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
          for (const [st] of attached) if (stores.get(st)?.class !== "ephemeral") out.push(finding("E-RB-WORKSHOP-NOT-DISPOSABLE", s.id, `${s.id} disposes of the workshop while ${st} is attached`, { store: st }));
          attached.clear();
          break;
        }
        case "checkpoint":
        case undefined:
          break;
        default:
          return absurd(verb.role);
      }
      const level = levels.get(s.id)?.autonomy ?? "human-only";
      if (AUTONOMY.indexOf(level) > AUTONOMY.indexOf("agent-proposes")) {
        for (const v of Object.values(s.inputs)) {
          if (v.kind !== "output" || !judges.has(v.step)) continue;
          const from = position.get(v.step) ?? 0;
          const person = flat.slice(from + 1, i).some((p) => p.kind === "gate" || p.kind === "ask");
          if (!person) out.push(finding("E-RB-JUDGE-APPLIED", s.id, `${s.id} applies the proposal of ${v.step} with no gate or ask between them`));
        }
      }
    }
  }
  for (const [st, by] of attached) out.push(finding("E-RB-STORE-NOT-DETACHED", by, `${st} is attached by ${by} and never detached`, { store: st }));
  return out;
}

/** The findings of a value that came from outside: the reasons it is not a runbook, or the findings of the runbook it is. */
export function checkValue(input: unknown, registry: VerbRegistry = VERBS): readonly Finding[] {
  const r = decodeRunbook(input);
  return r.kind === "err" ? r.error : check(r.value, registry);
}
