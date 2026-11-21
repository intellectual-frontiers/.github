// Spec: 0002-bridge-plans FR-001, FR-002, FR-003, FR-004
/**
 * The vocabulary of a bridge: the modes of a transfer, the rails that bound it, and the plan that comes before any change. A plan is a value: a list of actions, a closed union, in a fixed order, with
 * what it would lose and a hash of its whole, so that a person can review it and the apply of it can refuse to run when what it was made from has changed.
 *
 * @example
 * ```ts
 * import { COMPARATORS, describeAction } from "./plan.ts";
 * COMPARATORS; // ["native-digest", "size-mtime", "content-hash"]
 * ```
 *
 * @module
 */
import { absurd, type Brand } from "@intellectual-frontiers/core";
import type { Path, Problem, Revision } from "@intellectual-frontiers/anyfs/governance";
import type { Glob } from "./glob.ts";

/** The way a pair of files is compared, cheapest first: the revisions when both are SHA-256 of the bytes, the size and the time, or the bytes themselves hashed. */
export const COMPARATORS = ["native-digest", "size-mtime", "content-hash"] as const;
/** One way to compare. */
export type Comparator = (typeof COMPARATORS)[number];

/** What decided that an action is needed: the comparator, `absent` where the file is not at the destination, `size` where the sizes differ, and `undecided` where no comparator could say, so that the file is copied again. */
export type Decider = "absent" | "size" | "native-digest" | "size-mtime" | "content-hash" | "undecided";

/** The sha-256 of a plan, in hex. Made only by `hashPlan`. */
export type PlanHash = Brand<string, "anyfs-bridge plan hash">;

/** What a transfer does: `copy` never deletes; `sync` makes the destination equal and deletes only within its allowance; `move` copies, checks, and removes the source; `check` only compares. */
export type Mode =
  | { readonly kind: "copy" }
  | { readonly kind: "sync"; readonly deletes: DeletePolicy }
  | { readonly kind: "move" }
  | { readonly kind: "check" };
/** The name of a mode. */
export type ModeName = Mode["kind"];

/** Whether a plan may delete at the destination, and at most how many files. */
export type DeletePolicy = { readonly kind: "forbid" } | { readonly kind: "allow"; readonly max: number };
/** No deletes. */
export const forbidDeletes: DeletePolicy = { kind: "forbid" };
/** Deletes, at most `max`. */
export const allowDeletes = (max: number): DeletePolicy => ({ kind: "allow", max });

/** What a conflict is: two files that would become one, or two sides that changed. */
export const CONFLICT_REASONS = ["target-collision", "case-collision", "both-changed", "no-time"] as const;
/** One reason for a conflict. */
export type ConflictReason = (typeof CONFLICT_REASONS)[number];

/** Why a file is left as it is. */
export const SKIP_REASONS = ["never-overwrite", "protected", "delete-not-allowed", "too-large"] as const;
/** One reason for a skip. */
export type SkipReason = (typeof SKIP_REASONS)[number];

/** What a destination would not keep of a file: a name it refuses, a size it cannot hold, a name it folds to another by case. */
export const LOSS_KINDS = ["unportable-name", "too-large", "case-folded"] as const;
/** One kind of loss. */
export type LossKind = (typeof LOSS_KINDS)[number];
/** What would be lost at a target. */
export type Loss = { readonly kind: LossKind; readonly target: Path; readonly detail: string };

/** One thing a plan does, a closed union. Paths are relative to the endpoint's prefix; `rel` is the path at the source and `target` the path at the destination. */
export type Action =
  | { readonly kind: "create"; readonly rel: Path; readonly target: Path; readonly size: number; readonly src: Revision; readonly decided: Decider; readonly losses: readonly Loss[] }
  | { readonly kind: "update"; readonly rel: Path; readonly target: Path; readonly size: number; readonly src: Revision; readonly dst: Revision; readonly decided: Decider; readonly losses: readonly Loss[] }
  | { readonly kind: "delete"; readonly target: Path; readonly dst: Revision }
  | { readonly kind: "rename"; readonly from: Path; readonly to: Path; readonly dst: Revision }
  | { readonly kind: "remove-source"; readonly rel: Path; readonly src: Revision }
  | { readonly kind: "skip"; readonly target: Path; readonly reason: SkipReason }
  | { readonly kind: "conflict"; readonly target: Path; readonly reason: ConflictReason; readonly detail: string };

/** The name of an action. */
export type ActionKind = Action["kind"];
/** The kinds of action in the order a plan lists them. */
export const ACTION_ORDER: readonly ActionKind[] = ["create", "update", "rename", "delete", "remove-source", "skip", "conflict"];

/** What a plan is: the mode, where from and where to, the actions in order, what is already equal, what it would lose and its hash. */
export type Plan = {
  readonly mode: ModeName;
  readonly source: string;
  readonly dest: string;
  readonly actions: readonly Action[];
  readonly unchanged: number;
  /** What a transfer carries: the bytes of an object. Its other facts (type, time, mode) are the destination's own. */
  readonly carries: readonly ["bytes"];
  /** The bytes that would be written. */
  readonly bytes: number;
  readonly losses: readonly Loss[];
  readonly hash: PlanHash;
};

/** The rails that bound a transfer. Every pattern is a glob; the limits count the files and bytes that would be written. */
export type Rails = {
  /** Only the files matching one of these are transferred; none means every file. */
  readonly include?: readonly Glob[];
  /** Files matching one of these are left out. */
  readonly exclude?: readonly Glob[];
  /** Files at the destination matching one of these are never deleted or renamed. */
  readonly protect?: readonly Glob[];
  readonly maxFiles?: number;
  readonly maxBytes?: number;
  /** Files larger than this are left as they are. */
  readonly maxObjectBytes?: number;
  /** Refuse unless the destination holds nothing under its prefix. */
  readonly requireEmptyDestination?: boolean;
  /** Never replace a file that is already at the destination. */
  readonly neverOverwrite?: boolean;
};

/** Why a plan was not made. */
export type PlanRefusal =
  | { readonly kind: "unavailable"; readonly problem: Problem }
  | { readonly kind: "delete-budget"; readonly wanted: number; readonly max: number }
  | { readonly kind: "rails"; readonly reason: "max-files" | "max-bytes" | "destination-not-empty"; readonly detail: string }
  | { readonly kind: "lossy"; readonly losses: readonly Loss[] }
  | { readonly kind: "capability"; readonly detail: string }
  | { readonly kind: "rewrite"; readonly rel: Path; readonly detail: string };

/** An action in a few words. */
export function describeAction(action: Action): string {
  switch (action.kind) {
    case "create":
      return `create ${action.target} (${action.size} bytes)`;
    case "update":
      return `update ${action.target} (${action.size} bytes, by ${action.decided})`;
    case "delete":
      return `delete ${action.target}`;
    case "rename":
      return `rename ${action.from} to ${action.to}`;
    case "remove-source":
      return `remove ${action.rel} from the source`;
    case "skip":
      return `leave ${action.target} (${action.reason})`;
    case "conflict":
      return `conflict at ${action.target} (${action.reason}): ${action.detail}`;
    default:
      return absurd(action);
  }
}

/** A refusal in a sentence. */
export function describeRefusal(refusal: PlanRefusal): string {
  switch (refusal.kind) {
    case "unavailable":
      return `a store did not answer: ${refusal.problem.kind}`;
    case "delete-budget":
      return `the plan would delete ${refusal.wanted} files and the allowance is ${refusal.max}`;
    case "rails":
      return `the plan crosses a rail (${refusal.reason}): ${refusal.detail}`;
    case "lossy":
      return `the plan would lose ${refusal.losses.length} things at the destination`;
    case "capability":
      return refusal.detail;
    case "rewrite":
      return `${refusal.rel} cannot be rewritten: ${refusal.detail}`;
    default:
      return absurd(refusal);
  }
}

/** What a mode is called in a sentence. */
export function describeMode(mode: Mode): string {
  switch (mode.kind) {
    case "copy":
      return "copy: make what is missing or different at the destination, and delete nothing";
    case "sync":
      return mode.deletes.kind === "forbid" ? "sync without deletes: the destination gains and changes, and nothing is removed" : `sync: make the destination equal, deleting at most ${mode.deletes.max}`;
    case "move":
      return "move: copy, check, then remove the source";
    case "check":
      return "check: say how the two differ";
    default:
      return absurd(mode);
  }
}
