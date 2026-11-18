// Spec: 0026-sql-kinds FR-001
/**
 * Kinds (commons data 0026-sql-kinds): reference data kept as CSV, read into typed rows, checked against a table, written as a TypeScript module, and given to integrations and ephemeral targets.
 *
 * @example
 * ```ts
 * const k = must(kindsFromCsv("code,label,rank\nperson,Person,1\n", { name: "kind", types: { rank: "integer" } }));
 * writeFileSync("kinds.auto.ts", kindsModule(k, { source: "kinds.csv" }));
 * ```
 *
 * @module
 */
export { type Cell, type CheckError, checkKinds, type Kinds, kindsFromCsv, type KindsError, kindsModule, type KindsOptions, type KindType, rowsOf } from "./kinds.ts";
