// Spec: 0001-anyfs-onedrive-layers FR-001
/**
 * The typed facts of AnyFS OneDrive, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it by
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** AnyFS OneDrive. */
export const about: About = {
  title: "AnyFS OneDrive",
  summary: "The OneDrive backend of AnyFS: a store over a drive and a folder of Microsoft Graph, with a revision on every read and a stated expectation on every write, held to the same conformance suite as every backend.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "Layer 3: the store on a drive and a folder, the client of Graph that addresses by path and sends the bearer token, the transport, the reading of the items Graph answers with and the table of its errors.", mayImport: ["anyfs, by its exports", "crypto, by its exports", "core, by its exports"] },
    { path: "suite/", what: "The tests: every requirement over a Graph made in process, the shapes of the documented responses, and a live run that is skipped where no tenant is named.", mayImport: ["src/", "the test module of commons", "the packages of commons by name"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel and the runtime of commons, by package name"] }
  ],
};
