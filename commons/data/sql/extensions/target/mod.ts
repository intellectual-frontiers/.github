// Spec: 0025-sql-target FR-001
/**
 * Ephemeral targets (commons data 0025-sql-target): a database that is a build product, one SQL file made from governance and typed rows, the same bytes every time, committed and diffed in Git;
 * made into a database in one transaction; and checked for staleness.
 *
 * @example
 * ```ts
 * const b = must(targetBuild(schema, { dialect, rows: { genre: [{ code: "novel", label: "Novel" }] }, module: "catalog.ts" }));
 * writeFileSync("catalog.auto.sql", b.text);          // committed
 * await materialize(driver, b);                        // made from it
 * staleness(readFileSync("catalog.auto.sql", "utf8"), b); // { stale: false }
 * ```
 *
 * @module
 */
export { type Cell, type Rows, type SizeFinding, sizeFindings, targetBuild, type TargetBuild, type TargetError, type TargetOptions } from "./build.ts";
export { materialize, type Staleness, staleness } from "./make.ts";
