// Spec: 0018-sql-history FR-010
/**
 * The settings of the history strategy (commons data 0018-sql-history FR-010): how the files are delivered, the folder they are in, the release's label, and whether a guard that cannot be written
 * in a dialect's SQL is left out of a release package. Each has a default.
 *
 * @module
 */

/** How a frozen history is delivered. */
export type Delivery = "pipeline" | "release-package" | "in-database";

/** What a project says of history; what is not said is the default. */
export interface HistorySettings {
  /** `pipeline` (the default), `release-package` or `in-database`. */
  readonly delivery?: Delivery;
  /** The folder the files are in; `migrations` by default. */
  readonly folder?: string;
  /** The label of a release package; its last state's first digits by default. */
  readonly release?: string;
  /** Whether a release package leaves out a guard that the dialect cannot write; `refuse` by default. */
  readonly unguardable?: "refuse" | "leave-out";
  /** The schema the in-database runner is in; `lifecycle` by default. */
  readonly runnerSchema?: string;
}

/** The settings with every default filled. */
export interface History {
  readonly delivery: Delivery;
  readonly folder: string;
  readonly release: string | undefined;
  readonly unguardable: "refuse" | "leave-out";
  readonly runnerSchema: string;
}

/**
 * The settings with a project's changes.
 *
 * @param given - what a project says
 * @returns every setting
 */
export const settingsOf = (given: HistorySettings = {}): History => ({
  delivery: given.delivery ?? "pipeline",
  folder: given.folder ?? "migrations",
  release: given.release,
  unguardable: given.unguardable ?? "refuse",
  runnerSchema: given.runnerSchema ?? "lifecycle",
});
