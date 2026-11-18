// Spec: 0023-sql-transforms FR-001
/**
 * Transforms (commons data 0023-sql-transforms): models whose SQL asks for names by their words, built in the order of what they read, each in one transaction with its tests; a model whose
 * tests find rows that are wrong is not published and the models that read it are not built.
 *
 * @example
 * ```ts
 * const p = must(transformer(schema, [{ name: "author names", materialization: "table", select: (r) => `SELECT ${r.column("author", "name")} AS name FROM ${r.table("author")}` }], { dialect }));
 * const report = await build(driver, p); // { ok: true, models: [{ outcome: "built", rows: 2, ... }] }
 * ```
 *
 * @module
 */
export { build, type BuildReport, type Finding, type ModelReport } from "./build.ts";
export {
  type Check,
  type LineageEdge,
  type Materialization,
  type Model,
  type ModelSpec,
  type Project,
  type ResolvedTest,
  type TransformError,
  type TransformOptions,
  transformer,
} from "./model.ts";
export { LEDGER, settingsOf, type TransformSettings, type Transforms } from "./settings.ts";
