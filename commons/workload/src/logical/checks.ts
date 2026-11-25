// Spec: 0006-workload-split FR-003
/**
 * The checks every form holds its nodes to, the same code for each: a node that cites nothing, a verb the registry does not hold, inputs that do not fit the verb, a need of a verb nobody declares, a node that reads with a
 * verb that does more than read, an effect above its verb's, an effect on a system of record with no idempotency key, a need that names an installer, and a gate that guards nothing. A form calls these for its own kinds of node
 * and adds its own rules. Pure.
 *
 * @example
 * ```ts
 * import { inputProblems } from "./checks.ts";
 * // inputProblems(verbSpec, inputs): one reason for each input that does not fit
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Requirement } from "@intellectual-frontiers/workbench/governance";
import {
  type Effect,
  type Finding,
  finding,
  type InputSpec,
  type InputValue,
  type Inputs,
  modeRank,
  type NodeHead,
  type VerbRegistry,
  type VerbSpec,
} from "@intellectual-frontiers/workload/governance";

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

/** The store a node names as its `store` input, where it does. */
export const storeOf = (inputs: Inputs): string | undefined => {
  const v = inputs["store"];
  return v?.kind === "store" ? v.store : undefined;
};

/** Whether a need names an installer: a program or an install with an install command. */
export const installer = (r: Requirement): boolean => (r.kind === "program" || r.kind === "install") && r.install !== undefined;

/** The finding of a node that cites no requirement and no control, if it is one. */
export function citationFinding(head: NodeHead): Finding | undefined {
  return head.spec.length === 0 && (head.controls === undefined || head.controls.length === 0) ? finding("E-WL-CITATION-MISSING", head.id, `${head.id} cites no requirement and no control`) : undefined;
}

/** The findings of the needs of a node that name an installer. */
export const installerFindings = (head: NodeHead): readonly Finding[] => (head.needs ?? []).filter(installer).map((n) => finding("E-WL-NEED-INSTALLER", head.id, `the need ${n.id} of ${head.id} names an installer`));

/** The finding of an effect on a system of record that names no input as its idempotency key, if it is one. */
export function externalKeyFinding(head: NodeHead, e: Effect, inputs: Inputs): Finding | undefined {
  return e.class === "external" && e.mode !== "read" && (e.idempotencyKey === undefined || !Object.hasOwn(inputs, e.idempotencyKey)) ? finding("E-WL-EXTERNAL-NO-KEY", head.id, `${head.id} changes a system of record and names no input as its idempotency key`) : undefined;
}

/** What a node says of the verb it calls. */
export type VerbUse = {
  readonly head: NodeHead;
  readonly verb: string;
  readonly inputs: Inputs;
  /** The ids of the needs the workload declares. */
  readonly declared: ReadonlySet<string>;
  /** Whether the node only reads (a check, an observation, a verification): its verb must not do more. */
  readonly reads: boolean;
  /** The effect the node declares, for a node that applies something. */
  readonly effect?: Effect;
};

/** The findings of one node's use of a verb, and the verb where it is registered. */
export function verbFindings(use: VerbUse, registry: VerbRegistry): { readonly findings: readonly Finding[]; readonly spec: VerbSpec | undefined } {
  const out: Finding[] = [];
  const spec = registry.get(use.verb);
  if (spec === undefined) return { findings: [finding("E-WL-VERB-UNKNOWN", use.head.id, `${use.head.id} calls ${use.verb}, which is not registered`, { verb: use.verb })], spec };
  const bad = inputProblems(spec, use.inputs);
  if (bad.length > 0) out.push(finding("E-WL-VERB-INPUTS-INVALID", use.head.id, `${use.head.id}: ${bad.join("; ")}`, { verb: use.verb }));
  for (const n of spec.needs) {
    if (!use.declared.has(n.id) && !(use.head.needs ?? []).some((x) => x.id === n.id)) out.push(finding("E-WL-NEED-MISSING", use.head.id, `${use.verb} needs ${n.id} and neither ${use.head.id} nor the workload declares it`, { verb: use.verb }));
  }
  if (use.reads && spec.maxMode !== "read") out.push(finding("E-WL-CHECK-NOT-READ", use.head.id, `the node ${use.head.id} reads and uses ${use.verb}, which can ${spec.maxMode}`));
  const e = use.effect;
  if (e !== undefined && (!spec.classes.includes(e.class) || modeRank(e.mode) > modeRank(spec.maxMode))) {
    out.push(finding("E-WL-EFFECT-EXCEEDS-VERB", use.head.id, `${use.head.id} declares ${e.mode} of ${e.class}, and ${use.verb} is registered for at most ${spec.maxMode} of ${spec.classes.join(", ")}`, { verb: use.verb }));
  }
  return { findings: out, spec };
}
