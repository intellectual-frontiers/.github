// Spec: 0001-bridge-layers FR-001
/**
 * The typed facts of the bridge of AnyFS, a library of commons (commons 0027-commons-libraries): copy, sync and mirror between stores. Its specification is in its own spec kit (`spec-kit/`, `0001-bridge-layers`
 * to `0005-bridge-conformance`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The bridge of AnyFS. */
export const about: About = {
  title: "AnyFS Bridge",
  summary:
    "Copy, sync, move, check, two-way sync and mirror between any two AnyFS stores. A transfer is a plan before it is anything else: a list of actions in a fixed order, with how each file was compared, what the destination would not keep, and a hash; the apply refuses a plan that is not the one approved, guards each write by the revision the plan saw, and checks what it wrote.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the modes, the rails, the patterns of a filter, the plan, its actions, losses and refusals.", mayImport: ["core and the governance of AnyFS, by package name"] },
    { path: "src/logical/", what: "Layer 2: the inventory of an endpoint, the comparison of files, the plan of a transfer, its apply, the two-way sync and the mirror. Pure: only the operations of the stores it is given.", mayImport: ["governance, by relative path", "core, the SHA-256 of crypto, and the governance and logical layers of AnyFS, by package name"] },
    { path: "src/conformance/", what: "The laws every pair of stores keeps under these transfers, run by a backend's tests.", mayImport: ["governance and logical, by relative path", "the conformance and layers of AnyFS, by package name"] },
    { path: "suite/", what: "The tests: every requirement, and the laws run against stores in memory and in a folder.", mayImport: ["src/", "the test module of commons, by package name", "the stores of AnyFS, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the trace of mizan, system and the packer of commons, by package name"] },
  ],
};
