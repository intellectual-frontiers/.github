// Spec: 0001-cloud-init-layers FR-001
/**
 * The typed facts of the dialect for the unattended install of a machine, a library of commons and a dialect of Archon. Its specification is in its own spec kit (`spec-kit/`, `0001-cloud-init-layers` and
 * `0002-cloud-init-dialect`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The dialect for the unattended install. */
export const about: About = {
  title: "Archon dialect: cloud-init",
  summary:
    "The dialect of Archon for the unattended install of a machine from nothing: it renders an order to Ubuntu's autoinstall user-data and meta-data (no secret in it, a blank-disk guard first, key-only sign-in) and the script that converges the machine from its signed repository.",
  folders: [
    { path: "spec-kit/", what: "The package's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "Layer 3: the dialect: its guarantees, its render and its steps.", mayImport: ["archon, by its exports"] },
    { path: "suite/", what: "The tests: every requirement, with made-up commands.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
