// Spec: 0001-query-layers FR-001
/**
 * The typed facts of the query language of AnyFS, a library of commons (commons 0027-commons-libraries): read-only SQL over the files of any store. Its specification is in its own spec kit (`spec-kit/`,
 * `0001-query-layers` to `0005-query-agreement`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The query language of AnyFS. */
export const about: About = {
  title: "AnyFS Query",
  summary:
    "Read-only SQL over the files, places, revisions and content of any AnyFS store. A query is one SELECT of one source, a table of the language or a table function over a place; it is planned so that it lists only what its filter can match and reads an object only when the listing has left it, and it runs within a budget it reports and the consent its place was given.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the tables and their columns, the consent, the budget, the statistics of a run and the closed type of every way a query fails.", mayImport: ["core and the governance of AnyFS, by package name"] },
    { path: "src/logical/", what: "Layer 2: the dialect and its functions, a query read and planned, what a filter shows before anything is listed, and a query run over the stores of a context. It reaches a store only through its operations.", mayImport: ["governance, by relative path", "core, the governance and logical layers of AnyFS and the language library, by package name"] },
    { path: "suite/", what: "The tests: every requirement, the same queries over stores in memory, in a folder and in a Git branch, and the hostile queries.", mayImport: ["src/", "the test module of commons, by package name", "the stores of AnyFS, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the trace of mizan, system and the packer of commons, by package name"] },
  ],
};
