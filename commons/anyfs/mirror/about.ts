// Spec: 0001-mirror-layers FR-001
/**
 * The typed facts of the mirrored store of AnyFS, a library of commons (commons 0027-commons-libraries): one store that keeps two or more stores in step. Its specification is in its own spec kit (`spec-kit/`,
 * `0001-mirror-layers` to `0005-mirror-conformance`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The mirrored store of AnyFS. */
export const about: About = {
  title: "AnyFS Mirror",
  summary:
    "A primary store and one or more secondaries, of any AnyFS backends, kept in step as one store. The primary answers every read and decides every write; each change it takes is followed by the secondaries path by path; a secondary that cannot take a change is recorded as lagging and never stops the primary; a drift report compares the revision of every object, and a reconcile makes a secondary the same as the primary.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the policy for a secondary that fails, the lag of a path, the drift of a secondary and what a reconcile did. Pure: no input or output.", mayImport: ["core and the governance of AnyFS, by package name"] },
    { path: "src/logical/", what: "Layer 2: the paths an operation changes, the drift of two listings, the steps that make them the same and the traits of the mirror. Pure: no input or output.", mayImport: ["governance, by package name", "core and AnyFS, by package name"] },
    { path: "src/physical/", what: "Layer 3: the store that mirrors, the drift check and the reconcile, made only of the operations of the stores it is given.", mayImport: ["governance and logical, by package name", "core and AnyFS, by package name"] },
    { path: "suite/", what: "The tests: every requirement, a Git branch and a SQLite file in temporary folders, and the conformance suite of AnyFS run against the mirror.", mayImport: ["src/", "the test module of commons, by package name", "AnyFS, its Git and SQL stores, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs, and the acceptance run against a Git host.", mayImport: ["the trace of mizan, system and the packer of commons, by package name", "AnyFS and its stores, by package name"] },
  ],
};
