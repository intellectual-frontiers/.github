// Spec: 0001-evidence-capture-layers FR-001
/**
 * The manifest of Evidence Capture, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "evidence-capture",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  maturity: "preview",
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "The unattended capture of evidence: which assets are due, the canonical state of each kept on a branch of Git with a commit only where it changed, a hash-chained journal of every look, batched commits and a push that is configured, never forced.",
  workbench: {
    requirements: [{ kind: "program", id: "ssh-keygen", name: "ssh-keygen", task: "test", summary: "ssh-keygen makes the keys that the seal and the views tests sign with", install: ["apt-get", "install", "-y", "openssh-client"] }],
    tests: [{ glob: "suite/{seal,views}.test.ts", needs: ["ssh-keygen"] }],
  },
  kanon: {
    package: "@intellectual-frontiers/evidence-capture",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance"] }, { name: "@intellectual-frontiers/grc", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/lang-sql", subpaths: ["aide/catalog", "aide/guard", "aide/relational", "aide/text"] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/estate", subpaths: ["governance"] }, { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] }, { name: "@intellectual-frontiers/grc", subpaths: ["governance", "logical", "physical", "stores/gitref", "signers/sshsig"] }, { name: "@intellectual-frontiers/headless", subpaths: ["logical"] }, { name: "@intellectual-frontiers/evidence-capture", subpaths: ["logical"] }, { name: "@intellectual-frontiers/system", subpaths: "any" }, { name: "node:fs/promises", subpaths: [] }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
