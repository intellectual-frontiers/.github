/**
 * The Dune SQL dialect (commons lang-sql 0005-sql-dialects): Trino's.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as trino } from "../trino/mod.ts";

/** Dune SQL. */
export const dialect = declareDialect({ name: "dune", extends: trino, lexical: (b) => b });
