// Spec: 0003-workload-forms FR-001
/**
 * What every workload and every node has, whatever the form: the inputs a verb node is given, the type a judge's output decodes into, the head every node carries (its id, title, citations, controls and needs) and
 * the head every workload carries (its id, version, what it is given and needs, its inputs, its stores, its trigger and the outcome it is expected to have). A form adds its own closed sum of nodes and nothing to this.
 *
 * @example
 * ```ts
 * import type { Trigger } from "./node.ts";
 * const nightly: Trigger = { kind: "schedule", cadence: "monthly" };
 * ```
 *
 * @module
 */
import type { ControlRef } from "@intellectual-frontiers/grc/governance";
import type { Requirement } from "@intellectual-frontiers/workbench/governance";
import type { StoreDecl } from "./effect.ts";
import type { NodeId, SpecCite, StoreRef, WorkloadId } from "./ids.ts";
import type { Cadence, FormId, Outcome } from "./terms.ts";
import type { InputSpec } from "./verbs.ts";

/** The value of an input of a verb node: a literal, a store, the output of an earlier node or an input of the workload. */
export type InputValue =
  | { readonly kind: "literal"; readonly value: string | number | boolean }
  | { readonly kind: "store"; readonly store: StoreRef }
  | { readonly kind: "output"; readonly step: NodeId; readonly name: string }
  | { readonly kind: "input"; readonly name: string };

/** The inputs of a node by name. */
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

/** What every node has, in every form. */
export type NodeHead = {
  readonly id: NodeId;
  readonly title: string;
  /** The requirements of a spec the node answers to. */
  readonly spec: readonly SpecCite[];
  /** The controls of a catalog the node answers to, by the reference of grc. */
  readonly controls?: readonly ControlRef[];
  /** What the node needs, as requirements of the workbench; never an installer. */
  readonly needs?: readonly Requirement[];
};

/**
 * The slot of a schedule in UTC: the minute, and as far as the cadence reaches the hour, the weekday (0 is Sunday), the day of the month (1 to 28) and the month (of the year for a yearly cadence, of the quarter, 1 to 3, for a quarterly one). A field a cadence
 * does not have is refused (`E-WL-SCHEDULE-SLOT-INVALID`); none given is the default slot of the cadence (0015-schedule-realization FR-002: minute 17, hour 3, Monday, the first).
 */
export type ScheduleSlot = { readonly minute: number; readonly hour?: number; readonly weekday?: number; readonly day?: number; readonly month?: number };

/** What starts a workload: a closed sum. A trigger is a field of a workload and never a form. */
export type Trigger =
  | { readonly kind: "manual" }
  | { readonly kind: "schedule"; readonly cadence: Cadence; readonly at?: ScheduleSlot }
  | { readonly kind: "event"; readonly name: string }
  | { readonly kind: "alert"; readonly name: string };

/** The outcome a run of the workload is expected to have: what makes a drill or a game day a workload with a schedule trigger and an expectation. */
export type Expectation = { readonly outcome: Outcome };

/** What every workload has, in every form. */
export type WorkloadHead = {
  readonly id: WorkloadId;
  readonly form: FormId;
  readonly title: string;
  readonly version: string;
  /** When to use it, in a sentence: the description of its skill. */
  readonly summary: string;
  /** The ids of the requirements of the workbench the run is given (its Given). */
  readonly given: readonly string[];
  /** What the workload needs, as requirements of the workbench. */
  readonly needs: readonly Requirement[];
  /** The inputs of the run. */
  readonly inputs: readonly InputSpec[];
  /** The stores the workload attaches. */
  readonly stores: readonly StoreDecl[];
  /** What starts it. */
  readonly trigger: Trigger;
  /** The outcome a run is expected to have, where it is a drill or a game day. */
  readonly expect?: Expectation;
};
