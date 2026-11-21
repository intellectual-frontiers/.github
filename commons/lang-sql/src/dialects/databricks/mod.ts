/**
 * The Databricks dialect (commons lang-sql 0005-sql-dialects): Spark's quoting, raw strings and number suffixes.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as spark } from "../spark/mod.ts";

/** Databricks. */
export const dialect = declareDialect({ name: "databricks", extends: spark, lexical: (b) => b, grammar: (g) => ({ ...g, colonPaths: true }) });
