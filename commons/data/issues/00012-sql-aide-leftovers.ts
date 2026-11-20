// Spec: 0044-issues FR-001
/** What SQL Aide had that this library did not, and what became of it */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 12,
  slug: "sql-aide-leftovers",
  title: "What SQL Aide had that this library did not, and what became of it",
  summary:
    "Ported: the typed algebra and query builder (sql/typed), housekeeping columns, enum/domain/sequence/schema/extension DDL (extensions/objects), TAP and pgTAP (extensions/assertions), the PL/pgSQL body DSL (extensions/routines), the sql and lint project commands (arcactl), transforms and their tests (extensions/transforms, sql/quality), generators, lineage and integrations, ephemeral targets, the dialects with their vector type, history and undo, the live-database reader with drift and adoption (lifecycle, 0055) and the driver adapters (sql/drivers, 0056). Dropped by decision of the owner, with SQL Aide itself and everything under commons/ts/data (File Aide, IFRFS, the old Arca, the old osquery-atc, Data Vault, the example) on 2026-11-20: the SQL tagged template with typed variables and the multi-file coordinator, the CSV to typed rows module, the TSDoc pipeline (governance's definitions are the one source of comments), Data Vault, File Aide (typed layouts and stores of files, a query language over them: its S3 driver, check and recipes were never built) and IFRFS (the layout of the folder that ergactl publication sync fills). They are in the history of the repository. A rebuilt Data Vault would be a model; a file or object-store connector would sit on `Source` of sql/loads (issue 10).",
  severity: "medium",
  priority: "P2",
  goals: ["G1", "G5"],
  appliesTo: { engines: "all" },
  status: { kind: "fixed", proof: [{ kind: "spec", id: "0055-sql-introspect" }, { kind: "spec", id: "0056-sql-drivers" }, { kind: "test", file: "suite/introspect.test.ts", name: "a database that was not modelled is adopted as a logical schema" }] },
  size: "l",
  links: [{ kind: "relates", to: 10 }],
  raised: "2026-11-20",
});
