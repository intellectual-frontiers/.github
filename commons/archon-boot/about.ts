// Spec: 0001-boot-layers FR-001
/**
 * The typed facts of the plugin of `archon` for the network install, a library of commons and a plugin of the family of Archon. Its specification is in its own spec kit (`spec-kit/`, `0001-boot-layers` and
 * `0002-boot-command`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** The plugin for the network install. */
export const about: About = {
  title: "Archon plugin: boot",
  summary:
    "The plugin that gives `archon` its verbs for the network install: plan what a fleet's requirements would change on a machine (reading only), approve the plan by its hash, apply exactly that plan with the fleet's dialect, and show that the next plan is empty. " +
    "It holds no dialect and knows no layout of a fleet: the fleet gives both.",
  folders: [
    { path: "spec-kit/", what: "The package's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "Layer 3: the install, the five commands and the plugin value.", mayImport: ["archon, by its exports", "netboot, by its exports", "headless, by its exports", "core, system and terminal, by package name"] },
    { path: "suite/", what: "The tests: every requirement, with made-up tools and dialects that are real programs.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
