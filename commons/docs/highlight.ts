/**
 * Code highlighted when the site is built (commons 0011-documentation FR-017), so that a page needs no script to colour it: a small
 * scanner for each language the site shows (TypeScript, SQL, shell, TOML, JSON and JSON5, Turtle), which gives the text cut into tokens,
 * each with its class. It colours; it does not parse, so a token it does not know is plain text.
 *
 * @example
 * ```ts
 * import { tokens } from "./highlight.ts";
 * tokens("const a = 1; // one", "ts");
 * // [{ cls: "keyword", text: "const" }, { cls: "plain", text: " a = " }, { cls: "number", text: "1" }, ...]
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/ifc-ts/kernel";
import type { Lang } from "./model.ts";

/** What a token is, as the stylesheet colours it. */
export type TokenClass = "plain" | "keyword" | "string" | "comment" | "number" | "type" | "function" | "punct" | "variable";

/** A run of code and its class. */
export interface Token {
  /** Its class. */
  readonly cls: TokenClass;
  /** Its text. */
  readonly text: string;
}

interface Grammar {
  readonly line: readonly string[];
  readonly block?: readonly [string, string];
  readonly quotes: readonly string[];
  readonly keywords: ReadonlySet<string>;
  readonly caseless: boolean;
  readonly types: boolean;
  readonly variables: boolean;
}

const words = (s: string): ReadonlySet<string> => new Set(s.split(/\s+/).filter((w) => w !== ""));

const TS: Grammar = {
  line: ["//"],
  block: ["/*", "*/"],
  quotes: ['"', "'", "`"],
  keywords: words(`abstract as async await break case catch class const continue debugger declare default delete do else enum export
    extends false finally for from function get if implements import in infer instanceof interface is keyof let namespace never new null
    of private protected public readonly return satisfies set static super switch this throw true try type typeof undefined unique unknown
    var void while with yield any boolean number string symbol bigint object`),
  caseless: false,
  types: true,
  variables: false,
};

const SQL: Grammar = {
  line: ["--"],
  block: ["/*", "*/"],
  quotes: ["'", '"'],
  keywords: words(`add all alter and as asc begin between by cascade case check collate column commit constraint create cross current_date
    current_timestamp database default delete desc distinct do drop else end exists extension false for foreign from full function grant
    group having if in index inner insert into is join key language left like limit materialized not null nulls offset on or order outer
    partition policy primary procedure references replace returning returns revoke right rollback row schema select sequence set table
    temporary then to transaction trigger true type union unique update using values view when where with without integer int bigint
    smallint text varchar char boolean date time timestamp timestamptz numeric decimal real double precision json jsonb uuid blob serial
    bytea interval macro plpgsql sql immutable stable volatile security definer`),
  caseless: true,
  types: false,
  variables: false,
};

const SH: Grammar = {
  line: ["#"],
  quotes: ['"', "'"],
  keywords: words("if then else elif fi for in do done case esac while until function return export local set unset cd echo exit"),
  caseless: false,
  types: false,
  variables: true,
};

const TOML: Grammar = { line: ["#"], quotes: ['"', "'"], keywords: words("true false"), caseless: false, types: false, variables: false };
const JSON_: Grammar = {
  line: ["//"],
  block: ["/*", "*/"],
  quotes: ['"', "'"],
  keywords: words("true false null"),
  caseless: false,
  types: false,
  variables: false,
};
const TURTLE: Grammar = {
  line: ["#"],
  quotes: ['"', "'"],
  keywords: words("a @prefix @base true false PREFIX BASE"),
  caseless: false,
  types: false,
  variables: false,
};

function grammarOf(lang: Lang): Grammar | undefined {
  switch (lang) {
    case "ts":
      return TS;
    case "sql":
      return SQL;
    case "sh":
      return SH;
    case "toml":
      return TOML;
    case "json":
      return JSON_;
    case "turtle":
      return TURTLE;
    case "mermaid":
    case "text":
      return undefined;
    default:
      return absurd(lang);
  }
}

/**
 * The tokens of a text of code.
 *
 * @param code - the text
 * @param lang - its language
 */
export function tokens(code: string, lang: Lang): Token[] {
  const g = grammarOf(lang);
  if (g === undefined) return [{ cls: "plain", text: code }];
  const out: Token[] = [];
  const push = (cls: TokenClass, text: string): void => {
    const last = out[out.length - 1];
    if (last !== undefined && last.cls === cls) out[out.length - 1] = { cls, text: last.text + text };
    else out.push({ cls, text });
  };
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    const lc = g.line.find((m) => rest.startsWith(m));
    if (lc !== undefined && (lang !== "sh" || i === 0 || /\s/.test(code[i - 1] ?? ""))) {
      const end = code.indexOf("\n", i);
      const stop = end < 0 ? code.length : end;
      push("comment", code.slice(i, stop));
      i = stop;
      continue;
    }
    if (g.block !== undefined && rest.startsWith(g.block[0])) {
      const end = code.indexOf(g.block[1], i + g.block[0].length);
      const stop = end < 0 ? code.length : end + g.block[1].length;
      push("comment", code.slice(i, stop));
      i = stop;
      continue;
    }
    const q = g.quotes.find((m) => rest.startsWith(m));
    if (q !== undefined) {
      let j = i + 1;
      while (j < code.length && code[j] !== q) {
        if (code[j] === "\\") j++;
        if (code[j] === "\n" && q !== "`") break;
        j++;
      }
      push("string", code.slice(i, Math.min(j + 1, code.length)));
      i = Math.min(j + 1, code.length);
      continue;
    }
    if (g.variables && rest.startsWith("$")) {
      const m = /^\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|\d)/.exec(rest);
      if (m !== null) {
        push("variable", m[0]);
        i += m[0].length;
        continue;
      }
    }
    const num = /^(?:0x[0-9a-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?n?)/.exec(rest);
    if (num !== null && !/[\w$]/.test(code[i - 1] ?? "")) {
      push("number", num[0]);
      i += num[0].length;
      continue;
    }
    const word = /^[@A-Za-z_$][\w$-]*/.exec(rest);
    if (word !== null) {
      let w = word[0];
      if (lang !== "sh" && lang !== "turtle" && lang !== "toml") w = /^[@A-Za-z_$][\w$]*/.exec(rest)?.[0] ?? w;
      const key = g.caseless ? w.toLowerCase() : w;
      const after = code.slice(i + w.length).trimStart();
      if (g.keywords.has(key)) push("keyword", w);
      else if (g.types && /^[A-Z]/.test(w)) push("type", w);
      else if (lang === "ts" && after.startsWith("(")) push("function", w);
      else push("plain", w);
      i += w.length;
      continue;
    }
    push(/[{}()[\];,.:=<>+\-*/|&!?]/.test(code[i] ?? "") ? "punct" : "plain", code[i] ?? "");
    i++;
  }
  return out;
}
