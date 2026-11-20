// Spec: 0044-issues FR-001
/** What SQL Aide has that this library does not, so that it cannot be deleted yet */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 12,
  slug: "sql-aide-leftovers",
  title: "What SQL Aide has that this library does not: SQL Aide cannot be deleted yet",
  summary:
    "Ported: the typed algebra and query builder (sql/typed), housekeeping columns, enum/domain/sequence/schema/extension DDL (extensions/objects), TAP and pgTAP (extensions/assertions), the PL/pgSQL body DSL (extensions/routines), the sql and lint project commands (arcactl), transforms and their tests (extensions/transforms, sql/quality), generators, lineage and integrations, ephemeral targets, the dialects with their vector type, history and undo. Left, by value: (1) introspection of a live database into a state (ISLM's catalog reader and deep comparison, 1,300 lines): the core of adopting a database that exists, to be built in lifecycle; (2) public driver adapters typed by the shape of the client (node:sqlite, pg, PGlite, DuckDB, Bun.SQL): a unit `sql/drivers` that the loads' connectors need; (3) the SQL tagged template with typed variables and the coordinator that emits a model as several ordered files: an extension, low; (4) CSV to a typed TypeScript module of rows (seeds): a generator extension, low; (5) the TSDoc pipeline: not to be ported, governance's definitions are the one source. Dependents that go with it or on their own: the old Arca (634 lines; replaced by models/arca*), osquery-atc (313; replaced by extensions/osquery-atc), Data Vault (431; to be rebuilt as a model), the example, 16 test files, the docs lens and the workflow of SQL Aide, and specification 0009. File Aide (3,190 lines) and IFRFS do not import SQL Aide and are decided apart. Delete SQL Aide when (1) and (2) are built, Data Vault is rebuilt or dropped, and the dependents are deleted in the same change.",
  severity: "medium",
  priority: "P2",
  goals: ["G1", "G5"],
  appliesTo: { engines: "all" },
  status: { kind: "open" },
  size: "l",
  evidence: [{ kind: "file", path: "../ts/data/sql-aide/mod.ts" }],
  links: [{ kind: "relates", to: 10 }],
  raised: "2026-11-20",
});
