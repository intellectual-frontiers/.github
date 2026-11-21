/**
 * The SQL language core (commons data 0065-sql-lang): a small, fast, portable front end for SQL in many dialects, of which this is the lexical layer: `lex` turns text into tokens and comments with exact
 * positions, a dialect says how it is written (`defineDialect`, `compileLexical`), and the comments a person wrote are kept, with their place, for the features that read them. The folder imports only
 * `@intellectual-frontiers/core`, so that it can be published alone as `@intellectual-frontiers/sql-lang`; the dialects are the other exports (`./sql/lang/dialects/<name>`), and the core names none.
 *
 * @remarks
 * Not here yet, and specified after this layer: the parser and the syntax tree, the attachment of comments to nodes, the walkers and queries over the tree, the projection to `unist`, the extraction of
 * documentation from comments, and SQL over data that is not a database.
 *
 * @limits
 * It lexes; it does not parse, does not judge where a word is a keyword, and does not write SQL.
 *
 * @example
 * ```ts
 * import { allComments, ansi, lex } from "@intellectual-frontiers/data/sql/lang";
 * const { text, tokens, comments } = lex("-- a note\nselect 1", ansi.compiled);
 * allComments(comments, text)[0]?.text; // " a note"
 * ```
 *
 * Spec: 0065-sql-lang FR-001, FR-004, FR-009, FR-014, FR-015, FR-016, FR-017
 *
 * @module
 */
export { ANSI_LEXICAL, ansi } from "./ansi.ts";
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
