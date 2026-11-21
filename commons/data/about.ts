// Spec: 0001-layers FR-008
/**
 * The typed facts of Intellectual Frontiers data, an independent library of commons (commons 0027-commons-libraries): governance, a logical
 * and a physical schema, and the extensions to each. Its specifications are in its own spec kit (`spec-kit/`), numbered from 0001; this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Intellectual Frontiers data. */
export const about: About = {
  title: "Data",
  summary:
    "Governance (what a business domain is and what must be true of its data), a logical schema made from it, and a physical schema for " +
    "PostgreSQL, SQLite or DuckDB made from that, with extensions to each, and the lifecycle that changes a database from one physical schema to the next. Modules (governance/module.ts: a subject area as a value that a project composes with others into one domain, so that a module not listed has no table) let a project adopt only the models it needs. Models written as modules: the party model (models/arca), tenancy (models/arca-tenancy: tenants and their hierarchy for B2B and B2B2C) and identity as composable modules on one principal of five kinds (a person, a machine, a device, an AI agent, a group): models/identity (the core: accounts, credentials that hold no secret in the clear, sessions, invitations, domains, policies, a hash-chained audit trail), identity-access (roles with inheritance, separation of duties, role assignments for every kind), identity-abac (attributes and policies), identity-rebac (relationship tuples), identity-pki, identity-machine (workload identities, API keys), identity-device (attestation and posture), identity-delegation (attenuated on-behalf-of) and identity-agent (versions pinned by model and prompt hash, tool grants, runs, budgets, single-use approvals). A library of commons with its own specifications. Roadmap: views that leave out removed rows, a type change that proves it loses nothing, masks and vector indexes as features, and interchange formats for other migration tools (Flyway, Liquibase and Atlas exports).",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "engine/",
      what: "The extension host: contribution points and handles that layers declare, manifests, `compose` and lazy activation.",
      mayImport: ["the kernel, by package name"],
    },
    {
      path: "governance/",
      what: "The governance layer: domains of concepts and code lists, typed annotations, the vocabularies (documentation, requirements, privacy, security, ownership, quality), identity, the trace graph and lint.",
      mayImport: ["engine/, by package name"],
    },
    {
      path: "sql/",
      what: "The logical schema (tables, columns, keys and indexes made from governance by a projection, with the report of the flow and the types of rows), the physical schema (a logical schema bound to a dialect and a case style, as statements) and the dialects of PostgreSQL, SQLite and DuckDB, which are extensions; the extensions are in sql/extensions/: documentation (comments, documentation tables, governance tables), views, access (row-level security and grants from governance), routines and partitions; names that carry a schema are in sql/physical/; protected access (tables in a schema, views over them, rights and a guard) is in sql/extensions/protected-access/; the safety features (quarantine instead of drop, lock discipline, verification) are in sql/extensions/safety/; the plan report (what a plan does in the words of governance, and who must approve it) is in sql/extensions/plan-report/; the rewrite (a table made again where the engine cannot change it, a type cast) is in sql/extensions/rewrite/; the history strategy (a plan frozen into files, replayed, or delivered as a release package or a procedure in the database) is in sql/extensions/history/; the convergence strategy (the plan from the state a database is in, reviewed or autonomous) is in sql/extensions/convergence/; parallel versions (two versions of an application on one database through schemas of views, an expand that destroys nothing, and the retirement of the older) are in sql/extensions/rollout/; integrations (rows, CSV text, an attached database or an adapter landed, checked and loaded by append, upsert, replace or snapshot in one transaction, with a ledger and lineage) are in sql/extensions/integrations/; transforms (models whose SQL asks for names by their words, built in order, each in one transaction with its tests, so that a model whose tests find wrong rows is not published) are in sql/extensions/transforms/; queries (a catalog of read-only queries over the names of a schema, with typed parameters that enter only as literals, verified against a database and compared between versions of a schema) are in sql/extensions/queries/; the ephemeral target (a database that is a build product: one SQL file from governance and typed rows, the same bytes every time, committed and diffed in Git, made into a database in one transaction and checked for staleness) is in sql/extensions/target/; kinds (reference data kept as CSV, read into typed rows, checked against a table and written as a TypeScript module) are in sql/extensions/kinds/; osquery ATC (the auto_table_construction configuration that makes osquery tables from a SQLite database, made from a logical schema) is in sql/extensions/osquery-atc/; operations (the business operations of a model: contracts in governance, run by sql/extensions/operations in one transaction, held to what they declare, with the audit trail written with them) are in sql/extensions/operations/, with the identity decision engine (one decide() for every kind of principal: roles, groups, inheritance, relationships and policies, refusal wins, unknown never allows, delegation never adds), the audit chain and the operations of delegation and agents (delegate, revoke, tool calls with budgets and single-use approvals, the kill switch) in sql/extensions/operations/identity/; the presets (team-managed, dba-managed, reviewed-convergence and autonomous-convergence: each a strategy with the features it needs and the settings it calls for) are in sql/presets/; the generators (diagrams in Mermaid and D2, the data dictionary in Markdown and HTML, row types in Rust and Zod, the register of personal data and security) are in sql/extensions/generators/",
      mayImport: ["governance/, engine/, by package name"],
    },
    {
      path: "sql/lang/",
      what: "The SQL language core (0065-sql-lang): a small, fast, portable front end for SQL in many dialects, built to be published alone as `@intellectual-frontiers/sql-lang`. The lexical layer (0065-sql-lang): `lex` turns text into tokens and comments with exact positions, a dialect (`defineDialect`) says how it is written, and every comment is kept with its kind, marker, span and place for the features that read them. The syntax tree and the parser (0066-sql-ast-parser): a closed union of nodes whose child fields are typed by sort, `parse` and `parseStrict` for the common ground of SQL (queries, data changes, tables, views, indexes) with a dialect's `Grammar` adding its operators, cast and like-words, a statement that cannot be read kept as an `unparsed` node while the others are read, each comment attached to its node (`commentsOf`), and the walks `children`, `walk`, `findAll` and `fold`. The core is the files of the folder; the dialects are `dialects/<name>/` and the extensions will be `extensions/<name>/`, which may import the core and nothing else here.",
      mayImport: ["@intellectual-frontiers/core, by package name, and nothing of this library"],
    },
    {
      path: "sql/lifecycle/",
      what: "What changes a database from one physical schema to the next: the hashed state of a database, the changes between two states, the plan of classified steps, the hash-chained ledger and the run on a driver. Strategies and features of migration (idempotency first) are extensions of it.",
      mayImport: ["sql/physical/, sql/logical/, governance/, engine/, by package name"],
    },
    
    {
      path: "models/",
      what: "Arca's typical data models as governance: the party model first.",
      mayImport: ["governance/, engine/, by package name"],
    },
    { path: "suite/", what: "The tests.", mayImport: ["anything here"] },
  ],
  commands: [{ run: "bun run verify", does: "The compiler, the specification checker and the rules on spec-kit/, and the tests." }],
};
