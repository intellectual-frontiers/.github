// Spec: 0001-toolchain-layers FR-001
/**
 * The typed facts of Toolchain, an independent library of commons (commons 0027-commons-libraries): which programs a computer needs, declared once, and resolved to the dialect that carries each out.
 * Its specification is in its own spec kit (`spec-kit/`, `0001-toolchain-layers` to `0003-toolchain-logical`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Toolchain. */
export const about: About = {
  title: "Toolchain",
  summary:
    "A Kanon library of the tools a computer needs. GOVERNANCE: the declaration of a tool (one exact version, a pin policy, what it provides and needs, the phase of work that needs it, the scope it lives in, and the bindings that say how a dialect obtains it: an https artifact with its SHA-256 for each platform, or the names a package manager knows) and the catalog. " +
    "LOGICAL: the guarantees of a dialect of tools as data, the resolution of each tool to the first dialect that can carry it out with the integrity a fleet asks for (never one that builds from source), the plan against what is installed, and the requirements of kind tool that Desired OS State orders. " +
    "It does no input or output: the dialects obtain the tools.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: tool names and versions, the declaration of a tool, the catalog.", mayImport: ["core, the digest of crypto and the governance of desired-os-state, by package name"] },
    { path: "src/logical/", what: "Layer 2: the guarantees of a dialect, the resolution, the plan, the requirements of desired-os-state.", mayImport: ["governance, by package name", "core and the governance of desired-os-state, by package name"] },
    { path: "src/physical/ontology/", what: "Layer 3: the one adapter, a source of pins over the packaging ontology.", mayImport: ["governance and logical, by package name", "core and the downloads of the ontology, by package name"] },
    { path: "suite/", what: "The tests: every requirement.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
