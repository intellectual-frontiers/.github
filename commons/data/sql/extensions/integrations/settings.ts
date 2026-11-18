// Spec: 0022-sql-integrations FR-010
/**
 * The settings of integrations (commons data 0022-sql-integrations FR-010): the ledger's table, the landing's name, when an unchanged load is skipped, how much of a snapshot may be deleted, and the CSV delimiter.
 *
 * @module
 */

/** The default name of the ledger's table. */
export const LEDGER = "integration_run";

/** What a project says of integrations; what is not said is the default. */
export interface IntegrationSettings {
  /** The ledger's table; `integration_run` by default. */
  readonly ledger?: string;
  /** The words that end the landing's name; `landing` by default. */
  readonly landing?: string;
  /** Which loads do nothing where their rows are those of the last load: `append` (the default), `all` or `none`. */
  readonly skipUnchanged?: "append" | "all" | "none";
  /** The share of the target's rows a snapshot may delete, from 0 to 1; `0.5` by default. */
  readonly maxDeleteShare?: number;
  /** The delimiter of CSV text; a comma by default. */
  readonly delimiter?: string;
}

/** The settings with every default filled. */
export interface Integrations {
  readonly ledger: string;
  readonly landing: string;
  readonly skipUnchanged: "append" | "all" | "none";
  readonly maxDeleteShare: number;
  readonly delimiter: string;
}

/**
 * The settings with a project's changes.
 *
 * @param given - what a project says
 * @returns every setting
 */
export const settingsOf = (given: IntegrationSettings = {}): Integrations => ({
  ledger: given.ledger ?? LEDGER,
  landing: given.landing ?? "landing",
  skipUnchanged: given.skipUnchanged ?? "append",
  maxDeleteShare: given.maxDeleteShare ?? 0.5,
  delimiter: given.delimiter ?? ",",
});
