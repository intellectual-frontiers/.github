// Spec: 0001-anyfs-githost-layers FR-001
/**
 * The manifest of the Git host backend of AnyFS, a library of commons (commons 0027-commons-libraries FR-012) and a plugin of the family of AnyFS (commons 0033-kanon FR-019 to FR-024): it extends
 * `@intellectual-frontiers/anyfs` and reaches it only through its exports.
 *
 * @module
 */
export const library = {
  name: "anyfs-githost",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "unfinished", reason: "built and verified but not released until the fleet store runs on it", missing: ["its first consumer, the fleet store"], liftedWhen: "the fleet store runs on it" },
  exports: [".", "./governance", "./physical"],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "The Git host backend of AnyFS: a branch of a repository on GitHub or GitLab (gitlab.com or a self-managed server) kept as a store through the host's REST API, with a revision on every read and a stated expectation on every write, a batch that is one commit, and a branch that is the compare-and-swap of every writer.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-githost",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] }] },
      {
        folder: "src/physical/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/formats", subpaths: ["base64"] },
          { name: "@intellectual-frontiers/net", subpaths: ["http-client"] },
          { name: "@intellectual-frontiers/headless", subpaths: ["logical"] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/anyfs-githost", subpaths: ["governance"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
