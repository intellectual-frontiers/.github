// Spec: 0003-workload-forms FR-001
/**
 * The contract of a form, tiny and closed. A form declares its id, its closed sum of node kinds, `validate` (the static check), `plan` (the dry run), `fold` (the run events to a state) and a native runner behind a port, and
 * nothing else. Nothing in this module names a form but by its id: the core imports nothing from a form, and a form imports nothing from another. A form is made of the logic (`FormLogic`, in the logical layer) and its native runner
 * (in the physical layer), which `Form` joins. How else a plan may be carried out is the runner axis (`runner.ts`).
 *
 * @example
 * ```ts
 * import type { FormLogic, NativeRunner } from "./form.ts";
 * // const logic: FormLogic<Runbook, RunState> = { id: "runbook", nodeKinds, validate, plan, fold }
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { ItemEvent, ItemId } from "@intellectual-frontiers/planning/governance";
import type { Contract, Finding as WorkbenchFinding, Requirement } from "@intellectual-frontiers/workbench/governance";
import type { Autonomy } from "@intellectual-frontiers/workbench/governance";
import type { Finding } from "./catalog.ts";
import type { NodeId } from "./ids.ts";
import type { BuiltFormId } from "./terms.ts";
import type { VerbRegistry } from "./verbs.ts";

/** One node of a plan: its id, its kind in the form's words, the autonomy derived for it and whether it stops for a person. */
export type PlannedNode = { readonly id: NodeId; readonly kind: string; readonly autonomy: Autonomy; readonly stopsForPerson: boolean };

/** What a dry run says, in every form. */
export type Plan = {
  readonly workload: string;
  readonly form: BuiltFormId;
  readonly nodes: readonly PlannedNode[];
  /** The requirements the workbench would evaluate: the given ones that the contract holds, and the needs of the nodes that read. */
  readonly requirements: readonly Requirement[];
  /** The requirements the workload is given that the contract does not hold. */
  readonly unknownGiven: readonly string[];
  readonly preconditions: readonly WorkbenchFinding[];
};

/** What a dry run is given: the contract, the facts a probe made, the day, and the registry of verbs to hold the workload to. */
export type PlanInput = { readonly contract: Contract; readonly facts: unknown; readonly today: string; readonly registry?: VerbRegistry };

/** What a native runner gives back where it cannot run: a finding of the catalog or a reason. */
export type RunnerFailure = readonly Finding[] | string;

/** The port a form's native run goes through, the former executor: the physical layer gives one for each form, the logic never sees it (0010-workload-runners FR-002). */
export type NativeRunner<W, D, S> = { readonly form: BuiltFormId; run(workload: W, deps: D): Promise<Result<S, RunnerFailure>> };

/** The logic of a form: its id, its closed sum of node kinds, the static check, the dry run and the fold of its run events. `F` is the facts a dry run reads. */
export type FormLogic<W, S, F = unknown> = {
  readonly id: BuiltFormId;
  /** The closed list of the kinds of node of the form: a function over its nodes is an exhaustive `switch` that ends in `absurd`. */
  readonly nodeKinds: readonly string[];
  validate(workload: W, registry?: VerbRegistry): readonly Finding[];
  plan(workload: W, input: Omit<PlanInput, "facts"> & { readonly facts: F }): Result<Plan, readonly Finding[]>;
  fold(item: ItemId, events: readonly ItemEvent[]): S;
};

/** A form: its logic and its native runner. */
export type Form<W, S, D, F = unknown> = FormLogic<W, S, F> & { readonly native: NativeRunner<W, D, S> };
