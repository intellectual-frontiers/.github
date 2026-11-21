/**
 * The Materialize dialect (commons lang-sql 0005-sql-dialects): PostgreSQL's comments, quoting, dollar quotes and operators.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as postgres } from "../postgres/mod.ts";

/** Materialize. */
export const dialect = declareDialect({ name: "materialize", extends: postgres, lexical: (b) => b });
