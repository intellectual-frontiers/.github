/**
 * Path globs as regular expressions, on `/` paths, with the meaning `@std/path`'s `globToRegExp` gives them (commons
 * 0005-typescript-runtime FR-058); `fs.expandGlob` walks a folder with what this gives.
 *
 * The API, which `fs.expandGlob` builds on and which stays as it is:
 * - `globToRegExp(glob, { extended?, globstar?, caseInsensitive? })`: the glob as a `RegExp` anchored at both ends, or why it is refused.
 * - `matchGlob(glob, path, options?)`: whether the path matches, or why the glob is refused.
 * - `isGlob(text)`: whether the text holds anything a glob gives a meaning to (else it names one path).
 * - `globRoot(glob)`: the leading folders (every segment but the last) with no glob character, where a walk starts (`.` if none).
 *
 * The syntax, one segment (between `/`) at a time:
 * - `*` any characters but `/`; `?` one character but `/` (where `@std/path` lets `?` and `[!a]` match a `/`, these do not);
 * - `**` alone in its segment (with `globstar`, the default): any number of segments, none included, so `src/**\/*.ts` matches
 *   `src/a.ts` and `src/a/b/c.ts`; elsewhere it is `*`;
 * - `[abc]`, `[a-z]`, `[!abc]` (not one of, nor `/`), `[[:alpha:]]` and the other POSIX classes; `[^a]` is `^` or `a`, as in `@std/path`;
 * - `{a,b}` either alternative (always on);
 * - with `extended` (the default): `?(a|b)` at most one, `*(a|b)` any number, `+(a|b)` at least one, `@(a|b)` exactly one, `!(a|b)` none;
 * - `\` takes the next character as it is.
 *
 * A segment with an unclosed `[`, `{` or `(`, or ending in `\`, is taken as it is written. Separators run together (`a//b` is `a/b`), a
 * trailing one is optional, and the empty glob matches nothing. A glob that begins with `!` not followed by `(` is refused: it reads as
 * the negation of a gitignore or a shell, which a regular expression of the path cannot mean.
 *
 * @example
 * ```ts
 * import { globToRegExp, matchGlob } from "./glob.ts";
 * matchGlob("src/**\/*.ts", "src/a/b/c.ts"); // { kind: "ok", value: true }
 * matchGlob("src/**\/*.ts", "srcx/a.ts"); // { kind: "ok", value: false }
 * globToRegExp("!x"); // { kind: "err", error: { kind: "negated", glob: "!x" } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** How a glob is read: `extended` (extglob groups, default true), `globstar` (`**` across segments, default true), `caseInsensitive`. */
export type GlobOptions = {
  readonly extended?: boolean;
  readonly globstar?: boolean;
  readonly caseInsensitive?: boolean;
};

/** Why a glob is refused: it begins with a `!` that negates nothing a path expression can say. */
export type GlobError = { readonly kind: "negated"; readonly glob: string };

/** A refused glob as one sentence. */
export function formatGlobError(e: GlobError): string {
  return `the glob ${JSON.stringify(e.glob)} begins with "!", a negation a path glob cannot mean; escape it as "\\!" to match a "!"`;
}

const SEP = "/+";
const SEP_MAYBE = "/*";
const WILDCARD = "[^/]*";
const GLOBSTAR = "(?:[^/]*(?:/|$)+)*";
const ESCAPE_OUTSIDE = new Set(["!", "$", "(", ")", "*", "+", ".", "=", "?", "[", "\\", "^", "{", "|"]);
const ESCAPE_INSIDE = new Set(["-", "\\", "]"]);
const CLASSES: ReadonlyMap<string, string> = new Map([
  ["alnum", "\\dA-Za-z"],
  ["alpha", "A-Za-z"],
  ["ascii", "\\x00-\\x7F"],
  ["blank", "\\t "],
  ["cntrl", "\\x00-\\x1F\\x7F"],
  ["digit", "\\d"],
  ["graph", "\\x21-\\x7E"],
  ["lower", "a-z"],
  ["print", "\\x20-\\x7E"],
  ["punct", "!-\\/:-@\\[-`{-~"],
  ["space", "\\s\\v"],
  ["upper", "A-Z"],
  ["word", "\\w"],
  ["xdigit", "\\dA-Fa-f"],
]);

const literal = (c: string): string => (ESCAPE_OUTSIDE.has(c) ? `\\${c}` : c);

type Group = "brace" | "?" | "*" | "+" | "@" | "!";

/** One segment of a glob (no `/` in it) as a regular expression, and whether it is a globstar; undefined where it does not close. */
function segment(text: string, extended: boolean, globstar: boolean): { readonly source: string; readonly star: boolean } | undefined {
  let out = "";
  const groups: Group[] = [];
  let inClass = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? "";
    const next = text[i + 1];
    if (c === "\\") {
      const e = text[i + 1];
      if (e === undefined) return undefined;
      i++;
      out += inClass ? (ESCAPE_INSIDE.has(e) ? `\\${e}` : e) : literal(e);
      continue;
    }
    if (inClass) {
      if (c === "]") {
        inClass = false;
        out += "]";
      } else if (c === "[" && next === ":") {
        const end = text.indexOf(":]", i + 2);
        const cls = end < 0 ? undefined : CLASSES.get(text.slice(i + 2, end));
        if (end >= 0 && cls !== undefined) {
          out += cls;
          i = end + 1;
        } else out += "\\[";
      } else out += c === "\\" || c === "^" ? `\\${c}` : c;
      continue;
    }
    const top = groups[groups.length - 1];
    if (c === "[") {
      inClass = true;
      out += "[";
      if (next === "!") {
        out += "^/";
        i++;
      } else if (next === "^") {
        out += "\\^";
        i++;
      }
    } else if (extended && next === "(" && (c === "?" || c === "*" || c === "+" || c === "@" || c === "!")) {
      groups.push(c);
      out += c === "!" ? "(?!" : "(?:";
      i++;
    } else if (c === ")" && top !== undefined && top !== "brace") {
      groups.pop();
      out += top === "!" ? `)${WILDCARD}` : top === "@" ? ")" : `)${top}`;
    } else if (c === "|" && top !== undefined && top !== "brace") out += "|";
    else if (c === "{") {
      groups.push("brace");
      out += "(?:";
    } else if (c === "}" && top === "brace") {
      groups.pop();
      out += ")";
    } else if (c === "," && top === "brace") out += "|";
    else if (c === "?") out += "[^/]";
    else if (c === "*") {
      let stars = 1;
      while (text[i + 1] === "*") {
        i++;
        stars++;
      }
      if (globstar && stars === 2 && text.length === 2) return { source: GLOBSTAR, star: true };
      out += WILDCARD;
    } else out += literal(c);
  }
  return groups.length > 0 || inClass ? undefined : { source: out, star: false };
}

/**
 * The glob as a regular expression of a whole `/` path, as `@std/path`'s `globToRegExp` makes it (see the module's documentation for the
 * syntax); refused where it begins with a `!` that is not an extglob `!(...)`.
 */
export function globToRegExp(glob: string, options: GlobOptions = {}): Result<RegExp, GlobError> {
  const extended = options.extended ?? true;
  const globstar = options.globstar ?? true;
  if (glob.startsWith("!") && !(extended && glob[1] === "(")) return err({ kind: "negated", glob });
  if (glob === "") return ok(/(?!)/);
  const leading = glob.startsWith("/");
  const body = glob.replace(/^\/+/, "").replace(/\/+$/, "");
  let source = leading ? SEP : "";
  const parts = body === "" ? [] : body.split(/\/+/);
  parts.forEach((part, n) => {
    const s = segment(part, extended, globstar);
    if (s?.star === true) {
      source += s.source;
      return;
    }
    source += s === undefined ? [...part].map(literal).join("") : s.source;
    source += n < parts.length - 1 ? SEP : SEP_MAYBE;
  });
  return ok(new RegExp(`^${source}$`, options.caseInsensitive === true ? "i" : ""));
}

/** Whether the `/` path matches the glob (see `globToRegExp`), or why the glob is refused. */
export function matchGlob(glob: string, path: string, options: GlobOptions = {}): Result<boolean, GlobError> {
  const re = globToRegExp(glob, options);
  return re.kind === "err" ? re : ok(re.value.test(path));
}

/**
 * Whether the text holds anything a glob gives a meaning to, not escaped: `*`, `?`, a closed `[...]` or `{...}`, an extglob group, or a
 * leading `!`. Text that is not a glob names one path, which a caller can take as it is.
 */
export function isGlob(text: string): boolean {
  if (text.startsWith("!")) return true;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") i++;
    else if (c === "*" || c === "?") return true;
    else if (c === "[" && text.indexOf("]", i + 2) > 0) return true;
    else if (c === "{" && text.indexOf("}", i + 1) > 0) return true;
    else if ((c === "+" || c === "@" || c === "!") && text[i + 1] === "(" && text.indexOf(")", i + 2) > 0) return true;
  }
  return false;
}

/**
 * The leading segments of a glob, its last one never among them, in which nothing is a glob, joined by `/`: the folder a walk for its
 * matches starts from. `.` where there are none; `/` for an absolute glob with none. Escapes in these segments are taken off.
 */
export function globRoot(glob: string): string {
  const absolute = glob.startsWith("/");
  const parts = glob.split(/\/+/).filter((p) => p !== "");
  const plain: string[] = [];
  for (const p of parts.slice(0, -1)) {
    if (isGlob(p)) break;
    plain.push(p.replace(/\\(.)/g, "$1"));
  }
  if (plain.length === 0) return absolute ? "/" : ".";
  return `${absolute ? "/" : ""}${plain.join("/")}`;
}
