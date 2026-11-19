// Spec: 0045-issues-model FR-003
/**
 * Issues in the database (commons data 0045-issues-model): the issues that the code holds (0044-issues), copied into the tables of the issues model and kept in step.
 *
 * @example
 * ```ts
 * const reports = must(await syncIssues(driver, schema, dialect, [issues]));
 * // [{ scope: "data", outcome: "synced", inserted: 7, ... }], and again: outcome "unchanged"
 * ```
 *
 * @module
 */
export { contentHashOf, syncIssues, type SyncError, type SyncOptions, type SyncReport } from "./sync.ts";
