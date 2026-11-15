/**
 * The typed facts of the data libraries of commons (commons 0009-sql-aide, 0010-file-aide), as their documentation shows them (commons
 * 0011-documentation FR-005): the folders and what each may import, the commands that work on them, and the areas, each with its entry
 * point, its specification, its phases and its examples. What each part is and does is the TSDoc of its modules.
 *
 * @module
 */
import type { About } from "../kernel/mod.ts";

/** The data libraries: SQL Aide and the libraries built with it, and File Aide and the layout built with it. */
export const about: About = {
  title: "Data libraries",
  summary:
    "The data libraries of Intellectual Frontiers Commons, built on IFC TypeScript's kernel. SQL Aide is a SQL generator first and " +
    "a database client second: a schema is written once as TypeScript algebraic types and rendered as SQL for PostgreSQL, SQLite and " +
    "DuckDB; it replaces `netspective-labs/sql-aide`. Arca, Data Vault and osquery ATC are libraries built with it. File Aide is its peer " +
    "for stores of files, and IFRFS the layout built with it. The package has no `dependencies`: DuckDB, PGlite and pg are installed for " +
    "the tests only.",
  spec: { repo: "commons", id: "0009-sql-aide" },
  folders: [
    {
      path: "sql-aide/",
      what: "The library: domains, columns and tables whose row types are computed; dialects whose features the compiler knows; the `SQL` template; lint; TAP.",
      mayImport: ["sql-aide/", "the kernel", "the runtime, from sql-aide/runtime/ only"],
    },
    { path: "arca/", what: "Arca, the typical data models: the party model first.", mayImport: ["arca/", "sql-aide/mod.ts"] },
    {
      path: "data-vault/",
      what: "Data Vault: hubs, satellites and links as generic functions.",
      mayImport: ["data-vault/", "sql-aide/mod.ts"],
    },
    {
      path: "osquery-atc/",
      what: "osquery ATC: Automatic Table Construction entries typed, their JSON configuration and SQLite database built.",
      mayImport: ["osquery-atc/", "sql-aide/mod.ts"],
    },
    {
      path: "file-aide/",
      what: "File Aide: a store's layout as TypeScript algebraic types, drivers behind one interface, and a query language compiled to a walk.",
      mayImport: ["file-aide/", "the kernel", "sql-aide/mod.ts", "the runtime, from file-aide/runtime/ only"],
    },
    {
      path: "ifrfs/",
      what: "The IF Renditions File System, the layout erga's publication sync fills.",
      mayImport: ["ifrfs/", "file-aide/mod.ts"],
    },
    {
      path: "examples/",
      what: "The examples the documentation shows, which the compiler checks and the suite runs.",
      mayImport: ["the entry points"],
    },
    {
      path: "suite/",
      what: "The tests, with committed SQL (`golden/`) for every dialect; not named `tests/`, which is IFC TypeScript's own suite and what its jobs run.",
      mayImport: ["anything here"],
    },
  ],
  commands: [
    {
      run: "bun install --frozen-lockfile",
      does: "Installs DuckDB, PGlite and pg, for the tests only (run it in commons/ts first for TypeScript 7).",
    },
    { run: "bun run verify", does: "Runs tsc 7, checks the documentation maps, then runs every test under Bun." },
    { run: "bun run test:node", does: "Runs the same tests under Node 26." },
    {
      run: "bun run docs",
      does: "Writes the documentation maps (arca/party.docs.auto.ts and the others) again after a TSDoc comment changes.",
    },
    { run: "IFCSQL_UPDATE_GOLDEN=1 bun test suite/", does: "Writes the committed SQL again; then read the diff." },
    {
      run: "IFCSQL_PG_URL=postgres://... bun test suite/",
      does: "Also runs on a PostgreSQL server: each test makes a database and drops it.",
    },
  ],
  rules: [
    {
      rule: "A library built with SQL Aide imports `sql-aide/mod.ts` alone; a file of SQL Aide imports SQL Aide and the kernel, and the runtime only under `runtime/`.",
      enforcedBy: [{ kind: "test", file: "suite/conventions.test.ts" }],
    },
    {
      rule: "Everything is configured in TypeScript, never in YAML, XML, TOML or JSON.",
      enforcedBy: [{ kind: "test", file: "suite/conventions.test.ts" }],
    },
    {
      rule: "Every exported declaration carries TSDoc, which is also what the SQL documentation says.",
      enforcedBy: [{ kind: "test", file: "suite/conventions.test.ts" }],
    },
    {
      rule: "What a model emits is committed under `suite/**/golden/`, so that a change shows as a diff of SQL.",
      enforcedBy: [{ kind: "test", file: "suite/sql-aide/model.test.ts" }],
    },
  ],
  areas: [
    {
      title: "SQL Aide",
      slug: "sql-aide",
      entryPoints: ["sql-aide/mod.ts"],
      spec: { repo: "commons", id: "0009-sql-aide" },
      phases: [
        {
          n: 1,
          what: "Algebra, dialects, the `SQL` template and its two renderings, naming, hooks, governance, TSDoc maps, TAP",
          state: "here",
        },
        { n: 2, what: "Views, typed indexes and partitions, PostgreSQL objects, tests inside the database", state: "here" },
        { n: 3, what: "Typed routines, triggers, policies, DuckDB macros", state: "here" },
        {
          n: 4,
          what: "Integrations: seed rows, CSV through DuckDB, attached databases, adapters; four strategies; lineage; vault loads",
          state: "here",
        },
        {
          n: 5,
          what: "ISLM: catalogs read, plans classified, an append-only ledger in the database, undo, script, lint, teardown",
          state: "here",
        },
        {
          n: 6,
          what: "Query builder: joins by foreign key, projections, CTEs, set operations, insert, update, delete, returning, upsert",
          state: "here",
        },
        {
          n: 7,
          what: "Transforms: typed models, build order from references, five materializations, tests recorded and reported as TAP",
          state: "here",
        },
        {
          n: 8,
          what: "Drivers: node:sqlite, pg, PGlite and DuckDB adapters typed by shape; bound values, decoding by domain, typed calls",
          state: "here",
        },
        {
          n: 9,
          what: "Generators (Mermaid, D2, data dictionary, Rust, Zod), `cli(project)`, every typed hook, the pgvector plugin",
          state: "here",
        },
        {
          n: 10,
          what: "Durable and ephemeral targets: ISLM refused for ephemeral, `.auto.sql` builds, databases made, staleness checked; osquery ATC",
          state: "here",
        },
      ],
      examples: [
        {
          file: "examples/getting-started.ts",
          what: "Two tables, the type of a row, and the same model rendered for PostgreSQL and SQLite.",
        },
      ],
    },
    { title: "Arca", slug: "arca", entryPoints: ["arca/mod.ts"], spec: { repo: "commons", id: "0009-sql-aide" } },
    { title: "Data Vault", slug: "data-vault", entryPoints: ["data-vault/mod.ts"], spec: { repo: "commons", id: "0009-sql-aide" } },
    { title: "osquery ATC", slug: "osquery-atc", entryPoints: ["osquery-atc/mod.ts"], spec: { repo: "commons", id: "0009-sql-aide" } },
    {
      title: "File Aide",
      slug: "file-aide",
      entryPoints: ["file-aide/mod.ts", "file-aide/runtime/mod.ts"],
      spec: { repo: "commons", id: "0010-file-aide" },
      phases: [
        { n: 1, what: "Segments, path patterns and their laws, entries, layouts, names", state: "here" },
        { n: 2, what: "The store interface, the `memory` and `posix` drivers, the conformance suite", state: "here" },
        {
          n: 3,
          what: "Queries: the builder, the text form, the planner, the compiler, `explain`, ignore files, `fd` parity",
          state: "here",
        },
        { n: 4, what: "The `s3` driver, the local S3 server, tests against real providers", state: "not yet" },
        { n: 5, what: "Checks and recipes, and stores that fail on purpose", state: "not yet" },
        { n: 6, what: "With SQL Aide: the file-reference domain and listings as a source; IFRFS end to end", state: "not yet" },
      ],
      examples: [
        {
          file: "examples/file-aide.ts",
          what: "A query over the IFRFS layout of a folder, in its builder form and its text form, and fd's walk.",
        },
      ],
    },
    { title: "IFRFS", slug: "ifrfs", entryPoints: ["ifrfs/mod.ts"], spec: { repo: "commons", id: "0010-file-aide" } },
  ],
};
