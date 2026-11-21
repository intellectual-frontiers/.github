// Spec: 0001-integrations-x12-skeleton FR-001
/**
 * The manifest of Integrations X12, a plugin library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs.
 *
 * @module
 */
export const library = {
  name: "integrations-x12",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.2.1",
  distribution: ["github", "npm"],
  exports: ["."],
  summary: "The X12 envelope and acknowledgement skeleton of Integrations: the entries of X12 and of the HIPAA 5010 and purchasing transaction sets with their licence as data, a codec for the fixed-width ISA envelope and its ISA, GS and ST levels, control counts checked as findings, TA1 and 999 made and read, and a loader of a schema from the user's own transcription of a licensed guide. It embeds no standard.",
};
