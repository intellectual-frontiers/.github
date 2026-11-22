// Spec: 0004-planning-sources FR-009
/**
 * The source for comments in source files (0037-planning FR-027): a comment that carries one of the markers set in the configuration (`TODO`, `FIXME`, `XXX` and `HACK` by default, the markers the documentation
 * scan of Docs reads) is an item of the kind todo, with the fingerprint of the comment's normalized text, the symbol that encloses it and its place among equal ones there, so that the id survives a move of the line
 * inside the file; the anchor `MARKER(#id)` in the comment is the id of its item. The only thing written is that anchor, only in the files the configuration lists and never in a generated or a vendored file.
 *
 * @remarks
 * The reader knows the comment syntax of a file by its extension (`//` and block comments for the C family, `#` and `--` for scripts and SQL) and skips string literals on a line. The enclosing symbol is the nearest
 * declaration above the comment that is indented less than it (a function, class, type, constant or method by the keywords of the common languages): a heuristic and not a parser, so a comment between two functions of
 * one indent has the symbol of neither. A comment with no text after its marker reads with the marker as its title.
 *
 * @example
 * ```ts
 * import { commentsLens } from "./comments.ts";
 * commentsLens({ anchorFiles: (p) => p.startsWith("src/") }).name; // "comments"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type ItemId, type Observation, type Patch, parseItemId } from "@intellectual-frontiers/planning/governance";
import type { FileLens, FileRead } from "../file-source.ts";
import type { SourceProblem } from "../source.ts";

/** What the configuration says of the comments source. */
export type CommentsConfig = {
  /** The markers read (`TODO`, `FIXME`, `XXX`, `HACK` where none). */
  readonly markers?: readonly string[];
  /** The files an anchor may be written to; none where it is left out, so that nothing is written. */
  readonly anchorFiles?: (path: string) => boolean;
};

/** The markers read where the configuration names none. */
export const DEFAULT_MARKERS: readonly string[] = ["TODO", "FIXME", "XXX", "HACK"];

type Syntax = { readonly line: readonly string[]; readonly block: boolean };
const C_FAMILY: Syntax = { line: ["//"], block: true };
const SYNTAX: Readonly<Record<string, Syntax>> = {
  ts: C_FAMILY, tsx: C_FAMILY, js: C_FAMILY, jsx: C_FAMILY, mjs: C_FAMILY, cjs: C_FAMILY, java: C_FAMILY, c: C_FAMILY, h: C_FAMILY, cc: C_FAMILY, cpp: C_FAMILY, cs: C_FAMILY, go: C_FAMILY, rs: C_FAMILY, kt: C_FAMILY, swift: C_FAMILY,
  py: { line: ["#"], block: false }, sh: { line: ["#"], block: false }, rb: { line: ["#"], block: false }, yaml: { line: ["#"], block: false }, yml: { line: ["#"], block: false }, toml: { line: ["#"], block: false },
  sql: { line: ["--"], block: true },
};

const syntaxOf = (path: string): Syntax | undefined => SYNTAX[path.split(".").pop()?.toLowerCase() ?? ""];

/** Whether a path is a generated or a vendored file: never written to. */
export function isGeneratedOrVendored(path: string): boolean {
  return /(^|\/)(node_modules|vendor|dist|build|generated|\.git)\//u.test(path) || /\.(auto|min|generated)\./u.test(path) || path.endsWith(".d.ts");
}

const DECLARATION = /^(?<indent>\s*)(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:public\s+|private\s+|protected\s+|static\s+)*(?:function\*?|class|interface|type|enum|const|let|var|def|fn|func|impl|struct|trait|fun|module)\s+(?<name>[A-Za-z_$][\w$]*)/u;
const METHOD = /^(?<indent>\s+)(?:async\s+)?(?:static\s+)?(?<name>[A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^={]+)?\{\s*$/u;
const UUID = /^#[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/** A comment with a marker, read from a file. */
export type Found = {
  readonly line: number;
  readonly marker: string;
  readonly text: string;
  readonly anchor: ItemId | undefined;
  readonly symbol: string;
  /** The index in the line where the marker begins and ends. */
  readonly markerStart: number;
  readonly markerEnd: number;
  readonly hasAnchor: boolean;
};

/** The text of the comment of a line (after the comment start, outside string literals), and where it starts in the line. */
function commentOf(line: string, syntax: Syntax, inBlock: boolean): { readonly text: string; readonly offset: number; readonly inBlock: boolean } | undefined {
  if (inBlock) {
    const end = line.indexOf("*/");
    const body = end === -1 ? line : line.slice(0, end);
    const lead = /^\s*\*?\s?/u.exec(body)?.[0].length ?? 0;
    return { text: body.slice(lead), offset: lead, inBlock: end === -1 };
  }
  let quote: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (quote !== undefined) {
      if (c === "\\") i++;
      else if (c === quote) quote = undefined;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    const start = syntax.line.find((l) => line.startsWith(l, i));
    if (start !== undefined) return { text: line.slice(i + start.length), offset: i + start.length, inBlock: false };
    if (syntax.block && line.startsWith("/*", i)) {
      const end = line.indexOf("*/", i + 2);
      return end === -1 ? { text: line.slice(i + 2), offset: i + 2, inBlock: true } : { text: line.slice(i + 2, end), offset: i + 2, inBlock: false };
    }
  }
  return undefined;
}

/** Every comment of a text that carries a marker. */
export function commentsOf(path: string, text: string, markers: readonly string[]): readonly Found[] {
  const syntax = syntaxOf(path);
  if (syntax === undefined) return [];
  const names = markers.map((m) => m.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
  if (names === "") return [];
  const marker = new RegExp(`(?<![\\w])(?<marker>${names})(?<spec>(?:\\([^)]*\\))*)(?<rest>[:\\-\\s].*|$)`, "u");
  const out: Found[] = [];
  const declared: { readonly indent: number; readonly name: string }[] = [];
  let inBlock = false;
  let blockIndent = 0;
  for (const [i, line] of text.split("\n").entries()) {
    const d = DECLARATION.exec(line) ?? METHOD.exec(line);
    const lineIndent = line.length - line.trimStart().length;
    const wasInBlock = inBlock;
    const c = commentOf(line, syntax, inBlock);
    inBlock = c?.inBlock ?? false;
    if (c !== undefined && !wasInBlock && c.inBlock) blockIndent = lineIndent;
    const before = c === undefined ? "" : wasInBlock ? "" : line.slice(0, Math.max(0, c.offset)).trim();
    const commentOnly = c !== undefined && (wasInBlock || before === "" || syntax.line.includes(before) || before === "/*" || before === "/**");
    const indent = wasInBlock ? blockIndent : lineIndent;
    // a line of code ends the declarations it is not inside of; a declaration is pushed after
    if (!commentOnly && line.trim() !== "") while (declared.length > 0 && (declared.at(-1)?.indent ?? 0) >= lineIndent) declared.pop();
    const push = (): void => {
      if (d?.groups?.["name"] !== undefined && !commentOnly) declared.push({ indent: d.groups["indent"]?.length ?? 0, name: d.groups["name"] });
    };
    const m = c === undefined ? null : marker.exec(c.text);
    if (c === undefined || m?.groups === undefined) {
      push();
      continue;
    }
    const spec = m.groups["spec"] ?? "";
    const anchorText = [...spec.matchAll(/\(([^)]*)\)/gu)].map((x) => x[1] ?? "").find((x) => UUID.test(x));
    const anchor = anchorText === undefined ? undefined : parseItemId(anchorText.slice(1));
    const start = c.offset + (m.index ?? 0);
    const enclosing = [...declared].reverse().find((s) => s.indent < indent);
    out.push({
      line: i + 1,
      marker: m.groups["marker"] ?? "",
      text: (m.groups["rest"] ?? "").replace(/^[:\-\s]+/u, "").trim(),
      anchor: anchor?.kind === "ok" ? anchor.value : undefined,
      symbol: enclosing?.name ?? "",
      markerStart: start,
      markerEnd: start + (m.groups["marker"] ?? "").length,
      hasAnchor: anchorText !== undefined,
    });
    push();
  }
  return out;
}

const normal = (s: string): string => s.toLowerCase().replace(/\s+/gu, " ").trim();

async function observationsOf(path: string, text: string, markers: readonly string[]): Promise<readonly Observation[]> {
  const lines = text.split("\n");
  const seen = new Map<string, number>();
  return Promise.all(
    commentsOf(path, text, markers).map(async (f): Promise<Observation> => {
      const key = `${normal(f.text)}\u0000${f.symbol}`;
      const k = seen.get(key) ?? 0;
      seen.set(key, k + 1);
      const own = lines[f.line - 1] ?? "";
      return {
        source: "comments",
        locator: { kind: "file-span", path, startLine: f.line, endLine: f.line },
        contentHash: await sha256(own),
        fingerprint: await sha256(`comments\u0000${path}\u0000${key}\u0000${k}`),
        content: {
          kind: "todo",
          title: f.text === "" ? f.marker : f.text,
          body: "",
          labels: [f.marker],
          assignees: [],
          state: { kind: "open" },
          origin: "derived",
          external: [],
          target: { file: path },
          ...(f.anchor === undefined ? {} : { anchor: f.anchor }),
        },
        raw: { line: f.line, marker: f.marker, symbol: f.symbol, text: f.text },
      };
    }),
  );
}

/** The lens for the comments of source files, with the markers and the files an anchor may be written to. */
export function commentsLens(config: CommentsConfig = {}): FileLens {
  const markers = config.markers ?? DEFAULT_MARKERS;
  const edit = (file: FileRead, patch: Patch): Result<string | undefined, SourceProblem> => {
    const data = patch.event.data;
    if (data.type !== "opened") return err({ kind: "unexpressed", reason: `a comment holds an anchor and no ${data.type} event` });
    if (isGeneratedOrVendored(file.path)) return err({ kind: "refused", message: `${file.path} is a generated or a vendored file: no anchor is written to it` });
    if (config.anchorFiles?.(file.path) !== true) return err({ kind: "refused", message: `${file.path} is not among the files the configuration lists for anchors` });
    const o = file.observations.find((x) => x.fingerprint === patch.fingerprint);
    if (o === undefined || o.locator.kind !== "file-span") return err({ kind: "refused", message: "the comment is not in this file" });
    const found = commentsOf(file.path, file.text, markers).find((f) => f.line === (o.locator.kind === "file-span" ? o.locator.startLine : -1));
    if (found === undefined) return err({ kind: "refused", message: "the comment is not found" });
    if (found.hasAnchor) return ok(undefined);
    const lines = file.text.split("\n");
    const line = lines[found.line - 1] ?? "";
    lines[found.line - 1] = `${line.slice(0, found.markerEnd)}(#${patch.event.item})${line.slice(found.markerEnd)}`;
    return ok(lines.join("\n"));
  };
  return {
    name: "comments",
    capabilities: ["read", "create"],
    reads: (path) => syntaxOf(path) !== undefined,
    parse: async (path, text) => ({ observations: await observationsOf(path, text, markers), findings: [] }),
    edit,
  };
}
