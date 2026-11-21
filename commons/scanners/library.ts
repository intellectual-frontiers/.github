// Spec: 0001-scanners-layers FR-001
/**
 * The manifest of Scanners, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "scanners",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner publishes the fleet libraries together, when the first fleet runs on them" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Runs security scanners (a built-in TLS and header check, nuclei, nmap, trivy, grype, semgrep, checkov and ZAP's baseline scan) the safe way: only after the engagement allows the action, only a binary whose SHA-256 is the one pinned for it, with a command line made from validated parts and no shell, in an empty working folder with a bare environment, and a record of every run. What they print is read into findings.",
  kanon: {
    package: "@intellectual-frontiers/scanners",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/findings", subpaths: ["governance"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/findings", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/scanners", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }, { name: "node:http", subpaths: [] }, { name: "node:https", subpaths: [] }, { name: "node:tls", subpaths: [] }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
