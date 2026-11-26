// Spec: 0001-actor-layers FR-001
/**
 * The manifest of Actor, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "actor",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  maturity: "preview",
  distribution: ["github", "npm"],
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Who did what in a regulated act: actors (person, system, agent), the six roles with the rule in the types that an agent is never the initiator, reviewer or approver, directives, tasking levels, the commit trailers and a vocabulary lint, and a retention policy for the digests of agent sessions.",
  kanon: {
    package: "@intellectual-frontiers/actor",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/actor", subpaths: ["governance"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/actor", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/system", subpaths: "any" },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
