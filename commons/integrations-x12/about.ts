// Spec: 0001-integrations-x12-skeleton FR-001
/**
 * The typed facts of Integrations X12, a plugin library of commons: The X12 envelope and acknowledgement skeleton of Integrations: the entries of X12 and of the HIPAA 5010 and purchasing t
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/commons/ts/kernel";

/** Integrations X12. */
export const about: About = {
  title: "Integrations X12",
  summary: "The X12 envelope and acknowledgement skeleton of Integrations: the entries of X12 and of the HIPAA 5010 and purchasing transaction sets with their licence as data, a codec for the fixed-width ISA envelope and its ISA, GS and ST levels, control counts checked as findings, TA1 and 999 made and read, and a loader of a schema from the user's own transcription of a licensed guide. It embeds no standard.",
  folders: [
    { path: "spec-kit/", what: "The package's own specification.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "The plugin: its ports made of the library Integrations, by package name.", mayImport: ["core and integrations, by package name"] },
    { path: "suite/", what: "The tests, with the conformance suite of Integrations over synthetic data.", mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
