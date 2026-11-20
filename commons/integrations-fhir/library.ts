// Spec: 0001-integrations-fhir-plugin FR-001
/**
 * The manifest of Integrations FHIR, a plugin library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs.
 *
 * @module
 */
export const library = {
  name: "integrations-fhir",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  exports: ["."],
  summary: "The FHIR plugin of Integrations: R4 and US Core as registry entries with their licence as data, a codec for FHIR JSON and NDJSON to the abstract typed tree, a loader of StructureDefinitions, CodeSystems and ValueSets the user supplies, and the acknowledgement port of OperationOutcome.",
};
