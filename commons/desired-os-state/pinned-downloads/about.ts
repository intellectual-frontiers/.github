// Spec: 0001-pinned-downloads-layers FR-001
/**
 * The typed facts of the default dialect of tools, a library of commons and a dialect of Desired OS State. Its specification is in its own spec kit (`spec-kit/`, `0001-pinned-downloads-layers` to
 * `0004-pinned-downloads-dialect`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The default dialect of tools. */
export const about: About = {
  title: "Desired OS State dialect: pinned-downloads",
  summary:
    "The default dialect of tools: the programs a computer needs, as their publishers released them, pinned by the SHA-256 of the artifact, in a folder of the user's own, with no administrator rights and no package manager; never built from source. " +
    "It checks the hash before anything is unpacked, unpacks in memory with every path checked, keeps an install record, switches an install into place by a rename that is retried where Windows refuses it, and observes what is installed (the store, then the path). " +
    "A package on the port of Desired OS State and a dialect of tools for Toolchain.",
  folders: [
    { path: "spec-kit/", what: "The package's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "Layer 3: the pure install logic, the store, the observation, the plan file, the dialect and the program that checks and applies a plan.", mayImport: ["desired-os-state, by its exports", "toolchain, by its exports", "core, crypto, formats, net and system, by package name"] },
    { path: "suite/", what: "The tests: every requirement, with real archives, a real local server and real files.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
