// Spec: 0001-integrations-github-connector FR-001
/**
 * The typed facts of Integrations GitHub, a plugin library of commons: The reference connector of Integrations for the posture of one organization of a code host: read-only, with its governan
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Integrations GitHub. */
export const about: About = {
  title: "Integrations GitHub",
  summary: "The reference connector of Integrations for the posture of one organization of a code host: read-only, with its governance as data, its posture policies in the vocabulary of GRC, its records and entities, proved by the conformance suite over made-up recorded answers.",
  folders: [
    { path: "spec-kit/", what: "The package's own specification.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "The plugin: its ports made of the library Integrations, by package name.", mayImport: ["core and integrations, by package name"] },
    { path: "suite/", what: "The tests, with the conformance suite of Integrations over synthetic data.", mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
