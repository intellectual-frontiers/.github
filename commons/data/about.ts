// Spec: 0001-layers FR-008
/**
 * The typed facts of Intellectual Frontiers data, an independent library of commons (commons 0027-commons-libraries): governance, a logical
 * and a physical schema, and the extensions to each. Its specifications are in its own spec kit (`spec-kit/`), numbered from 0001; this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Intellectual Frontiers data. */
export const about: About = {
  title: "Data",
  summary:
    "Governance (what a business domain is and what must be true of its data), a logical schema made from it, and a physical schema for " +
    "PostgreSQL, SQLite or DuckDB made from that, with extensions to each, and the lifecycle that changes a database from one physical schema to the next. A library of commons with its own specifications. Roadmap: views that leave out removed rows, parallel versions of an API, quarantine instead of drop, the strategies (history and convergence), and interchange formats for other migration tools.",
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
      what: "The logical schema (tables, columns, keys and indexes made from governance by a projection, with the report of the flow and the types of rows), the physical schema (a logical schema bound to a dialect and a case style, as statements) and the dialects of PostgreSQL, SQLite and DuckDB, which are extensions; the extensions are in sql/extensions/: documentation (comments, documentation tables, governance tables), views, access (row-level security and grants from governance), routines and partitions; names that carry a schema are in sql/physical/; protected access (tables in a schema, views over them, rights and a guard) is in sql/extensions/protected-access/; the safety features (quarantine instead of drop, lock discipline, verification) are in sql/extensions/safety/; the plan report (what a plan does in the words of governance, and who must approve it) is in sql/extensions/plan-report/; the rewrite (a table made again where the engine cannot change it, a type cast) is in sql/extensions/rewrite/; the history strategy (a plan frozen into files, replayed, or delivered as a release package or a procedure in the database) is in sql/extensions/history/; the convergence strategy (the plan from the state a database is in, reviewed or autonomous) is in sql/extensions/convergence/; the generators (diagrams in Mermaid and D2, the data dictionary in Markdown and HTML, row types in Rust and Zod, the register of personal data and security) are in sql/extensions/generators/",
      mayImport: ["governance/, engine/, by package name"],
    },
    {
      path: "sql/lifecycle/",
      what: "What changes a database from one physical schema to the next: the hashed state of a database, the changes between two states, the plan of classified steps, the hash-chained ledger and the run on a driver. Strategies and features of migration (idempotency first) are extensions of it.",
      mayImport: ["sql/physical/, sql/logical/, governance/, engine/, by package name"],
    },
    { path: "extensions/", what: "Extensions that need no database.", mayImport: ["governance/, engine/, by package name"] },
    {
      path: "models/",
      what: "Arca's typical data models as governance: the party model first.",
      mayImport: ["governance/, engine/, by package name"],
    },
    { path: "suite/", what: "The tests.", mayImport: ["anything here"] },
  ],
  commands: [{ run: "bun run verify", does: "The compiler, the specification checker and the rules on spec-kit/, and the tests." }],
};
