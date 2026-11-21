// Spec: 0001-catalog-nist-sp800-layers FR-001
/**
 * The typed facts of Catalog Nist Sp800, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Catalog Nist Sp800. */
export const about: About = {
  title: "Catalog Nist Sp800",
  summary: "NIST SP 800-53 Rev 5.2.0 and SP 800-171 Rev 3 as grc catalog packages, with the controls, the assessment objectives of SP 800-53A and SP 800-171A as controls of their own, and where they came from, their licence and the digest of each source.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: what the library is, as data and types.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2: the model the library reasons with.", mayImport: ["governance, by package name", "core, by package name"] },
    { path: "src/physical/", what: "Layer 3: what reads files, runs programs and reaches the network.", mayImport: ["governance and logical, by package name", "core and the system, by package name"] },
    { path: "suite/", what: "The tests: every requirement.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
