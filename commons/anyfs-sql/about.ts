// Spec: 0001-sql-layers FR-001
/**
 * The typed facts of the SQL stores of AnyFS, a library of commons (commons 0027-commons-libraries): objects kept in the tables of a SQL-speaking database. Its specification is in its own spec kit (`spec-kit/`,
 * `0001-sql-layers` to `0008-sql-dump`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The SQL stores of AnyFS. */
export const about: About = {
  title: "AnyFS SQL",
  summary:
    "A SQLite database kept as an AnyFS store that merges by nature. Every change is a version row with a time-ordered id (UUIDv7), its replica, its parent and the digest of its fields, and the bytes are blobs keyed by their digest; the two tables have no row id and a key that ignores a second row, so that the data of any number of files, dumped as plain inserts by the real `sqlite3` and replayed into one database, is their union: a cheap file-system sync. A database takes rows only from replicas it trusts, keeps the heads that did not win as siblings, and tells a copy of its file from the original. The current files, the names and the vector of what has been seen are views. A write that expects a revision is decided in one transaction, a batch is one transaction, and the history of a file and an index of its words are kept with it. PostgreSQL, DuckDB and, as drivers of SQLite, libSQL and Turso fit the same port; their layouts follow. The layout of the tables is documented so that a catalog can read it.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the dialects and the largest object of each, the names of the tables, the port of a database, the documented layout and the media types of names. Pure: no file, process or network.", mayImport: ["core and the governance of anyfs, by package name"] },
    { path: "src/physical/", what: "Layer 3: the statements built by the language of SQL, the migrations of the layout, the merge of replicas and the dump of the mergeable tables, the layout (every statement that names a table or a column, in one module the store calls by name), the store of a table and, in `adapters/`, the port of each driver.", mayImport: ["governance, by relative path", "the language of SQL, the stores of anyfs and the digest of crypto, by package name"] },
    { path: "suite/", what: "The tests: every requirement, on the real engines (SQLite, PostgreSQL in PGlite, DuckDB) and on clearly named fakes over a real engine for the drivers that need a server, and the laws of AnyFS and of the bridge run against the stores.", mayImport: ["src/", "the test module and the stores of anyfs, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the trace of mizan, system and the packer of commons, by package name"] },
  ],
};
