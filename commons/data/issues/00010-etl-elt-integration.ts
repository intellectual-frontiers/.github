// Spec: 0044-issues FR-001
/** Data loads, extracts and ETL/ELT: the first slice is built; the connectors and native bulk paths are not */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 10,
  slug: "etl-elt-integration",
  title: "Data loads, extracts and ETL/ELT: connectors and native bulk paths are left",
  summary:
    "Built (0054-sql-loads, `sql/loads`): typed sources (rows, CSV with typed cells and rejected lines, JSON lines, a select of another database), loads in four modes (append, skip-existing, upsert, replace) in one transaction with a ledger of runs, ELT through a staging table gated by SQL-DQ tests, a high-water mark for incremental loads, extracts to CSV and JSON lines, and a copy between any two of SQLite, DuckDB and PostgreSQL. Left, each a connector on `Source` and `Load`: dialect-native bulk paths (PostgreSQL COPY, DuckDB read_csv, read_parquet and COPY TO, SQLite .import), Parquet and Arrow, HTTP and API sources with paging, object stores, queues, change data capture, and orchestration (schedules, dependencies, retries). The ledger of loads is a table made by the load; whether it becomes a model is OQ-1 of the spec.",
  severity: "high",
  priority: "P1",
  goals: ["G1", "G2", "G5"],
  appliesTo: { engines: "all" },
  status: { kind: "in-progress", by: "claude" },
  size: "xl",
  cites: ["0052-sql-quality FR-006", "0054-sql-loads FR-004"],
  evidence: [{ kind: "file", path: "sql/loads/load.ts" }, { kind: "spec", id: "0054-sql-loads" }],
  links: [{ kind: "relates", to: 11 }],
  raised: "2026-11-19",
});
