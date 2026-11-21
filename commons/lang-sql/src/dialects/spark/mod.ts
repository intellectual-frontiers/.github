/**
 * The Apache Spark dialect (commons lang-sql 0005-sql-dialects): Spark 2's, with raw strings (`r'..'`) that have no escapes.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as spark2 } from "../spark2/mod.ts";

/** Apache Spark. */
export const dialect = declareDialect({
  name: "spark",
  extends: spark2,
  lexical: (b) => ({ ...b, prefixes: [...b.prefixes, { prefix: "R", escape: "none" }], operators: [...b.operators, "::"] }),
  grammar: (g) => ({ ...g, castOperator: "::" }),
});
