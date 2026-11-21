/**
 * The Apache Doris dialect (commons data 0069-sql-dialects): MySQL's comments, quoting, strings and operators.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as mysql } from "../mysql/mod.ts";

/** Apache Doris. */
export const dialect = declareDialect({ name: "doris", extends: mysql, lexical: (b) => b, grammar: (g) => ({ ...g, lambdas: true }) });
