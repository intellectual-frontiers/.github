// Spec: 0001-planning-layers FR-001
/**
 * The typed facts of Planning, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Planning. */
export const about: About = {
  title: "Planning",
  summary: "Planning content from many places as one item each with one stable id, its history as append-only events and its state a fold of them, with every act of an agent made on behalf of a person; sources are lenses over the places, and a write goes back in the place's own form.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: what an item is and what may happen to it: the closed lists with their registries, instants and days, ids of UUID version 7, actors (an agent names the person it acts for), events and items with their state.", mayImport: ["core, by package name", "the governance of anyfs, for the syntax of a version id"] },
    { path: "src/logical/records/", what: "Layer 2: the records at the boundary: the store's files of events and items in JSON5 with the order of keys of RFC 8785, the monorepo's issue files, event objects and summaries, and an issue file read as an item with its events.", mayImport: ["logical, by relative path", "governance, by package name", "core and the JSON5 of formats"] },
    { path: "src/logical/", what: "Layer 2: the model the library reasons with: the fold of events into an item with the authority over each field, the cycle check of links, the clock that makes ids (the hybrid clock of anyfs's merge), the ids of records read from another scheme, `reconcile` of what a source read with the store, duplicates, the outbox and previews with their hash, the query algebra, the views, the matrix of what a source can hold and the configuration. Pure: no input or output and no clock.", mayImport: ["governance, by package name", "core and the SHA-256 of crypto", "the governance and the merge of anyfs"] },
    { path: "src/physical/", what: "Layer 3: what reads files, runs programs and reaches the network: the store of events over AnyFS, the port a source implements and the laws of a lens, the sources (typed issues, event files, Markdown, comments, a Git host), the configuration read from the repository, and the program `planctl` with its tool server.", mayImport: ["governance and logical, by package name, and the records of the logical layer", "core, AnyFS, the SHA-256 and JSON5 of commons, the Git host contract, Headless, the terminal and the system, by package name"] },
    { path: "suite/", what: "The tests: every requirement.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
