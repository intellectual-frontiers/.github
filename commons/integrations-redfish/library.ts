// Spec: 0001-integrations-redfish-layers FR-001
/**
 * The manifest of Integrations Redfish, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "integrations-redfish",
  family: { host: "integrations", role: "plugin" },
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  maturity: "preview",
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "A read-only observer of baseboard management controllers that answer Redfish over HTTPS: the service root, systems, chassis, managers and firmware by the links of the documents, bounded, with the OEM extensions dropped, the identity keys for the estate, written against the HTTP read port of Integrations and proved over made-up documents.",
  kanon: {
    package: "@intellectual-frontiers/integrations-redfish",
    extends: "@intellectual-frontiers/integrations",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance"] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/integrations-redfish", subpaths: ["governance"] }] },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical", "http"] },
          { name: "@intellectual-frontiers/net", subpaths: ["http-client"] },
          { name: "@intellectual-frontiers/integrations-redfish", subpaths: ["governance", "logical"] },

        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
