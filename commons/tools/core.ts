/**
 * What the commons tools share: errors as values, nominal types, the exhaustiveness check, and the few rules of text the tools keep so that what they read and
 * write is what the Python tools they replaced read and wrote (universal newlines, `str.splitlines`, ordering by code point). Nothing here imports anything:
 * the tools run on Bun or on Node 26 from any checkout, with the built-ins of `node:` alone.
 *
 * @module
 */
import { readFileSync, statSync } from "node:fs";
import process from "node:process";

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** A nominal type: a string that has been checked to be what its brand says. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** The exhaustiveness check of a switch over a union (`default: return absurd(x)`): a case left out is a type error here. */
export function absurd(x: never): never {
  throw new Error(`unhandled case: ${JSON.stringify(x)}`);
}

/** Two strings in the order of their code points, as Python orders `str` (JavaScript's `<` orders UTF-16 units, which differs above U+FFFF). */
export function compareText(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a.charCodeAt(i),
      y = b.charCodeAt(i);
    if (x !== y) return unit(x) - unit(y);
  }
  return a.length - b.length;
}
const unit = (c: number): number => (c >= 0xd800 && c <= 0xdfff ? c + 0x2000 : c >= 0xe000 ? c - 0x800 : c);

/** A copy of `xs` sorted by `key`, ties kept in their order (Python's `sorted` is stable too). */
export function sortedBy<T>(xs: Iterable<T>, cmp: (a: T, b: T) => number): T[] {
  return [...xs].sort(cmp);
}

/** Sorted strings, by code point. */
export function sortedText(xs: Iterable<string>): string[] {
  return sortedBy(xs, compareText);
}

/** A file's text as Python's `Path.read_text()` gives it: UTF-8, with `\r\n` and `\r` read as `\n`. */
export function readText(path: string): string {
  return universalNewlines(new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path)));
}
export const universalNewlines = (text: string): string => text.replace(/\r\n?/g, "\n");

/** Python's line boundaries, control characters among them, written as text so that the one expression says what it means. */
const BREAKS = "\\n\\r\\v\\f\\x1c\\x1d\\x1e\\x85\\u2028\\u2029";
const LINE_BOUNDARY = new RegExp(`\\r\\n|[${BREAKS}]`);

/** The lines of a text as Python's `str.splitlines() gives them: every line boundary Python knows, and no empty line after the last one. */
export function splitLines(text: string): string[] {
  const out = text.split(LINE_BOUNDARY);
  if (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

/** The first `n` characters (code points, as Python slices a `str`). */
export const firstChars = (text: string, n: number): string => Array.from(text).slice(0, n).join("");

/** Whether there is a file (or, with `dir`, a folder) at `path`, following links, as Python's `is_file()` and `is_dir()` do. */
export function isKind(path: string, kind: "file" | "dir"): boolean {
  try {
    const s = statSync(path);
    return kind === "file" ? s.isFile() : s.isDirectory();
  } catch {
    return false;
  }
}

/** The local path of a `file:` URL (`import.meta.url`), on POSIX and on Windows. */
export function pathOfUrl(url: URL): string {
  const p = decodeURIComponent(url.pathname);
  return /^\/[A-Za-z]:\//.test(p) ? p.slice(1) : p;
}

/** Writes all of `text` to standard output or standard error (the stream finishes what it holds before the process ends, as the tools set the exit status rather than exit). */
export function writeAll(to: "stdout" | "stderr", text: string): void {
  if (text !== "") process[to].write(text);
}

/**
 * The one cast of the tools: a string that has just been checked becomes the nominal type its check names. It is called only where a value is decoded (the Turtle
 * reader's IRIs, the ontology's identifiers and checksums), and the test of the tools' typing holds that no other file casts.
 */
export function brand<B extends string>(checked: string): Brand<string, B> {
  return checked as Brand<string, B>;
}

/** Whether `s` is one of the words of `xs` (a guard, so a word read from a file becomes the union it belongs to). */
export function isOneOf<T extends string>(xs: readonly T[], s: string): s is T {
  return xs.some((x) => x === s);
}

/** The characters Python's `str.isspace()` holds to be white space (`\s` of a Python `str` pattern), as the inside of a character class. */
export const PY_SPACE = "\\t-\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
