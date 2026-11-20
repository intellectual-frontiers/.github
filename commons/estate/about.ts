// Spec: 0001-estate-layers FR-001
/**
 * The typed facts of Estate, an independent library of commons (commons 0027-commons-libraries): the assets of an organization and what is declared of them against what is observed. Its specification is
 * in its own spec kit (`spec-kit/`, `0001-estate-layers` to `0003-estate-logical`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Estate. */
export const about: About = {
  title: "Estate",
  summary:
    "The assets of an organization (machines, services, accounts) as discovered, adopted or managed; the capabilities each state offers, with the reason for each it does not; what each asset is declared to be against what is observed of it, with the age of the observation; the assets seen that nobody declared; and which system owns each capability, a capability moving only when its acceptance test has passed. " +
    "An estate is typed data in which every reference is derived from the data, so that an unknown asset is an error the compiler finds.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/governance/", what: "Layer 1: the identities, the states and their capabilities, the transitions, the asset and the typed estate.", mayImport: ["core, by package name"] },
    { path: "src/logical/", what: "Layer 2: the lifecycle, the ownership of capabilities, operational truth and the assets nobody declared. Pure.", mayImport: ["governance, by package name", "core and grc, by package name"] },
    { path: "suite/", what: "The tests: every requirement, with the compile-time checks of the typed estate.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
