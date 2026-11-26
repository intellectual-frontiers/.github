// Spec: 0001-integrations-otel-layers FR-001
/**
 * The manifest of Integrations OTel, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "integrations-otel",
  family: { host: "integrations", role: "plugin" },
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified against recorded, made-up answers and never against a live system: the owner releases the fleet libraries together, when a first site has been read" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "A read-only observer of what the controller's receiver kept of the signals of assets and of site relays: one device record for each asset or key set, the latest host metrics as posture facts, counts of log records by severity and class with no body, and a sighting for each device no asset holds, proved over made-up batches.",
  kanon: {
    package: "@intellectual-frontiers/integrations-otel",
    extends: "@intellectual-frontiers/integrations",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance"] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/integrations-otel", subpaths: ["governance"] }] },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/integrations-otel", subpaths: ["governance", "logical"] },
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
