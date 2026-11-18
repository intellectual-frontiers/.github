// Spec: 0001-layers FR-008
/**
 * The manifest of IFC data, a library of commons (commons 0027-commons-libraries FR-012): data a program reads and never runs. Registering a library is a folder with a manifest like this one; this
 * repository's specification of the libraries is made from it (`bun ts/mizan/libraries.ts`), and a test fails where the manifest and the folder disagree.
 *
 * @module
 */
export const library = {
  name: "data",
  level: "L1",
  specKit: "spec-kit",
  verify: "bun run verify",
  version: "0.0.0",
  exports: [
    "./engine",
    "./governance",
    "./sql/logical",
    "./sql/physical",
    "./models/arca",
    "./sql/dialects/postgres",
    "./sql/dialects/sqlite",
    "./sql/dialects/duckdb",
    "./sql/extensions/documentation",
  ],
  summary:
    "A governance layer, a logical schema and a physical schema, and the extensions to each, produce SQL for PostgreSQL, SQLite and DuckDB; its own specifications say what it does.",
};
