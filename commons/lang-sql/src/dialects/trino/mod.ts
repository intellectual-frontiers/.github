/**
 * The Trino dialect (commons lang-sql 0005-sql-dialects): Presto's.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as presto } from "../presto/mod.ts";

/** Trino. */
export const dialect = declareDialect({ name: "trino", extends: presto, lexical: (b) => b });
