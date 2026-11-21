// Spec: 0003-anyfs-cli-logical FR-007
/**
 * The text search of `grep`, and the name and size tests of `find` (commons anyfs-cli 0003-anyfs-cli-logical FR-007): a literal text, never a pattern a caller wrote (so a search cannot be made to run for ever), with a
 * case option; a wildcard of `*` and `?` for names; and a size test written as `+N`, `-N` or `N` with the units K, M and G. Pure functions over text and numbers.
 *
 * @example
 * ```ts
 * import { matchingLines, wildcard } from "./grep.ts";
 * matchingLines("a\nHello\n", "hello", true); // [{ line: 2, text: "Hello" }]
 * wildcard("*.ts", "a.ts"); // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** A line that holds the text. */
export type Hit = { readonly line: number; readonly text: string };

/** Whether bytes look like text: no NUL in the first 8 KiB. */
export function looksLikeText(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8192);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return false;
  return true;
}

/** The lines of a text that hold `needle`, with their numbers from 1. */
export function matchingLines(text: string, needle: string, ignoreCase: boolean): readonly Hit[] {
  const wanted = ignoreCase ? needle.toLowerCase() : needle;
  const hits: Hit[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if ((ignoreCase ? line.toLowerCase() : line).includes(wanted)) hits.push({ line: i + 1, text: line });
  });
  return hits;
}

/** Whether a name matches a wildcard: `*` is any run of characters but a slash, `?` is one. */
export function wildcard(pattern: string, name: string): boolean {
  let p = 0;
  let n = 0;
  let star = -1;
  let mark = 0;
  while (n < name.length) {
    const pc = pattern.charAt(p);
    if (p < pattern.length && (pc === "?" || pc === name.charAt(n)) && pc !== "*") {
      p++;
      n++;
    } else if (p < pattern.length && pc === "*") {
      star = p++;
      mark = n;
    } else if (star >= 0) {
      p = star + 1;
      n = ++mark;
    } else return false;
  }
  while (pattern.charAt(p) === "*") p++;
  return p === pattern.length;
}

/** A test of a size in bytes. */
export type SizeTest = { readonly kind: "over" | "under" | "equal"; readonly bytes: number };

/** A size test from text: `+10K` is over ten KiB, `-1M` under a MiB, `512` exactly that many bytes. */
export function parseSizeTest(text: string): Result<SizeTest, string> {
  const m = /^([+-]?)([0-9]+)([KMG]?)$/.exec(text);
  if (m === null) return err(`${JSON.stringify(text)} is not a size test: +N, -N or N, with K, M or G after it`);
  const unit = m[3] === "K" ? 1024 : m[3] === "M" ? 1024 ** 2 : m[3] === "G" ? 1024 ** 3 : 1;
  const bytes = Number(m[2]) * unit;
  if (!Number.isSafeInteger(bytes)) return err(`${text} is too large`);
  return ok({ kind: m[1] === "+" ? "over" : m[1] === "-" ? "under" : "equal", bytes });
}

/** Whether a size passes a test. */
export function sizePasses(test: SizeTest, size: number): boolean {
  return test.kind === "over" ? size > test.bytes : test.kind === "under" ? size < test.bytes : size === test.bytes;
}
