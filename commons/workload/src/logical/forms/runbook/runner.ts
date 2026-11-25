// Spec: 0008-form-runbook FR-023
/**
 * What a runbook asks of a runner, and how it lowers to a plan of calls. The needs are derived from the steps and never declared: a call of a verb or a check needs `calls`, an `each` `fan-out`, an `ask` `interactive`, a
 * `judge` `judge`, a `gate` `approval`, a `branch` `logic`, an `undo` `compensate`, a destroy of a durable, git or external store `destroy` (or `approval` where a gate guards it) and any other step that is `human-only` once the
 * gates are applied and that no gate guards `interactive`. The plan of calls is the closed subset an artifact is made from: a `verb` or a `check`, and an `each` over a fixed list a caller gives, with inputs that are literals, stores or inputs of
 * the run; any other step is refused with `E-WL-RUNNER-EMIT-UNSUPPORTED`. The derived autonomy of each step is carried in the plan unchanged. Pure.
 *
 * @example
 * ```ts
 * import { callsOf, runnerNeedsOf } from "./runner.ts";
 * // runnerNeedsOf(runbook).map((n) => n.capability); callsOf(runbook, { fleet })
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { type Call, type CallArg, type CallPlan, type Finding, finding, isSafeText, type PlanStep, type RunnerNeed, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { destroyNeed, distinctNeeds, personNeed } from "@intellectual-frontiers/workload/logical";
import { levelsOf } from "./autonomy.ts";
import { check } from "./check.ts";
import { type EachKind } from "./terms.ts";
import { flatten, type Runbook, type Step } from "./step.ts";

/** What a runbook needs of a runner, from its steps, in the order of the steps, once each. */
export function runnerNeedsOf(runbook: Runbook): readonly RunnerNeed[] {
  const flat = flatten(runbook.steps);
  const level = new Map(levelsOf(runbook).map((l) => [String(l.id), l.autonomy]));
  const guarded = new Set(flat.flatMap((s) => (s.kind === "gate" ? s.guards.map(String) : [])));
  const out: RunnerNeed[] = [];
  const need = (capability: RunnerNeed["capability"], node: string, why: string): void => void out.push({ capability, node, why });
  for (const s of flat) {
    const id = String(s.id);
    switch (s.kind) {
      case "verb":
      case "undo": {
        need(s.kind === "undo" ? "compensate" : "calls", id, s.kind === "undo" ? `${id} compensates ${s.compensates}` : `${id} calls ${s.verb}`);
        const d = destroyNeed(id, s.effect, guarded.has(id));
        if (d !== undefined) out.push(d);
        const p = d === undefined && !guarded.has(id) ? personNeed(id, level.get(id) ?? "human-only") : undefined;
        if (p !== undefined) out.push(p);
        break;
      }
      case "check":
        need("calls", id, `${id} calls ${s.using}`);
        break;
      case "each":
        need("fan-out", id, `${id} fans out over ${s.over}`);
        break;
      case "ask":
        need("interactive", id, `${id} asks ${s.approver}`);
        break;
      case "judge":
        need("judge", id, `${id} is a judgement of an agent`);
        break;
      case "gate":
        need("approval", id, `${id} is the approval of ${s.approver}`);
        break;
      case "branch":
        need("logic", id, `${id} chooses by the output of ${s.on}`);
        break;
      default:
        return absurd(s);
    }
  }
  return distinctNeeds(out);
}

/** What lowering to a plan of calls is given: the fixed list of members for a source of an `each`, or none where the caller has none. */
export type CallsInput = { readonly fleet: (over: EachKind, source: string) => readonly string[] | undefined; readonly registry?: VerbRegistry };

const text = (v: string | number | boolean): string => String(v);

/** The plan of calls of a runbook, or the findings that refuse it: those of the static check, then those of the emit. */
export function callsOf(runbook: Runbook, input: CallsInput): Result<CallPlan, readonly Finding[]> {
  const found = check(runbook, input.registry ?? VERBS);
  if (found.length > 0) return err(found);
  const level = new Map(levelsOf(runbook).map((l) => [String(l.id), l.autonomy]));
  const out: Finding[] = [];
  const unsafe = (node: string, what: string, value: string): void => void out.push(finding("E-WL-RUNNER-VALUE-UNSAFE", node, `${what} of ${node} is not printable ASCII: ${JSON.stringify(value.slice(0, 40))}`));
  const used = new Set<string>();
  const call = (s: Step & { readonly kind: "verb" | "check" }): Call | undefined => {
    const args: CallArg[] = [];
    for (const [name, v] of Object.entries(s.inputs).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (!isSafeText(name)) unsafe(s.id, `the input ${name}`, name);
      switch (v.kind) {
        case "literal":
          if (!isSafeText(text(v.value))) unsafe(s.id, `the input ${name}`, text(v.value));
          args.push({ name, value: { kind: "literal", text: text(v.value) } });
          break;
        case "store":
          args.push({ name, value: { kind: "literal", text: v.store } });
          break;
        case "input":
          if (!/^[a-z][a-z0-9-]*$/u.test(v.name)) unsafe(s.id, `the name of the input ${v.name}`, v.name);
          used.add(v.name);
          args.push({ name, value: { kind: "input", name: v.name } });
          break;
        case "output":
          out.push(finding("E-WL-RUNNER-EMIT-UNSUPPORTED", s.id, `${s.id} reads the output of ${v.step}: a value passed from one call to another is a computation of the program, and an artifact holds none`, { node: s.id }));
          return undefined;
        default:
          return absurd(v);
      }
    }
    return { kind: "call", step: s.id, as: s.kind, verb: s.kind === "verb" ? s.verb : s.using, args, autonomy: level.get(s.id) ?? "human-only" };
  };
  const steps: PlanStep[] = [];
  for (const s of runbook.steps) {
    switch (s.kind) {
      case "verb":
      case "check": {
        const c = call(s);
        if (c !== undefined) steps.push(c);
        break;
      }
      case "each": {
        if (s.source.kind !== "literal") {
          out.push(finding("E-WL-RUNNER-EACH-UNLISTED", s.id, `${s.id} fans out over a source that is no literal: the members would be found at run time`, { node: s.id }));
          break;
        }
        const members = input.fleet(s.over, text(s.source.value));
        if (members === undefined) {
          out.push(finding("E-WL-RUNNER-EACH-UNLISTED", s.id, `${s.id} names the list ${text(s.source.value)} and the caller gave none`, { node: s.id }));
          break;
        }
        for (const m of members) if (!isSafeText(m)) unsafe(s.id, "a member", m);
        const body: Call[] = [];
        for (const b of s.body) {
          if (b.kind !== "verb" && b.kind !== "check") {
            out.push(finding("E-WL-RUNNER-EMIT-UNSUPPORTED", b.id, `${b.id} is a ${b.kind} inside the each ${s.id}: only a verb and a check may be in the body of a loop an artifact holds`, { node: b.id }));
            continue;
          }
          const c = call(b);
          if (c !== undefined) body.push(c);
        }
        steps.push({ kind: "each", step: s.id, over: s.over, members: [...members], body, autonomy: level.get(s.id) ?? "human-only" });
        break;
      }
      case "ask":
      case "judge":
      case "branch":
      case "gate":
      case "undo":
        out.push(finding("E-WL-RUNNER-EMIT-UNSUPPORTED", s.id, `${s.id} is a ${s.kind}: an artifact holds only calls of verbs and checks and each over a fixed list`, { node: s.id }));
        break;
      default:
        return absurd(s);
    }
  }
  const credentials = [...new Set([...runbook.needs, ...flatten(runbook.steps).flatMap((s) => s.needs ?? [])].flatMap((n) => (n.kind === "credential" ? [n.name] : [])))].sort();
  for (const c of credentials) if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(c)) unsafe("", "the name of a credential", c);
  for (const v of [runbook.id, runbook.version]) if (!isSafeText(v)) unsafe("", "the id or the version of the runbook", v);
  if (out.length > 0) return err(out);
  return ok({ workload: runbook.id, version: runbook.version, form: "runbook", inputs: [...used].sort(), credentials, steps });
}
