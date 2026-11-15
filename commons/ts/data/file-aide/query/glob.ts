/**
 * Globs: `*`, `**`, `?`, `[...]` and `{a,b}`, matched by the library's own matcher in time linear in the length of the path, for a pattern of
 * a given length (commons 0010-file-aide FR-025). A glob is compiled once into tokens and matched by stepping a set of states over the text,
 * so that no pattern backtracks.
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/mod.ts";

type Token =
  | { readonly kind: "char"; readonly c: string }
  | { readonly kind: "any" }
  | { readonly kind: "star" }
  | { readonly kind: "globstar" }
  | { readonly kind: "class"; readonly negated: boolean; readonly ranges: readonly (readonly [number, number])[] };

/** A compiled glob: whether a text matches it. */
export interface Glob {
  /** The glob as written. */
  readonly source: string;
  /** Whether the whole of a text matches. */
  matches(text: string): boolean;
}

/** The most alternatives `{a,b}` may expand to. */
export const MAX_ALTERNATIVES = 64;

function expand(source: string): Result<string[], string> {
  const open = source.indexOf("{");
  if (open < 0) return ok([source]);
  let depth = 0;
  let close = -1;
  const commas: number[] = [];
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      close = i;
      break;
    } else if (c === "," && depth === 1) commas.push(i);
  }
  if (close < 0) return err(`${JSON.stringify(source)} has a { with no }`);
  const cuts = [open, ...commas, close];
  const head = source.slice(0, open);
  const tail = source.slice(close + 1);
  const out: string[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const r = expand(head + source.slice((cuts[k] ?? 0) + 1, cuts[k + 1]) + tail);
    if (r.kind === "err") return r;
    out.push(...r.value);
    if (out.length > MAX_ALTERNATIVES) return err(`${JSON.stringify(source)} expands to more than ${MAX_ALTERNATIVES} alternatives`);
  }
  return ok(out);
}

function tokens(source: string): Result<Token[], string> {
  const out: Token[] = [];
  const chars = [...source];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] ?? "";
    if (c === "\\") {
      const next = chars[++i];
      if (next === undefined) return err(`${JSON.stringify(source)} ends with \\`);
      out.push({ kind: "char", c: next });
    } else if (c === "?") out.push({ kind: "any" });
    else if (c === "*") {
      if (chars[i + 1] === "*") {
        i++;
        // `**/` also matches no folder at all
        if (chars[i + 1] === "/") i++;
        out.push({ kind: "globstar" });
      } else out.push({ kind: "star" });
    } else if (c === "[") {
      let j = i + 1;
      const negated = chars[j] === "!" || chars[j] === "^";
      if (negated) j++;
      const ranges: [number, number][] = [];
      let first = true;
      for (; j < chars.length && (chars[j] !== "]" || first); j++) {
        first = false;
        let lo = chars[j] ?? "";
        if (lo === "\\") lo = chars[++j] ?? "";
        let hi = lo;
        if (chars[j + 1] === "-" && chars[j + 2] !== undefined && chars[j + 2] !== "]") {
          hi = chars[j + 2] ?? lo;
          j += 2;
        }
        ranges.push([lo.codePointAt(0) ?? 0, hi.codePointAt(0) ?? 0]);
      }
      if (chars[j] !== "]") return err(`${JSON.stringify(source)} has a [ with no ]`);
      out.push({ kind: "class", negated, ranges });
      i = j;
    } else out.push({ kind: "char", c });
  }
  return ok(out);
}

/** Every state reachable from `states` without reading a character: a `**` may match nothing. */
function close(ts: readonly Token[], states: Set<number>): Set<number> {
  const stack = [...states];
  while (stack.length > 0) {
    const s = stack.pop() ?? 0;
    const t = ts[s];
    if ((t?.kind === "star" || t?.kind === "globstar") && !states.has(s + 1)) {
      states.add(s + 1);
      stack.push(s + 1);
    }
  }
  return states;
}

function step(ts: readonly Token[], states: ReadonlySet<number>, c: string): Set<number> {
  const next = new Set<number>();
  const code = c.codePointAt(0) ?? 0;
  for (const s of states) {
    const t = ts[s];
    if (t === undefined) continue;
    switch (t.kind) {
      case "char":
        if (t.c === c) next.add(s + 1);
        break;
      case "any":
        if (c !== "/") next.add(s + 1);
        break;
      case "star":
        if (c !== "/") next.add(s);
        break;
      case "globstar":
        next.add(s);
        break;
      case "class": {
        const inside = t.ranges.some(([lo, hi]) => code >= lo && code <= hi);
        if (c !== "/" && inside !== t.negated) next.add(s + 1);
        break;
      }
    }
  }
  return close(ts, next);
}

/**
 * Compiles a glob, or says why it is not one.
 *
 * @param source - the glob
 */
export function glob(source: string): Result<Glob, string> {
  const alternatives = expand(source);
  if (alternatives.kind === "err") return alternatives;
  const compiled: Token[][] = [];
  for (const a of alternatives.value) {
    const t = tokens(a);
    if (t.kind === "err") return t;
    compiled.push(t.value);
  }
  const matches = (text: string): boolean =>
    compiled.some((ts) => {
      let states = close(ts, new Set([0]));
      for (const c of text) {
        states = step(ts, states, c);
        if (states.size === 0) return false;
      }
      return states.has(ts.length);
    });
  return ok({ source, matches });
}

/**
 * The literal folders a glob begins with, which a walk need not list above: `works/book/**\/*.pdf` begins with `works/book/`.
 *
 * @param source - the glob
 */
export function literalPrefix(source: string): string {
  const special = source.search(/[*?[{\\]/);
  const head = special < 0 ? source : source.slice(0, special);
  const cut = head.lastIndexOf("/");
  return cut < 0 ? "" : head.slice(0, cut + 1);
}
