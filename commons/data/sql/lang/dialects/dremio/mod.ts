/**
 * The Dremio dialect (commons data 0069-sql-dialects): `--`, `//` and block comments, identifiers in double quotes, strings in single quotes.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";

/** Dremio. */
export const dialect = declareDialect({
  name: "dremio",
  extends: ansi,
  lexical: (b) => ({
    ...b,
    comments: [
      { kind: "line", marker: "--" },
      { kind: "line", marker: "//" },
      { kind: "block", open: "/*", close: "*/", nested: true },
    ],
  }),
});
