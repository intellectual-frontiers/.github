// Spec: 0001-git-layers FR-001
/**
 * The manifest of the SQL stores of AnyFS, a library of commons (commons 0027-commons-libraries FR-012) and a plugin of the family of `anyfs` (commons 0033-kanon FR-019 to FR-024): objects kept in the tables
 * of a SQL-speaking database. It extends `@intellectual-frontiers/anyfs` and reaches it only through its exports; every statement it runs is built by the language of SQL (`lang-sql`) and run through a port
 * a caller gives, so that the driver of the database is the caller's.
 *
 * @module
 */
export const library = {
  name: "anyfs-sql",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.1.0",
  distribution: ["github"],
  held: "new: built and verified but not released until the fleet store runs on it",
  exports: [".", "./governance", "./physical", "./sqlite", "./libsql", "./pg", "./pglite", "./duckdb"],
  family: { host: "anyfs", role: "plugin" },
  summary:
    "The SQL stores of AnyFS: objects kept in a table of any SQL-speaking database (a SQLite file by default, PostgreSQL and DuckDB too, and libSQL and Turso as drivers of SQLite), with a revision on every object, a native transaction for a batch, a history of revisions and search where the engine has an index for it, and the layout of the tables documented for a catalog.",
  kanon: {
    package: "@intellectual-frontiers/anyfs-sql",
    extends: "@intellectual-frontiers/anyfs",
    units: [
      { folder: "src/governance/", layer: "governance", packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }, { name: "@intellectual-frontiers/anyfs", subpaths: ["governance"] }] },
      {
        folder: "src/physical/",
        layer: "physical",
        packages: [
          { name: "@intellectual-frontiers/core", subpaths: [] },
          { name: "@intellectual-frontiers/crypto", subpaths: ["sha256"] },
          { name: "@intellectual-frontiers/system", subpaths: ["path"] },
          { name: "@intellectual-frontiers/lang-sql", subpaths: "any" },
          { name: "@intellectual-frontiers/anyfs", subpaths: ["governance", "logical"] },
          { name: "@intellectual-frontiers/anyfs-sql", subpaths: ["governance"] },
        ],
      },
      { folder: "src/", own: true },
      { folder: "suite/", own: true },
      { folder: "tools/", own: true },
      { folder: "./", own: true },
    ],
  },
};
