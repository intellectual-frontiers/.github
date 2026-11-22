// Spec: 0002-evidence-capture-journal FR-001
/**
 * What the collector is given and what it gives back: the assets it observes, the way it observes one (a function a program supplies, so that the collector knows no probe), what an observation or a failure is, and the kinds of entry of the
 * journal.
 *
 * @example
 * ```ts
 * import type { Observer } from "./capture.ts";
 * const observe: Observer = async () => ({ kind: "ok", value: { stateText: "{}\n" } });
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";

/** An asset the collector observes: its id and whether it is managed or adopted (a discovered asset is not observed). */
export type Observed = { readonly id: string; readonly state: "managed" | "adopted"; /** The attributes of the asset, where the policy keys on them (the role of its cadence, its disposability). */ readonly attributes?: Readonly<Record<string, unknown>> };

/** Why an asset could not be observed: it could not be reached, it refused, or what it said could not be read. */
export type CaptureFailure = { readonly kind: "unreachable" | "refused" | "unreadable"; readonly message: string };

/** The way an asset is observed: its state as text (the same text for the same state, with no time in it), or why not. */
export type Observer = (asset: Observed) => Promise<Result<{ readonly stateText: string }, CaptureFailure>>;

/** The kinds of entry of the journal: a look at an asset that found it changed or unchanged, a look that failed, a push that failed, and a seal. */
export const JOURNAL_TYPES = ["capture.changed", "capture.unchanged", "capture.unreachable", "capture.refused", "capture.unreadable", "push.failed", "seal"] as const;

/** A kind of entry of the journal. */
export type JournalType = (typeof JOURNAL_TYPES)[number];
