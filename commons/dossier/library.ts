// Spec: 0001-dossier-layers FR-001
/**
 * The manifest of Dossier, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "dossier",
  family: { host: "dossier", role: "host" },
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "A sealed, point-in-time file on one subject, compiled from signed evidence through lenses as deterministic AsciiDoc: sources with hashes, lenses that select, project and disclose by class, plates with citations, a manifest of the evidence that a stranger can verify offline, a seal that only a person makes, and a diff by meaning; the same evidence, lenses and parameters give the same bytes, and no reader sees more than their class allows.",
  kanon: {
    package: "@intellectual-frontiers/dossier",
    family: { dialect: "{host}-dialect-{name}", plugin: "{host}-{name}", contract: "./logical" },
    plugins: [],
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/dossier", subpaths: ["governance"] },
          { name: "@intellectual-frontiers/formats", subpaths: ["asciidoc"] },
          { name: "@intellectual-frontiers/grc", subpaths: ["logical"] },
        ],
      },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/dossier", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/grc", subpaths: ["logical", "physical", "signers/sshsig"] },
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
