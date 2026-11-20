// Spec: 0001-mise-layers FR-001
/**
 * The typed facts of the dialect of tools that installs them with mise, a library of commons and a dialect of Archon. Its specification is in its own spec kit (`spec-kit/`, `0001-mise-layers` and
 * `0002-mise-dialect`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** The dialect of tools for mise. */
export const about: About = {
  title: "Archon dialect: mise",
  summary:
    "The dialect of tools that installs them with mise: mise, which installs the tools of an account in the account's own folder at the versions it is told. It holds only the data of the manager (what it guarantees, how it writes an exact version, what its check answers); the commands come from the packaging ontology and the code from the kit of the manager dialects. " +
    "A package on the port of Archon and a dialect of tools for Toolchain.",
  folders: [
    { path: "spec-kit/", what: "The package's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "Layer 3: the data of the manager and the call that makes its dialect.", mayImport: ["archon, by its exports", "toolchain, by its exports", "package-managers, by package name"] },
    { path: "suite/", what: "The tests: every requirement, with made-up commands.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
