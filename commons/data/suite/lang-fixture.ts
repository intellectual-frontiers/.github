/**
 * What the tests of the SQL language core share (commons data 0065-sql-lang): the dialects under test, the check that a lexed text can be put back from its parts, and the corpus.
 *
 * Spec: 0065-sql-lang FR-004
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ansi, type Dialect, kindAt, type Lexed, lex, Tok, tokenCount, textAt } from "@intellectual-frontiers/data/sql/lang";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/lang/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/lang/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/lang/dialects/sqlite";

/** The dialects of this folder. */
export const DIALECTS: readonly Dialect[] = [ansi, sqlite, postgres, duckdb];

/** The corpus of the benchmark and of the tests. */
export const CORPUS: string = readFileSync(fileURLToPath(new URL("./lang-corpus.sql", import.meta.url)), "utf8");

const SPACE = /^[\s﻿]*$/;

/** What is wrong with how a lexed text is cut into parts, or nothing: every character is in one token, one comment or white space, in order. */
export function wholeness(l: Lexed): string | undefined {
  const parts: { start: number; end: number; what: string }[] = [];
  const t = l.tokens;
  for (let i = 0; i < tokenCount(t); i++) {
    if (kindAt(t, i) === Tok.Eof) continue;
    parts.push({ start: t.start[i] ?? 0, end: t.end[i] ?? 0, what: `token ${i}` });
  }
  for (let i = 0; i < l.comments.start.length; i++)
    parts.push({ start: l.comments.start[i] ?? 0, end: l.comments.end[i] ?? 0, what: `comment ${i}` });
  parts.sort((a, b) => a.start - b.start);
  let at = 0;
  for (const p of parts) {
    if (p.end <= p.start) return `${p.what} is empty`;
    if (p.start < at) return `${p.what} overlaps what precedes it`;
    if (!SPACE.test(l.text.slice(at, p.start))) return `text between ${at} and ${p.start} is not white space`;
    at = p.end;
  }
  if (!SPACE.test(l.text.slice(at))) return `text after ${at} is not white space`;
  const last = tokenCount(t) - 1;
  if (kindAt(t, last) !== Tok.Eof) return "the last token is not the end of the text";
  return undefined;
}

/** The kinds of the tokens of a text, with the end of the text left out. */
export function kindsOf(d: Dialect, text: string): readonly number[] {
  const l = lex(text, d.compiled);
  return l.tokens.kind.slice(0, -1);
}

/** The texts of the tokens of a text, with the end of the text left out. */
export function textsOf(d: Dialect, text: string): readonly string[] {
  const l = lex(text, d.compiled);
  const out: string[] = [];
  for (let i = 0; i < tokenCount(l.tokens) - 1; i++) out.push(textAt(l.tokens, text, i));
  return out;
}
