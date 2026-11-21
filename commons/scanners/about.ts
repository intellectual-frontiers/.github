// Spec: 0001-scanners-layers FR-001
/**
 * The typed facts of Scanners, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Scanners. */
export const about: About = {
  title: "Scanners",
  summary: "Runs security scanners (a built-in TLS and header check, nuclei, nmap, trivy, grype, semgrep, checkov and ZAP's baseline scan) the safe way: only after the engagement allows the action, only a binary whose SHA-256 is the one pinned for it, with a command line made from validated parts and no shell, in an empty working folder with a bare environment, and a record of every run. What they print is read into findings.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: what the library is, as data and types.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2: the model the library reasons with.", mayImport: ["governance, by package name", "core, by package name"] },
    { path: "src/physical/", what: "Layer 3: what reads files, runs programs and reaches the network.", mayImport: ["governance and logical, by package name", "core and the system, by package name"] },
    { path: "suite/", what: "The tests: every requirement.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
