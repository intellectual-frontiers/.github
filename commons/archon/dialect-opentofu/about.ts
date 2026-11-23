// Spec: 0001-opentofu-layers FR-001
/**
 * The typed facts of the dialect for cloud resources with OpenTofu, a library of commons and a dialect of Archon. Its specification is in its own spec kit (`spec-kit/`, `0001-opentofu-layers` and
 * `0002-opentofu-dialect`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The dialect for cloud resources with OpenTofu. */
export const about: About = {
  title: "Archon dialect: opentofu",
  summary:
    "The dialect of Archon for cloud resources with OpenTofu: it renders an order of cloud-resource requirements to a JSON configuration with pinned providers and no credential, the state kept outside the repository, and the steps that init, plan to a saved plan and apply exactly that plan.",
  folders: [
    { path: "spec-kit/", what: "The package's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "Layer 3: the dialect: its guarantees, its render, its steps and the check of a plan against the order.", mayImport: ["archon, by its exports"] },
    { path: "suite/", what: "The tests: every requirement, with made-up commands.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
