// Spec: 0003-headless-output FR-008
/**
 * The mechanism of `explain` and `translate` (commons headless 0003-headless-output FR-008): a problem shown with a stable code says how to read more
 * about it, and a raw error of another tool (ssh, apt, git) that people meet often is recognized and given its plain cause and fix. The
 * catalogue of codes, the patterns of raw errors and the guides are the program's own data; this module holds the rules for using them.
 *
 * @example
 * ```ts
 * import { explainText, translator } from "./explain.ts";
 * const catalogue = { "E001-DNS": { title: "A name did not resolve", what: "It did not.", why: "The network is down.", fix: "ping 1.1.1.1" } };
 * const translate = translator(catalogue, [[/Could not resolve host/, "E001-DNS"]]);
 * translate("curl: Could not resolve host: x")?.code; // "E001-DNS"
 * explainText(catalogue, { program: "tool" }, "e001-dns").includes("Likely cause"); // true
 * ```
 *
 * @module
 */
import { suggest } from "@intellectual-frontiers/terminal/args";
import { isProblemCode } from "@intellectual-frontiers/headless/governance";

/** One problem's explanation: what, why, the fix, and the guide. */
export type Explanation = {
  readonly title: string;
  /** What happened, in plain words. */
  readonly what: string;
  /** The likely cause. */
  readonly why: string;
  /** The fix: what to do, with the exact command where there is one. */
  readonly fix: string;
  /** The guide that explains more, by its name: the program says where it is shown. */
  readonly doc?: string;
};

/** Every explanation, by code. */
export type Catalogue = Readonly<Record<string, Explanation>>;

/** A pattern of a raw error and the code it is given. */
export type RawPattern = readonly [RegExp, string];

/** What a pattern gives: the code and the fix of its explanation. */
export type Translation = { readonly code: string; readonly fix: string };

/** Everything wrong with a catalogue and its patterns: a code that is not a code, an explanation with a blank field, a pattern that names a code the catalogue lacks. */
export function catalogueProblems(catalogue: Catalogue, patterns: readonly RawPattern[] = []): readonly string[] {
  const out: string[] = [];
  for (const [code, e] of Object.entries(catalogue)) {
    if (!isProblemCode(code)) out.push(`${code} is not a stable code`);
    for (const field of ["title", "what", "why", "fix"] as const) if (e[field].trim() === "") out.push(`${code} has no ${field}`);
  }
  for (const [re, code] of patterns) if (catalogue[code] === undefined) out.push(`the pattern ${String(re)} names ${code}, which the catalogue does not explain`);
  return out;
}

/** A function that gives a known raw error its code and fix, or `undefined` where the error is not known (it is then shown as it is). The first pattern that matches wins. */
export function translator(catalogue: Catalogue, patterns: readonly RawPattern[]): (raw: string) => Translation | undefined {
  return (raw) => {
    for (const [re, code] of patterns) if (re.test(raw)) return { code, fix: catalogue[code]?.fix ?? "" };
    return undefined;
  };
}

/** How a program says where more is to be read: the command that shows a guide, here and offline, and where it is online. */
export type GuideLinks = (doc: string) => { readonly ref: string; readonly url: string };

/** What `explainText` is given about the program. */
export type ExplainContext = { readonly program: string; readonly guide?: GuideLinks };

/** The explanation of a code (a code is written in either case), the list of every code, or a sentence that says there is none and names the nearest. */
export function explainText(catalogue: Catalogue, ctx: ExplainContext, code?: string): string {
  const codes = Object.keys(catalogue);
  if (code === undefined || code === "") {
    const w = Math.max(0, ...codes.map((k) => k.length));
    return [`Every problem ${ctx.program} explains (${ctx.program} explain <code>):`, "", ...codes.map((k) => `  ${k.padEnd(w)}  ${catalogue[k]?.title ?? ""}`)].join("\n");
  }
  const key = code.toUpperCase();
  const e = catalogue[key];
  if (e === undefined) {
    const near = suggest(key, codes);
    return `no explanation named ${code}${near === undefined ? "" : `; did you mean ${near}?`} ${ctx.program} explain lists them`;
  }
  const more = e.doc === undefined || ctx.guide === undefined ? undefined : ctx.guide(e.doc);
  return [
    `${key}: ${e.title}`,
    "",
    `What happened  ${e.what}`,
    `Likely cause   ${e.why}`,
    `Fix            ${e.fix}`,
    ...(more === undefined ? [] : [`More           ${more.ref}   (online: ${more.url})`]),
  ].join("\n");
}
