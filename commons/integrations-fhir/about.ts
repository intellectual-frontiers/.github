// Spec: 0001-integrations-fhir-plugin FR-001
/**
 * The typed facts of Integrations FHIR, a plugin library of commons: The FHIR plugin of Integrations: R4 and US Core as registry entries with their licence as data, a codec for FHIR JSON an
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Integrations FHIR. */
export const about: About = {
  title: "Integrations FHIR",
  summary: "The FHIR plugin of Integrations: R4 and US Core as registry entries with their licence as data, a codec for FHIR JSON and NDJSON to the abstract typed tree, a loader of StructureDefinitions, CodeSystems and ValueSets the user supplies, and the acknowledgement port of OperationOutcome.",
  folders: [
    { path: "spec-kit/", what: "The package's own specification.", mayImport: ["nothing: Markdown and TSV"] },
    { path: "src/", what: "The plugin: its ports made of the library Integrations, by package name.", mayImport: ["core and integrations, by package name"] },
    { path: "suite/", what: "The tests, with the conformance suite of Integrations over synthetic data.", mayImport: ["src/", "fast-check", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check and the packer `bun run verify` runs.", mayImport: ["the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
