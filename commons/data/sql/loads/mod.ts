// Spec: 0054-sql-loads FR-001, FR-004
/**
 * Loads and extracts (commons data 0054-sql-loads): sources (rows, CSV, lines of JSON, a select of another database), a load of a source into a typed table (append, skip-existing, upsert, replace) in one
 * transaction and recorded in a ledger, ELT through a staging table gated by SQL-DQ tests, a high-water mark for incremental loads, and extracts to CSV and lines of JSON.
 *
 * @example
 * ```ts
 * const csv = fromCsv<AuthorInsert>(text, { id: integer, name: text, bio: optional(text) });
 * const report = await runLoad({ name: "authors", source: csv, target: author, mode: "upsert", gate: (s) => [...on(s).column("name", use(notNull))] }, on);
 * report.status; // "loaded" | "gated" | "rejected" | "failed"
 * const out = await extractCsv(from(author).select((s) => ({ id: s.author.id, name: s.author.name })), on);
 * ```
 *
 * @module
 */
export { extractCsv, extractJsonLines } from "./extract.ts";
export { ensureLedger, type LoadMode, type LoadReport, type LoadSpec, loadRun, runLoad, watermarkOf } from "./load.ts";
export {
  type Batch,
  bool,
  type CellParser,
  csvRecords,
  date,
  decimal,
  fromCsv,
  fromJsonLines,
  fromQuery,
  fromRows,
  integer,
  oneOf,
  optional,
  type Rejected,
  type Source,
  text,
  timestamp,
} from "./source.ts";
