// Spec: 0001-estate-endpoints-layers FR-001
/**
 * The manifest of Estate Endpoints, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "estate-endpoints",
  group: "estate",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  maturity: "preview",
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Finds the endpoints of an estate from what describes or shows them: OpenAPI and GraphQL descriptions, Android and iOS manifests, DNS zone files, certificates and the listening ports a machine reports, as assets and links of the estate with where each came from. It reads files and text and reaches no network.",
  kanon: {
    package: "@intellectual-frontiers/estate-endpoints",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate-iac", subpaths: ["governance"] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance"] }, { name: "@intellectual-frontiers/estate-endpoints", subpaths: ["governance"] }, { name: "@intellectual-frontiers/estate-iac", subpaths: ["governance"] }, { name: "@intellectual-frontiers/formats", subpaths: ["xml", "yaml"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate-endpoints", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/estate-iac", subpaths: ["governance"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }, { name: "node:crypto", subpaths: [] }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
