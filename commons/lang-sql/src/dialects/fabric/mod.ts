/**
 * The Microsoft Fabric dialect (commons lang-sql 0005-sql-dialects): Transact-SQL's.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as tsql } from "../tsql/mod.ts";

/** Microsoft Fabric. */
export const dialect = declareDialect({ name: "fabric", extends: tsql, lexical: (b) => b });
