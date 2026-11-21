// Spec: 0001-anyfs-githost-layers FR-001
/**
 * The typed facts of AnyFS Git hosts, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it by
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** AnyFS Git hosts. */
export const about: About = {
  title: "AnyFS Git hosts",
  summary:
    "The Git host backend of AnyFS: a branch of a repository on GitHub or GitLab kept as a store through the host's REST API, with a revision on every read and a stated expectation on every write, a batch that is one commit, and the branch as the compare-and-swap of every writer.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: who a commit is by, how its message is made, the limits of a store, where a token comes from, and the names Git treats specially. Pure: no file, process or network.", mayImport: ["core and the governance of AnyFS, by package name"] },
    { path: "src/physical/", what: "Layer 3: the stores of a branch on GitHub and on GitLab, the one store logic over a host's API, the REST clients of the two hosts and the table of their failures.", mayImport: ["governance, by relative path", "core, crypto, formats, net, the credential port of headless and AnyFS, by package name"] },
    { path: "suite/", what: "The tests: every requirement, over fakes of the two REST APIs made in process and, where a real Git host can be run, over it, and the laws of AnyFS and of the bridge run against the stores.", mayImport: ["src/", "the test module of commons, by package name", "AnyFS and its bridge, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs, and the pinned download of the real Git host the tests run on.", mayImport: ["the trace of mizan, system and the packer of commons, by package name"] },
  ],
};
