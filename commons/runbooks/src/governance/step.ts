// Spec: 0002-runbooks-algebra FR-001, FR-003, FR-004, FR-005, FR-007
/**
 * The algebra of a runbook: a closed sum of eight kinds of step and the runbook they make. A `verb` step is a deterministic call; a `check` asserts and yields evidence; an `ask` parks the run for a person's input;
 * a `judge` is a bounded judgement of an agent whose output is typed and which has no effect; a `branch` reads an earlier output; an `each` fans out; a `gate` is a person's authority; an `undo` is the compensation
 * of an earlier step. Every step carries the requirements it answers to and may carry controls of a catalog (the references of grc) and what it needs (the requirements of the workbench).
 *
 * @example
 * ```ts
 * import type { Step } from "./step.ts";
 * const describe = (s: Step): string => s.kind;
 * ```
 *
 * @module
 */
import type { ControlRef } from "@intellectual-frontiers/grc/governance";
import type { Autonomy, Requirement } from "@intellectual-frontiers/workbench/governance";
import type { Effect, StoreDecl } from "./effect.ts";
import type { RunbookId, SpecCite, StepId, StoreRef, VerbId } from "./ids.ts";
import type { EachKind, EvidenceKind, GateAction } from "./terms.ts";
import type { InputSpec } from "./verbs.ts";

/** The value of an input of a verb step: a literal, a store, the output of an earlier step or an input of the runbook. */
export type InputValue =
  | { readonly kind: "literal"; readonly value: string | number | boolean }
  | { readonly kind: "store"; readonly store: StoreRef }
  | { readonly kind: "output"; readonly step: StepId; readonly name: string }
  | { readonly kind: "input"; readonly name: string };

/** The inputs of a step by name. */
export type Inputs = Readonly<Record<string, InputValue>>;

/** The type of one field of the output of a judge. */
export type FieldType =
  | { readonly kind: "text" }
  | { readonly kind: "integer" }
  | { readonly kind: "flag" }
  | { readonly kind: "choice"; readonly of: readonly string[] }
  | { readonly kind: "texts" };

/** The type a judge's output decodes into: its fields by name. */
export type OutputSchema = Readonly<Record<string, FieldType>>;

/** What every step has. */
export type Common = {
  readonly id: StepId;
  readonly title: string;
  /** The requirements of a spec the step answers to. */
  readonly spec: readonly SpecCite[];
  /** The controls of a catalog the step answers to, by the reference of grc. */
  readonly controls?: readonly ControlRef[];
  /** What the step needs, as requirements of the workbench; never an installer. */
  readonly needs?: readonly Requirement[];
};

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

/** A runbook: typed data that a program loads by import. */
export type Runbook = {
  readonly id: RunbookId;
  readonly title: string;
  readonly version: string;
  /** When to use it, in a sentence: the description of its skill. */
  readonly summary: string;
  /** The ids of the requirements of the workbench the run is given (its Given). */
  readonly given: readonly string[];
  /** What the runbook needs, as requirements of the workbench. */
  readonly needs: readonly Requirement[];
  /** The inputs of the run. */
  readonly inputs: readonly InputSpec[];
  /** The stores the runbook attaches. */
  readonly stores: readonly StoreDecl[];
  readonly steps: readonly Step[];
};

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
