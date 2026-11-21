/**
 * The parser of SQL (commons data 0066-sql-ast-parser): the tokens of a text, by index, into the tree of `ast.ts`. Expressions are read by precedence climbing over the binding powers of `grammar.ts`, with
 * the operators a dialect adds in tables made once for it; statements, clauses and definitions by recursive descent. A statement that cannot be read becomes an `unparsed` node and an error value, and the parser
 * goes on at the next `;`, so a script with one bad statement still gives the others.
 *
 * @remarks
 * The recursive descent signals a failure by throwing a private `Failure` that `script` catches at the statement and turns into an error value; nothing is thrown out of `parse`. Nesting is limited to 200
 * levels, so that a text of `(((((` is an error value and not a stack overflow. A node is made by one object literal, with its fields in the order its interface declares them.
 *
 * @limits
 * The common ground of SQL and the operators and words a dialect's grammar names; not `MERGE`, `GROUP BY ROLLUP`, the `WINDOW` clause, ordered-set aggregates, array subscripts, JSON paths or procedural code.
 *
 * @example
 * ```ts
 * const { script, errors } = parse("SELECT a, count(*) FROM t WHERE a > 1 GROUP BY a");
 * errors.length; // 0
 * script.statements[0]?.kind; // "select"
 * ```
 *
 * Spec: 0066-sql-ast-parser FR-008, FR-009, FR-010, FR-011, FR-012, FR-013
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { ansi } from "./ansi.ts";
import type {
  Alias,
  AlterAction,
  Argument,
  Assignment,
  BinaryOp,
  ColumnConstraint,
  ColumnDef,
  Cte,
  DataType,
  Expr,
  Frame,
  FrameBound,
  Ident,
  Insert,
  IsTest,
  JoinType,
  Name,
  NamedArg,
  OrderItem,
  Query,
  RefAction,
  Reference,
  Script,
  Select,
  SelectItem,
  SetOp,
  SetOperator,
  Source,
  Statement,
  TableConstraint,
  TableRef,
  Tuple,
  WindowSpec,
} from "./ast.ts";
import { attachComments, type CommentTable, NO_COMMENTS } from "./attach.ts";
import { allComments, type Comment } from "./comment.ts";
import type { Dialect } from "./dialect.ts";
import type { ParseError } from "./errors.ts";
import { Prec, RESERVED_WORDS } from "./grammar.ts";
import { lex, Q_STRING } from "./lexer.ts";
import { type CompiledLexical, keywordId, operatorId, type ParamStyle } from "./lexical.ts";
import { Tok, type TokKind } from "./token.ts";

const MAX_DEPTH = 200;

/** What a parse gives. */
export interface Parsed {
  readonly text: string;
  readonly script: Script;
  /** Everything that could not be read, in the order of the text: the lexer's errors and the parser's. */
  readonly errors: readonly ParseError[];
  /** Every comment of the text. */
  readonly comments: readonly Comment[];
  /** Each comment's node and placement. */
  readonly attachments: CommentTable;
}

/** What a parse may be asked. */
export interface ParseOptions {
  /** Whether to attach the comments to nodes (the default); the comments are returned either way. */
  readonly attach?: boolean;
}

class Failure extends Error {
  readonly error: ParseError;
  constructor(error: ParseError) {
    super("parse failure");
    this.error = error;
  }
}

const kw = (lx: CompiledLexical) => {
  const k = (w: string): number => keywordId(lx, w) ?? -1;
  return {
    SELECT: k("SELECT"),
    FROM: k("FROM"),
    WHERE: k("WHERE"),
    GROUP: k("GROUP"),
    BY: k("BY"),
    HAVING: k("HAVING"),
    ORDER: k("ORDER"),
    LIMIT: k("LIMIT"),
    OFFSET: k("OFFSET"),
    FETCH: k("FETCH"),
    FIRST: k("FIRST"),
    NEXT: k("NEXT"),
    ROW: k("ROW"),
    ROWS: k("ROWS"),
    ONLY: k("ONLY"),
    UNION: k("UNION"),
    INTERSECT: k("INTERSECT"),
    EXCEPT: k("EXCEPT"),
    ALL: k("ALL"),
    DISTINCT: k("DISTINCT"),
    JOIN: k("JOIN"),
    INNER: k("INNER"),
    LEFT: k("LEFT"),
    RIGHT: k("RIGHT"),
    FULL: k("FULL"),
    CROSS: k("CROSS"),
    NATURAL: k("NATURAL"),
    OUTER: k("OUTER"),
    ON: k("ON"),
    USING: k("USING"),
    AS: k("AS"),
    AND: k("AND"),
    OR: k("OR"),
    NOT: k("NOT"),
    NULL: k("NULL"),
    TRUE: k("TRUE"),
    FALSE: k("FALSE"),
    CASE: k("CASE"),
    WHEN: k("WHEN"),
    THEN: k("THEN"),
    ELSE: k("ELSE"),
    END: k("END"),
    IN: k("IN"),
    IS: k("IS"),
    LIKE: k("LIKE"),
    BETWEEN: k("BETWEEN"),
    EXISTS: k("EXISTS"),
    VALUES: k("VALUES"),
    WITH: k("WITH"),
    RECURSIVE: k("RECURSIVE"),
    INSERT: k("INSERT"),
    INTO: k("INTO"),
    UPDATE: k("UPDATE"),
    SET: k("SET"),
    DELETE: k("DELETE"),
    CREATE: k("CREATE"),
    TABLE: k("TABLE"),
    VIEW: k("VIEW"),
    INDEX: k("INDEX"),
    ALTER: k("ALTER"),
    DROP: k("DROP"),
    PRIMARY: k("PRIMARY"),
    KEY: k("KEY"),
    FOREIGN: k("FOREIGN"),
    REFERENCES: k("REFERENCES"),
    CHECK: k("CHECK"),
    UNIQUE: k("UNIQUE"),
    DEFAULT: k("DEFAULT"),
    CONSTRAINT: k("CONSTRAINT"),
    RETURNING: k("RETURNING"),
    LATERAL: k("LATERAL"),
    ESCAPE: k("ESCAPE"),
    CAST: k("CAST"),
    EXTRACT: k("EXTRACT"),
    INTERVAL: k("INTERVAL"),
    OVER: k("OVER"),
    FILTER: k("FILTER"),
    PARTITION: k("PARTITION"),
    RANGE: k("RANGE"),
    GROUPS: k("GROUPS"),
    UNBOUNDED: k("UNBOUNDED"),
    PRECEDING: k("PRECEDING"),
    FOLLOWING: k("FOLLOWING"),
    CURRENT: k("CURRENT"),
    ASC: k("ASC"),
    DESC: k("DESC"),
    NULLS: k("NULLS"),
    LAST: k("LAST"),
    UNKNOWN: k("UNKNOWN"),
    IF: k("IF"),
    REPLACE: k("REPLACE"),
    COLUMN: k("COLUMN"),
    ADD: k("ADD"),
    RENAME: k("RENAME"),
    TO: k("TO"),
    CASCADE: k("CASCADE"),
    RESTRICT: k("RESTRICT"),
    ACTION: k("ACTION"),
    COLLATE: k("COLLATE"),
    NO: k("NO"),
    TIME: k("TIME"),
    WITHOUT: k("WITHOUT"),
    YEAR: k("YEAR"),
    MONTH: k("MONTH"),
    DAY: k("DAY"),
    HOUR: k("HOUR"),
    MINUTE: k("MINUTE"),
    SECOND: k("SECOND"),
  } as const;
};
type Kw = ReturnType<typeof kw>;
const KW_CACHE = new WeakMap<CompiledLexical, Kw>();

interface Infix {
  readonly prec: number;
  readonly op: BinaryOp | undefined;
  readonly text: string;
}

const CORE_INFIX: readonly (readonly [string, number, BinaryOp])[] = [
  ["+", Prec.Additive, "+"],
  ["-", Prec.Additive, "-"],
  ["*", Prec.Multiplicative, "*"],
  ["/", Prec.Multiplicative, "/"],
  ["%", Prec.Multiplicative, "%"],
  ["||", Prec.Other, "||"],
  ["=", Prec.Compare, "="],
  ["<>", Prec.Compare, "<>"],
  ["!=", Prec.Compare, "!="],
  ["<", Prec.Compare, "<"],
  ["<=", Prec.Compare, "<="],
  [">", Prec.Compare, ">"],
  [">=", Prec.Compare, ">="],
];

/** The words that may follow the first word of a type's name where what follows the type is an expression. */
const TYPE_WORDS: ReadonlySet<string> = new Set([
  "PRECISION",
  "VARYING",
  "TIME",
  "ZONE",
  "LOCAL",
  "UNSIGNED",
  "SIGNED",
  "ZEROFILL",
  "CHARACTER",
  "CHAR",
  "VARCHAR",
  "NCHAR",
  "BYTE",
  "YEAR",
  "MONTH",
  "DAY",
  "HOUR",
  "MINUTE",
  "SECOND",
  "TO",
  "WITH",
  "WITHOUT",
]);
/** The words that begin a statement the grammar keeps as a command. */
const COMMAND_WORDS: ReadonlySet<string> = new Set(
  "SET SHOW EXPLAIN DESCRIBE DESC ANALYZE ANALYSE GRANT REVOKE USE PRAGMA BEGIN START COMMIT ROLLBACK SAVEPOINT RELEASE TRUNCATE COPY VACUUM CALL EXEC EXECUTE DECLARE IF WHILE LOAD ATTACH DETACH INSTALL EXPORT IMPORT COMMENT LOCK UNLOCK REFRESH REINDEX CLUSTER CHECKPOINT RESET DISCARD DO LISTEN NOTIFY PREPARE DEALLOCATE FETCH OPTIMIZE MERGE UNSET UNDROP RENAME SYSTEM".split(
    " ",
  ),
);
/** The words that may stand between `CREATE` and the kind of object. */
const OBJECT_MODIFIERS: ReadonlySet<string> = new Set(
  "OR REPLACE TEMP TEMPORARY GLOBAL LOCAL UNLOGGED MATERIALIZED RECURSIVE UNIQUE VIRTUAL EXTERNAL TRANSIENT VOLATILE SECURE IF NOT EXISTS".split(
    " ",
  ),
);
/** The words that may stand between `CREATE` and `TABLE`. */
const TABLE_MODIFIERS: ReadonlySet<string> = new Set("TEMP TEMPORARY GLOBAL LOCAL UNLOGGED TRANSIENT VOLATILE EXTERNAL".split(" "));
const STYLES: readonly ParamStyle[] = ["question", "question", "dollar-number", "dollar-name", "colon-name", "at-name"];
const ESCAPES: Readonly<Record<string, string>> = { n: "\n", t: "\t", r: "\r", "0": "\0", b: "\b", f: "\f", v: "\v" };

/** The value of a string token's text. */
function stringValue(raw: string, lx: CompiledLexical, tag: number): { readonly value: string; readonly prefix: string } {
  if (tag === 0) {
    const j = raw.indexOf("$", 1);
    const t = raw.slice(0, j + 1);
    const inner = raw.length >= t.length * 2 && raw.endsWith(t) ? raw.slice(t.length, raw.length - t.length) : raw.slice(t.length);
    return { value: inner, prefix: "" };
  }
  if (tag === Q_STRING) return { value: raw.slice(3, Math.max(3, raw.length - 2)), prefix: raw.charAt(0).toUpperCase() };
  const syn = lx.lexical.strings[tag - 1];
  if (syn === undefined) return { value: raw, prefix: "" };
  const p = raw.indexOf(syn.open);
  const prefix = raw.slice(0, p);
  const escape = lx.prefixes.get(prefix.toUpperCase()) ?? syn.escape;
  const closed = raw.length >= p + syn.open.length + syn.close.length && raw.endsWith(syn.close);
  const inner = raw.slice(p + syn.open.length, closed ? raw.length - syn.close.length : raw.length);
  const q = syn.close.length === 1 ? syn.close : "";
  const doubled = q !== "" && (escape === "double" || escape === "both");
  const slashed = escape === "backslash" || escape === "both";
  if ((!slashed || !inner.includes("\\")) && (!doubled || !inner.includes(q + q))) return { value: inner, prefix };
  let out = "";
  for (let k = 0; k < inner.length; k++) {
    const c = inner.charAt(k);
    if (slashed && c === "\\" && k + 1 < inner.length) {
      const n = inner.charAt(k + 1);
      out += ESCAPES[n] ?? n;
      k++;
    } else if (doubled && c === q && inner.charAt(k + 1) === q) {
      out += q;
      k++;
    } else out += c;
  }
  return { value: out, prefix };
}

class Parser {
  private readonly text: string;
  private readonly lx: CompiledLexical;
  private readonly kinds: readonly TokKind[];
  private readonly starts: readonly number[];
  private readonly ends: readonly number[];
  private readonly ids: readonly number[];
  private readonly K: Kw;
  private readonly reserved: ReadonlySet<number>;
  private readonly infix: readonly (Infix | undefined)[];
  private readonly likeWords: ReadonlySet<number>;
  private readonly castOp: number;
  private readonly opMinus: number;
  private readonly opPlus: number;
  private readonly opStar: number;
  private readonly named: ReadonlySet<number>;
  private readonly wordOps: ReadonlyMap<number, Infix>;
  private i = 0;
  private depth = 0;
  readonly errors: ParseError[] = [];

  constructor(
    text: string,
    tokens: {
      readonly kind: readonly TokKind[];
      readonly start: readonly number[];
      readonly end: readonly number[];
      readonly id: readonly number[];
    },
    d: Dialect,
  ) {
    this.text = text;
    this.lx = d.compiled;
    this.kinds = tokens.kind;
    this.starts = tokens.start;
    this.ends = tokens.end;
    this.ids = tokens.id;
    const cached = KW_CACHE.get(d.compiled);
    this.K = cached ?? kw(d.compiled);
    if (cached === undefined) KW_CACHE.set(d.compiled, this.K);
    const reserved = new Set<number>();
    for (const w of RESERVED_WORDS) {
      const id = keywordId(d.compiled, w);
      if (id !== undefined) reserved.add(id);
    }
    this.reserved = reserved;
    const infix: (Infix | undefined)[] = [];
    for (const [text2, prec, op] of CORE_INFIX) {
      const id = operatorId(d.compiled, text2);
      if (id !== undefined) infix[id] = { prec, op, text: text2 };
    }
    for (const o of d.grammar.operators) {
      const id = operatorId(d.compiled, o.text);
      if (id !== undefined) infix[id] = { prec: o.prec, op: undefined, text: o.text };
    }
    this.infix = infix;
    const like = new Set<number>();
    for (const w of d.grammar.likeWords) {
      const id = keywordId(d.compiled, w);
      if (id !== undefined) like.add(id);
    }
    this.likeWords = like;
    this.castOp = d.grammar.castOperator === undefined ? -1 : (operatorId(d.compiled, d.grammar.castOperator) ?? -1);
    this.opMinus = operatorId(d.compiled, "-") ?? -1;
    this.opPlus = operatorId(d.compiled, "+") ?? -1;
    this.opStar = operatorId(d.compiled, "*") ?? -1;
    const named = new Set<number>();
    for (const t of ["=>", ":="]) {
      const id = operatorId(d.compiled, t);
      if (id !== undefined) named.add(id);
    }
    this.named = named;
    const wordOps = new Map<number, Infix>();
    for (const o of d.grammar.wordOperators) {
      const id = keywordId(d.compiled, o.text);
      if (id !== undefined) wordOps.set(id, { prec: o.prec, op: undefined, text: o.text });
    }
    this.wordOps = wordOps;
  }

  // ---- the tokens

  private kind(at = 0): TokKind {
    return this.kinds[this.i + at] ?? Tok.Eof;
  }
  private id(at = 0): number {
    return this.ids[this.i + at] ?? 0;
  }
  /** The kind of the token `back` before the cursor. */
  private tokens(back: number): TokKind {
    return this.kinds[this.i + back] ?? Tok.Eof;
  }
  private atEnd(): boolean {
    return this.kind() === Tok.Eof;
  }
  private at(word: number, off = 0): boolean {
    return this.kind(off) === Tok.Word && this.id(off) === word;
  }
  private atOp(op: number, off = 0): boolean {
    return this.kind(off) === Tok.Op && this.id(off) === op;
  }
  private eat(word: number): boolean {
    if (this.at(word)) {
      this.i++;
      return true;
    }
    return false;
  }
  private eatKind(k: TokKind): boolean {
    if (this.kind() === k) {
      this.i++;
      return true;
    }
    return false;
  }
  private start(): number {
    return this.starts[this.i] ?? this.text.length;
  }
  private last(): number {
    return this.ends[this.i - 1] ?? 0;
  }
  private slice(at = 0): string {
    return this.text.slice(this.starts[this.i + at] ?? this.text.length, this.ends[this.i + at] ?? this.text.length);
  }
  private found(): string {
    if (this.atEnd()) return "the end of the text";
    const t = this.slice();
    return JSON.stringify(t.length > 24 ? `${t.slice(0, 24)}...` : t);
  }
  private fail(expected: string): never {
    throw new Failure({
      kind: "expected",
      expected,
      found: this.found(),
      span: { start: this.start(), end: this.ends[this.i] ?? this.start() },
    });
  }
  private unsupported(what: string): never {
    throw new Failure({ kind: "unsupported", what, span: { start: this.start(), end: this.ends[this.i] ?? this.start() } });
  }
  private expect(word: number, name: string): void {
    if (!this.eat(word)) this.fail(name);
  }
  private expectKind(k: TokKind, name: string): void {
    if (!this.eatKind(k)) this.fail(name);
  }
  private deeper(): void {
    if (++this.depth > MAX_DEPTH)
      throw new Failure({ kind: "too-deep", span: { start: this.start(), end: this.ends[this.i] ?? this.start() } });
  }
  private isReserved(at = 0): boolean {
    return this.kind(at) === Tok.Word && this.reserved.has(this.id(at));
  }
  private canBeIdent(at = 0): boolean {
    const k = this.kind(at);
    return k === Tok.QuotedIdent || (k === Tok.Word && !this.isReserved(at));
  }

  // ---- names

  private ident(allowReserved = false): Ident {
    const k = this.kind();
    const s = this.start();
    if (k === Tok.QuotedIdent) {
      const raw = this.slice();
      const syn = this.lx.lexical.identifiers[this.id()];
      const open = syn?.open ?? '"';
      const close = syn?.close ?? '"';
      const closed = raw.length >= open.length + close.length && raw.endsWith(close);
      let name = raw.slice(open.length, closed ? raw.length - close.length : raw.length);
      if (name.includes(close + close)) name = name.split(close + close).join(close);
      this.i++;
      return { kind: "ident", start: s, end: this.last(), name, quoted: true };
    }
    if (k === Tok.Word && (allowReserved || !this.isReserved())) {
      const name = this.slice();
      this.i++;
      return { kind: "ident", start: s, end: this.last(), name, quoted: false };
    }
    return this.fail("a name");
  }
  private qualifiedName(): Name {
    const s = this.start();
    const parts: Ident[] = [this.ident()];
    while (this.kind() === Tok.Dot && (this.kind(1) === Tok.Word || this.kind(1) === Tok.QuotedIdent)) {
      this.i++;
      parts.push(this.ident(true));
    }
    return { kind: "name", start: s, end: this.last(), parts };
  }
  private identList(): Ident[] {
    this.expectKind(Tok.LParen, "(");
    const out: Ident[] = [this.ident()];
    while (this.eatKind(Tok.Comma)) out.push(this.ident());
    this.expectKind(Tok.RParen, ")");
    return out;
  }
  private commaList<T>(one: () => T): T[] {
    const out: T[] = [one()];
    while (this.eatKind(Tok.Comma)) out.push(one());
    return out;
  }

  // ---- expressions

  expr(min: number = 0): Expr {
    this.deeper();
    const s = this.start();
    let left = this.prefix();
    for (;;) {
      const k = this.kind();
      if (k === Tok.Op) {
        const oid = this.id();
        if (oid === this.castOp) {
          if (Prec.Cast < min) break;
          this.i++;
          const type = this.dataType(true);
          left = { kind: "cast", start: s, end: this.last(), arg: left, type };
          continue;
        }
        const info = this.infix[oid];
        if (info === undefined || info.prec < min) break;
        this.i++;
        const right = this.expr(info.prec + 1);
        left =
          info.op === undefined
            ? { kind: "operator", start: s, end: this.last(), op: info.text, left, right }
            : { kind: "binary", start: s, end: this.last(), op: info.op, left, right };
        continue;
      }
      if (k === Tok.LBracket) {
        if (Prec.Cast < min) break;
        this.i++;
        const index = this.expr(0);
        this.expectKind(Tok.RBracket, "]");
        left = { kind: "subscript", start: s, end: this.last(), arg: left, index };
        continue;
      }
      if (k !== Tok.Word) break;
      const w = this.id();
      const K = this.K;
      const wordOp = this.wordOps.get(w);
      if (wordOp !== undefined) {
        if (wordOp.prec < min) break;
        this.i++;
        const right = this.expr(wordOp.prec + 1);
        left = { kind: "operator", start: s, end: this.last(), op: wordOp.text, left, right };
      } else if (w === K.COLLATE) {
        if (Prec.Cast < min) break;
        this.i++;
        const collation = this.qualifiedName();
        left = { kind: "collate", start: s, end: this.last(), arg: left, collation };
      } else if (w === K.AND) {
        if (Prec.And < min) break;
        this.i++;
        const right = this.expr(Prec.And + 1);
        left = { kind: "binary", start: s, end: this.last(), op: "AND", left, right };
      } else if (w === K.OR) {
        if (Prec.Or < min) break;
        this.i++;
        const right = this.expr(Prec.Or + 1);
        left = { kind: "binary", start: s, end: this.last(), op: "OR", left, right };
      } else if (w === K.IS) {
        if (Prec.Is < min) break;
        this.i++;
        const negated = this.eat(K.NOT);
        let test: IsTest;
        let other: Expr | undefined;
        if (this.eat(K.NULL)) test = "null";
        else if (this.eat(K.TRUE)) test = "true";
        else if (this.eat(K.FALSE)) test = "false";
        else if (this.eat(K.UNKNOWN)) test = "unknown";
        else if (this.eat(K.DISTINCT)) {
          this.expect(K.FROM, "FROM");
          test = "distinct-from";
          other = this.expr(Prec.Compare + 1);
        } else this.fail("NULL, TRUE, FALSE, UNKNOWN or DISTINCT FROM");
        left = { kind: "is", start: s, end: this.last(), arg: left, test, negated, other };
      } else if (w === K.NOT || w === K.BETWEEN || w === K.IN || w === K.LIKE || this.likeWords.has(w)) {
        const neg = w === K.NOT;
        const at = neg ? 1 : 0;
        const nw = this.id(at);
        if (this.kind(at) !== Tok.Word || (nw !== K.BETWEEN && nw !== K.IN && nw !== K.LIKE && !this.likeWords.has(nw))) break;
        if (Prec.Like < min) break;
        this.i += at + 1;
        if (nw === K.BETWEEN) {
          const low = this.expr(Prec.Like + 1);
          this.expect(K.AND, "AND");
          const high = this.expr(Prec.Like + 1);
          left = { kind: "between", start: s, end: this.last(), arg: left, negated: neg, low, high };
        } else if (nw === K.IN) {
          this.expectKind(Tok.LParen, "(");
          if (this.atQuery()) {
            const query = this.query();
            this.expectKind(Tok.RParen, ")");
            left = { kind: "in-query", start: s, end: this.last(), arg: left, negated: neg, query };
          } else {
            const values = this.commaList(() => this.expr(0));
            this.expectKind(Tok.RParen, ")");
            left = { kind: "in", start: s, end: this.last(), arg: left, negated: neg, values };
          }
        } else {
          const op = this.text.slice(this.starts[this.i - 1] ?? 0, this.ends[this.i - 1] ?? 0).toUpperCase();
          const pattern = this.expr(Prec.Like + 1);
          const escape = this.eat(K.ESCAPE) ? this.expr(Prec.Like + 1) : undefined;
          left = { kind: "like", start: s, end: this.last(), arg: left, op, negated: neg, pattern, escape };
        }
      } else break;
    }
    this.depth--;
    return left;
  }

  private prefix(): Expr {
    const k = this.kind();
    const s = this.start();
    switch (k) {
      case Tok.Number: {
        const text = this.slice();
        this.i++;
        return { kind: "number", start: s, end: this.last(), text };
      }
      case Tok.String: {
        const { value, prefix } = stringValue(this.slice(), this.lx, this.id());
        this.i++;
        return { kind: "string", start: s, end: this.last(), value, prefix };
      }
      case Tok.Param: {
        const text = this.slice();
        const style = STYLES[this.id()] ?? "question";
        this.i++;
        return { kind: "param", start: s, end: this.last(), style, text };
      }
      case Tok.LParen: {
        this.i++;
        if (this.atQuery()) {
          const query = this.query();
          this.expectKind(Tok.RParen, ")");
          return { kind: "scalar-query", start: s, end: this.last(), query };
        }
        const first = this.expr(0);
        if (this.kind() === Tok.Comma) {
          const items: Expr[] = [first];
          while (this.eatKind(Tok.Comma)) items.push(this.expr(0));
          this.expectKind(Tok.RParen, ")");
          return { kind: "tuple", start: s, end: this.last(), items };
        }
        this.expectKind(Tok.RParen, ")");
        return first;
      }
      case Tok.LBracket: {
        this.i++;
        const items = this.kind() === Tok.RBracket ? [] : this.commaList(() => this.expr(0));
        this.expectKind(Tok.RBracket, "]");
        return { kind: "array", start: s, end: this.last(), items };
      }
      case Tok.Op: {
        const o = this.id();
        if (o === this.opMinus || o === this.opPlus) {
          this.i++;
          const arg = this.expr(Prec.Unary);
          return { kind: "unary", start: s, end: this.last(), op: o === this.opMinus ? "-" : "+", arg };
        }
        return this.fail("an expression");
      }
      case Tok.Word:
      case Tok.QuotedIdent:
        return this.wordPrefix(s);
      case Tok.Eof:
      case Tok.RParen:
      case Tok.RBracket:
      case Tok.LBrace:
      case Tok.RBrace:
      case Tok.Comma:
      case Tok.Semicolon:
      case Tok.Dot:
      case Tok.Error:
        return this.fail("an expression");
      default:
        return absurd(k);
    }
  }

  private wordPrefix(s: number): Expr {
    const K = this.K;
    if (this.kind() === Tok.Word) {
      const w = this.id();
      const paren = this.kind(1) === Tok.LParen;
      if (w === K.NULL) {
        this.i++;
        return { kind: "null", start: s, end: this.last() };
      }
      if (w === K.TRUE || w === K.FALSE) {
        this.i++;
        return { kind: "boolean", start: s, end: this.last(), value: w === K.TRUE };
      }
      if (w === K.NOT) {
        this.i++;
        const arg = this.expr(Prec.Not + 1);
        return { kind: "unary", start: s, end: this.last(), op: "NOT", arg };
      }
      if (w === K.CASE) return this.caseExpr(s);
      if (this.kind(1) === Tok.LBracket && this.slice().toUpperCase() === "ARRAY") {
        this.i += 2;
        const items = this.kind() === Tok.RBracket ? [] : this.commaList(() => this.expr(0));
        this.expectKind(Tok.RBracket, "]");
        return { kind: "array", start: s, end: this.last(), items };
      }
      if (w === K.CAST && paren) {
        this.i += 2;
        const arg = this.expr(0);
        this.expect(K.AS, "AS");
        const type = this.dataType(true);
        this.expectKind(Tok.RParen, ")");
        return { kind: "cast", start: s, end: this.last(), arg, type };
      }
      if (w === K.EXTRACT && paren) {
        this.i += 2;
        const field = this.ident(true).name.toUpperCase();
        this.expect(K.FROM, "FROM");
        const arg = this.expr(0);
        this.expectKind(Tok.RParen, ")");
        return { kind: "extract", start: s, end: this.last(), field, arg };
      }
      if (w === K.EXISTS && paren) {
        this.i += 2;
        const query = this.query();
        this.expectKind(Tok.RParen, ")");
        return { kind: "exists", start: s, end: this.last(), query };
      }
      if (w === K.INTERVAL && (this.kind(1) === Tok.String || this.kind(1) === Tok.Number || this.kind(1) === Tok.Param)) {
        this.i++;
        const value = this.prefix();
        let unit: string | undefined;
        if (this.kind() === Tok.Word && this.isIntervalUnit(this.id())) {
          unit = this.slice().toUpperCase();
          this.i++;
        }
        return { kind: "interval", start: s, end: this.last(), value, unit };
      }
      if (this.isReserved() && !paren) return this.fail("an expression");
    }
    const first = this.ident(true);
    const parts: Ident[] = [first];
    while (this.kind() === Tok.Dot) {
      if (this.kind(1) === Tok.Op && this.id(1) === this.opStar) {
        this.i += 2;
        const qualifier: Name = { kind: "name", start: s, end: this.ends[this.i - 2] ?? s, parts };
        return { kind: "star", start: s, end: this.last(), qualifier };
      }
      if (this.kind(1) !== Tok.Word && this.kind(1) !== Tok.QuotedIdent) break;
      this.i++;
      parts.push(this.ident(true));
    }
    const name: Name = { kind: "name", start: s, end: this.last(), parts };
    if (this.kind() === Tok.LParen) return this.call(name);
    return name;
  }

  private isIntervalUnit(w: number): boolean {
    const K = this.K;
    return w === K.YEAR || w === K.MONTH || w === K.DAY || w === K.HOUR || w === K.MINUTE || w === K.SECOND;
  }

  private caseExpr(s: number): Expr {
    const K = this.K;
    this.i++;
    const operand = this.at(K.WHEN) ? undefined : this.expr(0);
    const whens: { kind: "when"; start: number; end: number; cond: Expr; result: Expr }[] = [];
    while (this.at(K.WHEN)) {
      const ws = this.start();
      this.i++;
      const cond = this.expr(0);
      this.expect(K.THEN, "THEN");
      const result = this.expr(0);
      whens.push({ kind: "when", start: ws, end: this.last(), cond, result });
    }
    if (whens.length === 0) this.fail("WHEN");
    const otherwise = this.eat(K.ELSE) ? this.expr(0) : undefined;
    this.expect(K.END, "END");
    return { kind: "case", start: s, end: this.last(), operand, whens, otherwise };
  }

  private call(name: Name): Expr {
    const K = this.K;
    this.i++;
    let distinct = false;
    const args: Argument[] = [];
    if (this.kind() === Tok.Op && this.id() === this.opStar && this.kind(1) === Tok.RParen) {
      const ss = this.start();
      this.i++;
      args.push({ kind: "star", start: ss, end: this.last(), qualifier: undefined });
    } else if (this.kind() !== Tok.RParen) {
      if (this.eat(K.DISTINCT)) distinct = true;
      else this.eat(K.ALL);
      args.push(...this.commaList(() => this.argument()));
    }
    this.expectKind(Tok.RParen, ")");
    let filter: Expr | undefined;
    if (this.at(K.FILTER) && this.kind(1) === Tok.LParen) {
      this.i += 2;
      this.expect(K.WHERE, "WHERE");
      filter = this.expr(0);
      this.expectKind(Tok.RParen, ")");
    }
    let over: WindowSpec | undefined;
    if (this.at(K.OVER)) {
      this.i++;
      over = this.kind() === Tok.LParen ? this.windowSpec() : this.namedWindow();
    }
    return { kind: "call", start: name.start, end: this.last(), name, args, distinct, filter, over };
  }

  private argument(): Argument {
    if (
      (this.kind() === Tok.Word || this.kind() === Tok.QuotedIdent) &&
      this.kind(1) === Tok.Op &&
      this.named.has(this.id(1)) &&
      this.canBeIdent()
    ) {
      const s = this.start();
      const name = this.ident();
      this.i++;
      const value = this.expr(0);
      const arg: NamedArg = { kind: "named-arg", start: s, end: this.last(), name, value };
      return arg;
    }
    if (this.kind() === Tok.Op && this.id() === this.opStar) {
      const s = this.start();
      this.i++;
      return { kind: "star", start: s, end: this.last(), qualifier: undefined };
    }
    return this.expr(0);
  }

  private namedWindow(): WindowSpec {
    const s = this.start();
    const base = this.ident();
    return { kind: "window-spec", start: s, end: this.last(), base, partitionBy: [], orderBy: [], frame: undefined };
  }

  private windowSpec(): WindowSpec {
    const K = this.K;
    const s = this.start();
    this.i++;
    let base: Ident | undefined;
    if (this.canBeIdent() && !this.at(K.PARTITION) && !this.at(K.ORDER) && !this.at(K.ROWS) && !this.at(K.RANGE) && !this.at(K.GROUPS))
      base = this.ident();
    let partitionBy: Expr[] = [];
    if (this.eat(K.PARTITION)) {
      this.expect(K.BY, "BY");
      partitionBy = this.commaList(() => this.expr(0));
    }
    const orderBy = this.orderByClause();
    let frame: Frame | undefined;
    if (this.at(K.ROWS) || this.at(K.RANGE) || this.at(K.GROUPS)) frame = this.frame();
    this.expectKind(Tok.RParen, ")");
    return { kind: "window-spec", start: s, end: this.last(), base, partitionBy, orderBy, frame };
  }

  private frame(): Frame {
    const K = this.K;
    const s = this.start();
    const unit = this.at(K.ROWS) ? "rows" : this.at(K.RANGE) ? "range" : "groups";
    this.i++;
    if (this.eat(K.BETWEEN)) {
      const from = this.frameBound();
      this.expect(K.AND, "AND");
      const to = this.frameBound();
      return { kind: "frame", start: s, end: this.last(), unit, from, to };
    }
    const from = this.frameBound();
    return { kind: "frame", start: s, end: this.last(), unit, from, to: undefined };
  }

  private frameBound(): FrameBound {
    const K = this.K;
    const s = this.start();
    if (this.eat(K.UNBOUNDED)) {
      const preceding = this.at(K.PRECEDING);
      if (!this.eat(K.PRECEDING) && !this.eat(K.FOLLOWING)) this.fail("PRECEDING or FOLLOWING");
      return {
        kind: "frame-bound",
        start: s,
        end: this.last(),
        type: preceding ? "unbounded-preceding" : "unbounded-following",
        offset: undefined,
      };
    }
    if (this.eat(K.CURRENT)) {
      this.expect(K.ROW, "ROW");
      return { kind: "frame-bound", start: s, end: this.last(), type: "current-row", offset: undefined };
    }
    const offset = this.expr(Prec.Additive);
    const preceding = this.at(K.PRECEDING);
    if (!this.eat(K.PRECEDING) && !this.eat(K.FOLLOWING)) this.fail("PRECEDING or FOLLOWING");
    return { kind: "frame-bound", start: s, end: this.last(), type: preceding ? "preceding" : "following", offset };
  }

  private orderItem(): OrderItem {
    const K = this.K;
    const s = this.start();
    const expr = this.expr(0);
    const direction = this.eat(K.ASC) ? "asc" : this.eat(K.DESC) ? "desc" : undefined;
    let nulls: "first" | "last" | undefined;
    if (this.eat(K.NULLS)) {
      if (this.eat(K.FIRST)) nulls = "first";
      else if (this.eat(K.LAST)) nulls = "last";
      else this.fail("FIRST or LAST");
    }
    return { kind: "order-item", start: s, end: this.last(), expr, direction, nulls };
  }

  private orderByClause(): OrderItem[] {
    const K = this.K;
    if (!this.at(K.ORDER)) return [];
    this.i++;
    this.expect(K.BY, "BY");
    return this.commaList(() => this.orderItem());
  }

  // ---- data types

  /** Whether the word at the cursor may continue a data type's name after its first word, where what follows a type is an expression (`x::int ILIKE 'a'`, `x::int DESC`). */
  private isTypeWord(): boolean {
    return TYPE_WORDS.has(this.slice().toUpperCase());
  }

  private dataType(strict = false): DataType {
    const K = this.K;
    const s = this.start();
    const words: string[] = [];
    const args: Expr[] = [];
    if (this.kind() === Tok.QuotedIdent) words.push(this.ident().name.toUpperCase());
    else if (this.kind() === Tok.Word) {
      words.push(this.slice().toUpperCase());
      this.i++;
    } else this.fail("a type");
    let paren = false;
    for (;;) {
      if (this.kind() === Tok.LParen && !paren) {
        paren = true;
        this.i++;
        args.push(...this.commaList(() => this.expr(0)));
        this.expectKind(Tok.RParen, ")");
      } else if (
        this.kind() === Tok.Word &&
        (!this.isReserved() || ((this.at(K.WITH) || this.at(K.WITHOUT)) && this.at(K.TIME, 1))) &&
        (!strict || this.isTypeWord())
      ) {
        words.push(this.slice().toUpperCase());
        this.i++;
      } else break;
    }
    let name = words.join(" ");
    while (this.kind() === Tok.LBracket && this.kind(1) === Tok.RBracket) {
      this.i += 2;
      name += "[]";
    }
    let collation: string | undefined;
    if (this.eat(K.COLLATE)) {
      const c = this.qualifiedName();
      collation = c.parts.map((p) => p.name).join(".");
    }
    return { kind: "data-type", start: s, end: this.last(), name, args, collation };
  }

  // ---- queries

  private atQuery(at = 0): boolean {
    const K = this.K;
    let o = at;
    while (this.kind(o) === Tok.LParen) o++;
    return this.at(K.SELECT, o) || this.at(K.WITH, o) || this.at(K.VALUES, o);
  }

  query(): Query {
    const K = this.K;
    this.deeper();
    let q: Query;
    if (this.at(K.WITH)) q = this.withQuery();
    else q = this.queryExpr();
    this.depth--;
    return q;
  }

  private withQuery(): Query {
    const K = this.K;
    const s = this.start();
    this.i++;
    const recursive = this.eat(K.RECURSIVE);
    const ctes = this.commaList((): Cte => {
      const cs = this.start();
      const name = this.ident();
      const columns = this.kind() === Tok.LParen ? this.identList() : [];
      this.expect(K.AS, "AS");
      this.expectKind(Tok.LParen, "(");
      const query = this.query();
      this.expectKind(Tok.RParen, ")");
      return { kind: "cte", start: cs, end: this.last(), name, columns, query };
    });
    const body = this.queryExpr();
    return { kind: "with", start: s, end: this.last(), recursive, ctes, body };
  }

  private queryExpr(): Query {
    const K = this.K;
    const s = this.start();
    const left = this.setExpr(1);
    const orderBy = this.orderByClause();
    let limit: Expr | undefined;
    let offset: Expr | undefined;
    for (;;) {
      if (this.eat(K.LIMIT)) limit = this.expr(0);
      else if (this.eat(K.OFFSET)) {
        offset = this.expr(0);
        if (!this.eat(K.ROWS)) this.eat(K.ROW);
      } else if (this.at(K.FETCH)) {
        this.i++;
        if (!this.eat(K.FIRST)) this.expect(K.NEXT, "FIRST or NEXT");
        limit =
          this.at(K.ROW) || this.at(K.ROWS)
            ? { kind: "number", start: this.start(), end: this.start(), text: "1" }
            : this.expr(Prec.Additive);
        if (!this.eat(K.ROWS)) this.expect(K.ROW, "ROW or ROWS");
        this.expect(K.ONLY, "ONLY");
      } else break;
    }
    if (orderBy.length === 0 && limit === undefined && offset === undefined) return left;
    if (left.kind === "select" || left.kind === "set-op") {
      if (left.orderBy.length > 0 || left.limit !== undefined || left.offset !== undefined)
        this.unsupported("a clause after a query in parentheses that has its own");
      return left.kind === "select"
        ? { ...left, start: s, end: this.last(), orderBy, limit, offset }
        : { ...left, start: s, end: this.last(), orderBy, limit, offset };
    }
    return this.unsupported("ORDER BY or LIMIT after this query");
  }

  private setOperator(): SetOperator | undefined {
    const K = this.K;
    if (this.at(K.UNION)) return "union";
    if (this.at(K.INTERSECT)) return "intersect";
    if (this.at(K.EXCEPT)) return "except";
    return undefined;
  }

  private setExpr(min: number): Query {
    const K = this.K;
    const s = this.start();
    let left = this.queryTerm();
    for (;;) {
      const op = this.setOperator();
      if (op === undefined) break;
      const level = op === "intersect" ? 2 : 1;
      if (level < min) break;
      this.i++;
      const quantifier = this.eat(K.ALL) ? "all" : this.eat(K.DISTINCT) ? "distinct" : undefined;
      const right = this.setExpr(level + 1);
      const node: SetOp = {
        kind: "set-op",
        start: s,
        end: this.last(),
        op,
        quantifier,
        left,
        right,
        orderBy: [],
        limit: undefined,
        offset: undefined,
      };
      left = node;
    }
    return left;
  }

  private queryTerm(): Query {
    const K = this.K;
    if (this.at(K.SELECT)) return this.selectCore();
    if (this.at(K.VALUES)) return this.values();
    if (this.kind() === Tok.LParen && this.atQuery()) {
      this.i++;
      const q = this.query();
      this.expectKind(Tok.RParen, ")");
      return q;
    }
    return this.fail("a query");
  }

  private values(): Query {
    const s = this.start();
    this.i++;
    const rows = this.commaList((): Tuple => {
      const rs = this.start();
      this.expectKind(Tok.LParen, "(");
      const items = this.commaList(() => this.expr(0));
      this.expectKind(Tok.RParen, ")");
      return { kind: "tuple", start: rs, end: this.last(), items };
    });
    return { kind: "values", start: s, end: this.last(), rows };
  }

  private selectItem(): SelectItem {
    const K = this.K;
    const s = this.start();
    let expr: Expr;
    if (this.kind() === Tok.Op && this.id() === this.opStar) {
      this.i++;
      expr = { kind: "star", start: s, end: this.last(), qualifier: undefined };
    } else expr = this.expr(0);
    let alias: Ident | undefined;
    if (this.eat(K.AS)) alias = this.ident(true);
    else if (this.canBeIdent()) alias = this.ident();
    return { kind: "select-item", start: s, end: this.last(), expr, alias };
  }

  private selectCore(): Select {
    const K = this.K;
    const s = this.start();
    this.i++;
    const distinct = this.eat(K.DISTINCT);
    if (!distinct) this.eat(K.ALL);
    const items = this.commaList(() => this.selectItem());
    const from = this.eat(K.FROM) ? this.commaList(() => this.joined()) : [];
    const where = this.eat(K.WHERE) ? this.expr(0) : undefined;
    let groupBy: Expr[] = [];
    if (this.eat(K.GROUP)) {
      this.expect(K.BY, "BY");
      groupBy = this.commaList(() => this.expr(0));
    }
    const having = this.eat(K.HAVING) ? this.expr(0) : undefined;
    return {
      kind: "select",
      start: s,
      end: this.last(),
      distinct,
      items,
      from,
      where,
      groupBy,
      having,
      orderBy: [],
      limit: undefined,
      offset: undefined,
    };
  }

  // ---- sources

  private alias(): Alias | undefined {
    const K = this.K;
    const s = this.start();
    let name: Ident;
    if (this.eat(K.AS)) name = this.ident(true);
    else if (this.canBeIdent()) name = this.ident();
    else return undefined;
    const columns = this.kind() === Tok.LParen ? this.identList() : [];
    return { kind: "alias", start: s, end: this.last(), name, columns };
  }

  private tableRef(): TableRef {
    const s = this.start();
    const name = this.qualifiedName();
    const alias = this.alias();
    return { kind: "table", start: s, end: this.last(), name, alias };
  }

  private sourceTerm(): Source {
    const K = this.K;
    const s = this.start();
    const lateral = this.eat(K.LATERAL);
    if (this.at(K.VALUES)) {
      const query = this.values();
      const alias = this.alias();
      return { kind: "subquery", start: s, end: this.last(), query, alias, lateral };
    }
    if (this.kind() === Tok.LParen) {
      if (this.atQuery(1)) {
        this.i++;
        const query = this.query();
        this.expectKind(Tok.RParen, ")");
        const alias = this.alias();
        return { kind: "subquery", start: s, end: this.last(), query, alias, lateral };
      }
      this.i++;
      const inner = this.joined();
      this.expectKind(Tok.RParen, ")");
      return inner;
    }
    const name = this.qualifiedName();
    if (this.kind() === Tok.LParen) {
      const call = this.call(name);
      if (call.kind !== "call") return this.fail("a function call");
      const alias = this.alias();
      return { kind: "table-fn", start: s, end: this.last(), call, alias, lateral };
    }
    const alias = this.alias();
    return { kind: "table", start: s, end: this.last(), name, alias };
  }

  private joined(): Source {
    const K = this.K;
    const s = this.start();
    let left = this.sourceTerm();
    for (;;) {
      const natural = this.eat(K.NATURAL);
      let type: JoinType | undefined;
      if (this.eat(K.INNER)) type = "inner";
      else if (this.eat(K.LEFT)) type = "left";
      else if (this.eat(K.RIGHT)) type = "right";
      else if (this.eat(K.FULL)) type = "full";
      else if (this.eat(K.CROSS)) type = "cross";
      if (type === "left" || type === "right" || type === "full") this.eat(K.OUTER);
      if (!this.eat(K.JOIN)) {
        if (natural || type !== undefined) this.fail("JOIN");
        return left;
      }
      const right = this.sourceTerm();
      let on: Expr | undefined;
      let using: Ident[] = [];
      if (this.eat(K.ON)) on = this.expr(0);
      else if (this.eat(K.USING)) using = this.identList();
      left = { kind: "join", start: s, end: this.last(), type: type ?? "inner", natural, left, right, on, using };
    }
  }

  // ---- statements

  private returning(): SelectItem[] {
    return this.eat(this.K.RETURNING) ? this.commaList(() => this.selectItem()) : [];
  }

  private insert(): Insert {
    const K = this.K;
    const s = this.start();
    this.i++;
    this.expect(K.INTO, "INTO");
    const table = this.qualifiedName();
    const columns = this.kind() === Tok.LParen && !this.atQuery(1) ? this.identList() : [];
    let source: Query | undefined;
    if (this.eat(K.DEFAULT)) this.expect(K.VALUES, "VALUES");
    else source = this.query();
    const returning = this.returning();
    return { kind: "insert", start: s, end: this.last(), table, columns, source, returning };
  }

  private update(): Statement {
    const K = this.K;
    const s = this.start();
    this.i++;
    const table = this.tableRef();
    this.expect(K.SET, "SET");
    const assignments = this.commaList((): Assignment => {
      const as = this.start();
      const target = this.qualifiedName();
      if (!this.atOp(operatorId(this.lx, "=") ?? -1)) this.fail("=");
      this.i++;
      const value = this.expr(0);
      return { kind: "assignment", start: as, end: this.last(), target, value };
    });
    const from = this.eat(K.FROM) ? this.commaList(() => this.joined()) : [];
    const where = this.eat(K.WHERE) ? this.expr(0) : undefined;
    const returning = this.returning();
    return { kind: "update", start: s, end: this.last(), table, assignments, from, where, returning };
  }

  private delete(): Statement {
    const K = this.K;
    const s = this.start();
    this.i++;
    this.expect(K.FROM, "FROM");
    const table = this.tableRef();
    const where = this.eat(K.WHERE) ? this.expr(0) : undefined;
    const returning = this.returning();
    return { kind: "delete", start: s, end: this.last(), table, where, returning };
  }

  private refAction(): RefAction {
    const K = this.K;
    if (this.eat(K.CASCADE)) return "cascade";
    if (this.eat(K.RESTRICT)) return "restrict";
    if (this.eat(K.SET)) {
      if (this.eat(K.NULL)) return "set-null";
      this.expect(K.DEFAULT, "NULL or DEFAULT");
      return "set-default";
    }
    this.expect(K.NO, "an action");
    this.expect(K.ACTION, "ACTION");
    return "no-action";
  }

  private reference(): Reference {
    const K = this.K;
    const s = this.start();
    this.expect(K.REFERENCES, "REFERENCES");
    const table = this.qualifiedName();
    const columns = this.kind() === Tok.LParen ? this.identList() : [];
    let onDelete: RefAction | undefined;
    let onUpdate: RefAction | undefined;
    while (this.at(K.ON)) {
      this.i++;
      if (this.eat(K.DELETE)) onDelete = this.refAction();
      else if (this.eat(K.UPDATE)) onUpdate = this.refAction();
      else this.fail("DELETE or UPDATE");
    }
    return { kind: "reference", start: s, end: this.last(), table, columns, onDelete, onUpdate };
  }

  private atTableConstraint(): boolean {
    const K = this.K;
    return this.at(K.CONSTRAINT) || this.at(K.PRIMARY) || this.at(K.UNIQUE) || this.at(K.CHECK) || this.at(K.FOREIGN);
  }

  private tableConstraint(): TableConstraint {
    const K = this.K;
    const s = this.start();
    const name = this.eat(K.CONSTRAINT) ? this.ident() : undefined;
    if (this.eat(K.PRIMARY)) {
      this.expect(K.KEY, "KEY");
      const columns = this.identList();
      return { kind: "primary-key", start: s, end: this.last(), name, columns };
    }
    if (this.eat(K.UNIQUE)) {
      const columns = this.identList();
      return { kind: "unique", start: s, end: this.last(), name, columns };
    }
    if (this.eat(K.CHECK)) {
      this.expectKind(Tok.LParen, "(");
      const expr = this.expr(0);
      this.expectKind(Tok.RParen, ")");
      return { kind: "check", start: s, end: this.last(), name, expr };
    }
    this.expect(K.FOREIGN, "PRIMARY KEY, UNIQUE, CHECK or FOREIGN KEY");
    this.expect(K.KEY, "KEY");
    const columns = this.identList();
    const reference = this.reference();
    return { kind: "foreign-key", start: s, end: this.last(), name, columns, reference };
  }

  private columnConstraints(): ColumnConstraint[] {
    const K = this.K;
    const out: ColumnConstraint[] = [];
    for (;;) {
      const s = this.start();
      const named = this.at(K.CONSTRAINT);
      const name = this.eat(K.CONSTRAINT) ? this.ident() : undefined;
      if (this.at(K.NOT) && this.at(K.NULL, 1)) {
        this.i += 2;
        out.push({ kind: "not-null", start: s, end: this.last(), name });
      } else if (this.eat(K.NULL)) {
        continue;
      } else if (this.eat(K.DEFAULT)) {
        const expr = this.expr(0);
        out.push({ kind: "default", start: s, end: this.last(), name, expr });
      } else if (this.eat(K.PRIMARY)) {
        this.expect(K.KEY, "KEY");
        out.push({ kind: "primary-key", start: s, end: this.last(), name, columns: [] });
      } else if (this.eat(K.UNIQUE)) {
        out.push({ kind: "unique", start: s, end: this.last(), name, columns: [] });
      } else if (this.eat(K.CHECK)) {
        this.expectKind(Tok.LParen, "(");
        const expr = this.expr(0);
        this.expectKind(Tok.RParen, ")");
        out.push({ kind: "check", start: s, end: this.last(), name, expr });
      } else if (this.at(K.REFERENCES)) {
        const reference = this.reference();
        out.push({ kind: "foreign-key", start: s, end: this.last(), name, columns: [], reference });
      } else {
        if (named) this.fail("a constraint");
        return out;
      }
    }
  }

  private columnDef(): ColumnDef {
    const s = this.start();
    const name = this.ident();
    const type = this.dataType();
    const constraints = this.columnConstraints();
    return { kind: "column-def", start: s, end: this.last(), name, type, constraints };
  }

  private create(): Statement {
    const K = this.K;
    const s = this.start();
    const first = this.i;
    this.i++;
    const orReplace = this.at(K.OR) && this.at(K.REPLACE, 1);
    if (orReplace) this.i += 2;
    const unique = this.eat(K.UNIQUE);
    let temporary = false;
    while (this.kind() === Tok.Word && TABLE_MODIFIERS.has(this.slice().toUpperCase())) {
      if (this.slice().toUpperCase().startsWith("TEMP")) temporary = true;
      this.i++;
    }
    if (this.eat(K.TABLE)) {
      const ifNotExists = this.ifNotExists();
      const name = this.qualifiedName();
      const elements =
        this.kind() === Tok.LParen && !this.atQuery(1)
          ? (this.i++, this.commaList(() => (this.atTableConstraint() ? this.tableConstraint() : this.columnDef())))
          : [];
      if (elements.length > 0 || this.tokens(-1) === Tok.LParen) this.expectKind(Tok.RParen, ")");
      const from = this.i;
      let depth = 0;
      while (!this.atEnd() && this.kind() !== Tok.Semicolon && !(depth === 0 && this.at(K.AS))) {
        if (this.kind() === Tok.LParen) depth++;
        else if (this.kind() === Tok.RParen) depth--;
        this.i++;
      }
      const options = this.i > from ? this.text.slice(this.starts[from] ?? 0, this.ends[this.i - 1] ?? 0) : undefined;
      let query: Query | undefined;
      if (this.eat(K.AS)) query = this.query();
      return { kind: "create-table", start: s, end: this.last(), name, ifNotExists, temporary, elements, query, options };
    }
    if (this.eat(K.INDEX)) {
      const ifNotExists = this.ifNotExists();
      const name = this.at(K.ON) ? undefined : this.qualifiedName();
      this.expect(K.ON, "ON");
      const table = this.qualifiedName();
      this.expectKind(Tok.LParen, "(");
      const items = this.commaList(() => this.orderItem());
      this.expectKind(Tok.RParen, ")");
      const where = this.eat(K.WHERE) ? this.expr(0) : undefined;
      return { kind: "create-index", start: s, end: this.last(), unique, ifNotExists, name, table, items, where };
    }
    if (this.eat(K.VIEW)) {
      const name = this.qualifiedName();
      const columns = this.kind() === Tok.LParen ? this.identList() : [];
      this.expect(K.AS, "AS");
      const query = this.query();
      return { kind: "create-view", start: s, end: this.last(), orReplace, name, columns, query };
    }
    this.i = first;
    return this.command();
  }

  private ifNotExists(): boolean {
    const K = this.K;
    if (this.at(K.IF) && this.at(K.NOT, 1) && this.at(K.EXISTS, 2)) {
      this.i += 3;
      return true;
    }
    return false;
  }

  private ifExists(): boolean {
    const K = this.K;
    if (this.at(K.IF) && this.at(K.EXISTS, 1)) {
      this.i += 2;
      return true;
    }
    return false;
  }

  private alterAction(): AlterAction {
    const K = this.K;
    const s = this.start();
    if (this.eat(K.ADD)) {
      if (this.atTableConstraint()) {
        const constraint = this.tableConstraint();
        return { kind: "add-constraint", start: s, end: this.last(), constraint };
      }
      this.eat(K.COLUMN);
      const ifNotExists = this.ifNotExists();
      const column = this.columnDef();
      return { kind: "add-column", start: s, end: this.last(), ifNotExists, column };
    }
    if (this.eat(K.DROP)) {
      if (this.eat(K.CONSTRAINT)) {
        const ifExists = this.ifExists();
        const name = this.ident();
        return { kind: "drop-constraint", start: s, end: this.last(), ifExists, name };
      }
      this.eat(K.COLUMN);
      const ifExists = this.ifExists();
      const name = this.ident();
      return { kind: "drop-column", start: s, end: this.last(), ifExists, name };
    }
    if (this.eat(K.RENAME)) {
      if (this.eat(K.TO)) {
        const to = this.ident();
        return { kind: "rename-table", start: s, end: this.last(), to };
      }
      this.eat(K.COLUMN);
      const from = this.ident();
      this.expect(K.TO, "TO");
      const to = this.ident();
      return { kind: "rename-column", start: s, end: this.last(), from, to };
    }
    return this.fail("ADD, DROP or RENAME");
  }

  private alter(): Statement {
    const K = this.K;
    const s = this.start();
    this.i++;
    const first = this.i - 1;
    if (!this.eat(K.TABLE)) {
      this.i = first;
      return this.command();
    }
    try {
      const ifExists = this.ifExists();
      const table = this.qualifiedName();
      const actions = this.commaList(() => this.alterAction());
      return { kind: "alter-table", start: s, end: this.last(), ifExists, table, actions };
    } catch (e) {
      if (!(e instanceof Failure)) throw e;
      this.i = first;
      return this.command();
    }
  }

  private drop(): Statement {
    const K = this.K;
    const s = this.start();
    this.i++;
    const first = this.i - 1;
    const object = this.eat(K.TABLE) ? "table" : this.eat(K.VIEW) ? "view" : this.eat(K.INDEX) ? "index" : undefined;
    if (object === undefined) {
      this.i = first;
      return this.command();
    }
    const ifExists = this.ifExists();
    const names = this.commaList(() => this.qualifiedName());
    const behavior = this.eat(K.CASCADE) ? "cascade" : this.eat(K.RESTRICT) ? "restrict" : undefined;
    return { kind: "drop", start: s, end: this.last(), object, ifExists, names, behavior };
  }

  /** A statement that holds no node: its keyword, its object for `CREATE`, `ALTER` and `DROP`, and its text. */
  private command(): Statement {
    const s = this.start();
    const keyword = this.slice().toUpperCase();
    this.i++;
    let object: string | undefined;
    if (keyword === "CREATE" || keyword === "ALTER" || keyword === "DROP") {
      let at = 0;
      while (this.kind(at) === Tok.Word && OBJECT_MODIFIERS.has(this.slice(at).toUpperCase())) at++;
      if (this.kind(at) === Tok.Word) object = this.slice(at).toUpperCase();
    }
    const from = this.i;
    while (!this.atEnd() && this.kind() !== Tok.Semicolon) this.i++;
    const text = this.i > from ? this.text.slice(this.starts[from] ?? 0, this.ends[this.i - 1] ?? 0) : "";
    return { kind: "command", start: s, end: this.last(), keyword, object, text };
  }

  private statement(): Statement {
    const K = this.K;
    if (this.kind() === Tok.Word && COMMAND_WORDS.has(this.slice().toUpperCase())) return this.command();
    if (this.kind() === Tok.LParen || this.at(K.SELECT) || this.at(K.WITH) || this.at(K.VALUES)) return this.query();
    if (this.at(K.INSERT)) return this.insert();
    if (this.at(K.UPDATE)) return this.update();
    if (this.at(K.DELETE)) return this.delete();
    if (this.at(K.CREATE)) return this.create();
    if (this.at(K.ALTER)) return this.alter();
    if (this.at(K.DROP)) return this.drop();
    return this.fail("a statement");
  }

  script(): Script {
    const statements: Statement[] = [];
    while (!this.atEnd()) {
      if (this.eatKind(Tok.Semicolon)) continue;
      const first = this.i;
      try {
        this.depth = 0;
        const statement = this.statement();
        if (!this.atEnd() && this.kind() !== Tok.Semicolon) this.fail("; or the end of the text");
        statements.push(statement);
      } catch (e) {
        if (!(e instanceof Failure)) throw e;
        this.errors.push(e.error);
        while (!this.atEnd() && this.kind() !== Tok.Semicolon) this.i++;
        if (this.i === first) this.i++;
        statements.push({ kind: "unparsed", start: this.starts[first] ?? 0, end: this.ends[Math.max(first, this.i - 1)] ?? 0 });
      }
    }
    return { kind: "script", start: 0, end: this.text.length, statements };
  }
}

/**
 * Parses a text.
 *
 * @param text - SQL
 * @param dialect - how it is written, the base dialect by default
 * @param options - whether to attach the comments
 * @returns the script, the errors, the comments and their attachment; it does not throw
 */
export function parse(text: string, dialect: Dialect = ansi, options: ParseOptions = {}): Parsed {
  const lexed = lex(text, dialect.compiled);
  const p = new Parser(text, lexed.tokens, dialect);
  const script = p.script();
  const errors: ParseError[] = [...lexed.errors.map((error): ParseError => ({ kind: "lex", error })), ...p.errors];
  errors.sort((a, b) => (a.kind === "lex" ? a.error.span.start : a.span.start) - (b.kind === "lex" ? b.error.span.start : b.span.start));
  const comments = allComments(lexed.comments, text);
  const attachments = options.attach === false ? NO_COMMENTS : attachComments(script, comments);
  return { text, script, errors, comments, attachments };
}

/**
 * Parses a text that must be read whole.
 *
 * @param text - SQL
 * @param dialect - how it is written, the base dialect by default
 * @returns the parse, or its errors where there is any
 */
export function parseStrict(text: string, dialect: Dialect = ansi): Result<Parsed, readonly ParseError[]> {
  const parsed = parse(text, dialect);
  return parsed.errors.length === 0 ? ok(parsed) : err(parsed.errors);
}
