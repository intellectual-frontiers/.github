// Spec: 0001-estate-iac-layers FR-001
/**
 * The manifest of Estate Iac, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "estate-iac",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "built and verified but not released: the owner publishes the fleet libraries together, when the first fleet runs on them",
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Reads infrastructure as code (OpenTofu and Terraform plans and state as JSON, CloudFormation templates, Kubernetes manifests, Compose files, Pulumi stack exports) into assets and links of the estate, with where each came from, and compares what the code says with what a cloud shows. It reads files and runs no tool.",
  kanon: {
    package: "@intellectual-frontiers/estate-iac",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance"] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate-iac", subpaths: ["governance"] }, { name: "@intellectual-frontiers/formats", subpaths: ["yaml"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate-iac", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
