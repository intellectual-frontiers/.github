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
    "PostgreSQL, SQLite or DuckDB made from that, with extensions to each. A library of commons with its own specifications; the engine and governance are built, the logical and physical schemas follow.",
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
      what: "The logical and the physical schema for SQL, with dialects and extensions.",
      mayImport: ["governance/, engine/, by package name"],
    },
    { path: "extensions/", what: "Extensions that need no database.", mayImport: ["governance/, engine/, by package name"] },
    { path: "suite/", what: "The tests.", mayImport: ["anything here"] },
  ],
  commands: [{ run: "bun run verify", does: "The compiler, the specification checker and the rules on spec-kit/, and the tests." }],
};
