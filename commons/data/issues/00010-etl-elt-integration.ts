// Spec: 0044-issues FR-001
/** There is no integration for loading data into a database, extracting it, or moving it between systems */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 10,
  slug: "etl-elt-integration",
  title: "No integration for data loads, extracts and ETL/ELT",
  summary:
    "The library describes, creates, changes, checks and transforms a database, but it has no typed way to bring data in or take it out: no source (file, CSV/JSON/Parquet, another database, an HTTP API), no sink, no bulk load per dialect (COPY, DuckDB read_csv/read_parquet, SQLite .import), no extract to files, no incremental or watermark state, no load that is idempotent and recorded in the ledger, and no contract between a load and the tables it fills (a load is checked by SQL-DQ before it is accepted). `physical/csv.ts` writes CSV only. Design `sql/extensions/loads` (sources, sinks, a typed Load plan per dialect, watermarks, run records, extract) and the connectors that sit on it as extensions or in `extensions/`; SQL-DQ (0052) is the gate between a staged load and its target.",
  severity: "high",
  priority: "P1",
  goals: ["G1", "G2", "G5"],
  appliesTo: { engines: "all" },
  status: { kind: "open" },
  size: "xl",
  cites: ["0052-sql-quality FR-006"],
  evidence: [{ kind: "file", path: "sql/physical/csv.ts" }],
  links: [{ kind: "relates", to: 11 }],
  raised: "2026-11-19",
});
