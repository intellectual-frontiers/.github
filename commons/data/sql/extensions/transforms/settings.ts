// Spec: 0023-sql-transforms FR-008
/**
 * The settings of transforms (commons data 0023-sql-transforms FR-008).
 *
 * @module
 */

/** What a project says of transforms; what is not said is the default. */
export interface TransformSettings {
  /** The schema models are written in; the schema of the tables where it is not said. */
  readonly schema?: string;
  /** The ledger's table; `transform_run` by default. */
  readonly ledger?: string;
  /** The number of rows in a sample of what a test found; 5 by default. */
  readonly sample?: number;
}

/** The settings with every default filled. */
export interface Transforms {
  readonly schema: string | undefined;
  readonly ledger: string;
  readonly sample: number;
}

/** The default name of the ledger's table. */
export const LEDGER = "transform_run";

/**
 * The settings with a project's changes.
 *
 * @param given - what a project says
 * @returns every setting
 */
export const settingsOf = (given: TransformSettings = {}): Transforms => ({ schema: given.schema, ledger: given.ledger ?? LEDGER, sample: given.sample ?? 5 });
