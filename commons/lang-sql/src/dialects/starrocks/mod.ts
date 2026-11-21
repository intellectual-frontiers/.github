/**
 * The StarRocks dialect (commons lang-sql 0005-sql-dialects): MySQL's comments, quoting, strings and operators.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as mysql } from "../mysql/mod.ts";

/** StarRocks. */
export const dialect = declareDialect({ name: "starrocks", extends: mysql, lexical: (b) => b, grammar: (g) => ({ ...g, lambdas: true }) });
