// Spec: 0001-query-layers FR-001
/**
 * The manifest of the query language of AnyFS, a library of commons (commons 0027-commons-libraries FR-012) and a plugin of the family of `anyfs` (commons 0033-kanon FR-019 to FR-024): read-only SQL over the
 * files, places, revisions and content of any store. It extends `@intellectual-frontiers/anyfs` and the language library `@intellectual-frontiers/lang-sql`, and it does no input or output of its own: everything it
 * reads is an operation of a store it was handed.
 *
 * @module
 */
export const library = {
  name: "anyfs-query",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: { kind: "unfinished", reason: "built and verified but not released until the fleet store runs on it", missing: ["its first consumer, the fleet store"], liftedWhen: "the fleet store runs on it" },
  exports: [".", "./governance", "./logical"],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "The query language of AnyFS: read-only SQL over the files, places, revisions and content of any AnyFS store, planned so that a query lists only what its filter can match and reads only what its metadata leaves, within budgets it reports and the consent it was given.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-query",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] }] },
      {
        folder: "src/logical/",
        layer: "logical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/lang-sql", subpaths: "any" },
          { name: "@intellectual-frontiers/anyfs-query", subpaths: ["governance"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
