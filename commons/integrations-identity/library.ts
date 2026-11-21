// Spec: 0001-integrations-identity-layers FR-001
/**
 * The manifest of Integrations Identity, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "integrations-identity",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified against recorded, made-up answers and never against a live tenant: the owner publishes the fleet libraries together, when a first customer tenant has been read" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Read-only connectors for the identity and device posture of a managed service provider's customers: a Microsoft Entra tenant (who has multifactor authentication, whether a policy requires it), Microsoft Intune managed devices (compliance, encryption, staleness) and a Google Workspace domain (two-step verification, administrators), each written against the read port of Integrations, with its governance as data and a conformance run over recorded answers.",
  kanon: {
    package: "@intellectual-frontiers/integrations-identity",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/integrations", subpaths: ["governance", "logical"] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/integrations", subpaths: ["logical"] }, { name: "@intellectual-frontiers/integrations-identity", subpaths: ["governance"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
