// Spec: 0001-git-layers FR-001
/**
 * The typed facts of the Git stores of AnyFS, a library of commons (commons 0027-commons-libraries): a branch and a working tree as stores. Its specification is in its own spec kit (`spec-kit/`, `0001-git-layers`
 * to `0005-git-conformance`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The Git stores of AnyFS. */
export const about: About = {
  title: "AnyFS Git",
  summary:
    "A branch of a Git repository and a Git working tree, each kept as an AnyFS store. The branch is written with Git's plumbing, so the working tree, the index and the checked-out branch are never touched; a batch is one commit; a revision is the digest of the bytes, so it means the same as in every other store; the branch is pushed and never forced.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: who a commit is by, how its message is made, the limits of a store, and the names Git treats specially. Pure: no file, process or network.", mayImport: ["core and the governance of AnyFS, by package name"] },
    { path: "src/physical/", what: "Layer 3: the store of a branch, the store of a working tree and the push and fetch of a branch, each through Git's own commands.", mayImport: ["governance, by relative path", "core, crypto, system and AnyFS, by package name"] },
    { path: "suite/", what: "The tests: every requirement, in real repositories in temporary folders, and the laws of AnyFS and of the bridge run against the stores.", mayImport: ["src/", "the test module of commons, by package name", "AnyFS and its bridge, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the trace of mizan, system and the packer of commons, by package name"] },
  ],
};
