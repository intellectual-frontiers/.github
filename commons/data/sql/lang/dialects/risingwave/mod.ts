/**
 * The RisingWave dialect (commons data 0069-sql-dialects): PostgreSQL's comments, quoting, dollar quotes and operators.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as postgres } from "../postgres/mod.ts";

/** RisingWave. */
export const dialect = declareDialect({ name: "risingwave", extends: postgres, lexical: (b) => b });
