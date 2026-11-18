// Spec: 0022-sql-integrations FR-001
/**
 * Integrations (commons data 0022-sql-integrations): rows from outside brought into a model's tables, landed and checked before they touch a table, loaded in one transaction, and recorded.
 *
 * @example
 * ```ts
 * const l = must(loader(schema, { name: "kinds", table: "genre", source: { kind: "rows", rows: [{ code: "novel", label: "Novel" }] } }, { dialect }));
 * const report = await load(driver, l); // { outcome: "loaded", inserted: 1, ... }
 * ```
 *
 * @module
 */
export { parseCsv } from "./csv.ts";
export {
  type ContractColumn,
  type IntegrationError,
  type IntegrationSpec,
  type LineageEdge,
  lineageOf,
  loader,
  type Loader,
  type LoaderOptions,
  type SourceAdapter,
  sourceLabel,
  type SourceSpec,
  type Strategy,
  upstream,
} from "./integration.ts";
export { load, type LoadError, type LoadReport } from "./load.ts";
export { type IntegrationSettings, type Integrations, LEDGER, settingsOf } from "./settings.ts";
