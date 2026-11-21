/**
 * The reader of the structure of a TypeScript or JavaScript source (commons 0036-distribution FR-022, FR-025): which of its characters are code, which are comments and which are the text of strings, so that what a packer reads of a source (the specifiers it
 * imports, whether it does something when it is loaded) is read from code and never from the text of a comment, a string or a template literal that only looks like it.
 *
 * @remarks
 * It is a scanner and not a parser: it tracks comments, the quotes, template literals with their expressions and regular expressions, which is all that the readers below need.
 *
 * @limits
 * A regular expression literal after a token it cannot tell from a division is read as a division; a source with such a literal that contains a quote may be read wrongly, which the packer's inspection would show as a finding, never as a silent pass.
 *
 * @example
 * ```ts
 * import { importSpecifiers } from "./scan.ts";
 * importSpecifiers('import a from "./a.ts"; const s = "import b from \\"./b.ts\\"";'); // ["./a.ts"]
 * ```
 *
 * Spec: 0001-libraries FR-029
 *
 * @module
 */

/** What a source is made of, for the readers below: its code with the comments and the insides of strings, templates and regular expressions blanked (each character a space, the quotes and the lines kept), and where the strings and the comments are. */
export type Scanned = {
  readonly code: string;
  readonly strings: readonly { readonly start: number; readonly end: number }[];
  readonly comments: readonly { readonly start: number; readonly end: number }[];
};

/** Reads a source's structure: see {@link Scanned}. A template literal is blanked whole, its expressions included, and is no string. */
export function scanSource(source: string): Scanned {
  const n = source.length;
  const out: string[] = [];
  const strings: { start: number; end: number }[] = [];
  const comments: { start: number; end: number }[] = [];
  const blank = (c: string): string => (c === "\n" ? "\n" : " ");
  let i = 0;
  let last = ";";
  const skipTemplate = (): void => {
    // after the opening backtick (or the closing brace of an expression): to the closing backtick, with the expressions inside it blanked too
    while (i < n) {
      const t = source[i] ?? "";
      if (t === "\\") {
        out.push(" ", blank(source[i + 1] ?? " "));
        i += 2;
      } else if (t === "`") {
        out.push("`");
        i++;
        return;
      } else if (t === "$" && source[i + 1] === "{") {
        out.push("  ");
        i += 2;
        let braces = 1;
        while (i < n && braces > 0) {
          const e = source[i] ?? "";
          if (e === "{") braces++;
          else if (e === "}") braces--;
          else if (e === "`") {
            out.push("`");
            i++;
            skipTemplate();
            continue;
          }
          out.push(blank(e));
          i++;
        }
      } else {
        out.push(blank(t));
        i++;
      }
    }
  };
  while (i < n) {
    const c = source[i] ?? "";
    const d = source[i + 1] ?? "";
    if (c === "#" && i === 0 && d === "!") {
      while (i < n && source[i] !== "\n") out.push(" "), i++;
      continue;
    }
    if (c === "/" && d === "/") {
      const start = i;
      while (i < n && source[i] !== "\n") out.push(" "), i++;
      comments.push({ start, end: i });
      continue;
    }
    if (c === "/" && d === "*") {
      const start = i;
      out.push("  ");
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) out.push(blank(source[i] ?? "")), i++;
      out.push("  ");
      i += 2;
      comments.push({ start, end: Math.min(i, n) });
      continue;
    }
    if (c === '"' || c === "'") {
      out.push(c);
      i++;
      const start = i;
      while (i < n && source[i] !== c && source[i] !== "\n") {
        if (source[i] === "\\") out.push(" "), i++;
        out.push(" ");
        i++;
      }
      strings.push({ start, end: i });
      if (source[i] === c) out.push(c), i++;
      last = "x";
      continue;
    }
    if (c === "`") {
      out.push("`");
      i++;
      skipTemplate();
      last = "x";
      continue;
    }
    if (c === "/" && "(,=:[!&|?{};".includes(last)) {
      // a regular expression literal
      out.push(" ");
      i++;
      let inClass = false;
      while (i < n && source[i] !== "\n") {
        const t = source[i] ?? "";
        if (t === "\\") out.push(" "), i++;
        else if (t === "[") inClass = true;
        else if (t === "]") inClass = false;
        else if (t === "/" && !inClass) {
          out.push(" ");
          i++;
          break;
        }
        out.push(" ");
        i++;
      }
      last = "x";
      continue;
    }
    out.push(c);
    if (c.trim() !== "") last = c;
    i++;
  }
  return { code: out.join(""), strings, comments };
}

/** The strings of a source that are specifiers: those that follow `from`, `import` or `import(`, with where each is. A name in a string that is no specifier (a list of packages, a field of a manifest, the text of generated code) is not one. */
export function specifierRanges(source: string): readonly { readonly start: number; readonly end: number }[] {
  const { code, strings } = scanSource(source);
  return strings.filter((r) => /(?:\bfrom|\bimport|\bimport\s*\()\s*["']$/.test(code.slice(Math.max(0, r.start - 24), r.start)));
}

/** The specifiers a source imports: no comment, no string that is no specifier. */
export function importSpecifiers(source: string): readonly string[] {
  return specifierRanges(source).map((r) => source.slice(r.start, r.end));
}

