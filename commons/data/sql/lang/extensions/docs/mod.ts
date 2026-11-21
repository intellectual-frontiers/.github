/**
 * Documentation extracted from SQL comments (commons data 0068-sql-docs): the comments attached to the tables, columns, views, indexes, common table expressions and statements of a script, read as TSDoc reads a
 * comment (a summary, a description and tags, with the examples parsed back), in whatever kind of comment the dialect has, and written as Markdown. An extension of the SQL language core: it imports the core and
 * nothing else.
 *
 * @remarks
 * A declaration's documentation is its leading comments, then its trailing ones, then those that trail its name; a comment set apart by a blank line is not documentation.
 *
 * @limits
 * Documentation of the bodies of routines is not here; a later specification reads it with the parsers of stored routines.
 *
 * @example
 * ```ts
 * import { parse } from "@intellectual-frontiers/data/sql/lang";
 * import { documentScript, toMarkdown } from "@intellectual-frontiers/data/sql/lang/extensions/docs";
 * const md = toMarkdown(documentScript(parse("/** The people. *\/\nCREATE TABLE person (\n  id INT -- the key\n)")));
 * ```
 *
 * Spec: 0068-sql-docs FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
 *
 * @module
 */
export { type Declaration, type DeclarationKind, documentScript } from "./declarations.ts";
export {
  type CustomTag,
  type Doc,
  type DocOptions,
  type DocTag,
  type ExampleTag,
  type NoteTag,
  type ParamTag,
  parseDoc,
  type ReturnsTag,
} from "./doc.ts";
export { toMarkdown } from "./markdown.ts";
export { docText } from "./text.ts";
