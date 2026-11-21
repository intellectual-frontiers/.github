/**
 * The Apache Spark 2 dialect (commons data 0069-sql-dialects): Hive's, with the hexadecimal prefix `X`.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as hive } from "../hive/mod.ts";

/** Apache Spark 2. */
export const dialect = declareDialect({ name: "spark2", extends: hive, lexical: (b) => ({ ...b, prefixes: [{ prefix: "X" }] }) });
