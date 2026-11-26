// Spec: 0001-bridge-layers FR-001
/**
 * The manifest of the bridge of AnyFS, a library of commons (commons 0027-commons-libraries FR-012) and a plugin of the family of `anyfs` (commons 0033-kanon FR-019 to FR-024): the operations between
 * stores. It extends `@intellectual-frontiers/anyfs` and reaches it only through its exports; it does no input or output of its own, since every change it makes is an operation of a store.
 *
 * @module
 */
export const library = {
  name: "anyfs-bridge",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github", "npm"],
  maturity: "experimental",
  limits: ["no program runs on it yet; the fleet store is its first consumer"],
  exports: [".", "./governance", "./logical", "./conformance", "./mirror", "./exchange"],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "The bridge of AnyFS: copy, sync, move, check, two-way sync and mirror between any two stores. Every transfer is a plan first, in a fixed order with a hash, that says how each file was compared and what the destination would not keep; an apply refuses a plan that is not the one approved, guards every write by the revision the plan saw, and checks what it wrote. The rails (filters, limits, never-overwrite, protected paths) are code, and nothing here touches a file system or a network except through a store.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-bridge",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        mayImport: ["src/governance/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical"] },
        ],
      },
      {
        folder: "src/conformance/",
        layer: "logical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [{ name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical", "conformance"] }],
      },
      {
        folder: "src/mirror/",
        layer: "logical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical", "docs"] },
        ],
      },
      {
        folder: "src/exchange/",
        layer: "logical",
        mayImport: ["src/governance/", "src/logical/"],
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical", "merge"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
