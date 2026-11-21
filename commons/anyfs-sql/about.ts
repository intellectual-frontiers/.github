// Spec: 0001-sql-layers FR-001
/**
 * The typed facts of the SQL stores of AnyFS, a library of commons (commons 0027-commons-libraries): objects kept in the tables of a SQL-speaking database. Its specification is in its own spec kit (`spec-kit/`,
 * `0001-sql-layers` to `0006-sql-conformance`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The SQL stores of AnyFS. */
export const about: About = {
  title: "AnyFS SQL",
  summary:
    "A table of any SQL-speaking database kept as an AnyFS store. Every object is a row with its revision (the digest of its bytes, the same in every store), a write that expects a revision is decided by one statement so that two writers cannot both win, a batch is one transaction, and the history of an object and an index of its words are kept with it where the engine has them. A SQLite file is the natural default; PostgreSQL, DuckDB and, as drivers of SQLite, libSQL and Turso fit the same port. The layout of the tables is documented so that a catalog can read it.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the dialects and the largest object of each, the names of the tables, the port of a database, the documented layout and the media types of names. Pure: no file, process or network.", mayImport: ["core and the governance of anyfs, by package name"] },
    { path: "src/physical/", what: "Layer 3: the statements built by the language of SQL, the migrations of the layout, the layout (every statement that names a table or a column, in one module the store calls by name), the store of a table and, in `adapters/`, the port of each driver.", mayImport: ["governance, by relative path", "the language of SQL, the stores of anyfs and the digest of crypto, by package name"] },
    { path: "suite/", what: "The tests: every requirement, on the real engines (SQLite, PostgreSQL in PGlite, DuckDB) and on clearly named fakes over a real engine for the drivers that need a server, and the laws of AnyFS and of the bridge run against the stores.", mayImport: ["src/", "the test module and the stores of anyfs, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the trace of mizan, system and the packer of commons, by package name"] },
  ],
};
