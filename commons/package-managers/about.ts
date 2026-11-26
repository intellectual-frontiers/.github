// Spec: 0001-package-managers-layers FR-001
/**
 * The typed facts of the shared kit of the dialects that drive a package manager, a library of commons. Its specification is in its own spec kit (`spec-kit/`, `0001-package-managers-layers` to
 * `0004-package-managers-dialect`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The shared kit of the manager dialects. */
export const about: About = {
  title: "Package managers",
  summary:
    "The shared kit of the dialects that drive a package manager: the commands of the packaging ontology as argument vectors that no shell reads, the exact version written as each manager writes it, the jobs a tool asks of a manager, the plan file, the observation of what is installed, and the dialect made from a manager's data. " +
    "The dialects of Homebrew, apt, WinGet and mise are packages of their own and hold only that data.",
  folders: [
    { path: "spec-kit/", what: "The package's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the operations, the command of an operation, how a version is written, and the form a name must have.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2: the argument vectors, the jobs a tool asks, the plan file, and the reading of a version. Pure.", mayImport: ["governance", "desired-os-state and toolchain, by their exports", "core, by package name"] },
    { path: "src/physical/", what: "Layer 3: the runner and the dialect made from a manager's data.", mayImport: ["governance and logical", "desired-os-state and toolchain, by their exports", "core and system, by package name"] },
    { path: "suite/", what: "The tests: every requirement, with made-up managers that are real programs.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
