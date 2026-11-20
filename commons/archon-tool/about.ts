// Spec: 0001-tool-layers FR-001
/**
 * The typed facts of the plugin of `archon` for tools, a library of commons and a plugin of the family of Archon. Its specification is in its own spec kit (`spec-kit/`, `0001-tool-layers` and
 * `0002-tool-command`); this repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** The plugin for tools. */
export const about: About = {
  title: "Archon plugin: tool",
  summary:
    "The plugin that gives `archon` its verbs for tools: list what a fleet declares, show how each tool is resolved and why a dialect was not chosen, ensure the tools a phase of work needs (a plan first, then the same approval as any change), find what drifted, and clean what can be got again. " +
    "It holds no catalog and no dialect: a fleet gives it both.",
  folders: [
    { path: "spec-kit/", what: "The package's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "Layer 3: the analysis of a selection of tools, the five commands and the plugin value.", mayImport: ["archon, by its exports", "toolchain, by its exports", "headless, by its exports", "core, system and terminal, by package name"] },
    { path: "suite/", what: "The tests: every requirement, with made-up tools and dialects that are real programs.", mayImport: ["src/", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
