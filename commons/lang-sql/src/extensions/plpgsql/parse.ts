/**
 * The parser of PL/pgSQL (commons lang-sql 0006-sql-routines FR-005 to FR-008): the body of a PostgreSQL routine, read as blocks, declarations and statements, with the SQL it holds read by the core parser at its
 * place in the whole text. It works on the tokens of the body, finds where each construct ends, and hands the expressions and queries to `parseFragment`; a statement it cannot read is a node `pl-unparsed` and an
 * error value, and the statements after it are read.
 *
 * @remarks
 * Every offset is an offset of the whole text, so a node of a body and a node of the script around it are in one coordinate system, and the comments of the body are attached by the rule of the core.
 *
 * @limits
 * It does not check that a variable is declared or a label is used, and it reads `FOR ... IN cursor` loops over a cursor as unreadable.
 *
 * @example
 * ```ts
 * const p = parse("CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END $$ LANGUAGE plpgsql", postgres);
 * const r = parsePlpgsql(p, postgres, p.script.statements[0]!);
 * r.block?.statements[0]?.kind; // "pl-return"
 * ```
 *
 * Spec: 0006-sql-routines FR-005, FR-006, FR-007, FR-008
 *
 * @module
 */
import {
  allComments,
  attachTree,
  type Comment,
  type DataType,
  type Dialect,
  type Expr,
  type Ident,
  lex,
  type ParseError,
  type Parsed,
  parseExpressionRange,
  parseStatementRange,
  parseTypeRange,
  Tok,
  type TableOf,
  type Statement,
  type TokKind,
} from "../../mod.ts";
import type {
  PlAlias,
  PlBlock,
  PlCursor,
  PlDeclaration,
  PlDiagnosticsItem,
  PlElsif,
  PlHandler,
  PlRaiseOption,
  PlStatement,
  PlTree,
  PlVariable,
  PlWhen,
} from "./nodes.ts";
import { plChildren } from "./nodes.ts";

/** What `parsePlpgsql` gives. */
export interface PlParse {
  /** The body as a block, or none where it holds no block. */
  readonly block: PlBlock | undefined;
  /** What could not be read, with spans in the whole text. */
  readonly errors: readonly ParseError[];
  /** The comments of the body. */
  readonly comments: readonly Comment[];
  /** Each comment's node and placement. */
  readonly attachments: TableOf<PlTree>;
}

const SQL_STARTERS: ReadonlySet<string> = new Set(
  "SELECT INSERT UPDATE DELETE WITH MERGE VALUES CREATE ALTER DROP TRUNCATE SET SHOW GRANT REVOKE COPY LOCK NOTIFY LISTEN UNLISTEN VACUUM ANALYZE REINDEX COMMENT DO EXPLAIN PREPARE DEALLOCATE DISCARD REFRESH IMPORT SECURITY CLUSTER CHECKPOINT RESET TABLE".split(
    " ",
  ),
);
const INTO_ENDS: ReadonlySet<string> = new Set(
  "FROM WHERE GROUP HAVING ORDER LIMIT OFFSET FETCH UNION INTERSECT EXCEPT WINDOW FOR JOIN USING ON RETURNING".split(" "),
);
const LEVELS: ReadonlySet<string> = new Set("DEBUG LOG INFO NOTICE WARNING EXCEPTION".split(" "));

/** The text of a body, from where it begins to where it ends in the whole text, of a routine or a `DO` command; or none. */
export function plpgsqlBodyOf(
  parsed: Parsed,
  dialect: Dialect,
  node: Statement,
): { readonly from: number; readonly to: number } | undefined {
  if (node.kind === "create-routine") {
    const b = node.body;
    if (b === undefined || !(b.style === "dollar" || b.style === "block" || (b.style === "string" && b.exact))) return undefined;
    if (node.language !== undefined && node.language !== "plpgsql") return undefined;
    return { from: b.bodyStart, to: b.bodyEnd };
  }
  if (node.kind === "command" && node.keyword === "DO") {
    const l = lex(parsed.text, dialect.compiled, node.start, node.end);
    for (const [i, k] of l.tokens.kind.entries()) {
      if (k !== Tok.String) continue;
      const raw = parsed.text.slice(l.tokens.start[i] ?? 0, l.tokens.end[i] ?? 0);
      if (l.tokens.id[i] === 0) {
        const tag = raw.indexOf("$", 1) + 1;
        return { from: (l.tokens.start[i] ?? 0) + tag, to: (l.tokens.end[i] ?? 0) - tag };
      }
      return { from: (l.tokens.start[i] ?? 0) + 1, to: (l.tokens.end[i] ?? 0) - 1 };
    }
  }
  return undefined;
}

class Pl {
  readonly errors: ParseError[] = [];
  private i = 0;
  private readonly text: string;
  private readonly d: Dialect;
  private readonly kinds: readonly TokKind[];
  private readonly starts: readonly number[];
  private readonly ends: readonly number[];
  /** The number of tokens, the end of the text not counted. */
  private readonly n: number;

  constructor(text: string, d: Dialect, from: number, to: number) {
    this.text = text;
    this.d = d;
    const l = lex(text, d.compiled, from, to);
    this.kinds = l.tokens.kind;
    this.starts = l.tokens.start;
    this.ends = l.tokens.end;
    this.n = l.tokens.kind.length - 1;
    for (const error of l.errors) this.errors.push({ kind: "lex", error });
  }

  // ---- tokens

  private kind(j = this.i): TokKind {
    return j >= this.n ? Tok.Eof : (this.kinds[j] ?? Tok.Eof);
  }
  private tok(j: number): string {
    return this.text.slice(this.starts[j] ?? 0, this.ends[j] ?? 0);
  }
  private word(j = this.i): string {
    return this.kind(j) === Tok.Word ? this.tok(j).toUpperCase() : "";
  }
  private start(j = this.i): number {
    return this.starts[Math.min(j, this.n)] ?? 0;
  }
  private endOf(j: number): number {
    return this.ends[Math.max(0, Math.min(j, this.n - 1))] ?? 0;
  }
  private last(): number {
    return this.endOf(this.i - 1);
  }
  private eof(): boolean {
    return this.i >= this.n;
  }
  private fail(expected: string, at = this.i): void {
    const found = at >= this.n ? "the end of the body" : JSON.stringify(this.tok(at));
    this.errors.push({
      kind: "expected",
      expected,
      found,
      span: { start: this.start(at), end: at >= this.n ? this.start(at) : (this.ends[at] ?? 0) },
    });
  }

  /** The first token in `[from, to)` at no depth that `is` says is wanted: depth is counted in brackets and in `CASE ... END`. */
  private top(from: number, to: number, is: (j: number) => boolean): number {
    let depth = 0;
    let cases = 0;
    for (let j = from; j < to; j++) {
      const k = this.kind(j);
      if (k === Tok.LParen || k === Tok.LBracket) {
        if (depth === 0 && cases === 0 && is(j)) return j;
        depth++;
      } else if (k === Tok.RParen || k === Tok.RBracket) {
        if (depth === 0 && cases === 0 && is(j)) return j;
        depth--;
      } else if (k === Tok.Word && depth === 0) {
        const w = this.word(j);
        if (w === "CASE") cases++;
        else if (w === "END" && cases > 0) cases--;
        else if (cases === 0 && is(j)) return j;
      } else if (depth === 0 && cases === 0 && is(j)) return j;
    }
    return -1;
  }
  private topWord(from: number, to: number, w: string): number {
    return this.top(from, to, (j) => this.word(j) === w);
  }
  /** The `;` that ends the statement that begins at `from`, or the end. */
  private stmtEnd(from: number): number {
    const j = this.top(from, this.n, (x) => this.kind(x) === Tok.Semicolon);
    return j < 0 ? this.n : j;
  }
  /** The ranges of `[from, to)` between its top-level commas. */
  private splitTop(from: number, to: number): [number, number][] {
    const out: [number, number][] = [];
    let a = from;
    for (;;) {
      const c = this.top(a, to, (x) => this.kind(x) === Tok.Comma);
      if (c < 0) break;
      out.push([a, c]);
      a = c + 1;
    }
    if (a < to) out.push([a, to]);
    return out;
  }

  // ---- the SQL a body holds

  private ident(j: number): Ident {
    const raw = this.tok(j);
    const quoted = this.kind(j) === Tok.QuotedIdent;
    return {
      kind: "ident",
      start: this.start(j),
      end: this.ends[j] ?? 0,
      name: quoted ? raw.slice(1, -1).replaceAll('""', '"') : raw,
      quoted,
    };
  }
  private nullAt(from: number, to: number): Expr {
    return { kind: "null", start: from, end: to };
  }
  private exprChars(from: number, to: number): Expr {
    const f = parseExpressionRange(this.text, this.d, from, to);
    this.errors.push(...f.errors);
    return f.node !== undefined && f.errors.length === 0 ? f.node : this.nullAt(from, to);
  }
  /** The expression of the tokens `[a, b)`; where they are not one, an error and a `NULL` in its place. */
  private expr(a: number, b: number): Expr {
    if (b <= a) {
      this.fail("an expression", a);
      return this.nullAt(this.start(a), this.start(a));
    }
    return this.exprChars(this.start(a), this.endOf(b - 1));
  }
  private exprs(a: number, b: number): Expr[] {
    return this.splitTop(a, b).map(([x, y]) => this.expr(x, y));
  }
  private sql(
    a: number,
    b: number,
    kind: "statement" | "perform",
    skip: readonly (readonly [number, number])[] = [],
  ): Statement | undefined {
    if (b <= a) {
      this.fail("a statement", a);
      return undefined;
    }
    const f = parseStatementRange(this.text, this.d, this.start(a), this.endOf(b - 1), { perform: kind === "perform", skip });
    this.errors.push(...f.errors);
    return f.node !== undefined && f.errors.length === 0 ? f.node : undefined;
  }
  private type(a: number, b: number): DataType | undefined {
    const f = parseTypeRange(this.text, this.d, this.start(a), this.endOf(b - 1));
    this.errors.push(...f.errors);
    return f.node !== undefined && f.errors.length === 0 ? f.node : undefined;
  }

  // ---- structure

  /** Statements until a word of `stops`, left on it. */
  private statements(stops: ReadonlySet<string>): PlStatement[] {
    const out: PlStatement[] = [];
    while (!this.eof()) {
      if (this.kind() === Tok.Semicolon) {
        this.i++;
        continue;
      }
      if (stops.has(this.word())) break;
      out.push(this.statement());
    }
    return out;
  }

  private label(): Ident | undefined {
    if (
      this.kind() === Tok.Op &&
      this.tok(this.i) === "<<" &&
      this.kind(this.i + 1) === Tok.Word &&
      this.kind(this.i + 2) === Tok.Op &&
      this.tok(this.i + 2) === ">>"
    ) {
      const l = this.ident(this.i + 1);
      this.i += 3;
      return l;
    }
    return undefined;
  }

  /** `END` and what may follow it: the keyword it closes and a label; then the `;`. */
  private closing(what: string): Ident | undefined {
    let label: Ident | undefined;
    if (this.word() === "END") {
      this.i++;
      if (what !== "" && this.word() === what) this.i++;
      if ((this.kind() === Tok.Word || this.kind() === Tok.QuotedIdent) && this.kind(this.i) !== Tok.Semicolon) {
        label = this.ident(this.i);
        this.i++;
      }
    } else this.fail(`END ${what}`.trim());
    if (this.kind() === Tok.Semicolon) this.i++;
    return label;
  }

  block(): PlBlock {
    const s = this.start();
    const label = this.label();
    const declarations: PlDeclaration[] = [];
    if (this.word() === "DECLARE") {
      this.i++;
      while (!this.eof() && this.word() !== "BEGIN") declarations.push(...this.declaration());
    }
    if (this.word() === "BEGIN") this.i++;
    else this.fail("BEGIN");
    const statements = this.statements(new Set(["EXCEPTION", "END"]));
    const handlers: PlHandler[] = [];
    if (this.word() === "EXCEPTION") {
      this.i++;
      while (this.word() === "WHEN") handlers.push(this.handler());
    }
    const endLabel = this.closing("");
    return { kind: "pl-block", start: s, end: this.last(), label, declarations, statements, handlers, endLabel };
  }

  private handler(): PlHandler {
    const s = this.start();
    this.i++;
    const then = this.topWord(this.i, this.n, "THEN");
    const conditions: string[] = [];
    if (then < 0) this.fail("THEN");
    else {
      for (const [a, b] of this.splitOr(this.i, then))
        conditions.push(
          this.text
            .slice(this.start(a), this.endOf(b - 1))
            .replace(/\s+/g, " ")
            .toUpperCase(),
        );
      this.i = then + 1;
    }
    const statements = this.statements(new Set(["WHEN", "END"]));
    return { kind: "pl-handler", start: s, end: this.last(), conditions, statements };
  }
  private splitOr(from: number, to: number): [number, number][] {
    const out: [number, number][] = [];
    let a = from;
    for (let j = from; j < to; j++) {
      if (this.word(j) === "OR") {
        out.push([a, j]);
        a = j + 1;
      }
    }
    if (a < to) out.push([a, to]);
    return out;
  }

  private declaration(): PlDeclaration[] {
    if (this.kind() === Tok.Semicolon) {
      this.i++;
      return [];
    }
    const s = this.start();
    const end = this.stmtEnd(this.i);
    if (this.kind() !== Tok.Word && this.kind() !== Tok.QuotedIdent) {
      this.fail("a name");
      this.i = Math.min(end + 1, this.n);
      return [];
    }
    const name = this.ident(this.i);
    let j = this.i + 1;
    let constant = false;
    if (this.word(j) === "CONSTANT") {
      constant = true;
      j++;
    }
    let result: PlDeclaration;
    if (this.word(j) === "ALIAS") {
      const target = this.text.slice(this.start(j + 2), this.endOf(end - 1));
      result = { kind: "pl-alias", start: s, end: this.endOf(end - 1), name, target } satisfies PlAlias;
    } else if (this.top(j, end, (x) => this.word(x) === "CURSOR") >= 0 && this.top(j, end, (x) => this.word(x) === "CURSOR") - j <= 2) {
      const c = this.top(j, end, (x) => this.word(x) === "CURSOR");
      const scroll = this.word(j) === "NO" ? "no-scroll" : this.word(j) === "SCROLL" ? "scroll" : undefined;
      let k = c + 1;
      const params: string[] = [];
      if (this.kind(k) === Tok.LParen) {
        const close = this.top(k + 1, end, (x) => this.kind(x) === Tok.RParen);
        const stop = close < 0 ? end : close;
        for (const [a, b] of this.splitTop(k + 1, stop)) params.push(this.text.slice(this.start(a), this.endOf(b - 1)));
        k = stop + 1;
      }
      const f = this.top(k, end, (x) => this.word(x) === "FOR" || this.word(x) === "IS");
      const query = f < 0 ? undefined : this.sql(f + 1, end, "statement");
      result = { kind: "pl-cursor", start: s, end: this.endOf(end - 1), name, scroll, params, query } satisfies PlCursor;
    } else {
      const stop = this.top(
        j,
        end,
        (x) =>
          ["COLLATE", "DEFAULT"].includes(this.word(x)) ||
          (this.word(x) === "NOT" && this.word(x + 1) === "NULL") ||
          (this.kind(x) === Tok.Op && [":=", "="].includes(this.tok(x))),
      );
      const typeEnd = stop < 0 ? end : stop;
      const type = typeEnd > j ? this.type(j, typeEnd) : undefined;
      const notNull = this.top(j, end, (x) => this.word(x) === "NOT" && this.word(x + 1) === "NULL") >= 0;
      const dflt = this.top(j, end, (x) => this.word(x) === "DEFAULT" || (this.kind(x) === Tok.Op && [":=", "="].includes(this.tok(x))));
      const value = dflt < 0 ? undefined : this.expr(dflt + 1, end);
      result = {
        kind: "pl-variable",
        start: s,
        end: this.endOf(end - 1),
        name,
        constant,
        type,
        notNull,
        default: value,
      } satisfies PlVariable;
    }
    this.i = Math.min(end + 1, this.n);
    return [result];
  }

  // ---- statements

  statement(): PlStatement {
    const s = this.start();
    const first = this.i;
    const label = this.label();
    const w = this.word();
    {
      switch (w) {
        case "IF":
          return this.ifStatement(s);
        case "CASE":
          return this.caseStatement(s);
        case "LOOP":
          return this.loop(s, label);
        case "WHILE":
          return this.whileLoop(s, label);
        case "FOR":
          return this.forLoop(s, label);
        case "FOREACH":
          return this.foreach(s, label);
        case "BEGIN":
        case "DECLARE": {
          this.i = first;
          return this.block();
        }
        default:
          return this.simple(s, w);
      }
    }
  }

  private simple(s: number, w: string): PlStatement {
    const end = this.stmtEnd(this.i);
    const done = (): number => {
      this.i = Math.min(end + 1, this.n);
      return this.endOf(end - 1);
    };
    switch (w) {
      case "EXIT":
      case "CONTINUE": {
        this.i++;
        const when = this.topWord(this.i, end, "WHEN");
        const labelAt = this.i < end && this.word() !== "WHEN" ? this.i : -1;
        const label = labelAt >= 0 ? this.ident(labelAt) : undefined;
        const cond = when < 0 ? undefined : this.expr(when + 1, end);
        return { kind: "pl-exit", start: s, end: done(), exit: w === "EXIT" ? "exit" : "continue", label, when: cond };
      }
      case "RETURN": {
        this.i++;
        if (this.word() === "NEXT") {
          this.i++;
          const value = this.i < end ? this.expr(this.i, end) : undefined;
          return { kind: "pl-return", start: s, end: done(), mode: "next", value, query: undefined, using: [] };
        }
        if (this.word() === "QUERY") {
          this.i++;
          if (this.word() === "EXECUTE") {
            this.i++;
            const using = this.topWord(this.i, end, "USING");
            const value = this.expr(this.i, using < 0 ? end : using);
            const params = using < 0 ? [] : this.exprs(using + 1, end);
            return { kind: "pl-return", start: s, end: done(), mode: "query-execute", value, query: undefined, using: params };
          }
          const query = this.sql(this.i, end, "statement");
          return { kind: "pl-return", start: s, end: done(), mode: "query", value: undefined, query, using: [] };
        }
        const value = this.i < end ? this.expr(this.i, end) : undefined;
        return { kind: "pl-return", start: s, end: done(), mode: "return", value, query: undefined, using: [] };
      }
      case "RAISE":
        return this.raise(s, end, done);
      case "PERFORM": {
        this.i++;
        const query = this.sql(this.i, end, "perform");
        return { kind: "pl-perform", start: s, end: done(), query };
      }
      case "EXECUTE": {
        this.i++;
        const into = this.topWord(this.i, end, "INTO");
        const using = this.topWord(this.i, end, "USING");
        const cmdEnd = [into, using, end].filter((x) => x >= 0).reduce((a, b) => Math.min(a, b), end);
        const command = this.expr(this.i, cmdEnd);
        let targets: Expr[] = [];
        let strict = false;
        if (into >= 0) {
          strict = this.word(into + 1) === "STRICT";
          targets = this.exprs(into + (strict ? 2 : 1), using >= 0 && using > into ? using : end);
        }
        const params = using < 0 ? [] : this.exprs(using + 1, into > using ? into : end);
        return { kind: "pl-execute", start: s, end: done(), command, into: targets, strict, using: params };
      }
      case "OPEN":
        return this.open(s, end, done);
      case "FETCH":
      case "MOVE":
        return this.fetch(s, end, done, w === "MOVE");
      case "CLOSE": {
        const cursor = this.ident(this.i + 1);
        this.i += 2;
        return { kind: "pl-close", start: s, end: done(), cursor };
      }
      case "CALL": {
        this.i++;
        const call = this.expr(this.i, end);
        return { kind: "pl-call", start: s, end: done(), call };
      }
      case "NULL":
        this.i++;
        return { kind: "pl-null", start: s, end: done() };
      case "GET": {
        this.i++;
        let stacked = false;
        if (this.word() === "CURRENT" || this.word() === "STACKED") {
          stacked = this.word() === "STACKED";
          this.i++;
        }
        if (this.word() === "DIAGNOSTICS") this.i++;
        else this.fail("DIAGNOSTICS");
        const items: PlDiagnosticsItem[] = [];
        for (const [a, b] of this.splitTop(this.i, end)) {
          const eq = this.top(a, b, (x) => this.kind(x) === Tok.Op && [":=", "="].includes(this.tok(x)));
          if (eq < 0) {
            this.fail("target = item", a);
            continue;
          }
          items.push({
            kind: "pl-diagnostics-item",
            start: this.start(a),
            end: this.endOf(b - 1),
            target: this.expr(a, eq),
            item: this.text.slice(this.start(eq + 1), this.endOf(b - 1)).toUpperCase(),
          });
        }
        return { kind: "pl-diagnostics", start: s, end: done(), stacked, items };
      }
      case "ASSERT": {
        this.i++;
        const parts = this.splitTop(this.i, end);
        const [c, m] = parts;
        const cond = c === undefined ? this.nullAt(s, s) : this.expr(c[0], c[1]);
        const message = m === undefined ? undefined : this.expr(m[0], m[1]);
        return { kind: "pl-assert", start: s, end: done(), cond, message };
      }
      case "COMMIT":
      case "ROLLBACK": {
        this.i++;
        const chain = this.word() === "AND" && this.word(this.i + 1) === "CHAIN";
        return { kind: "pl-transaction", start: s, end: done(), action: w === "COMMIT" ? "commit" : "rollback", chain };
      }
      default:
        return this.assignOrSql(s, w, end, done);
    }
  }

  private assignOrSql(s: number, w: string, end: number, done: () => number): PlStatement {
    const op = SQL_STARTERS.has(w) ? -1 : this.top(this.i, end, (x) => this.kind(x) === Tok.Op && [":=", "="].includes(this.tok(x)));
    if (op > this.i) {
      const target = this.expr(this.i, op);
      const value = this.expr(op + 1, end);
      return { kind: "pl-assign", start: s, end: done(), target, value };
    }
    // a SQL statement: its `INTO [STRICT] targets` is taken out and kept
    const skip: [number, number][] = [];
    let into: Expr[] = [];
    let strict = false;
    let at = -1;
    if (w === "SELECT" || w === "WITH") at = this.topWord(this.i, end, "INTO");
    else if (w === "INSERT" || w === "UPDATE" || w === "DELETE") {
      const r = this.topWord(this.i, end, "RETURNING");
      if (r >= 0) at = this.topWord(r + 1, end, "INTO");
    }
    if (at >= 0) {
      strict = this.word(at + 1) === "STRICT";
      const from = at + (strict ? 2 : 1);
      let to: number;
      if (w === "SELECT" && at <= this.i + 2) {
        // `SELECT INTO target select_list FROM ...`: the targets are names, and the select list follows them
        to = from;
        for (;;) {
          while (
            this.kind(to) === Tok.Word ||
            this.kind(to) === Tok.QuotedIdent ||
            this.kind(to) === Tok.Dot ||
            this.kind(to) === Tok.Param
          ) {
            if (this.kind(to) === Tok.Word && to > from && this.kind(to - 1) !== Tok.Dot && this.kind(to - 1) !== Tok.Comma) break;
            to++;
          }
          if (this.kind(to) === Tok.Comma) to++;
          else break;
        }
      } else {
        const stop = this.top(from, end, (x) => INTO_ENDS.has(this.word(x)));
        to = stop < 0 ? end : stop;
      }
      into = this.exprs(from, to);
      skip.push([this.start(at), this.endOf(to - 1)]);
    }
    const first = this.i;
    const statement = this.sql(first, end, "statement", skip);
    if (statement === undefined) {
      const stop = done();
      return { kind: "pl-unparsed", start: s, end: stop };
    }
    return { kind: "pl-sql", start: s, end: done(), statement, into, strict };
  }

  private raise(s: number, end: number, done: () => number): PlStatement {
    this.i++;
    let level: string | undefined;
    if (LEVELS.has(this.word())) {
      level = this.word();
      this.i++;
    }
    const using = this.topWord(this.i, end, "USING");
    const headEnd = using < 0 ? end : using;
    let condition: string | undefined;
    let message: Expr | undefined;
    let params: Expr[] = [];
    if (this.i < headEnd) {
      if (this.kind() === Tok.String) {
        const parts = this.splitTop(this.i, headEnd);
        const [m, ...rest] = parts;
        if (m !== undefined) message = this.expr(m[0], m[1]);
        params = rest.map(([a, b]) => this.expr(a, b));
      } else
        condition = this.text
          .slice(this.start(this.i), this.endOf(headEnd - 1))
          .replace(/\s+/g, " ")
          .toUpperCase();
    }
    const options: PlRaiseOption[] = [];
    if (using >= 0) {
      for (const [a, b] of this.splitTop(using + 1, end)) {
        const eq = this.top(a, b, (x) => this.kind(x) === Tok.Op && [":=", "="].includes(this.tok(x)));
        if (eq < 0) {
          this.fail("option = value", a);
          continue;
        }
        options.push({
          kind: "pl-raise-option",
          start: this.start(a),
          end: this.endOf(b - 1),
          name: this.tok(a).toUpperCase(),
          value: this.expr(eq + 1, b),
        });
      }
    }
    return { kind: "pl-raise", start: s, end: done(), level, condition, message, params, options };
  }

  private open(s: number, end: number, done: () => number): PlStatement {
    this.i++;
    const cursor = this.ident(this.i);
    this.i++;
    while (["NO", "SCROLL"].includes(this.word())) this.i++;
    let query: Statement | undefined;
    let dynamic: Expr | undefined;
    let args: Expr[] = [];
    let using: Expr[] = [];
    if (this.word() === "FOR") {
      this.i++;
      if (this.word() === "EXECUTE") {
        this.i++;
        const u = this.topWord(this.i, end, "USING");
        dynamic = this.expr(this.i, u < 0 ? end : u);
        using = u < 0 ? [] : this.exprs(u + 1, end);
      } else query = this.sql(this.i, end, "statement");
    } else if (this.kind() === Tok.LParen) {
      const close = this.top(this.i + 1, end, (x) => this.kind(x) === Tok.RParen);
      args = this.splitTop(this.i + 1, close < 0 ? end : close).map(([a, b]) => {
        const named =
          (this.kind(a) === Tok.Word || this.kind(a) === Tok.QuotedIdent) &&
          this.kind(a + 1) === Tok.Op &&
          [":=", "=>"].includes(this.tok(a + 1));
        return this.expr(named ? a + 2 : a, b);
      });
    }
    return { kind: "pl-open", start: s, end: done(), cursor, query, dynamic, args, using };
  }

  private fetch(s: number, end: number, done: () => number, move: boolean): PlStatement {
    this.i++;
    const into = this.topWord(this.i, end, "INTO");
    const coreEnd = into < 0 ? end : into;
    const f = this.top(this.i, coreEnd, (x) => this.word(x) === "FROM" || this.word(x) === "IN");
    let direction: string | undefined;
    let cursorAt = coreEnd - 1;
    if (f >= 0) {
      direction =
        f > this.i
          ? this.text
              .slice(this.start(this.i), this.endOf(f - 1))
              .replace(/\s+/g, " ")
              .toUpperCase()
          : undefined;
      cursorAt = f + 1;
    }
    const cursor = this.ident(Math.min(cursorAt, this.n - 1));
    const targets = into < 0 ? [] : this.exprs(into + 1, end);
    return { kind: "pl-fetch", start: s, end: done(), move, direction, cursor, into: targets };
  }

  // ---- compound statements

  private ifStatement(s: number): PlStatement {
    this.i++;
    const then = this.topWord(this.i, this.n, "THEN");
    const cond = then < 0 ? this.nullAt(this.start(), this.start()) : this.expr(this.i, then);
    if (then < 0) this.fail("THEN");
    else this.i = then + 1;
    const stops = new Set(["ELSIF", "ELSEIF", "ELSE", "END"]);
    const thenBody = this.statements(stops);
    const elsifs: PlElsif[] = [];
    while (this.word() === "ELSIF" || this.word() === "ELSEIF") {
      const es = this.start();
      this.i++;
      const t = this.topWord(this.i, this.n, "THEN");
      const c = t < 0 ? this.nullAt(this.start(), this.start()) : this.expr(this.i, t);
      if (t < 0) this.fail("THEN");
      else this.i = t + 1;
      const body = this.statements(stops);
      elsifs.push({ kind: "pl-elsif", start: es, end: this.last(), cond: c, body });
    }
    let otherwise: PlStatement[] | undefined;
    if (this.word() === "ELSE") {
      this.i++;
      otherwise = this.statements(new Set(["END"]));
    }
    this.closing("IF");
    return { kind: "pl-if", start: s, end: this.last(), cond, then: thenBody, elsifs, otherwise };
  }

  private caseStatement(s: number): PlStatement {
    this.i++;
    let operand: Expr | undefined;
    if (this.word() !== "WHEN") {
      const w = this.topWord(this.i, this.n, "WHEN");
      if (w < 0) this.fail("WHEN");
      else {
        operand = this.expr(this.i, w);
        this.i = w;
      }
    }
    const whens: PlWhen[] = [];
    const stops = new Set(["WHEN", "ELSE", "END"]);
    while (this.word() === "WHEN") {
      const ws = this.start();
      this.i++;
      const t = this.topWord(this.i, this.n, "THEN");
      const conds = t < 0 ? [] : this.exprs(this.i, t);
      if (t < 0) this.fail("THEN");
      else this.i = t + 1;
      const body = this.statements(stops);
      whens.push({ kind: "pl-when", start: ws, end: this.last(), conds, body });
    }
    let otherwise: PlStatement[] | undefined;
    if (this.word() === "ELSE") {
      this.i++;
      otherwise = this.statements(new Set(["END"]));
    }
    this.closing("CASE");
    return { kind: "pl-case", start: s, end: this.last(), operand, whens, otherwise };
  }

  private loopBody(): PlStatement[] {
    const body = this.statements(new Set(["END"]));
    this.closing("LOOP");
    return body;
  }

  private loop(s: number, label: Ident | undefined): PlStatement {
    this.i++;
    const body = this.loopBody();
    return { kind: "pl-loop", start: s, end: this.last(), label, body };
  }

  private whileLoop(s: number, label: Ident | undefined): PlStatement {
    this.i++;
    const l = this.topWord(this.i, this.n, "LOOP");
    const cond = l < 0 ? this.nullAt(this.start(), this.start()) : this.expr(this.i, l);
    if (l < 0) this.fail("LOOP");
    else this.i = l + 1;
    const body = this.loopBody();
    return { kind: "pl-while", start: s, end: this.last(), label, cond, body };
  }

  private forLoop(s: number, label: Ident | undefined): PlStatement {
    this.i++;
    const inAt = this.topWord(this.i, this.n, "IN");
    const loopAt = this.topWord(this.i, this.n, "LOOP");
    if (inAt < 0 || loopAt < 0) {
      this.fail("IN and LOOP");
      const stop = this.stmtEnd(this.i);
      this.i = Math.min(stop + 1, this.n);
      return { kind: "pl-unparsed", start: s, end: this.endOf(stop - 1) };
    }
    const variables = this.splitTop(this.i, inAt).map(([a]) => this.ident(a));
    let j = inAt + 1;
    const reverse = this.word(j) === "REVERSE";
    if (reverse) j++;
    const dots = this.top(
      j,
      loopAt,
      (x) =>
        this.kind(x) === Tok.Dot &&
        this.starts[x + 1] === this.ends[x] &&
        (this.kind(x + 1) === Tok.Dot || (this.kind(x + 1) === Tok.Number && this.tok(x + 1).startsWith("."))),
    );
    this.i = loopAt + 1;
    const variable = variables[0] ?? this.ident(Math.max(0, inAt - 1));
    if (dots >= 0) {
      const by = this.topWord(dots + 1, loopAt, "BY");
      const from = this.expr(j, dots);
      const toEnd = by < 0 ? this.endOf(loopAt - 1) : this.endOf(by - 1);
      const to = this.exprChars((this.ends[dots] ?? 0) + 1, toEnd);
      const step = by < 0 ? undefined : this.expr(by + 1, loopAt);
      const body = this.loopBody();
      return { kind: "pl-for-range", start: s, end: this.last(), label, variable, reverse, from, to, by: step, body };
    }
    let query: Statement | undefined;
    let dynamic: Expr | undefined;
    let cursor: Expr | undefined;
    let using: Expr[] = [];
    if (this.word(j) === "EXECUTE") {
      const u = this.topWord(j + 1, loopAt, "USING");
      dynamic = this.expr(j + 1, u < 0 ? loopAt : u);
      using = u < 0 ? [] : this.exprs(u + 1, loopAt);
    } else if (["SELECT", "WITH", "VALUES", "TABLE"].includes(this.word(j)) || this.kind(j) === Tok.LParen)
      query = this.sql(j, loopAt, "statement");
    else cursor = this.expr(j, loopAt);
    const body = this.loopBody();
    return { kind: "pl-for-query", start: s, end: this.last(), label, variables, query, dynamic, cursor, using, body };
  }

  private foreach(s: number, label: Ident | undefined): PlStatement {
    this.i++;
    const inAt = this.topWord(this.i, this.n, "IN");
    const loopAt = this.topWord(this.i, this.n, "LOOP");
    if (inAt < 0 || loopAt < 0) {
      this.fail("IN ARRAY and LOOP");
      const stop = this.stmtEnd(this.i);
      this.i = Math.min(stop + 1, this.n);
      return { kind: "pl-unparsed", start: s, end: this.endOf(stop - 1) };
    }
    const sliceAt = this.topWord(this.i, inAt, "SLICE");
    const variables = this.exprs(this.i, sliceAt < 0 ? inAt : sliceAt);
    const slice = sliceAt < 0 ? undefined : this.tok(sliceAt + 1);
    const arrayFrom = this.word(inAt + 1) === "ARRAY" ? inAt + 2 : inAt + 1;
    const array = this.expr(arrayFrom, loopAt);
    this.i = loopAt + 1;
    const body = this.loopBody();
    return { kind: "pl-foreach", start: s, end: this.last(), label, variables, slice, array, body };
  }

  atBlock(): boolean {
    // `#option value` lines before the block
    while (this.kind() === Tok.Semicolon || (this.kind() === Tok.Op && this.tok(this.i) === "#" && this.kind(this.i + 1) === Tok.Word))
      this.i += this.kind() === Tok.Semicolon ? 1 : 3;
    const save = this.i;
    this.label();
    const w = this.word();
    this.i = save;
    return w === "DECLARE" || w === "BEGIN";
  }
  skipSemicolons(): void {
    while (this.kind() === Tok.Semicolon) this.i++;
  }
  restIsEmpty(): boolean {
    this.skipSemicolons();
    return this.eof();
  }
  startOfBody(): number {
    return this.start();
  }
}

/**
 * Reads a range of a text as the body of a PL/pgSQL routine.
 *
 * @param text - the whole text
 * @param dialect - how it is written (PostgreSQL's)
 * @param from - where the body begins
 * @param to - where it ends
 * @returns its block, errors, comments and their attachment; it does not throw
 */
export function parsePlpgsqlRange(text: string, dialect: Dialect, from: number, to: number): PlParse {
  const pl = new Pl(text, dialect, from, to);
  let block: PlBlock | undefined;
  if (pl.atBlock()) {
    const b = pl.block();
    block = { ...b, start: from, end: to };
    if (!pl.restIsEmpty())
      pl.errors.push({ kind: "expected", expected: "the end of the body", found: "more text", span: { start: pl.startOfBody(), end: to } });
  } else
    pl.errors.push({
      kind: "expected",
      expected: "BEGIN or DECLARE",
      found: "something else",
      span: { start: from, end: Math.min(to, from + 1) },
    });
  const lexed = lex(text, dialect.compiled, from, to);
  const comments = allComments(lexed.comments, text);
  const attachments = block === undefined ? { all: [], byNode: new Map() } : attachTree<PlTree>(block, comments, plChildren);
  return { block, errors: pl.errors, comments, attachments };
}

/**
 * Reads the body of a routine or of a `DO` command of a parse as PL/pgSQL.
 *
 * @param parsed - what `parse` gave
 * @param dialect - how it was written
 * @param node - a `create-routine` or a `DO` command of its script
 * @returns the body, or none where the statement has no body that can be read as PL/pgSQL
 */
export function parsePlpgsql(parsed: Parsed, dialect: Dialect, node: Statement): PlParse | undefined {
  const range = plpgsqlBodyOf(parsed, dialect, node);
  return range === undefined ? undefined : parsePlpgsqlRange(parsed.text, dialect, range.from, range.to);
}
