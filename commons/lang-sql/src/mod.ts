/**
 * The SQL language core (commons lang-sql 0001-sql-lang, 0002-sql-ast-parser): a small, fast, portable front end for SQL in many dialects. `lex` turns text into tokens and comments with exact positions; `parse` reads
 * the tokens into a syntax tree, a closed union whose child fields are typed by sort, and attaches each comment to its node; a dialect says how it is written (`defineDialect`) and how its grammar differs; and the
 * walks (`children`, `walk`, `findAll`, `fold`), `toSexp` and the rewrites (`rewriteScript` and its kin, with the `build` of nodes) read and change a tree; the extensions `extensions/query` (selections and
 * analyses) and `extensions/unist` (the projection to `unist`) are further exports. The folder imports only `@intellectual-frontiers/core`, so that it can be published alone as `@intellectual-frontiers/sql-lang`; the
 * dialects are the other exports (`./dialects/<name>`), and the core names none.
 *
 * @remarks
 * Not here yet, and specified after these layers: writing SQL from a tree, the extraction of documentation from comments, the dialects beyond the three, and SQL over data that is not a database.
 *
 * @limits
 * The common ground of SQL and what a dialect's grammar names; it does not write SQL, and does not look names up.
 *
 * @example
 * ```ts
 * import { commentsOf, parse } from "@intellectual-frontiers/lang-sql";
 * const { script, comments, attachments } = parse("-- a note\nselect a from t");
 * comments[0]?.text; // " a note"
 * commentsOf(attachments, script.statements[0]!).leading.length; // 1
 * ```
 *
 * Spec: 0001-sql-lang FR-001, FR-004, FR-009, FR-014, FR-015, FR-016, FR-017; 0002-sql-ast-parser FR-008, FR-016; 0003-sql-ast-tools FR-001, FR-003
 *
 * @module
 */
export { ANSI_LEXICAL, ansi } from "./ansi.ts";
export type * from "./ast.ts";
export {
  type Attachment,
  type AttachedTo,
  attachComments,
  attachTree,
  type Ranged,
  type TableOf,
  type CommentTable,
  commentsOf,
  NO_COMMENTS,
  type NodeComments,
  type Placement,
} from "./attach.ts";
export { type SexpOptions, toSexp } from "./dump.ts";
export { describeParseError, type ParseError, spanOf } from "./errors.ts";
export { build } from "./build.ts";
export { print, printScript, type PrintOptions } from "./print.ts";
export { describeEmitError, type EmitError, identifier, paramStyles, placeholder, qualified, quoteIdent, quoteString } from "./emit.ts";
export { ANSI_FUNCTIONS, createRegistry, describeRegistryError, type FunctionSpec, type Registry, type RegistryError } from "./registry.ts";
export { ANSI_GRAMMAR, type CustomOperator, type Grammar, Prec, RESERVED_WORDS, type UnitLiteral } from "./grammar.ts";
export {
  type Fragment,
  type ParseOptions,
  type Parsed,
  parse,
  parseExpressionRange,
  parseStatementRange,
  parseStrict,
  parseTypeRange,
  type StatementRangeOptions,
} from "./parser.ts";
export { type Rules, rewriteExpr, rewriteQuery, rewriteScript, rewriteSource, rewriteStatement } from "./rewrite.ts";
export { children, findAll, fold, type Visitor, walk } from "./walk.ts";
export { type Comment, CommentFlag, type Comments, type CommentStyle, allComments, commentAt, commentCount } from "./comment.ts";
export {
  declareDialect,
  defineDialect,
  describeDialectError,
  type Dialect,
  type DialectError,
  type DialectSpec,
  EMPTY_LEXICAL,
} from "./dialect.ts";
export { describeLexError, type LexError, type Lexed, lex } from "./lexer.ts";
export {
  type CommentSyntax,
  type CompiledLexical,
  compileLexical,
  describeLexicalError,
  type Escape,
  type IdentSyntax,
  keywordId,
  type Lexical,
  type LexicalError,
  operatorId,
  type ParamStyle,
  ParamStyleId,
  type StringPrefix,
  type StringSyntax,
} from "./lexical.ts";
export { type LineIndex, lineIndex, type Position, positionAt, type Span } from "./span.ts";
export { endAt, idAt, kindAt, startAt, textAt, type TokKind, Tok, tokenCount, type Tokens } from "./token.ts";
