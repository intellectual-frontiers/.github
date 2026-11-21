/**
 * The Apache Druid dialect (commons lang-sql 0005-sql-dialects): the common comments, quoting and strings.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";

/** Apache Druid. */
export const dialect = declareDialect({ name: "druid", extends: ansi, lexical: (b) => b });
