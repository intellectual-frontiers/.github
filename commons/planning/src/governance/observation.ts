// Spec: 0003-planning-reconcile FR-001
/**
 * What a source read (0037-planning FR-008, FR-009, FR-046): an observation is one thing read in one place, with where it was read (a locator), the SHA-256 of the bytes it was read from, a fingerprint of its
 * identity that does not depend on where in the place it is, the content as an observed item and the record as read; a trace is the link from an item to an observation of it, which holds the content last taken
 * (the base of a three-way merge) and whether the thing is present or absent now. Data only.
 *
 * @example
 * ```ts
 * import type { Observation } from "./observation.ts";
 * const where = (o: Observation) => o.locator.kind;
 * ```
 *
 * @module
 */
import type { Carried, ItemEvent } from "./event.ts";
import type { Day, Instant } from "./time.ts";
import type { ExternalId, ItemId } from "./ids.ts";
import type { CloseReason, ItemKind, Origin, Severity } from "./vocab.ts";

/** A value as a source read it, with no function and no `undefined`: the record kept in an observation. */
export type Raw = null | boolean | number | string | readonly Raw[] | { readonly [key: string]: Raw };

/** Where a thing was read: a span of lines of a file, a URL or a commit (the three kinds of locator). */
export type Locator =
  | { readonly kind: "file-span"; readonly path: string; readonly startLine: number; readonly endLine: number }
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "commit"; readonly sha: string; readonly repo?: string };

/** The state a place says a thing is in. */
export type ObservedState =
  | { readonly kind: "open" }
  | { readonly kind: "in-progress" }
  | { readonly kind: "deferred"; readonly until: Day }
  | { readonly kind: "closed"; readonly reason: CloseReason };

/** What a source read of one thing, as an item would hold it. */
export type ObservedItem = {
  readonly kind: ItemKind;
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly severity?: Severity;
  readonly state: ObservedState;
  readonly origin: Origin;
  /** The ids the thing has in its place. */
  readonly external: readonly ExternalId[];
  /** The id of an item the place carries in its own form (an anchor): a thing that carries it is that item. */
  readonly anchor?: ItemId;
  /** The fingerprint of the observation of the parent in the same source, for a nested thing. */
  readonly parent?: string;
  /** When the place says the thing began, where it says: it gives the time of the id made from an external id, so that two stores that read the place make the same ids. */
  readonly at?: Instant;
  /** The events the place keeps itself, where it is a history (each with its id, time and actor): taken as they are. */
  readonly history?: readonly ItemEvent[];
} & Carried;

/** One thing read in one place. */
export type Observation = {
  readonly source: string;
  readonly locator: Locator;
  /** The SHA-256 of the bytes it was read from, in lower case hexadecimal. */
  readonly contentHash: string;
  /** The identity of the thing that does not depend on where in the place it is. */
  readonly fingerprint: string;
  readonly content: ObservedItem;
  /** The record as the source read it, kept so that nothing of it is dropped. */
  readonly raw: Raw;
};

/** Whether a thing is found in its place now. */
export type Presence = "present" | "absent";

/** The link from an item to an observation of it, with the content last taken. */
export type Trace = {
  readonly item: ItemId;
  readonly source: string;
  readonly fingerprint: string;
  readonly locator: Locator;
  readonly contentHash: string;
  readonly observed: ObservedItem;
  readonly presence: Presence;
};

/** The four classes of an observation against the one last taken (SARIF 2.1.0 section 3.27.24: `baselineState`). */
export const BASELINE_CLASSES = ["new", "unchanged", "updated", "absent"] as const;
/** One class of an observation against its base. */
export type BaselineClass = (typeof BASELINE_CLASSES)[number];

/** Two locators are the same place. */
export function sameLocator(a: Locator, b: Locator): boolean {
  switch (a.kind) {
    case "file-span":
      return b.kind === "file-span" && a.path === b.path && a.startLine === b.startLine && a.endLine === b.endLine;
    case "url":
      return b.kind === "url" && a.url === b.url;
    case "commit":
      return b.kind === "commit" && a.sha === b.sha && a.repo === b.repo;
    default: {
      const never: never = a;
      return never;
    }
  }
}
