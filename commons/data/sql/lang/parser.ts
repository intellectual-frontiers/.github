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
  ColumnOption,
  Cte,
  CteBody,
  DataType,
  Delete,
  Expr,
  Frame,
  FrameBound,
  Ident,
  Insert,
  IsTest,
  KeywordArg,
  JoinType,
  Name,
  NamedArg,
  OnConflict,
  OrderItem,
  Query,
  RefAction,
  RoutineBody,
  RoutineParam,
  Reference,
  Script,
  Select,
  SelectItem,
  SetOp,
  SetOperator,
  Source,
  StarModifier,
  Statement,
  StringLit,
  StructEntry,
  TypeField,
  TableConstraint,
  TableLike,
  TableRef,
  Tuple,
  Update,
  WindowDef,
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

/** What a read of a range of a text gives: the node, the errors, and the comments of the range, all with offsets of the whole text. */
export interface Fragment<T> {
  readonly node: T | undefined;
  readonly errors: readonly ParseError[];
  readonly comments: readonly Comment[];
}

function readRange<T>(
  text: string,
  dialect: Dialect,
  from: number,
  to: number,
  skip: readonly (readonly [number, number])[],
  read: (p: Parser) => T,
): Fragment<T> {
  const lexed = lex(text, dialect.compiled, from, to);
  let tokens = lexed.tokens;
  if (skip.length > 0) {
    const keep = tokens.start.map((st, i) => (i === tokens.start.length - 1 ? true : !skip.some(([a, b]) => st >= a && st < b)));
    const pick = <U>(xs: readonly U[]): U[] => xs.filter((_, i) => keep[i] === true);
    tokens = { kind: pick(tokens.kind), start: pick(tokens.start), end: pick(tokens.end), id: pick(tokens.id) };
  }
  const errors: ParseError[] = lexed.errors.map((error): ParseError => ({ kind: "lex", error }));
  let node: T | undefined;
  try {
    node = read(new Parser(text, tokens, dialect));
  } catch (e) {
    if (!(e instanceof Failure)) throw e;
    errors.push(e.error);
  }
  return { node, errors, comments: allComments(lexed.comments, text) };
}

/**
 * Reads a range of a text as one expression, with offsets of the whole text (commons data 0070-sql-routines FR-006).
 *
 * @param text - the whole text
 * @param dialect - how it is written
 * @param from - where the range begins
 * @param to - where it ends
 * @returns the expression, the errors and the comments; it does not throw
 */
export function parseExpressionRange(text: string, dialect: Dialect, from: number, to: number): Fragment<Expr> {
  return readRange(text, dialect, from, to, [], (p) => p.fragmentExpression());
}

/** What {@link parseStatementRange} may be given. */
export interface StatementRangeOptions {
  /** Whether the range is a `PERFORM`: a select that begins at its select list, with no `SELECT`. */
  readonly perform?: boolean;
  /** Ranges of the text whose tokens are left out, which is how the `INTO` of a statement is taken out of it. */
  readonly skip?: readonly (readonly [number, number])[];
}

/**
 * Reads a range of a text as one statement, with offsets of the whole text (commons data 0070-sql-routines FR-006).
 *
 * @param text - the whole text
 * @param dialect - how it is written
 * @param from - where the range begins
 * @param to - where it ends
 * @param options - whether it is a `PERFORM`, and what to leave out
 * @returns the statement, the errors and the comments; it does not throw
 */
export function parseStatementRange(
  text: string,
  dialect: Dialect,
  from: number,
  to: number,
  options: StatementRangeOptions = {},
): Fragment<Statement> {
  return readRange(text, dialect, from, to, options.skip ?? [], (p) => p.fragmentStatement(options.perform === true));
}

/** Reads a range of a text as one data type, with offsets of the whole text. */
export function parseTypeRange(text: string, dialect: Dialect, from: number, to: number): Fragment<DataType> {
  return readRange(text, dialect, from, to, [], (p) => p.fragmentType());
}

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
    ZONE: k("ZONE"),
    WITHOUT: k("WITHOUT"),
    YEAR: k("YEAR"),
    MONTH: k("MONTH"),
    DAY: k("DAY"),
    HOUR: k("HOUR"),
    MINUTE: k("MINUTE"),
    SECOND: k("SECOND"),
    FOR: k("FOR"),
    WINDOW: k("WINDOW"),
    WITHIN: k("WITHIN"),
    GROUPING: k("GROUPING"),
    SETS: k("SETS"),
    QUALIFY: k("QUALIFY"),
    FORMAT: k("FORMAT"),
    OTHERS: k("OTHERS"),
    EXCLUDE: k("EXCLUDE"),
    TIES: k("TIES"),
    BOTH: k("BOTH"),
    LEADING: k("LEADING"),
    TRAILING: k("TRAILING"),
    SIMILAR: k("SIMILAR"),
    ANY: k("ANY"),
    SOME: k("SOME"),
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

/** The type names that may stand before a string to make a typed literal (`DATE '2020-01-01'`). */
const TYPED_STRING_WORDS: ReadonlySet<string> = new Set(
  (
    "DATE TIME TIMETZ TIMESTAMP TIMESTAMPTZ INT INT2 INT4 INT8 INTEGER SMALLINT BIGINT FLOAT FLOAT4 FLOAT8 REAL NUMERIC DECIMAL BOOL BOOLEAN TEXT VARCHAR CHAR BYTEA JSON JSONB UUID BIT NAME OID " +
    "TIMESTAMP_LTZ TIMESTAMP_NTZ DATETIME REGCLASS REGTYPE POINT BOX LSEG PATH POLYGON CIRCLE CIDR INET MACADDR MONEY XML TSVECTOR TSQUERY"
  ).split(" "),
);

/** The characters an operator of PostgreSQL is made of. */
const OP_RUN_CHARS: ReadonlySet<number> = new Set([...("+-*/<>=~!@#%^&|?")].map((c) => c.charCodeAt(0)));
const SPECIAL_OP_CHARS: ReadonlySet<number> = new Set([...("~!@#%^&|?")].map((c) => c.charCodeAt(0)));

/** The units of an interval beyond the standard's. */
const INTERVAL_UNITS: ReadonlySet<string> = new Set("WEEK QUARTER MILLISECOND MICROSECOND NANOSECOND".split(" "));

/** The words that begin a column option the grammar keeps as text. */
const COLUMN_OPTION_WORDS: ReadonlySet<string> = new Set("COMMENT GENERATED AUTOINCREMENT AUTO_INCREMENT DEFERRABLE INITIALLY ASC DESC NO NULLS".split(" "));

/** The words that begin a column constraint, where an option ends. */
const CONSTRAINT_STARTS: ReadonlySet<string> = new Set("CONSTRAINT NOT NULL DEFAULT PRIMARY UNIQUE CHECK REFERENCES COLLATE".split(" "));

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
  "SET SHOW EXPLAIN DESCRIBE DESC ANALYZE ANALYSE GRANT REVOKE USE PRAGMA BEGIN START COMMIT ROLLBACK SAVEPOINT RELEASE TRUNCATE COPY VACUUM CALL EXEC EXECUTE DECLARE IF WHILE LOAD ATTACH DETACH INSTALL EXPORT IMPORT COMMENT LOCK UNLOCK REFRESH REINDEX CLUSTER CHECKPOINT RESET DISCARD DO LISTEN NOTIFY PREPARE DEALLOCATE FETCH OPTIMIZE MERGE UNSET UNDROP RENAME SYSTEM END ABORT CLOSE MOVE OPEN".split(
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
/** The words after `BEGIN` that make it a transaction and not a block. */
const TXN_WORDS: ReadonlySet<string> = new Set("TRANSACTION WORK DEFERRED IMMEDIATE EXCLUSIVE ISOLATION READ NOT TRAN".split(" "));
/** The words after `DECLARE` (or its first name) that make it a cursor and not the declarations of a block. */
const CURSOR_WORDS: ReadonlySet<string> = new Set("CURSOR BINARY INSENSITIVE ASENSITIVE SCROLL NO".split(" "));
/** The words after `END` that close a kind of block and open nothing. */
const END_QUALIFIERS: ReadonlySet<string> = new Set("IF LOOP CASE WHILE REPEAT FOR TRY CATCH".split(" "));
/** What may stand before an `IF` that begins a statement. */
const BLOCK_PREV: ReadonlySet<string> = new Set([";", "THEN", "ELSE", "ELSIF", "ELSEIF", "BEGIN", "LOOP", ">>", "DO", "REPEAT", "ATOMIC"]);
/** The objects whose `CREATE` has a body of statements. */
const PROCEDURAL_OBJECTS: ReadonlySet<string> = new Set("FUNCTION PROCEDURE TRIGGER PACKAGE EVENT".split(" "));
/** The objects that a `CREATE` that is not procedural makes, which end the search for a procedural one. */
const PLAIN_OBJECTS: ReadonlySet<string> = new Set(
  "TABLE VIEW INDEX SEQUENCE TYPE DATABASE SCHEMA ROLE USER EXTENSION DOMAIN COLLATION STAGE WAREHOUSE".split(" "),
);
/** The words that, after the first word of a parameter, show that the first word is a type and the parameter has no name. */
const ROUTINE_CONTINUATION: ReadonlySet<string> = new Set(["PRECISION", "VARYING", "WITH", "WITHOUT", "ZONE"]);
/** The words that begin a statement and not the declaration of a variable: before a `BEGIN`, they show that a `DECLARE` is a statement of its own. */
const NOT_DECLARATIONS: ReadonlySet<string> = new Set(
  "DECLARE SELECT INSERT UPDATE DELETE CREATE DROP ALTER SET WITH CALL EXEC EXECUTE USE SHOW EXPLAIN GRANT TRUNCATE COPY VALUES MERGE".split(
    " ",
  ),
);
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
  private readonly runs: boolean;
  private readonly selectTop: boolean;
  private readonly parametric: boolean;
  private halfGt = false;
  private readonly queryTail: ReadonlySet<string>;
  private readonly fromFirst: boolean;
  private readonly tableIndexes: boolean;
  private readonly colonPaths: boolean;
  private readonly lambdas: boolean;
  private readonly emptySelect: boolean;
  private readonly opMinus: number;
  private readonly opPlus: number;
  private readonly opStar: number;
  private readonly named: ReadonlySet<number>;
  private readonly wordOps: ReadonlyMap<number, Infix>;
  private i = 0;
  private depth = 0;
  /** Set for `PERFORM`: the query begins at the select list, with no `SELECT`. */
  private skipSelect = false;
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
    this.runs = d.grammar.operatorRuns;
    this.selectTop = d.grammar.selectTop;
    this.parametric = d.grammar.parametric;
    this.queryTail = new Set(d.grammar.queryTail);
    this.fromFirst = d.grammar.fromFirst;
    this.tableIndexes = d.grammar.tableIndexes;
    this.colonPaths = d.grammar.colonPaths;
    this.lambdas = d.grammar.lambdas;
    this.emptySelect = d.grammar.emptySelect;
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

  expr(min: number = 0, noCast = false): Expr {
    this.deeper();
    const s = this.start();
    let left = this.prefix();
    for (;;) {
      const k = this.kind();
      if (k === Tok.Op) {
        if (this.colonPaths && this.atColon() && (this.kind(1) === Tok.Word || this.kind(1) === Tok.QuotedIdent || this.kind(1) === Tok.LBracket)) {
          if (Prec.Cast < min) break;
          this.i++;
          const right = this.expr(Prec.Cast, true);
          left = { kind: "operator", start: s, end: this.last(), op: ":", left, right };
          continue;
        }
        const oid = this.id();
        if (oid === this.castOp) {
          if (Prec.Cast < min || noCast) break;
          this.i++;
          const type = this.dataType(true);
          left = { kind: "cast", start: s, end: this.last(), arg: left, type, try: false, format: undefined };
          continue;
        }
        const info = this.infix[oid];
        if (this.runs) {
          const run = this.opRun();
          if (run !== undefined && (run > 1 || info === undefined)) {
            if (Prec.Other < min) break;
            const op = this.text.slice(this.starts[this.i] ?? 0, this.ends[this.i + run - 1] ?? 0);
            this.i += run;
            const right = this.expr(Prec.Other + 1);
            left = { kind: "operator", start: s, end: this.last(), op, left, right };
            continue;
          }
        }
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
        const index = this.atColon() ? undefined : this.expr(0);
        let upper: Expr | undefined;
        const slice = this.atColon();
        if (slice) {
          this.i++;
          if (this.kind() !== Tok.RBracket) upper = this.expr(0);
        }
        this.expectKind(Tok.RBracket, "]");
        left = { kind: "subscript", start: s, end: this.last(), arg: left, index, upper, slice };
        continue;
      }
      if (k === Tok.Dot) {
        if (Prec.Cast < min) break;
        const nk = this.kind(1);
        if (nk === Tok.Op && this.id(1) === this.opStar) {
          this.i += 2;
          left = { kind: "field", start: s, end: this.last(), arg: left, field: undefined };
          continue;
        }
        if (nk !== Tok.Word && nk !== Tok.QuotedIdent) break;
        this.i++;
        const field = this.ident(true);
        left = { kind: "field", start: s, end: this.last(), arg: left, field };
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
        } else if (this.startsExpression() && !this.at(K.AND) && !this.at(K.OR)) {
          test = "distinct-from";
          other = this.expr(Prec.Compare + 1);
          left = { kind: "is", start: s, end: this.last(), arg: left, test, negated: !negated, other };
          continue;
        } else this.fail("NULL, TRUE, FALSE, UNKNOWN or DISTINCT FROM");
        left = { kind: "is", start: s, end: this.last(), arg: left, test, negated, other };
      } else if (w === 0 && this.at(K.TIME, 1) && this.at(K.ZONE, 2) && this.slice().toUpperCase() === "AT") {
        if (Prec.Exponent < min) break;
        this.i += 3;
        const right = this.expr(Prec.Exponent + 1);
        left = { kind: "operator", start: s, end: this.last(), op: "AT TIME ZONE", left, right };
      } else if (w === K.NOT && this.at(K.NULL, 1)) {
        if (Prec.Is < min) break;
        this.i += 2;
        left = { kind: "is", start: s, end: this.last(), arg: left, test: "null", negated: true, other: undefined };
      } else if (w === K.NOT || w === K.BETWEEN || w === K.IN || w === K.LIKE || this.likeWords.has(w) || (w === K.SIMILAR && this.at(K.TO, 1))) {
        const neg = w === K.NOT;
        const at = neg ? 1 : 0;
        const nw = this.id(at);
        const similar = nw === K.SIMILAR && this.at(K.TO, at + 1);
        if (this.kind(at) !== Tok.Word || (nw !== K.BETWEEN && nw !== K.IN && nw !== K.LIKE && !this.likeWords.has(nw) && !similar)) break;
        if (Prec.Like < min) break;
        this.i += at + (similar ? 2 : 1);
        if (nw === K.BETWEEN) {
          const symmetric = this.wordIs("SYMMETRIC");
          if (symmetric || this.wordIs("ASYMMETRIC")) this.i++;
          const low = this.expr(Prec.Like + 1);
          this.expect(K.AND, "AND");
          const high = this.expr(Prec.Like + 1);
          left = { kind: "between", start: s, end: this.last(), arg: left, negated: neg, symmetric, low, high };
        } else if (nw === K.IN) {
          if (this.kind() !== Tok.LParen) {
            const table = this.qualifiedName();
            left = { kind: "in", start: s, end: this.last(), arg: left, negated: neg, values: [table], bare: true };
          } else {
            this.i++;
            if (this.atQuery()) {
              const query = this.query();
              this.expectKind(Tok.RParen, ")");
              left = { kind: "in-query", start: s, end: this.last(), arg: left, negated: neg, query };
            } else {
              const values = this.kind() === Tok.RParen ? [] : this.commaList(() => this.expr(0));
              this.expectKind(Tok.RParen, ")");
              left = { kind: "in", start: s, end: this.last(), arg: left, negated: neg, values, bare: false };
            }
          }
        } else {
          const op = similar ? "SIMILAR TO" : this.text.slice(this.starts[this.i - 1] ?? 0, this.ends[this.i - 1] ?? 0).toUpperCase();
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
        let { value, prefix } = stringValue(this.slice(), this.lx, this.id());
        this.i++;
        while (this.kind() === Tok.String && this.text.slice(this.ends[this.i - 1] ?? 0, this.starts[this.i] ?? 0).includes("\n")) {
          value += stringValue(this.slice(), this.lx, this.id()).value;
          this.i++;
        }
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
        const run = this.runs ? this.opRun() : undefined;
        if (run !== undefined) {
          const op = this.text.slice(this.starts[this.i] ?? 0, this.ends[this.i + run - 1] ?? 0);
          this.i += run;
          const right = this.expr(Prec.Unary);
          return { kind: "operator", start: s, end: this.last(), op, left: undefined, right };
        }
        return this.fail("an expression");
      }
      case Tok.Word:
      case Tok.QuotedIdent:
        return this.wordPrefix(s);
      case Tok.LBrace:
        return this.structLit(s, undefined);
      case Tok.Eof:
      case Tok.RParen:
      case Tok.RBracket:
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
      if (this.kind(1) === Tok.LBrace && this.slice().toUpperCase() === "MAP") {
        const prefix = this.slice();
        this.i++;
        return this.structLit(s, prefix);
      }
      if (this.kind(1) === Tok.LBracket && this.slice().toUpperCase() === "ARRAY") {
        this.i += 2;
        const items = this.kind() === Tok.RBracket ? [] : this.commaList(() => this.expr(0));
        this.expectKind(Tok.RBracket, "]");
        return { kind: "array", start: s, end: this.last(), items };
      }
      if (paren && (w === K.CAST || this.isTryCast(w))) {
        this.i += 2;
        const arg = this.expr(0);
        let type: DataType;
        if (this.kind() === Tok.Comma && this.kind(1) === Tok.String) {
          this.i++;
          const ts = this.start();
          const lit = stringValue(this.slice(), this.lx, this.id());
          this.i++;
          type = { kind: "data-type", start: ts, end: this.last(), name: lit.value, args: [], fields: [], charset: undefined, collation: undefined };
        } else {
          this.expect(K.AS, "AS");
          type = this.dataType(true);
        }
        const format = this.eat(K.FORMAT) ? this.expr(0) : undefined;
        this.expectKind(Tok.RParen, ")");
        return { kind: "cast", start: s, end: this.last(), arg, type, try: w !== K.CAST, format };
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
      if (w === K.INTERVAL && (this.kind(1) === Tok.String || this.kind(1) === Tok.Number || this.kind(1) === Tok.Param || this.parenThenUnit())) {
        this.i++;
        const value = this.prefix();
        let unit: string | undefined;
        if (this.kind() === Tok.Word && this.isIntervalUnit(this.id())) {
          unit = this.slice().toUpperCase();
          this.i++;
          if (this.kind() === Tok.LParen && this.kind(1) === Tok.Number && this.kind(2) === Tok.RParen) {
            unit += `(${this.slice(1)})`;
            this.i += 3;
          }
          if (this.at(K.TO) && this.kind(1) === Tok.Word && this.isIntervalUnit(this.id(1))) {
            unit += ` TO ${this.slice(1).toUpperCase()}`;
            this.i += 2;
            if (this.kind() === Tok.LParen && this.kind(1) === Tok.Number && this.kind(2) === Tok.RParen) {
              unit += `(${this.slice(1)})`;
              this.i += 3;
            }
          }
        }
        return { kind: "interval", start: s, end: this.last(), value, unit };
      }
      if (w === K.DEFAULT && !paren) {
        this.i++;
        const ident: Ident = { kind: "ident", start: s, end: this.last(), name: "DEFAULT", quoted: false };
        return { kind: "name", start: s, end: this.last(), parts: [ident] };
      }
      if (this.isReserved() && !paren) return this.fail("an expression");
      const zone = (this.at(K.WITH, 1) || this.at(K.WITHOUT, 1)) && this.at(K.TIME, 2) && this.at(K.ZONE, 3) && this.kind(4) === Tok.String;
      if ((this.kind(1) === Tok.String || zone) && !paren && TYPED_STRING_WORDS.has(this.slice().toUpperCase())) {
        let type = this.slice().toUpperCase();
        this.i++;
        if (zone) {
          type += ` ${this.slice().toUpperCase()} TIME ZONE`;
          this.i += 3;
        }
        const vs = this.start();
        const { value, prefix } = stringValue(this.slice(), this.lx, this.id());
        this.i++;
        const lit: StringLit = { kind: "string", start: vs, end: this.last(), value, prefix };
        return { kind: "typed-string", start: s, end: this.last(), type, value: lit };
      }
    }
    const first = this.ident(true);
    const parts: Ident[] = [first];
    while (this.kind() === Tok.Dot) {
      if (this.kind(1) === Tok.Op && this.id(1) === this.opStar) {
        this.i += 2;
        const qualifier: Name = { kind: "name", start: s, end: this.ends[this.i - 2] ?? s, parts };
        const modifiers = this.starModifiers();
        return { kind: "star", start: s, end: this.last(), qualifier, modifiers };
      }
      if (this.kind(1) !== Tok.Word && this.kind(1) !== Tok.QuotedIdent) break;
      this.i++;
      parts.push(this.ident(true));
    }
    const name: Name = { kind: "name", start: s, end: this.last(), parts };
    if (this.kind() === Tok.LParen) return this.call(name);
    return name;
  }

  /** Whether `INTERVAL (expr) UNIT` is at the cursor: a parenthesis after the word, and a unit after its closing one. */
  private parenThenUnit(): boolean {
    if (this.kind(1) !== Tok.LParen) return false;
    let depth = 0;
    let at = 1;
    do {
      if (this.kind(at) === Tok.LParen) depth++;
      else if (this.kind(at) === Tok.RParen) depth--;
      else if (this.kind(at) === Tok.Eof) return false;
      at++;
    } while (depth > 0);
    if (this.kind(at) !== Tok.Word) return false;
    const w = this.id(at);
    return this.slice(at).length > 0 && (w === this.K.YEAR || w === this.K.MONTH || w === this.K.DAY || w === this.K.HOUR || w === this.K.MINUTE || w === this.K.SECOND || INTERVAL_UNITS.has(this.slice(at).toUpperCase()));
  }

  /** Whether the word at the cursor is `TRY_CAST` or `SAFE_CAST`, which are not keywords. */
  /** A struct or map literal from the brace at the cursor. */
  private structLit(s: number, prefix: string | undefined): Expr {
    this.i++;
    const entries: StructEntry[] = [];
    if (this.kind() !== Tok.RBrace) {
      do {
        const es = this.start();
        const key = this.expr(0);
        if (!this.atColon()) this.fail(":");
        this.i++;
        const value = this.expr(0);
        entries.push({ kind: "struct-entry", start: es, end: this.last(), key, value });
      } while (this.eatKind(Tok.Comma));
    }
    this.expectKind(Tok.RBrace, "}");
    return { kind: "struct", start: s, end: this.last(), prefix, entries };
  }

  private isTryCast(w: number): boolean {
    if (w !== 0) return false;
    const n = (this.ends[this.i] ?? 0) - (this.starts[this.i] ?? 0);
    if (n !== 8 && n !== 9) return false;
    const t = this.slice().toUpperCase();
    return t === "TRY_CAST" || t === "SAFE_CAST";
  }

  private isIntervalUnit(w: number): boolean {
    const K = this.K;
    return w === K.YEAR || w === K.MONTH || w === K.DAY || w === K.HOUR || w === K.MINUTE || w === K.SECOND || (w === 0 && INTERVAL_UNITS.has(this.slice().toUpperCase()));
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
    const position = name.parts.length === 1 && name.parts[0]?.name.toUpperCase() === "POSITION" && !name.parts[0].quoted;
    if (this.kind() === Tok.Op && this.id() === this.opStar && this.kind(1) === Tok.RParen) {
      const ss = this.start();
      this.i++;
      args.push({ kind: "star", start: ss, end: this.last(), qualifier: undefined, modifiers: [] });
    } else if (this.kind() !== Tok.RParen) {
      if (this.eat(K.DISTINCT)) distinct = true;
      else this.eat(K.ALL);
      for (;;) {
        args.push(position && args.length === 0 ? this.expr(Prec.Like + 1) : this.argument());
        for (let kw = this.keywordArg(); kw !== undefined; kw = this.keywordArg()) args.push(kw);
        if (!this.eatKind(Tok.Comma)) break;
      }
    }
    let orderBy = this.orderByClause();
    this.expectKind(Tok.RParen, ")");
    let parameters: Argument[] = [];
    if (this.parametric && this.kind() === Tok.LParen) {
      parameters = args.splice(0, args.length);
      this.i++;
      if (this.kind() !== Tok.RParen) {
        if (this.eat(K.DISTINCT)) distinct = true;
        args.push(...this.commaList(() => this.argument()));
      }
      orderBy = this.orderByClause();
      this.expectKind(Tok.RParen, ")");
    }
    let nullTreatment: "ignore" | "respect" | undefined;
    if (this.kind() === Tok.Word && this.at(K.NULLS, 1)) {
      const t = this.slice().toUpperCase();
      if (t === "IGNORE" || t === "RESPECT") {
        nullTreatment = t === "IGNORE" ? "ignore" : "respect";
        this.i += 2;
      }
    }
    let withinGroup: OrderItem[] = [];
    if (this.at(K.WITHIN) && this.at(K.GROUP, 1) && this.kind(2) === Tok.LParen) {
      this.i += 3;
      withinGroup = this.orderByClause();
      this.expectKind(Tok.RParen, ")");
    }
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
    return { kind: "call", start: name.start, end: this.last(), name, parameters, args, distinct, orderBy, withinGroup, nullTreatment, filter, over };
  }

  /** A keyword of a call's arguments that follows an argument (`FROM`, `FOR`, `IN`, `PLACING`, `SIMILAR`), with the expression after it. */
  private keywordArg(): KeywordArg | undefined {
    const K = this.K;
    if (this.kind() !== Tok.Word) return undefined;
    const w = this.id();
    if (this.at(K.NULLS, 1) && (this.wordIs("IGNORE") || this.wordIs("RESPECT"))) {
      const s = this.start();
      const keyword = `${this.slice().toUpperCase()} NULLS`;
      this.i += 2;
      return { kind: "keyword-arg", start: s, end: this.last(), keyword, value: undefined };
    }
    if (w !== K.FROM && w !== K.FOR && w !== K.IN && w !== K.SIMILAR && w !== K.ESCAPE && w !== K.USING && w !== K.AS && !(w === 0 && (this.wordIs("PLACING") || this.wordIs("SEPARATOR")))) return undefined;
    const s = this.start();
    const keyword = this.slice().toUpperCase();
    this.i++;
    if (w === K.AS) {
      const ns = this.start();
      const id = this.ident(true);
      const name: Name = { kind: "name", start: ns, end: this.last(), parts: [id] };
      return { kind: "keyword-arg", start: s, end: this.last(), keyword, value: name };
    }
    const value = this.expr(Prec.Like + 1);
    return { kind: "keyword-arg", start: s, end: this.last(), keyword, value };
  }

  /** The number of tokens of the arrow at `at` (`->`, or `-` and `>` that touch), or 0. */
  private arrowAt(at: number): number {
    if (this.kind(at) !== Tok.Op) return 0;
    const from = this.starts[this.i + at] ?? 0;
    const to = this.ends[this.i + at] ?? 0;
    if (to - from === 2 && this.text.startsWith("->", from)) return 1;
    if (to - from === 1 && this.text.charCodeAt(from) === 45 && this.kind(at + 1) === Tok.Op && (this.starts[this.i + at + 1] ?? -1) === to && this.text.charCodeAt(to) === 62 && (this.ends[this.i + at + 1] ?? 0) - to === 1) return 2;
    return 0;
  }

  /** A lambda at the cursor: `x -> body`, `(x, y) -> body`, `lambda x, y: body`; or `undefined`. */
  private lambda(): Expr | undefined {
    const K = this.K;
    const s = this.start();
    const params: Ident[] = [];
    if ((this.kind() === Tok.Word || this.kind() === Tok.QuotedIdent) && this.arrowAt(1) > 0 && this.canBeIdent()) {
      params.push(this.ident());
      this.i += this.arrowAt(0);
    } else if (this.kind() === Tok.LParen) {
      let at = 1;
      for (;;) {
        if (this.kind(at) !== Tok.Word && this.kind(at) !== Tok.QuotedIdent) return undefined;
        at++;
        if (this.kind(at) === Tok.Comma) at++;
        else break;
      }
      if (this.kind(at) !== Tok.RParen || this.arrowAt(at + 1) === 0) return undefined;
      this.i++;
      do params.push(this.ident(true));
      while (this.eatKind(Tok.Comma));
      this.expectKind(Tok.RParen, ")");
      this.i += this.arrowAt(0);
    } else if (this.wordIs("LAMBDA") && (this.kind(1) === Tok.Word || this.kind(1) === Tok.QuotedIdent)) {
      let at = 1;
      while ((this.kind(at) === Tok.Word || this.kind(at) === Tok.QuotedIdent) && this.kind(at + 1) === Tok.Comma) at += 2;
      if (!((this.kind(at) === Tok.Word || this.kind(at) === Tok.QuotedIdent) && this.kind(at + 1) === Tok.Op)) return undefined;
      this.i++;
      do params.push(this.ident(true));
      while (this.eatKind(Tok.Comma));
      if (!this.atColon()) this.fail(":");
      this.i++;
    } else return undefined;
    void K;
    const body = this.expr(0);
    return { kind: "lambda", start: s, end: this.last(), params, body };
  }

  private argument(): Argument {
    const K = this.K;
    if (this.lambdas) {
      const l = this.lambda();
      if (l !== undefined) return l;
    }
    if (this.kind() === Tok.Word) {
      const w = this.id();
      const head = w === K.BOTH || w === K.LEADING || w === K.TRAILING || (w === 0 && this.slice().toUpperCase() === "VARIADIC");
      const nk = this.kind(1);
      if (head && (nk === Tok.Word || nk === Tok.String || nk === Tok.QuotedIdent || nk === Tok.Number || nk === Tok.Param)) {
        const s = this.start();
        const keyword = this.slice().toUpperCase();
        this.i++;
        const value = this.at(K.FROM) ? undefined : this.expr(Prec.Like + 1);
        return { kind: "keyword-arg", start: s, end: this.last(), keyword, value };
      }
    }
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
      return { kind: "star", start: s, end: this.last(), qualifier: undefined, modifiers: [] };
    }
    if (this.atQuery()) {
      const s = this.start();
      const query = this.query();
      return { kind: "scalar-query", start: s, end: this.last(), query };
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
      return { kind: "frame", start: s, end: this.last(), unit, from, to, exclude: this.frameExclude() };
    }
    const from = this.frameBound();
    return { kind: "frame", start: s, end: this.last(), unit, from, to: undefined, exclude: this.frameExclude() };
  }

  private frameExclude(): string | undefined {
    const K = this.K;
    if (!this.eat(K.EXCLUDE)) return undefined;
    if (this.eat(K.NO)) {
      if (!this.eat(K.OTHERS)) this.fail("OTHERS");
      return "NO OTHERS";
    }
    if (this.eat(K.CURRENT)) {
      this.expect(K.ROW, "ROW");
      return "CURRENT ROW";
    }
    if (this.eat(K.GROUP)) return "GROUP";
    if (this.eat(K.TIES)) return "TIES";
    return this.fail("NO OTHERS, CURRENT ROW, GROUP or TIES");
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

  private orderItem(indexItem = false): OrderItem {
    const K = this.K;
    const s = this.start();
    let expr: Expr;
    if (this.at(K.ALL) && !indexItem) {
      this.i++;
      const ident: Ident = { kind: "ident", start: s, end: this.last(), name: "ALL", quoted: false };
      expr = { kind: "name", start: s, end: this.last(), parts: [ident] };
    } else expr = this.expr(0);
    let opclass: string | undefined;
    if (indexItem && this.canBeIdent() && !this.at(K.ASC) && !this.at(K.DESC) && !this.at(K.NULLS)) {
      const from = this.i;
      this.i++;
      while (this.kind() === Tok.Dot) this.i += 2;
      if (this.kind() === Tok.LParen) this.skipGroup();
      opclass = this.text.slice(this.starts[from] ?? 0, this.ends[this.i - 1] ?? 0);
    }
    const direction = this.eat(K.ASC) ? "asc" : this.eat(K.DESC) ? "desc" : undefined;
    let using: string | undefined;
    if (direction === undefined && this.at(K.USING) && this.kind(1) === Tok.Op) {
      const from = this.i + 1;
      this.i++;
      const run = this.runs ? (this.opRun() ?? 1) : 1;
      this.i += run;
      using = this.text.slice(this.starts[from] ?? 0, this.ends[this.i - 1] ?? 0);
    }
    let nulls: "first" | "last" | undefined;
    if (this.eat(K.NULLS)) {
      if (this.eat(K.FIRST)) nulls = "first";
      else if (this.eat(K.LAST)) nulls = "last";
      else this.fail("FIRST or LAST");
    }
    return { kind: "order-item", start: s, end: this.last(), expr, direction, nulls, opclass, using };
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
    const fields: TypeField[] = [];
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
        const named = (this.kind() === Tok.Word || this.kind() === Tok.QuotedIdent) && (this.kind(1) === Tok.Word || this.kind(1) === Tok.QuotedIdent);
        if (named) fields.push(...this.commaList(() => this.typeField()));
        else args.push(...this.commaList(() => this.expr(0)));
        this.expectKind(Tok.RParen, ")");
      } else if (
        this.kind() === Tok.Word &&
        (!this.isReserved() || ((this.at(K.WITH) || this.at(K.WITHOUT)) && this.at(K.TIME, 1))) &&
        (!strict || this.isTypeWord()) &&
        !COLUMN_OPTION_WORDS.has(this.slice().toUpperCase()) &&
        !(this.wordIs("CHARACTER") && this.at(K.SET, 1)) &&
        !this.wordIs("CHARSET")
      ) {
        words.push(this.slice().toUpperCase());
        this.i++;
      } else break;
    }
    while (this.kind() === Tok.Dot && this.kind(1) === Tok.Word && words.length === 1) {
      this.i++;
      words[0] = `${words[0] ?? ""}.${this.slice().toUpperCase()}`;
      this.i++;
    }
    if (this.atOp(operatorId(this.lx, "%") ?? -1) && (this.wordIs("TYPE", 1) || this.wordIs("ROWTYPE", 1))) {
      words[words.length - 1] = `${words[words.length - 1] ?? ""}%${this.slice(1).toUpperCase()}`;
      this.i += 2;
    }
    const last = words[words.length - 1] ?? "";
    if (this.atOp(operatorId(this.lx, "<") ?? -1) && (last === "ARRAY" || last === "MAP" || last === "STRUCT" || last === "ROW" || last === "LIST" || last === "TUPLE" || last === "NESTED")) {
      this.i++;
      fields.push(...this.commaList(() => this.typeField()));
      this.closeAngle();
    }
    let name = words.join(" ");
    while (this.kind() === Tok.LBracket && (this.kind(1) === Tok.RBracket || (this.kind(1) === Tok.Number && this.kind(2) === Tok.RBracket))) {
      this.i += this.kind(1) === Tok.RBracket ? 2 : 3;
      name += "[]";
    }
    let charset: string | undefined;
    if ((this.wordIs("CHARACTER") && this.at(K.SET, 1)) || this.wordIs("CHARSET")) {
      this.i += this.wordIs("CHARSET") ? 1 : 2;
      charset = this.ident(true).name;
    }
    let collation: string | undefined;
    if (this.eat(K.COLLATE)) {
      const c = this.qualifiedName();
      collation = c.parts.map((p) => p.name).join(".");
    }
    return { kind: "data-type", start: s, end: this.last(), name, args, fields, charset, collation };
  }

  /** A field of a type: `name type`, or just a type. */
  private typeField(): TypeField {
    const s = this.start();
    const named = (this.kind() === Tok.Word || this.kind() === Tok.QuotedIdent) && (this.kind(1) === Tok.Word || this.kind(1) === Tok.QuotedIdent);
    const name = named ? this.ident(true) : undefined;
    const type = this.dataType();
    return { kind: "type-field", start: s, end: this.last(), name, type };
  }

  /** Closes `<` of a type; `>>` closes two, the first of them without moving. */
  private closeAngle(): void {
    if (this.atOp(operatorId(this.lx, ">") ?? -1)) {
      this.i++;
      return;
    }
    const w = this.kind() === Tok.Op ? this.text.slice(this.starts[this.i] ?? 0, this.ends[this.i] ?? 0) : "";
    if (w === ">>") {
      if (this.halfGt) {
        this.halfGt = false;
        this.i++;
      } else this.halfGt = true;
      return;
    }
    this.fail(">");
  }

  // ---- queries

  private atQuery(at = 0): boolean {
    const K = this.K;
    let o = at;
    while (this.kind(o) === Tok.LParen) o++;
    return this.at(K.SELECT, o) || this.at(K.WITH, o) || this.at(K.VALUES, o) || (this.fromFirst && this.at(K.FROM, o));
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
      let materialized: "materialized" | "not-materialized" | undefined;
      if (this.wordIs("MATERIALIZED")) {
        materialized = "materialized";
        this.i++;
      } else if (this.at(K.NOT) && this.wordIs("MATERIALIZED", 1)) {
        materialized = "not-materialized";
        this.i += 2;
      }
      this.expectKind(Tok.LParen, "(");
      const query: CteBody = this.at(K.INSERT) ? this.insert() : this.at(K.UPDATE) ? this.update() : this.at(K.DELETE) ? this.delete() : this.query();
      this.expectKind(Tok.RParen, ")");
      const trailer = this.cteTrailer();
      return { kind: "cte", start: cs, end: this.last(), name, columns, query, materialized, trailer };
    });
    const body = this.at(K.INSERT) ? this.insert() : this.at(K.UPDATE) ? this.update() : this.at(K.DELETE) ? this.delete() : this.queryExpr();
    return { kind: "with", start: s, end: this.last(), recursive, ctes, body };
  }

  /** The `SEARCH` or `CYCLE` clause after a common table expression, as text. */
  private cteTrailer(): string | undefined {
    const K = this.K;
    const from = this.i;
    while (this.kind() === Tok.Word && (this.wordIs("SEARCH") || this.wordIs("CYCLE"))) {
      while (!this.atEnd() && !this.at(K.SET)) this.i++;
      if (!this.eat(K.SET)) this.fail("SET");
      this.ident(true);
      if (this.wordIs("TO")) {
        this.i++;
        this.expr(Prec.Additive);
        this.expect(K.DEFAULT, "DEFAULT");
        this.expr(Prec.Additive);
      }
      if (this.at(K.USING)) {
        this.i++;
        this.ident(true);
      }
    }
    return this.textFrom(from);
  }

  private atIndexHint(): boolean {
    if (this.at(this.K.FOR) && (this.wordIs("SYSTEM_TIME", 1) || this.wordIs("VERSION", 1) || this.wordIs("TIMESTAMP", 1)) && this.at(this.K.AS, 2) && this.wordIs("OF", 3)) return true;
    return (this.wordIs("USE") || this.wordIs("FORCE") || this.wordIs("IGNORE")) && (this.at(this.K.INDEX, 1) || this.wordIs("KEY", 1));
  }

  /** Whether a clause that the dialect keeps as the tail of a query is at the cursor. */
  private atTail(): boolean {
    return this.queryTail.size > 0 && this.kind() === Tok.Word && this.queryTail.has(this.slice().toUpperCase());
  }

  /** Whether a locking clause (`FOR UPDATE`, `FOR SHARE`, `FOR NO KEY UPDATE`, `FOR KEY SHARE`) is at the cursor. */
  private atLocking(): boolean {
    return this.at(this.K.FOR) && (this.wordIs("UPDATE", 1) || this.wordIs("SHARE", 1) || (this.wordIs("NO", 1) && this.wordIs("KEY", 2)) || (this.wordIs("KEY", 1) && this.wordIs("SHARE", 2)));
  }

  private lockingClause(): void {
    this.i++;
    while (this.wordIs("NO") || this.wordIs("KEY")) this.i++;
    this.i++;
    if (this.wordIs("OF")) {
      this.i++;
      this.commaList(() => this.qualifiedName());
    }
    if (this.wordIs("NOWAIT")) this.i++;
    else if (this.wordIs("SKIP") && this.wordIs("LOCKED", 1)) this.i += 2;
  }

  private queryExpr(): Query {
    const K = this.K;
    const s = this.start();
    const left = this.setExpr(1);
    const orderBy = this.orderByClause();
    let limit: Expr | undefined;
    let offset: Expr | undefined;
    let locking: string | undefined;
    let settings: string | undefined;
    for (;;) {
      if (this.eat(K.LIMIT)) {
        limit = this.expr(0);
        if (this.kind() === Tok.Comma) {
          this.i++;
          offset = limit;
          limit = this.expr(0);
        }
      }
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
      } else if (this.atTail()) {
        const from = this.i;
        let depth = 0;
        while (!this.atEnd() && this.kind() !== Tok.Semicolon && !(depth === 0 && this.kind() === Tok.RParen)) {
          if (this.kind() === Tok.LParen) depth++;
          else if (this.kind() === Tok.RParen) depth--;
          this.i++;
        }
        settings = this.textFrom(from);
      } else if (this.atLocking()) {
        const from = this.i;
        while (this.atLocking()) this.lockingClause();
        locking = this.textFrom(from);
      } else break;
    }
    if (orderBy.length === 0 && limit === undefined && offset === undefined && locking === undefined && settings === undefined) return left;
    if (left.kind === "select" || left.kind === "set-op") {
      if (left.orderBy.length > 0 || left.limit !== undefined || left.offset !== undefined)
        this.unsupported("a clause after a query in parentheses that has its own");
      return left.kind === "select"
        ? { ...left, start: s, end: this.last(), orderBy, limit, offset, locking, settings }
        : { ...left, start: s, end: this.last(), orderBy, limit, offset, locking, settings };
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
      const byName = this.at(K.BY) && this.wordIs("NAME", 1);
      if (byName) this.i += 2;
      const right = this.setExpr(level + 1);
      const node: SetOp = {
        kind: "set-op",
        start: s,
        end: this.last(),
        op,
        byName,
        quantifier,
        left,
        right,
        orderBy: [],
        limit: undefined,
        offset: undefined,
        locking: undefined,
        settings: undefined,
      };
      left = node;
    }
    return left;
  }

  private queryTerm(): Query {
    const K = this.K;
    if (this.skipSelect || this.at(K.SELECT) || (this.fromFirst && this.at(K.FROM))) return this.selectCore();
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

  /** Whether the word at the cursor is the `QUALIFY` of a clause (and not a name): it is, unless something that ends an item follows it. */
  /** Moves past the parenthesis at the cursor and what it holds. */
  private skipGroup(): void {
    let depth = 0;
    do {
      if (this.kind() === Tok.LParen) depth++;
      else if (this.kind() === Tok.RParen) depth--;
      this.i++;
    } while (depth > 0 && !this.atEnd());
  }

  /** The text of the tokens from `from` to the cursor, or `undefined` where there are none. */
  private textFrom(from: number): string | undefined {
    return this.i > from ? this.text.slice(this.starts[from] ?? 0, this.ends[this.i - 1] ?? 0) : undefined;
  }

  /** How many tokens, from the cursor, are one operator of a run of operator characters (PostgreSQL's rule: a run does not end in `+` or `-` unless it holds one of `~ ! @ # % ^ & | ?`), or `undefined` where there is none. */
  private opRun(): number | undefined {
    let n = 0;
    let at = this.starts[this.i] ?? 0;
    let special = false;
    while (this.kind(n) === Tok.Op && (this.starts[this.i + n] ?? 0) === at && this.id(n) !== this.castOp) {
      const from = this.starts[this.i + n] ?? 0;
      const to = this.ends[this.i + n] ?? 0;
      for (let c = from; c < to; c++) {
        const ch = this.text.charCodeAt(c);
        if (!OP_RUN_CHARS.has(ch)) return n === 0 ? undefined : this.trimRun(n, special);
        if (SPECIAL_OP_CHARS.has(ch)) special = true;
      }
      at = to;
      n++;
    }
    return n === 0 ? undefined : this.trimRun(n, special);
  }

  private trimRun(n: number, special: boolean): number | undefined {
    let count = n;
    if (!special) {
      while (count > 1) {
        const last = this.text.charCodeAt((this.ends[this.i + count - 1] ?? 1) - 1);
        if (last !== 43 && last !== 45) break;
        count--;
      }
    }
    return count;
  }

  /** Whether the token at the cursor is the `:` of a slice. */
  private atColon(): boolean {
    return this.kind() === Tok.Op && (this.ends[this.i] ?? 0) - (this.starts[this.i] ?? 0) === 1 && this.text.charCodeAt(this.starts[this.i] ?? 0) === 58;
  }

  private atQualify(): boolean {
    if (!this.at(this.K.QUALIFY)) return false;
    const k = this.kind(1);
    return !(k === Tok.Comma || k === Tok.RParen || k === Tok.Semicolon || k === Tok.Eof);
  }

  /** Whether the token at the cursor can begin an expression (and so a list after `GROUP BY ALL`). */
  private startsExpression(): boolean {
    const k = this.kind();
    if (k === Tok.Number || k === Tok.String || k === Tok.Param || k === Tok.LParen || k === Tok.QuotedIdent || k === Tok.LBracket)
      return true;
    if (k === Tok.Op) return this.id() === this.opMinus || this.id() === this.opPlus;
    if (k !== Tok.Word) return false;
    const K = this.K;
    const w = this.id();
    return !(
      w === K.HAVING ||
      w === K.ORDER ||
      w === K.LIMIT ||
      w === K.OFFSET ||
      w === K.FETCH ||
      w === K.UNION ||
      w === K.INTERSECT ||
      w === K.EXCEPT ||
      w === K.WINDOW ||
      w === K.QUALIFY ||
      w === K.FOR
    );
  }

  /** One item of `GROUP BY`: an expression, the empty grouping `()`, or `GROUPING SETS (...)` (a call of that name). */
  private groupItem(): Expr {
    const K = this.K;
    const s = this.start();
    if (this.kind() === Tok.LParen && this.kind(1) === Tok.RParen) {
      this.i += 2;
      return { kind: "tuple", start: s, end: this.last(), items: [] };
    }
    if (this.at(K.GROUPING) && this.at(K.SETS, 1) && this.kind(2) === Tok.LParen) {
      this.i += 2;
      const nameEnd = this.last();
      const ident: Ident = { kind: "ident", start: s, end: nameEnd, name: "GROUPING SETS", quoted: false };
      const name: Name = { kind: "name", start: s, end: nameEnd, parts: [ident] };
      this.i++;
      const args = this.commaList(() => this.groupItem());
      this.expectKind(Tok.RParen, ")");
      return {
        kind: "call",
        start: s,
        end: this.last(),
        name,
        parameters: [],
        args,
        distinct: false,
        orderBy: [],
        withinGroup: [],
        nullTreatment: undefined,
        filter: undefined,
        over: undefined,
      };
    }
    return this.expr(0);
  }

  /** `EXCEPT (a, b)`, `EXCLUDE (a)`, `REPLACE (x AS a)`, `RENAME (a AS b)` after a star. */
  private starModifiers(): StarModifier[] {
    const K = this.K;
    const out: StarModifier[] = [];
    while ((this.at(K.EXCEPT) || this.at(K.EXCLUDE) || this.at(K.REPLACE) || this.at(K.RENAME)) && this.kind(1) === Tok.LParen && !this.atQuery(1)) {
      const s = this.start();
      const keyword = this.slice().toUpperCase();
      this.i += 2;
      const items = this.commaList(() => this.selectItem());
      this.expectKind(Tok.RParen, ")");
      out.push({ kind: "star-modifier", start: s, end: this.last(), keyword, items });
    }
    return out;
  }

  private selectItem(): SelectItem {
    const K = this.K;
    const s = this.start();
    let expr: Expr;
    if (this.kind() === Tok.Op && this.id() === this.opStar) {
      this.i++;
      const modifiers = this.starModifiers();
      expr = { kind: "star", start: s, end: this.last(), qualifier: undefined, modifiers };
    } else expr = this.expr(0);
    let alias: Ident | undefined;
    if (this.eat(K.AS)) alias = this.ident(true);
    else if (this.canBeIdent() && !this.atQualify() && !this.atLocking() && !this.atTail()) alias = this.ident();
    return { kind: "select-item", start: s, end: this.last(), expr, alias };
  }

  private selectCore(): Select {
    const K = this.K;
    const s = this.start();
    const fromFirst = this.fromFirst && this.at(K.FROM);
    if (this.skipSelect) this.skipSelect = false;
    else if (!fromFirst) this.i++;
    const distinct = !fromFirst && this.eat(K.DISTINCT);
    let distinctOn: Expr[] = [];
    if (distinct && this.at(K.ON) && this.kind(1) === Tok.LParen) {
      this.i += 2;
      distinctOn = this.commaList(() => this.expr(0));
      this.expectKind(Tok.RParen, ")");
    }
    if (!distinct && !fromFirst) this.eat(K.ALL);
    let top: Expr | undefined;
    let topOptions: string | undefined;
    if (this.selectTop && this.wordIs("TOP") && (this.kind(1) === Tok.Number || this.kind(1) === Tok.LParen)) {
      this.i++;
      top = this.kind() === Tok.LParen ? this.prefix() : this.expr(Prec.Unary);
      const f = this.i;
      if (this.wordIs("PERCENT")) this.i++;
      if (this.at(K.WITH) && this.wordIs("TIES", 1)) this.i += 2;
      topOptions = this.textFrom(f);
    }
    let items: SelectItem[] = fromFirst ? [] : this.emptySelect && (this.at(K.FROM) || this.kind() === Tok.Semicolon || this.kind() === Tok.RParen || this.atEnd() || this.at(K.UNION) || this.at(K.INTERSECT) || this.at(K.EXCEPT)) ? [] : this.commaList(() => this.selectItem());
    let into: string | undefined;
    if (this.at(K.INTO)) {
      const f = this.i;
      this.i++;
      while (this.wordIs("TEMP") || this.wordIs("TEMPORARY") || this.wordIs("UNLOGGED") || this.at(K.TABLE)) this.i++;
      this.qualifiedName();
      into = this.textFrom(f);
    }
    const from = this.eat(K.FROM) ? this.commaList(() => this.joined()) : [];
    if (fromFirst && this.at(K.SELECT)) {
      this.i++;
      items = this.commaList(() => this.selectItem());
    }
    const where = this.eat(K.WHERE) ? this.expr(0) : undefined;
    let groupBy: Expr[] = [];
    let groupAll = false;
    if (this.eat(K.GROUP)) {
      this.expect(K.BY, "BY");
      if (this.at(K.ALL)) {
        groupAll = true;
        this.i++;
      }
      if (!groupAll || this.startsExpression()) groupBy = this.commaList(() => this.groupItem());
    }
    let having: Expr | undefined;
    let qualify: Expr | undefined;
    let windows: WindowDef[] = [];
    for (;;) {
      if (having === undefined && this.eat(K.HAVING)) having = this.expr(0);
      else if (qualify === undefined && this.eat(K.QUALIFY)) qualify = this.expr(0);
      else if (windows.length === 0 && this.at(K.WINDOW)) {
        this.i++;
        windows = this.commaList((): WindowDef => {
          const ws = this.start();
          const name = this.ident();
          this.expect(K.AS, "AS");
          if (this.kind() !== Tok.LParen) this.fail("(");
          const spec = this.windowSpec();
          return { kind: "window-def", start: ws, end: this.last(), name, spec };
        });
      } else break;
    }
    return {
      kind: "select",
      start: s,
      end: this.last(),
      distinct,
      top,
      topOptions,
      into,
      distinctOn,
      items,
      from,
      where,
      groupBy,
      groupAll,
      having,
      windows,
      qualify,
      orderBy: [],
      limit: undefined,
      offset: undefined,
      locking: undefined,
        settings: undefined,
    };
  }

  // ---- sources

  private alias(): Alias | undefined {
    const K = this.K;
    const s = this.start();
    let name: Ident;
    if (this.eat(K.AS)) name = this.ident(true);
    else if (this.canBeIdent() && !this.atQualify() && !this.atLocking() && !this.atTail() && !this.atIndexHint() && this.tableOpAt() === undefined && !(this.wordIs("INDEXED") && this.at(K.BY, 1))) name = this.ident();
    else return undefined;
    const columns: Ident[] = [];
    const types: (DataType | undefined)[] = [];
    if (this.kind() === Tok.LParen) {
      this.i++;
      do {
        columns.push(this.ident(true));
        types.push(this.kind() === Tok.Comma || this.kind() === Tok.RParen ? undefined : this.dataType());
      } while (this.eatKind(Tok.Comma));
      this.expectKind(Tok.RParen, ")");
    }
    return { kind: "alias", start: s, end: this.last(), name, columns, types: types.some((t) => t !== undefined) ? types : [] };
  }

  private tableRef(): TableRef {
    return this.plainTable(this.start());
  }

  /** A table with its alias and what stands beside it: `ONLY t`, `t*`, `t x TABLESAMPLE ...`, `t NOT INDEXED`. */
  private plainTable(s: number): TableRef {
    const only = this.wordIs("ONLY") && (this.kind(1) === Tok.Word || this.kind(1) === Tok.QuotedIdent);
    if (only) this.i++;
    const name = this.qualifiedName();
    const star = this.atOp(this.opStar);
    if (star) this.i++;
    const alias = this.alias();
    const after = this.tableHint();
    const hint = [only ? "ONLY" : undefined, star ? "*" : undefined, after].filter((x) => x !== undefined).join(" ") || undefined;
    return { kind: "table", start: s, end: this.last(), name, alias, hint };
  }

  /** `NOT INDEXED` or `INDEXED BY name` after a table, as text. */
  private tableHint(): string | undefined {
    const K = this.K;
    const from = this.i;
    if (this.at(K.WITH) && this.kind(1) === Tok.LParen) {
      this.i++;
      this.skipGroup();
    } else if (this.at(K.FOR) && (this.wordIs("SYSTEM_TIME", 1) || this.wordIs("VERSION", 1) || this.wordIs("TIMESTAMP", 1)) && this.at(K.AS, 2) && this.wordIs("OF", 3)) {
      this.i += 4;
      this.expr(Prec.Additive);
    } else if ((this.wordIs("USE") || this.wordIs("FORCE") || this.wordIs("IGNORE")) && (this.at(K.INDEX, 1) || this.wordIs("KEY", 1))) {
      this.i += 2;
      if (this.at(K.FOR)) this.i += 2;
      if (this.kind() === Tok.LParen) this.skipGroup();
    } else if (this.wordIs("TABLESAMPLE")) {
      this.i += 2;
      if (this.kind() === Tok.LParen) this.skipGroup();
      if (this.wordIs("REPEATABLE")) {
        this.i++;
        if (this.kind() === Tok.LParen) this.skipGroup();
      }
    } else if (this.at(K.NOT) && this.wordIs("INDEXED", 1)) this.i += 2;
    else if (this.wordIs("INDEXED") && this.at(K.BY, 1)) {
      this.i += 2;
      this.qualifiedName();
    } else return undefined;
    return this.textFrom(from);
  }

  private sourceTerm(): Source {
    let src = this.sourceBase();
    for (;;) {
      const op = this.tableOpAt();
      if (op === undefined) return src;
      const s = src.start;
      const from = this.i;
      if (op === "LATERAL VIEW") {
        this.i += 2;
        if (this.at(this.K.OUTER)) this.i++;
        this.expr(Prec.Cast);
        if (this.canBeIdent()) this.ident();
        if (this.eat(this.K.AS)) this.commaList(() => this.ident(true));
        src = { kind: "table-op", start: s, end: this.last(), op, source: src, text: this.textFrom(from) ?? "", alias: undefined };
        continue;
      }
      this.i++;
      this.skipGroup();
      const text = this.textFrom(from) ?? "";
      const alias = this.alias();
      src = { kind: "table-op", start: s, end: this.last(), op, source: src, text, alias };
    }
  }

  /** The table operator at the cursor, if one: `PIVOT (`, `UNPIVOT (`, `MATCH_RECOGNIZE (`, `LATERAL VIEW`. */
  private tableOpAt(): string | undefined {
    if (this.kind() !== Tok.Word) return undefined;
    if (this.at(this.K.LATERAL) && this.wordIs("VIEW", 1)) return "LATERAL VIEW";
    if (this.kind(1) !== Tok.LParen) return undefined;
    const w = this.slice().toUpperCase();
    return w === "PIVOT" || w === "UNPIVOT" || w === "MATCH_RECOGNIZE" ? w : undefined;
  }

  private sourceBase(): Source {
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
        const mark = this.i;
        const depth = this.depth;
        const nested = this.kind(1) === Tok.LParen;
        try {
          this.i++;
          const query = this.query();
          this.expectKind(Tok.RParen, ")");
          const alias = this.alias();
          return { kind: "subquery", start: s, end: this.last(), query, alias, lateral };
        } catch (e) {
          if (!(e instanceof Failure) || !nested) throw e;
          this.i = mark;
          this.depth = depth;
        }
      }
      this.i++;
      const inner = this.joined();
      this.expectKind(Tok.RParen, ")");
      const alias = this.alias();
      return alias === undefined ? inner : this.withAlias(inner, alias, s);
    }
    if (this.at(K.TABLE) && this.kind(1) === Tok.LParen) {
      const ident: Ident = { kind: "ident", start: s, end: this.ends[this.i] ?? s, name: this.slice(), quoted: false };
      this.i++;
      const name: Name = { kind: "name", start: ident.start, end: ident.end, parts: [ident] };
      const call = this.call(name);
      if (call.kind !== "call") return this.fail("a function call");
      const alias = this.alias();
      return { kind: "table-fn", start: s, end: this.last(), call, alias, lateral, ordinality: false };
    }
    let at = this.wordIs("ONLY") && this.kind(1) !== Tok.LParen ? 1 : 0;
    at++;
    while (this.kind(at) === Tok.Dot) at += 2;
    if (this.kind(at) !== Tok.LParen) return this.plainTable(s);
    const name = this.qualifiedName();
    if (this.kind() === Tok.LParen) {
      const call = this.call(name);
      if (call.kind !== "call") return this.fail("a function call");
      const ordinality = this.at(K.WITH) && this.wordIs("ORDINALITY", 1);
      if (ordinality) this.i += 2;
      const alias = this.alias();
      return { kind: "table-fn", start: s, end: this.last(), call, alias, lateral, ordinality };
    }
    const alias = this.alias();
    const hint = this.tableHint();
    return { kind: "table", start: s, end: this.last(), name, alias, hint };
  }

  /** A parenthesized source with an alias: the alias goes on the source where the node has one, else it is kept by a subquery of the source's own text. */
  private withAlias(inner: Source, alias: Alias, s: number): Source {
    switch (inner.kind) {
      case "join":
        return { ...inner, start: s, end: this.last(), alias };
      case "table":
        return inner.alias === undefined ? { ...inner, start: s, end: this.last(), alias } : this.fail("an alias");
      case "subquery":
        return inner.alias === undefined ? { ...inner, start: s, end: this.last(), alias } : this.fail("an alias");
      case "table-fn":
        return inner.alias === undefined ? { ...inner, start: s, end: this.last(), alias } : this.fail("an alias");
      case "table-op":
        return inner.alias === undefined ? { ...inner, start: s, end: this.last(), alias } : this.fail("an alias");
      default:
        return absurd(inner);
    }
  }

  /** Whether a join begins at the cursor. */
  private atJoinStart(): boolean {
    const K = this.K;
    return this.at(K.JOIN) || this.at(K.INNER) || this.at(K.LEFT) || this.at(K.RIGHT) || this.at(K.FULL) || this.at(K.CROSS) || this.at(K.NATURAL);
  }

  private joined(first?: Source): Source {
    const K = this.K;
    const s = first === undefined ? this.start() : first.start;
    let left = first ?? this.sourceTerm();
    for (;;) {
      const natural = this.eat(K.NATURAL);
      let type: JoinType | undefined;
      if (this.eat(K.INNER)) type = "inner";
      else if (this.eat(K.LEFT)) type = "left";
      else if (this.eat(K.RIGHT)) type = "right";
      else if (this.eat(K.FULL)) type = "full";
      else if (this.at(K.CROSS) && this.wordIs("APPLY", 1)) {
        this.i += 2;
        type = "cross-apply";
      } else if (this.at(K.OUTER) && this.wordIs("APPLY", 1)) {
        this.i += 2;
        type = "outer-apply";
      } else if (this.eat(K.CROSS)) type = "cross";
      if (type === "left" || type === "right" || type === "full") this.eat(K.OUTER);
      if ((type === "left" || type === "right" || type === undefined) && (this.wordIs("SEMI") || this.wordIs("ANTI")) && this.at(K.JOIN, 1)) {
        type = this.wordIs("SEMI") ? "semi" : "anti";
        this.i++;
      }
      if (type !== "cross-apply" && type !== "outer-apply" && !this.eat(K.JOIN)) {
        if (natural || type !== undefined) this.fail("JOIN");
        return left;
      }
      let right = this.sourceTerm();
      if (type !== "cross" && !natural && !this.at(K.ON) && !this.at(K.USING) && this.atJoinStart()) right = this.joined(right);
      let on: Expr | undefined;
      let using: Ident[] = [];
      let usingAlias: Ident | undefined;
      if (this.eat(K.ON)) on = this.expr(0);
      else if (this.eat(K.USING)) {
        using = this.identList();
        if (this.at(K.AS)) {
          this.i++;
          usingAlias = this.ident(true);
        }
      }
      left = { kind: "join", start: s, end: this.last(), type: type ?? "inner", natural, left, right, on, using, usingAlias, alias: undefined };
    }
  }

  // ---- statements

  private returning(): SelectItem[] {
    return this.eat(this.K.RETURNING) ? this.commaList(() => this.selectItem()) : [];
  }

  private insert(): Insert {
    const K = this.K;
    const s = this.start();
    let conflict: string | undefined;
    if (this.at(K.REPLACE)) conflict = "REPLACE";
    this.i++;
    if (conflict === undefined && this.wordIs("OVERWRITE")) {
      conflict = "OVERWRITE";
      this.i++;
      this.eat(K.TABLE);
    } else if (conflict === undefined && this.eat(K.OR)) {
      if (this.kind() !== Tok.Word) this.fail("IGNORE, REPLACE, ABORT, FAIL or ROLLBACK");
      conflict = this.slice().toUpperCase();
      this.i++;
    }
    if (conflict !== "OVERWRITE") {
      this.expect(K.INTO, "INTO");
      this.eat(K.TABLE);
    }
    const table = this.qualifiedName();
    let partition: string | undefined;
    if (this.wordIs("PARTITION") && this.kind(1) === Tok.LParen) {
      const f = this.i;
      this.i++;
      this.skipGroup();
      partition = this.textFrom(f);
    }
    const alias = this.eat(K.AS) ? this.ident(true) : undefined;
    let columns: Expr[] = [];
    if (this.kind() === Tok.LParen && !this.atQuery(1)) {
      this.i++;
      columns = this.commaList(() => this.expr(Prec.Cast));
      this.expectKind(Tok.RParen, ")");
    }
    const byName = this.at(K.BY) && this.wordIs("NAME", 1);
    if (byName) this.i += 2;
    let source: Query | undefined;
    if (this.eat(K.DEFAULT)) this.expect(K.VALUES, "VALUES");
    else source = this.query();
    const onConflict = this.at(K.ON) && this.wordIs("CONFLICT", 1) ? this.onConflict() : this.at(K.ON) && this.wordIs("DUPLICATE", 1) ? this.onDuplicate() : undefined;
    const returning = this.returning();
    return { kind: "insert", start: s, end: this.last(), partition, byName, table, alias, columns, source, conflict, onConflict, returning };
  }

  private onConflict(): OnConflict {
    const K = this.K;
    const s = this.start();
    this.i += 2;
    let targets: Expr[] = [];
    let constraint: Ident | undefined;
    let targetWhere: Expr | undefined;
    if (this.kind() === Tok.LParen) {
      this.i++;
      targets = this.commaList(() => this.expr(0));
      this.expectKind(Tok.RParen, ")");
      if (this.eat(K.WHERE)) targetWhere = this.expr(0);
    } else if (this.at(K.ON) && this.wordIs("CONSTRAINT", 1)) {
      this.i += 2;
      constraint = this.ident(true);
    }
    if (!this.wordIs("DO")) this.fail("DO");
    this.i++;
    if (this.wordIs("NOTHING")) {
      this.i++;
      return { kind: "on-conflict", start: s, end: this.last(), duplicateKey: false, targets, constraint, targetWhere, update: false, assignments: [], where: undefined };
    }
    this.expect(K.UPDATE, "NOTHING or UPDATE");
    this.expect(K.SET, "SET");
    const assignments = this.commaList(() => this.assignment());
    const where = this.eat(K.WHERE) ? this.expr(0) : undefined;
    return { kind: "on-conflict", start: s, end: this.last(), duplicateKey: false, targets, constraint, targetWhere, update: true, assignments, where };
  }

  private onDuplicate(): OnConflict {
    const K = this.K;
    const s = this.start();
    this.i += 2;
    this.expect(K.KEY, "KEY");
    this.expect(K.UPDATE, "UPDATE");
    const assignments = this.commaList(() => this.assignment());
    return { kind: "on-conflict", start: s, end: this.last(), duplicateKey: true, targets: [], constraint: undefined, targetWhere: undefined, update: true, assignments, where: undefined };
  }

  private assignment(): Assignment {
    const s = this.start();
    const target = this.expr(Prec.Cast);
    if (!this.atOp(operatorId(this.lx, "=") ?? -1)) this.fail("=");
    this.i++;
    const value = this.expr(0);
    return { kind: "assignment", start: s, end: this.last(), target, value };
  }

  private update(): Update {
    const K = this.K;
    const s = this.start();
    this.i++;
    const table = this.tableRef();
    this.expect(K.SET, "SET");
    const assignments = this.commaList(() => this.assignment());
    const from = this.eat(K.FROM) ? this.commaList(() => this.joined()) : [];
    const where = this.eat(K.WHERE) ? this.expr(0) : undefined;
    const returning = this.returning();
    return { kind: "update", start: s, end: this.last(), table, assignments, from, where, returning };
  }

  private delete(): Delete {
    const K = this.K;
    const s = this.start();
    this.i++;
    this.expect(K.FROM, "FROM");
    const table = this.tableRef();
    const using = this.eat(K.USING) ? this.commaList(() => this.joined()) : [];
    const where = this.eat(K.WHERE) ? this.expr(0) : undefined;
    const returning = this.returning();
    return { kind: "delete", start: s, end: this.last(), table, using, where, returning };
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
    const optFrom = this.i;
    while (this.wordIs("MATCH") || this.wordIs("DEFERRABLE") || this.wordIs("INITIALLY") || (this.at(K.NOT) && this.wordIs("DEFERRABLE", 1))) {
      this.i += this.at(K.NOT) ? 2 : 1;
      if (this.kind() === Tok.Word && !this.at(K.ON)) this.i += this.wordIs("DEFERRED") || this.wordIs("IMMEDIATE") || this.wordIs("FULL") || this.wordIs("PARTIAL") || this.wordIs("SIMPLE") ? 1 : 0;
    }
    return { kind: "reference", start: s, end: this.last(), table, columns, onDelete, onUpdate, options: this.textFrom(optFrom) };
  }

  private atTableIndex(): boolean {
    if (!this.tableIndexes || this.kind() !== Tok.Word) return false;
    const w = this.slice().toUpperCase();
    const n = this.kind(1);
    if (w === "INDEX") return n === Tok.Word || n === Tok.QuotedIdent || n === Tok.LParen;
    if (w === "KEY") return n === Tok.LParen || ((n === Tok.Word || n === Tok.QuotedIdent) && this.kind(2) === Tok.LParen);
    if (w === "FULLTEXT" || w === "SPATIAL" || w === "UNIQUE") return this.wordIs("KEY", 1) || this.wordIs("INDEX", 1);
    return w === "PROJECTION";
  }

  /** An index among the elements of a `CREATE TABLE`, as text. */
  private tableIndex(): TableConstraint {
    const s = this.start();
    const from = this.i;
    let depth = 0;
    while (!this.atEnd() && this.kind() !== Tok.Semicolon && !(depth === 0 && (this.kind() === Tok.Comma || this.kind() === Tok.RParen))) {
      if (this.kind() === Tok.LParen) depth++;
      else if (this.kind() === Tok.RParen) depth--;
      this.i++;
    }
    return { kind: "column-option", start: s, end: this.last(), name: undefined, text: this.textFrom(from) ?? "", expr: undefined };
  }

  private tableLike(): TableLike {
    const s = this.start();
    this.i++;
    const table = this.qualifiedName();
    const from = this.i;
    let depth = 0;
    while (!this.atEnd() && this.kind() !== Tok.Semicolon && !(depth === 0 && (this.kind() === Tok.Comma || this.kind() === Tok.RParen))) {
      if (this.kind() === Tok.LParen) depth++;
      else if (this.kind() === Tok.RParen) depth--;
      this.i++;
    }
    return { kind: "table-like", start: s, end: this.last(), table, options: this.textFrom(from) };
  }

  private atTableConstraint(): boolean {
    const K = this.K;
    return this.at(K.CONSTRAINT) || this.at(K.PRIMARY) || this.at(K.UNIQUE) || this.at(K.CHECK) || this.at(K.FOREIGN) || (this.at(K.NOT) && this.at(K.NULL, 1)) || this.at(K.EXCLUDE);
  }

  /** `NO INHERIT` or `NOT VALID` after a check, as text. */
  private constraintOptions(): string | undefined {
    const K = this.K;
    const from = this.i;
    for (;;) {
      if (this.at(K.NO) && this.wordIs("INHERIT", 1)) this.i += 2;
      else if (this.at(K.NOT) && (this.wordIs("VALID", 1) || this.wordIs("ENFORCED", 1))) this.i += 2;
      else if (this.wordIs("ENFORCED")) this.i++;
      else if (this.at(K.NOT) && this.wordIs("DEFERRABLE", 1)) this.i += 2;
      else if (this.wordIs("DEFERRABLE")) this.i++;
      else if (this.wordIs("INITIALLY") && (this.wordIs("DEFERRED", 1) || this.wordIs("IMMEDIATE", 1))) this.i += 2;
      else if (this.wordIs("NULLS") && this.at(K.NOT, 1) && this.at(K.DISTINCT, 2)) this.i += 3;
      else if (this.at(K.USING) && this.kind(1) === Tok.Word) this.i += 2;
      else break;
    }
    return this.textFrom(from);
  }

  private tableConstraint(): TableConstraint {
    const K = this.K;
    const s = this.start();
    const name = this.eat(K.CONSTRAINT) ? this.ident() : undefined;
    if (this.at(K.NOT) || this.at(K.EXCLUDE)) {
      const from = this.i;
      let depth = 0;
      while (!this.atEnd() && this.kind() !== Tok.Semicolon && !(depth === 0 && (this.kind() === Tok.Comma || this.kind() === Tok.RParen))) {
        if (this.kind() === Tok.LParen) depth++;
        else if (this.kind() === Tok.RParen) depth--;
        this.i++;
      }
      return { kind: "column-option", start: s, end: this.last(), name, text: this.textFrom(from) ?? "", expr: undefined };
    }
    if (this.eat(K.PRIMARY)) {
      this.expect(K.KEY, "KEY");
      const columns = this.identList();
      const options = this.constraintOptions();
      return { kind: "primary-key", start: s, end: this.last(), name, columns, options };
    }
    if (this.eat(K.UNIQUE)) {
      const columns = this.identList();
      const options = this.constraintOptions();
      return { kind: "unique", start: s, end: this.last(), name, columns, options };
    }
    if (this.eat(K.CHECK)) {
      this.expectKind(Tok.LParen, "(");
      const expr = this.expr(0);
      this.expectKind(Tok.RParen, ")");
      const options = this.constraintOptions();
      return { kind: "check", start: s, end: this.last(), name, expr, options };
    }
    this.expect(K.FOREIGN, "PRIMARY KEY, UNIQUE, CHECK or FOREIGN KEY");
    this.expect(K.KEY, "KEY");
    const columns = this.identList();
    const reference = this.reference();
    const options = this.constraintOptions();
    return { kind: "foreign-key", start: s, end: this.last(), name, columns, reference, options };
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
        const expr = this.expr(Prec.Is + 1);
        out.push({ kind: "default", start: s, end: this.last(), name, expr });
      } else if (this.eat(K.PRIMARY)) {
        this.expect(K.KEY, "KEY");
        const options = this.constraintOptions();
        out.push({ kind: "primary-key", start: s, end: this.last(), name, columns: [], options });
      } else if (this.eat(K.UNIQUE)) {
        const options = this.constraintOptions();
        out.push({ kind: "unique", start: s, end: this.last(), name, columns: [], options });
      } else if (this.eat(K.CHECK)) {
        this.expectKind(Tok.LParen, "(");
        const expr = this.expr(0);
        this.expectKind(Tok.RParen, ")");
        const options = this.constraintOptions();
        out.push({ kind: "check", start: s, end: this.last(), name, expr, options });
      } else if (this.at(K.REFERENCES)) {
        const reference = this.reference();
        const options = this.constraintOptions();
        out.push({ kind: "foreign-key", start: s, end: this.last(), name, columns: [], reference, options });
      } else if (this.atColumnOption()) {
        out.push(this.columnOption(s, name));
      } else {
        if (named) this.fail("a constraint");
        return out;
      }
    }
  }

  /** Whether the word before the cursor is `BY` or `NULLS`, so that the word at it continues an option and does not begin a constraint (`GENERATED BY DEFAULT`, `UNIQUE NULLS NOT DISTINCT`). */
  private afterBy(): boolean {
    return this.kind(-1) === Tok.Word && (this.at(this.K.BY, -1) || this.at(this.K.NULLS, -1));
  }

  private atColumnOption(): boolean {
    const K = this.K;
    if (this.kind() !== Tok.Word) return false;
    if (this.at(K.AS) && this.kind(1) === Tok.LParen) return true;
    if ((this.wordIs("CHARACTER") && this.at(K.SET, 1)) || this.wordIs("CHARSET")) return true;
    if (this.at(K.NOT) && this.kind(1) === Tok.Word && this.wordIs("DEFERRABLE", 1)) return true;
    return COLUMN_OPTION_WORDS.has(this.slice().toUpperCase());
  }

  /** A column option, as text, with the expression of `AS (expr)` where it has one; it ends at a comma, a closing parenthesis or the start of a constraint. */
  private columnOption(s: number, name: Ident | undefined): ColumnOption {
    const K = this.K;
    const from = this.i;
    let expr: Expr | undefined;
    do {
      if (this.at(K.AS) && this.kind(1) === Tok.LParen && expr === undefined) {
        this.i += 2;
        expr = this.expr(0);
        this.expectKind(Tok.RParen, ")");
      } else if (this.kind() === Tok.LParen) this.skipGroup();
      else this.i++;
    } while (
      !this.atEnd() &&
      this.kind() !== Tok.Comma &&
      this.kind() !== Tok.RParen &&
      this.kind() !== Tok.Semicolon &&
      !(this.kind() === Tok.Word && CONSTRAINT_STARTS.has(this.slice().toUpperCase()) && !this.afterBy())
    );
    return { kind: "column-option", start: s, end: this.last(), name, text: this.textFrom(from) ?? "", expr };
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
    if (!unique && (this.wordIs("FUNCTION") || this.wordIs("PROCEDURE")))
      return this.routine(s, orReplace, this.wordIs("FUNCTION") ? "function" : "procedure", first);
    if (this.eat(K.TABLE)) {
      const ifNotExists = this.ifNotExists();
      const name = this.qualifiedName();
      let elements: (ColumnDef | TableConstraint)[] = [];
      if (this.kind() === Tok.LParen && !this.atQuery(1)) {
        this.i++;
        if (this.kind() !== Tok.RParen) elements = this.commaList(() => (this.at(K.LIKE) ? this.tableLike() : this.atTableIndex() ? this.tableIndex() : this.atTableConstraint() ? this.tableConstraint() : this.columnDef()));
        this.expectKind(Tok.RParen, ")");
      }
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
      const concurrently = this.wordIs("CONCURRENTLY") ? (this.i++, true) : false;
      const ifNotExists = this.ifNotExists();
      const name = this.at(K.ON) ? undefined : this.qualifiedName();
      this.expect(K.ON, "ON");
      const only = this.wordIs("ONLY") && this.kind(1) !== Tok.LParen ? (this.i++, true) : false;
      const table = this.qualifiedName();
      const method = this.eat(K.USING) ? this.ident(true).name : undefined;
      this.expectKind(Tok.LParen, "(");
      const items = this.commaList(() => this.orderItem(true));
      this.expectKind(Tok.RParen, ")");
      const from = this.i;
      while (!this.atEnd() && this.kind() !== Tok.Semicolon && !this.at(K.WHERE)) {
        if (this.kind() === Tok.LParen) this.skipGroup();
        else this.i++;
      }
      const options = this.textFrom(from);
      const where = this.eat(K.WHERE) ? this.expr(0) : undefined;
      return { kind: "create-index", start: s, end: this.last(), unique, concurrently, ifNotExists, name, only, table, items, where, method, options };
    }
    if (this.eat(K.VIEW)) {
      const name = this.qualifiedName();
      const columns = this.kind() === Tok.LParen ? this.identList() : [];
      let options: string | undefined;
      if (this.at(K.WITH) && this.kind(1) === Tok.LParen) {
        const from = this.i;
        this.i++;
        this.skipGroup();
        options = this.textFrom(from);
      }
      this.expect(K.AS, "AS");
      const query = this.query();
      let checkOption: string | undefined;
      if (this.at(K.WITH)) {
        const from = this.i;
        while (!this.atEnd() && this.kind() !== Tok.Semicolon) this.i++;
        checkOption = this.textFrom(from);
      }
      return { kind: "create-view", start: s, end: this.last(), orReplace, name, columns, options, query, checkOption };
    }
    this.i = first;
    return this.command();
  }

  private routineParam(): RoutineParam {
    const s = this.start();
    let mode: RoutineParam["mode"];
    const m = this.kind() === Tok.Word ? this.slice().toUpperCase() : "";
    if (m === "OUT" || m === "INOUT" || m === "VARIADIC" || m === "IN") {
      mode = m === "OUT" ? "out" : m === "INOUT" ? "inout" : m === "VARIADIC" ? "variadic" : "in";
      this.i++;
      if (m === "IN" && this.wordIs("OUT")) {
        mode = "inout";
        this.i++;
      }
    }
    const next = this.kind(1);
    const typeOnly =
      next === Tok.Comma ||
      next === Tok.RParen ||
      next === Tok.LParen ||
      next === Tok.LBracket ||
      next === Tok.Dot ||
      next === Tok.Eof ||
      (next === Tok.Word && (ROUTINE_CONTINUATION.has(this.slice(1).toUpperCase()) || this.at(this.K.DEFAULT, 1))) ||
      (next === Tok.Op && this.id(1) === (operatorId(this.lx, "=") ?? -1));
    const name = !typeOnly && this.canBeIdent() ? this.ident() : undefined;
    const type = this.dataType(true);
    let def: Expr | undefined;
    if (this.eat(this.K.DEFAULT) || this.atOp(operatorId(this.lx, "=") ?? -1)) {
      if (this.atOp(operatorId(this.lx, "=") ?? -1)) this.i++;
      def = this.expr(0);
    }
    return { kind: "routine-param", start: s, end: this.last(), mode, name, type, default: def };
  }

  /** The body that follows `AS`: a string, two strings (an external routine), or a block. */
  private bodyAfterAs(): RoutineBody {
    const s = this.start();
    if (this.kind() !== Tok.String) return this.blockBody();
    const raw = this.slice();
    const tag = this.id();
    const { value } = stringValue(raw, this.lx, tag);
    const start = this.starts[this.i] ?? 0;
    const end = this.ends[this.i] ?? 0;
    this.i++;
    if (this.kind() === Tok.Comma && this.kind(1) === Tok.String) {
      this.i += 2;
      return {
        kind: "routine-body",
        start: s,
        end: this.last(),
        style: "external",
        text: value,
        bodyStart: start,
        bodyEnd: end,
        exact: false,
        expr: undefined,
      };
    }
    if (tag === 0) {
      const tagLen = raw.indexOf("$", 1) + 1;
      return {
        kind: "routine-body",
        start: s,
        end: this.last(),
        style: "dollar",
        text: value,
        bodyStart: start + tagLen,
        bodyEnd: end - tagLen,
        exact: true,
        expr: undefined,
      };
    }
    const syn = this.lx.lexical.strings[tag - 1];
    const prefixLen = syn === undefined ? 0 : raw.indexOf(syn.open);
    const open = syn?.open.length ?? 1;
    const close = syn?.close.length ?? 1;
    const bodyStart = start + prefixLen + open;
    const bodyEnd = end - close;
    return {
      kind: "routine-body",
      start: s,
      end: this.last(),
      style: "string",
      text: value,
      bodyStart,
      bodyEnd,
      exact: this.text.slice(bodyStart, bodyEnd) === value,
      expr: undefined,
    };
  }

  /** `BEGIN [ATOMIC] ... END`: the body is what is between them. */
  private blockBody(): RoutineBody {
    const s = this.start();
    if (!this.wordIs("BEGIN")) this.fail("a body: AS, BEGIN or RETURN");
    this.i++;
    if (this.wordIs("ATOMIC")) this.i++;
    const bodyStart = this.ends[this.i - 1] ?? 0;
    this.scanBlocks(1, "end");
    if (!this.wordIs("END")) this.fail("END");
    const bodyEnd = this.starts[this.i] ?? 0;
    this.i++;
    return {
      kind: "routine-body",
      start: s,
      end: this.last(),
      style: "block",
      text: this.text.slice(bodyStart, bodyEnd),
      bodyStart,
      bodyEnd,
      exact: true,
      expr: undefined,
    };
  }

  /** `CREATE [OR REPLACE] FUNCTION | PROCEDURE name (parameters) ...` (0070-sql-routines FR-003, FR-004); a header that is not read is a command. */
  private routine(s: number, orReplace: boolean, object: "function" | "procedure", first: number): Statement {
    const K = this.K;
    try {
      this.i++;
      this.ifNotExists();
      const name = this.qualifiedName();
      this.expectKind(Tok.LParen, "(");
      const params = this.kind() === Tok.RParen ? [] : this.commaList(() => this.routineParam());
      this.expectKind(Tok.RParen, ")");
      let returns: DataType | undefined;
      let setof = false;
      let table: ColumnDef[] = [];
      if (this.wordIs("RETURNS")) {
        this.i++;
        if (this.wordIs("SETOF")) {
          setof = true;
          this.i++;
        }
        if (this.at(K.TABLE)) {
          this.i++;
          this.expectKind(Tok.LParen, "(");
          table = this.commaList(() => this.columnDef());
          this.expectKind(Tok.RParen, ")");
        } else returns = this.dataType(true);
      }
      let language: string | undefined;
      let body: RoutineBody | undefined;
      const options: string[] = [];
      while (!this.atEnd() && this.kind() !== Tok.Semicolon) {
        if (this.wordIs("LANGUAGE")) {
          this.i++;
          language = this.slice().toLowerCase();
          if (language.startsWith("'") && language.endsWith("'") && language.length > 1) language = language.slice(1, -1);
          this.i++;
        } else if (this.at(K.AS)) {
          this.i++;
          body = this.bodyAfterAs();
        } else if (this.wordIs("BEGIN")) body = this.blockBody();
        else if (this.wordIs("RETURN")) {
          const bs = this.start();
          this.i++;
          const e = this.expr(0);
          body = {
            kind: "routine-body",
            start: bs,
            end: this.last(),
            style: "return",
            text: this.text.slice(e.start, e.end),
            bodyStart: e.start,
            bodyEnd: e.end,
            exact: true,
            expr: e,
          };
        } else {
          const from = this.i;
          this.i++;
          while (
            !this.atEnd() &&
            this.kind() !== Tok.Semicolon &&
            !this.wordIs("LANGUAGE") &&
            !this.at(K.AS) &&
            !this.wordIs("BEGIN") &&
            !this.wordIs("RETURN")
          )
            this.i++;
          options.push(this.text.slice(this.starts[from] ?? 0, this.ends[this.i - 1] ?? 0));
        }
      }
      return {
        kind: "create-routine",
        start: s,
        end: this.last(),
        object,
        orReplace,
        name,
        params,
        returns,
        setof,
        table,
        language,
        options: options.length === 0 ? undefined : options.join(" "),
        body,
      };
    } catch (e) {
      if (!(e instanceof Failure)) throw e;
      this.i = first;
      return this.command();
    }
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
        const optFrom = this.i;
        if (this.at(K.NOT) && this.wordIs("VALID", 1)) this.i += 2;
        return { kind: "add-constraint", start: s, end: this.last(), constraint, options: this.textFrom(optFrom) };
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
        const behavior = this.eat(K.CASCADE) ? "cascade" : this.eat(K.RESTRICT) ? "restrict" : undefined;
        return { kind: "drop-constraint", start: s, end: this.last(), ifExists, name, behavior };
      }
      this.eat(K.COLUMN);
      const ifExists = this.ifExists();
      const name = this.ident();
      const behavior = this.eat(K.CASCADE) ? "cascade" : this.eat(K.RESTRICT) ? "restrict" : undefined;
      return { kind: "drop-column", start: s, end: this.last(), ifExists, name, behavior };
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
    const concurrently = this.wordIs("CONCURRENTLY") ? (this.i++, true) : false;
    const ifExists = this.ifExists();
    const names = this.commaList(() => this.qualifiedName());
    const behavior = this.eat(K.CASCADE) ? "cascade" : this.eat(K.RESTRICT) ? "restrict" : undefined;
    if (this.wordIs("FORCE") || this.wordIs("PURGE")) this.i++;
    return { kind: "drop", start: s, end: this.last(), object, ifExists, names, concurrently, behavior };
  }

  private wordIs(w: string, at = 0): boolean {
    return this.kind(at) === Tok.Word && this.slice(at).toUpperCase() === w;
  }

  /** Whether a `THEN` stands before the next `;`, from `at` tokens after the cursor. */
  private thenAhead(at: number): boolean {
    for (let j = at + 1; this.kind(j) !== Tok.Eof && this.kind(j) !== Tok.Semicolon; j++) if (this.wordIs("THEN", j)) return true;
    return false;
  }

  /** Whether the `DECLARE` at the cursor begins the declarations of a block: only declarations, each ended by `;`, come before a `BEGIN`. */
  private declaresBlock(): boolean {
    let j = 1;
    while (this.kind(j) !== Tok.Eof) {
      if (this.wordIs("BEGIN", j)) return true;
      if (this.kind(j) === Tok.Word && NOT_DECLARATIONS.has(this.slice(j).toUpperCase())) return false;
      while (this.kind(j) !== Tok.Eof && this.kind(j) !== Tok.Semicolon) j++;
      if (this.kind(j) === Tok.Semicolon) j++;
    }
    return false;
  }

  /** Whether a word stands before the next `;`, after the one at the cursor. */
  private wordAhead(w: string): boolean {
    for (let j = 1; this.kind(j) !== Tok.Eof && this.kind(j) !== Tok.Semicolon; j++) if (this.wordIs(w, j)) return true;
    return false;
  }

  /** Whether the statement that begins at the cursor is procedural: its end is found by blocks and not by the first `;` (0070-sql-routines FR-001, FR-002). */
  private proceduralStart(): boolean {
    if (this.kind() !== Tok.Word) return false;
    switch (this.slice().toUpperCase()) {
      case "BEGIN":
        return !(
          this.kind(1) === Tok.Semicolon ||
          this.kind(1) === Tok.Eof ||
          (this.kind(1) === Tok.Word && TXN_WORDS.has(this.slice(1).toUpperCase())) ||
          (this.wordIs("WITH", 1) && this.wordIs("LABEL", 2))
        );
      case "DECLARE":
        return (
          this.kind(1) !== Tok.Param &&
          !(this.kind(1) === Tok.Word && CURSOR_WORDS.has(this.slice(1).toUpperCase())) &&
          !(this.kind(2) === Tok.Word && CURSOR_WORDS.has(this.slice(2).toUpperCase())) &&
          this.declaresBlock()
        );
      case "WITH":
        return this.wordIs("FUNCTION", 1);
      case "IF":
        return this.thenAhead(0);
      case "WHILE":
      case "LOOP":
      case "FOR":
      case "REPEAT":
        return true;
      case "CREATE":
        for (let j = 1; j < 14 && this.kind(j) !== Tok.Eof && this.kind(j) !== Tok.Semicolon && this.kind(j) !== Tok.LParen; j++) {
          if (this.kind(j) !== Tok.Word) continue;
          const w = this.slice(j).toUpperCase();
          if (PROCEDURAL_OBJECTS.has(w)) return true;
          if (PLAIN_OBJECTS.has(w)) return false;
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Moves the cursor over blocks. In `semicolon` mode it stops at the first `;` outside every block (the end of a procedural statement); in `end` mode, from inside a block, at the `END` that closes it, leaving
   * the cursor on it. A block is opened by `BEGIN`, `CASE`, `LOOP`, `REPEAT`, `DECLARE` and an `IF` that begins a statement and has a `THEN`, and closed by `END`, and a word after `END` that names a kind of block opens nothing.
   */
  private scanBlocks(depth0: number, mode: "semicolon" | "end"): void {
    let depth = depth0;
    let prev = ";";
    const declared: number[] = [];
    // `CREATE PROCEDURE p IS declarations BEGIN ... END`: the declarations are part of the block that `IS` opens
    const create = mode === "semicolon" && this.wordIs("CREATE");
    while (!this.atEnd()) {
      const k = this.kind();
      if (k === Tok.Semicolon) {
        if (depth <= 0) return;
        prev = ";";
        this.i++;
        continue;
      }
      if (k === Tok.Word) {
        const w = this.slice().toUpperCase();
        if (w === "END") {
          if (mode === "end" && depth <= 1) return;
          depth--;
          this.i++;
          if (this.kind() === Tok.Word && END_QUALIFIERS.has(this.slice().toUpperCase())) this.i++;
          prev = "END";
          continue;
        }
        if (w === "DECLARE") {
          if (depth === 0) {
            depth++;
            declared.push(depth);
          }
        } else if (
          create &&
          depth === 0 &&
          w === "IS" &&
          !["NULL", "NOT", "TRUE", "FALSE", "UNKNOWN", "DISTINCT", "OF"].includes(
            this.kind(1) === Tok.Word ? this.slice(1).toUpperCase() : "",
          )
        ) {
          depth++;
          declared.push(depth);
        } else if (w === "BEGIN") {
          if (declared[declared.length - 1] === depth) declared.pop();
          else depth++;
        } else if (w === "CASE" || w === "LOOP" || w === "REPEAT") depth++;
        else if (w === "IF" && BLOCK_PREV.has(prev) && this.thenAhead(0)) depth++;
        else if (w === "WHILE" && this.wordAhead("DO")) depth++;
        prev = w;
      } else prev = k === Tok.Op ? this.slice() : "(";
      this.i++;
    }
  }

  /** Moves the cursor to the `;` that ends the statement it is in, or the end of the text. */
  private skipStatement(procedural: boolean): void {
    if (!procedural) {
      while (!this.atEnd() && this.kind() !== Tok.Semicolon) this.i++;
      return;
    }
    this.scanBlocks(0, "semicolon");
  }

  /** A statement that holds no node: its keyword, its object for `CREATE`, `ALTER` and `DROP`, and its text. */
  private command(): Statement {
    const s = this.start();
    const first = this.i;
    const keyword = this.slice().toUpperCase();
    this.i++;
    let object: string | undefined;
    if (keyword === "CREATE" || keyword === "ALTER" || keyword === "DROP") {
      let at = 0;
      while (this.kind(at) === Tok.Word && OBJECT_MODIFIERS.has(this.slice(at).toUpperCase())) at++;
      if (this.kind(at) === Tok.Word) object = this.slice(at).toUpperCase();
    }
    const from = this.i;
    this.i = first;
    const procedural = this.proceduralStart();
    this.i = from;
    if (procedural) {
      this.i = first;
      this.scanBlocks(0, "semicolon");
    } else this.skipStatement(false);
    const text = this.i > from ? this.text.slice(this.starts[from] ?? 0, this.ends[this.i - 1] ?? 0) : "";
    return { kind: "command", start: s, end: this.last(), keyword, object, text };
  }

  private statement(): Statement {
    const K = this.K;
    if (this.kind() === Tok.Word && COMMAND_WORDS.has(this.slice().toUpperCase())) return this.command();
    if (this.kind() === Tok.LParen || this.at(K.SELECT) || this.at(K.WITH) || this.at(K.VALUES) || (this.fromFirst && this.at(K.FROM))) return this.query();
    if (this.at(K.INSERT) || (this.at(K.REPLACE) && this.at(K.INTO, 1))) return this.insert();
    if (this.at(K.UPDATE)) return this.update();
    if (this.at(K.DELETE)) return this.delete();
    if (this.at(K.CREATE)) return this.create();
    if (this.at(K.ALTER)) return this.alter();
    if (this.at(K.DROP)) return this.drop();
    return this.fail("a statement");
  }

  /** Reads what the tokens hold as one expression. */
  fragmentExpression(): Expr {
    this.depth = 0;
    const e = this.expr(0);
    if (!this.atEnd()) this.fail("the end of the expression");
    return e;
  }

  /** Reads what the tokens hold as one statement, or as a `PERFORM` (a select with no `SELECT`). */
  fragmentStatement(perform: boolean): Statement {
    this.depth = 0;
    let s: Statement;
    if (perform) {
      this.skipSelect = true;
      s = this.query();
    } else s = this.statement();
    this.eatKind(Tok.Semicolon);
    if (!this.atEnd()) this.fail("the end of the statement");
    return s;
  }

  /** Reads what the tokens hold as one data type. */
  fragmentType(): DataType {
    this.depth = 0;
    const t = this.dataType();
    if (!this.atEnd()) this.fail("the end of the type");
    return t;
  }

  script(): Script {
    const statements: Statement[] = [];
    while (!this.atEnd()) {
      if (this.eatKind(Tok.Semicolon)) continue;
      const first = this.i;
      const procedural = this.proceduralStart();
      try {
        this.depth = 0;
        const statement = this.statement();
        if (!this.atEnd() && this.kind() !== Tok.Semicolon) this.fail("; or the end of the text");
        statements.push(statement);
      } catch (e) {
        if (!(e instanceof Failure)) throw e;
        this.errors.push(e.error);
        this.i = first;
        this.skipStatement(procedural);
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
