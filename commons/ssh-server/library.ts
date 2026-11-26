// Spec: 0001-ssh-server-layers FR-001
/**
 * The manifest of SSH Server, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Its `kanon` field is the table of its layers (commons 0033-kanon FR-010), which the shared checker
 * of `@intellectual-frontiers/kanon` holds in `verify`. The package `ssh2` is allowed in `src/physical/` and nowhere else (0001-ssh-server-layers FR-003).
 *
 * @module
 */
export const library = {
  name: "ssh-server",
  group: "lab",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "owner-blocked", reason: "built and verified but not released: the owner releases it with the controller that calls it" },
  exports: [".", "./governance", "./logical", "./physical"],
  summary: "The SSH server of enrollment: a device with only an ssh client enrolls inbound against our own server on ssh2, which speaks a closed registry of typed commands, renders the bootstrap scripts for POSIX sh and PowerShell 7, decides by typed policy, keeps the session in a store port and never gives a shell.",
  kanon: {
    package: "@intellectual-frontiers/ssh-server",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
      { folder: "src/logical/", layer: "logical", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/ssh-server", subpaths: ["governance"] }] },
      {
        folder: "src/physical/",
        layer: "physical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/ssh-server", subpaths: ["governance", "logical"] },
          { name: "ssh2", subpaths: [] },
          { name: "node:crypto", subpaths: [] },
          { name: "node:dns/promises", subpaths: [] },
          { name: "node:fs", subpaths: [] },
          { name: "node:fs/promises", subpaths: [] },
          { name: "node:net", subpaths: [] },
          { name: "node:path", subpaths: [] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
