// Spec: 0001-change-control-layers FR-001
/**
 * The manifest of Change Control, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`.
 *
 * @module
 */
export const library = {
  name: "change-control",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  maturity: "preview",
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "Change control for a fleet's repository: each change is accepted only if a signer of the fleet signed it, a change to a controlled path is blocked until a different signer of an approving role approves it, and what is refused or blocked is said with the reason; the signers are the fleet's own and the check reads Git with its own signature verification.",
  workbench: {
    requirements: [{ kind: "program", id: "ssh-keygen", name: "ssh-keygen", task: "test", summary: "ssh-keygen makes the keys that the key and signature tests use", install: ["apt-get", "install", "-y", "openssh-client"] }],
    tests: [{ glob: "suite/{keys,change-control}.test.ts", needs: ["ssh-keygen"] }],
  },
  kanon: {
    package: "@intellectual-frontiers/change-control",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/change-control", subpaths: ["governance"] }, { name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/physical/", layer: "physical", mayImport: ["src/governance/", "src/logical/"], packages: [{ name: "@intellectual-frontiers/change-control", subpaths: ["governance", "logical"] }, { name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/system", subpaths: "any" }] },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
