// Spec: 0008-form-runbook FR-001, FR-002, FR-004, FR-005
/**
 * The algebra of a runbook: a closed sum of eight kinds of step and the runbook they make. A `verb` step is a deterministic call; a `check` asserts and yields evidence; an `ask` parks the run for a person's input;
 * a `judge` is a bounded judgement of an agent whose output is typed and which has no effect; a `branch` reads an earlier output; an `each` fans out; a `gate` is a person's authority; an `undo` is the compensation
 * of an earlier step. Every step carries the requirements it answers to and may carry controls of a catalog (the references of grc) and what it needs (the requirements of the workbench), as every node of every form does.
 *
 * @example
 * ```ts
 * import type { Step } from "./step.ts";
 * const describe = (s: Step): string => s.kind;
 * ```
 *
 * @module
 */
import type { Autonomy } from "@intellectual-frontiers/workbench/governance";
import type { Effect, EvidenceKind, GateAction, Inputs, InputValue, NodeHead, NodeId, OutputSchema, VerbId, WorkloadHead } from "@intellectual-frontiers/workload/governance";
import type { EachKind } from "./terms.ts";

/** The id of a step: the id of a node of a runbook. */
export type StepId = NodeId;

/** What every step has: what every node has. */
export type Common = NodeHead;

/** A deterministic call of a registered verb. */
export type VerbStep = Common & { readonly kind: "verb"; readonly verb: VerbId; readonly inputs: Inputs; readonly effect: Effect };
/** An assertion that yields evidence, by a verb that only reads. */
export type CheckStep = Common & { readonly kind: "check"; readonly asserts: string; readonly using: VerbId; readonly inputs: Inputs; readonly evidence: EvidenceKind };
/** A person's input or approval: the run parks with a named approver and a deadline. */
export type AskStep = Common & { readonly kind: "ask"; readonly question: string; readonly approver: string; readonly deadlineHours: number };
/** A bounded judgement of an agent: its output is typed, it has no effect and it only proposes. */
export type JudgeStep = Common & { readonly kind: "judge"; readonly question: string; readonly output: OutputSchema };
/** A choice by an earlier output: the steps taken where the output is the value, and the steps taken where it is not. */
export type BranchStep = Common & { readonly kind: "branch"; readonly on: StepId; readonly output: string; readonly equals: string | number | boolean; readonly then: readonly Step[]; readonly otherwise: readonly Step[] };
/** A fan out of the steps of its body over the tenants, hosts or fleets a source names. */
export type EachStep = Common & { readonly kind: "each"; readonly over: EachKind; readonly source: InputValue; readonly body: readonly Step[] };
/** A person's authority over the steps it guards; it can only raise the control over them. */
export type GateStep = Common & { readonly kind: "gate"; readonly action: GateAction; readonly approver: string; readonly demands: Autonomy; readonly guards: readonly StepId[] };
/** The compensation of an earlier step, run when a later step fails. */
export type UndoStep = Common & { readonly kind: "undo"; readonly compensates: StepId; readonly verb: VerbId; readonly inputs: Inputs; readonly effect: Effect };

/** One step: a closed sum. */
export type Step = VerbStep | CheckStep | AskStep | JudgeStep | BranchStep | EachStep | GateStep | UndoStep;

/** A runbook: a workload of the form `runbook`, typed data that a program loads by import. */
export type Runbook = WorkloadHead & { readonly form: "runbook"; readonly steps: readonly Step[] };

/** The steps a step holds: those of a branch and of an each. */
export function childrenOf(step: Step): readonly Step[] {
  switch (step.kind) {
    case "branch":
      return [...step.then, ...step.otherwise];
    case "each":
      return step.body;
    case "verb":
    case "check":
    case "ask":
    case "judge":
    case "gate":
    case "undo":
      return [];
    default:
      return step satisfies never;
  }
}

/** Every step of a list in the order it is read, the steps nested in a branch or an each after their parent. */
export function flatten(steps: readonly Step[]): readonly Step[] {
  return steps.flatMap((s) => [s, ...flatten(childrenOf(s))]);
}
