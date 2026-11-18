// Spec: 0015-sql-safety FR-011
/**
 * The settings of the safety features (commons data 0015-sql-safety FR-011): each feature is on unless a project switches it off, and every number and name has a default.
 *
 * @module
 */

/** What a project says of safety; what is not said is the default. */
export interface SafetySettings {
  /** Whether a drop keeps what it removes in a quarantine table; `on` by default. */
  readonly quarantine?: "on" | "off";
  /** The last word of a quarantine table of a column and of a table; `quarantine` and `quarantined` by default. */
  readonly suffixes?: { readonly column?: string; readonly table?: string };
  /** Whether a step that changes a table asks for its locks with a timeout, and is tried again; `on` by default. */
  readonly locks?: "on" | "off";
  /** How long a step waits for a lock, in milliseconds; 5000 by default. */
  readonly lockTimeoutMs?: number;
  /** How long a statement of such a step may run, in milliseconds; 60000 by default. */
  readonly statementTimeoutMs?: number;
  /** How many times a step is tried where it gives up on a lock; 3 by default. */
  readonly attempts?: number;
  /** The pause before the next try, in milliseconds, multiplied by the number of tries so far; 1000 by default. */
  readonly delayMs?: number;
  /** Whether a constraint is added without checking the rows and then checked, where the dialect can; `on` by default. */
  readonly validateLater?: "on" | "off";
  /** Whether each step says what must be true after it and the run checks it; `on` by default. */
  readonly verify?: "on" | "off";
}

/** The settings with every default filled. */
export interface Safety {
  readonly quarantine: boolean;
  readonly suffixes: { readonly column: string; readonly table: string };
  readonly locks: boolean;
  readonly lockTimeoutMs: number;
  readonly statementTimeoutMs: number;
  readonly attempts: number;
  readonly delayMs: number;
  readonly validateLater: boolean;
  readonly verify: boolean;
}

/**
 * The settings with a project's changes.
 *
 * @param given - what a project says
 * @returns every setting
 */
export function settingsOf(given: SafetySettings = {}): Safety {
  return {
    quarantine: (given.quarantine ?? "on") === "on",
    suffixes: { column: given.suffixes?.column ?? "quarantine", table: given.suffixes?.table ?? "quarantined" },
    locks: (given.locks ?? "on") === "on",
    lockTimeoutMs: given.lockTimeoutMs ?? 5000,
    statementTimeoutMs: given.statementTimeoutMs ?? 60000,
    attempts: given.attempts ?? 3,
    delayMs: given.delayMs ?? 1000,
    validateLater: (given.validateLater ?? "on") === "on",
    verify: (given.verify ?? "on") === "on",
  };
}
