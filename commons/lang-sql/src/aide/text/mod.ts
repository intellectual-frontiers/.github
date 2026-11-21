/**
 * Writing, templates and diagnostics (commons lang-sql 0010-aide FR-009): `transpile` reads a text in one dialect and writes it in another with the constructs the other does not read, `sql` is a tagged template that puts a parameter for each value
 * and never a value into the text, `renderDiagnostic` writes a diagnostic with its line and a caret under its span, and `highlight` says what each token of a text is, for a page that colours SQL (0010-aide FR-011).
 *
 * Spec: 0010-aide FR-009, FR-011
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { describeEmitError, type Dialect, describeParseError, type EmitError, lex, parse, placeholder, print, Tok } from "../../mod.ts";

/** What a transpile gives. */
export interface Transpiled {
  readonly text: string;
  /** The statements, from 0, that the other dialect does not read as written, with why. */
  readonly unsupported: readonly { readonly statement: number; readonly message: string }[];
}

/** A text read in one dialect and written in another; an error value where it does not read in the first. */
export function transpile(text: string, from: Dialect, to: Dialect): Result<Transpiled, readonly string[]> {
  const parsed = parse(text, from);
  if (parsed.errors.length > 0) return err(parsed.errors.map((e) => describeParseError(e)));
  const written: string[] = [];
  const unsupported: { statement: number; message: string }[] = [];
  for (const [i, s] of parsed.script.statements.entries()) {
    const out = print(s, to);
    written.push(out);
    const again = parse(out, to);
    const first = again.errors[0];
    if (first !== undefined) unsupported.push({ statement: i, message: describeParseError(first) });
  }
  return ok({ text: written.map((w) => `${w};`).join("\n"), unsupported });
}

/** A statement and the values that go with it. */
export interface Statement {
  readonly text: string;
  readonly values: readonly (string | number | boolean | null)[];
}

/** A tag for a template of a statement in a dialect: each `${value}` becomes a parameter in the dialect's style, and the value is given beside the text. */
export function sql(dialect: Dialect): (strings: TemplateStringsArray, ...values: readonly (string | number | boolean | null)[]) => Result<Statement, EmitError> {
  return (strings, ...values) => {
    let text = strings[0] ?? "";
    for (const [i, _v] of values.entries()) {
      const p = placeholder(dialect, i + 1);
      if (p.kind === "err") return p;
      text += p.value + (strings[i + 1] ?? "");
    }
    return ok({ text, values });
  };
}

/** What can be rendered. */
export interface Renderable {
  readonly start: number;
  readonly end: number;
  readonly message: string;
  readonly severity?: string;
}

/** A diagnostic with its line, the text of the line and a caret under its span. */
export function renderDiagnostic(text: string, d: Renderable): string {
  const before = text.slice(0, Math.min(d.start, text.length));
  const line = before.split("\n").length;
  const lineStart = before.lastIndexOf("\n") + 1;
  const nl = text.indexOf("\n", lineStart);
  const lineText = text.slice(lineStart, nl < 0 ? text.length : nl);
  const col = d.start - lineStart;
  const width = Math.max(1, Math.min(d.end, lineStart + lineText.length) - d.start);
  const gutter = String(line);
  const pad = " ".repeat(gutter.length);
  return [`${d.severity ?? "error"}: ${d.message}`, `${pad} --> line ${line}, column ${col + 1}`, `${gutter} | ${lineText}`, `${pad} | ${" ".repeat(col)}${"^".repeat(width)}`].join("\n");
}

export { describeEmitError };

/** What a stretch of a text is, for colouring it. */
export type SpanKind = "keyword" | "function" | "name" | "quoted-name" | "number" | "string" | "param" | "operator" | "punctuation" | "comment" | "error";

/** A stretch of a text and what it is. */
export interface Span {
  readonly start: number;
  readonly end: number;
  readonly kind: SpanKind;
}

/**
 * The stretches of a text and what each is, by the lexer of the dialect (not by a pattern, so a word is a keyword where the dialect says so, a word in a string or a comment is not one, and a dollar quote or a doubled quote is read as the dialect reads it): in
 * the order of the text, never overlapping, with the white space between them left out. A word that is not a keyword and is followed by `(` is a `function`; a keyword followed by `(` (`COUNT(`) is a `function` too, a keyword otherwise. A character the lexer cannot read is
 * an `error`. Nothing throws for any text.
 */
export function highlight(text: string, dialect: Dialect): readonly Span[] {
  const { tokens, comments, errors } = lex(text, dialect.compiled);
  const out: Span[] = [];
  for (let i = 0; i < tokens.kind.length; i++) {
    const kind = tokens.kind[i];
    const start = tokens.start[i];
    const end = tokens.end[i];
    if (kind === undefined || start === undefined || end === undefined || kind === Tok.Eof || end <= start) continue;
    const call = tokens.kind[i + 1] === Tok.LParen && tokens.start[i + 1] === end;
    let span: SpanKind;
    switch (kind) {
      case Tok.Word:
        span = call ? "function" : (tokens.id[i] ?? 0) > 0 ? "keyword" : "name";
        break;
      case Tok.QuotedIdent:
        span = "quoted-name";
        break;
      case Tok.Number:
        span = "number";
        break;
      case Tok.String:
        span = "string";
        break;
      case Tok.Param:
        span = "param";
        break;
      case Tok.Op:
        span = "operator";
        break;
      case Tok.Error:
        span = "error";
        break;
      default:
        span = "punctuation";
    }
    out.push({ start, end, kind: span });
  }
  for (let i = 0; i < comments.start.length; i++) {
    const start = comments.start[i];
    const end = comments.end[i];
    if (start !== undefined && end !== undefined && end > start) out.push({ start, end, kind: "comment" });
  }
  for (const e of errors) if (e.span.end > e.span.start && !out.some((o) => o.start < e.span.end && e.span.start < o.end)) out.push({ start: e.span.start, end: e.span.end, kind: "error" });
  return out.sort((a, b) => a.start - b.start);
}
