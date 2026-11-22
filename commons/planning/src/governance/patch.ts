// Spec: 0003-planning-reconcile FR-008
/**
 * A patch (0037-planning FR-010): one event for one explicit source and place, in a closed union of the operations add an item, add an event, change a state, link and confirm. A patch does nothing until a
 * source applies it, and `makePatch` is pure. The capability a patch needs of its source and the outbox of the patches no source could apply are here too (FR-014, FR-033).
 *
 * @example
 * ```ts
 * import { opOf } from "./patch.ts";
 * opOf({ type: "closed", reason: "completed" }); // "change-state"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { EventData, ItemEvent } from "./event.ts";
import type { Instant } from "./time.ts";
import type { Capability } from "./vocab.ts";

/** The operations a patch is. */
export const PATCH_OPS = ["add-item", "add-event", "change-state", "link", "confirm"] as const;
/** One operation of a patch. */
export type PatchOp = (typeof PATCH_OPS)[number];

/** The operation an event is, by its type. */
export function opOf(data: EventData): PatchOp {
  switch (data.type) {
    case "opened":
      return "add-item";
    case "commented":
    case "edited":
    case "labeled":
    case "assigned":
    case "severity-set":
    case "blocker-set":
    case "decided":
      return "add-event";
    case "started":
    case "deferred":
    case "closed":
    case "reopened":
      return "change-state";
    case "linked":
      return "link";
    case "confirmed":
      return "confirm";
    default:
      return absurd(data);
  }
}

/** One event for one source and place: what a source is asked to write. */
export type Patch = {
  readonly op: PatchOp;
  readonly source: string;
  readonly place: string;
  readonly event: ItemEvent;
  /** The fingerprint of the observation the event is about in the source, where the item has one there. */
  readonly fingerprint?: string;
};

/** Why a patch is refused. */
export type PatchProblem = { readonly kind: "no-target"; readonly message: string };

/** The patch of an event for a source and a place, or why it is refused: the target is explicit, so a source and a place are not empty. */
export function makePatch(source: string, place: string, event: ItemEvent, fingerprint?: string): Result<Patch, PatchProblem> {
  if (source === "" || place === "") return err({ kind: "no-target", message: "a patch names the source and the place it is for" });
  return ok({ op: opOf(event.data), source, place, event, ...(fingerprint === undefined ? {} : { fingerprint }) });
}

/** The capability a patch asks of its source: the one of its kind. A source that appends events holds every type of event it can express. */
export function capabilityFor(patch: Patch): Capability {
  const data = patch.event.data;
  switch (data.type) {
    case "opened":
      return "create";
    case "closed":
    case "reopened":
      return "close";
    case "assigned":
      return "assign";
    case "commented":
    case "confirmed":
      return "append-event";
    case "edited":
    case "labeled":
    case "severity-set":
    case "blocker-set":
    case "decided":
    case "started":
    case "deferred":
    case "linked":
      return "edit";
    default:
      return absurd(data);
  }
}

/** Whether a source with these capabilities may be given the patch. */
export function mayApply(patch: Patch, capabilities: ReadonlySet<Capability>): boolean {
  const needed = capabilityFor(patch);
  return capabilities.has(needed) || (needed !== "create" && capabilities.has("append-event"));
}

/** Why a patch waits in the outbox: the capability its source lacks, or the reason the place cannot say it. */
export type OutboxReason = { readonly kind: "capability"; readonly capability: Capability } | { readonly kind: "unexpressed"; readonly reason: string };

/** A patch that no source could apply, with why, and when it was put there. */
export type OutboxEntry = { readonly patch: Patch; readonly waiting: OutboxReason; readonly at: Instant };
