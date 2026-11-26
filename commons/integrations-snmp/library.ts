// Spec: 0001-integrations-snmp-layers FR-001
/**
 * The manifest of Integrations SNMP, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "integrations-snmp",
  family: { host: "integrations", role: "plugin" },
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  maturity: "preview",
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "A read-only observer of network devices that answer SNMPv3: GET and GETNEXT with authentication and privacy (HMAC-SHA-2 and AES), a bounded walk of an allow-list of subtrees, the posture of each device in the vocabulary of GRC and its identity keys for the estate, written against the read port of Integrations and proved over recorded, made-up messages.",
  kanon: {
    package: "@intellectual-frontiers/integrations-snmp",
    extends: "@intellectual-frontiers/integrations",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance"] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/integrations-snmp", subpaths: ["governance"] }] },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/integrations-snmp", subpaths: ["governance", "logical"] },
          { name: "node:crypto", subpaths: [] },
          { name: "node:dgram", subpaths: [] }
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
