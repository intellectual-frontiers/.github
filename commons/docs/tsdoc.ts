/**
 * TSDoc read into its parts (commons 0011-documentation FR-006): the summary, `@remarks`, `@limits` (this repository's own block tag: what
 * a module does not do, or does only in part), `@example`, `@see`, `@param`, `@returns` and `@deprecated`, from a comment's text or from
 * the tags the TypeScript checker gives. The text of each part stays Markdown, for `markdown.ts` to read.
 *
 * @example
 * ```ts
 * import { moduleComment } from "./tsdoc.ts";
 * moduleComment("/**\n * What it is.\n *\n * @limits\n * What it is not.\n *\n * @module\n *\/\n")?.limits; // "What it is not."
 * ```
 *
 * @module
 */

/** A parameter's name and what the comment says of it. */
export interface DocParam {
  /** Its name. */
  readonly name: string;
  /** What it is. */
  readonly text: string;
}

/** The parts of a TSDoc comment. */
export interface DocComment {
  /** What comes before the first block tag. */
  readonly summary: string;
  /** `@remarks`: the longer account. */
  readonly remarks?: string;
  /** `@limits`: what it does not do, or does only in part. */
  readonly limits?: string;
  /** Each `@example`. */
  readonly examples: readonly string[];
  /** Each `@see`. */
  readonly see: readonly string[];
  /** Each `@param`. */
  readonly params: readonly DocParam[];
  /** `@returns`. */
  readonly returns?: string;
  /** `@deprecated`, with why. */
  readonly deprecated?: string;
  /** Whether it says `@module`. */
  readonly isModule: boolean;
}

/** A block tag and its text, as the checker gives it or as a comment's text holds it. */
export interface DocTag {
  /** The tag's name, without `@`. */
  readonly name: string;
  /** Its text. */
  readonly text: string;
}

const dedent = (s: string): string => {
  const lines = s.replace(/^\n+|\s+$/g, "").split("\n");
  const ind = Math.min(...lines.filter((l) => l.trim() !== "").map((l) => l.length - l.trimStart().length));
  return lines.map((l) => l.slice(Number.isFinite(ind) ? ind : 0)).join("\n");
};

/** A `@param` tag's text, as `name - what` or `name what`. */
function param(text: string): DocParam {
  const m = /^\s*([\w$.[\]]+)\s*(?:-\s*)?([\s\S]*)$/.exec(text);
  return { name: m?.[1] ?? "", text: (m?.[2] ?? "").trim() };
}

/**
 * The parts of a comment, from its summary and its block tags.
 *
 * @param summary - the text before the first block tag
 * @param tags - the block tags, in order
 */
export function docOf(summary: string, tags: readonly DocTag[]): DocComment {
  const all = (n: string): string[] => tags.filter((t) => t.name === n).map((t) => dedent(t.text));
  const one = (n: string): string | undefined => {
    const v = all(n);
    return v.length === 0 ? undefined : v.join("\n\n");
  };
  const remarks = one("remarks");
  const limits = one("limits");
  const returns = one("returns");
  const deprecated = one("deprecated");
  return {
    summary: dedent(summary),
    ...(remarks === undefined ? {} : { remarks }),
    ...(limits === undefined ? {} : { limits }),
    examples: all("example"),
    see: all("see"),
    params: tags.filter((t) => t.name === "param").map((t) => param(t.text)),
    ...(returns === undefined ? {} : { returns }),
    ...(deprecated === undefined ? {} : { deprecated }),
    isModule: tags.some((t) => t.name === "module"),
  };
}

/**
 * The parts of a comment's text: the inside of `/** ... *\/`, its leading asterisks taken off.
 *
 * @param inside - the comment's text between its delimiters
 */
export function parseComment(inside: string): DocComment {
  const lines = inside.split("\n").map((l) => l.replace(/^\s*\* ?/, ""));
  const tags: DocTag[] = [];
  const summary: string[] = [];
  let current: { name: string; lines: string[] } | undefined;
  let fenced = false;
  for (const l of lines) {
    if (/^\s*(```|~~~)/.test(l)) fenced = !fenced;
    const tag = fenced ? null : /^@(\w+)\s?(.*)$/.exec(l.trim());
    if (tag !== null) {
      if (current !== undefined) tags.push({ name: current.name, text: current.lines.join("\n") });
      current = { name: tag[1] ?? "", lines: tag[2] === undefined || tag[2] === "" ? [] : [tag[2]] };
      continue;
    }
    if (current === undefined) summary.push(l);
    else current.lines.push(l);
  }
  if (current !== undefined) tags.push({ name: current.name, text: current.lines.join("\n") });
  return docOf(summary.join("\n"), tags);
}

/**
 * The module comment of a source file: its first `/** ... *\/` comment, where that comment says `@module`.
 *
 * @param source - the file's text
 */
export function moduleComment(source: string): DocComment | undefined {
  const m = /^\s*(?:#![^\n]*\n\s*)?\/\*\*([\s\S]*?)\*\//.exec(source);
  if (m === null) return undefined;
  const doc = parseComment(m[1] ?? "");
  return doc.isModule ? doc : undefined;
}
