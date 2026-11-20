// Spec: 0002-toolchain-governance FR-001
/**
 * The names of Toolchain: a tool name and a version, each made only by the function that validates it, and the order of two versions. A version is one exact version of a tool, never `latest`
 * and never a range: what is pinned is one thing.
 *
 * @example
 * ```ts
 * import { compareVersions, parseVersion } from "./ids.ts";
 * parseVersion("1.10.0").kind; // "ok"
 * parseVersion("^1.2.3").kind; // "err"
 * compareVersions("1.10.0", "1.9.9") > 0; // true
 * ```
 *
 * @module
 */
import { err, ok, refine, string, type Brand, type Result } from "@intellectual-frontiers/core";

/** The name of a tool. */
export type ToolName = Brand<string, "toolchain tool name">;
/** One exact version of a tool: dotted numbers with an optional suffix. */
export type Version = Brand<string, "toolchain version">;

const toolName = refine(string, "toolchain tool name", (t) => t.length <= 60 && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(t));
const version = refine(string, "toolchain version", (t) => /^\d+(\.\d+){0,3}([-+][0-9A-Za-z.-]+)?$/.test(t));

/** A tool name from text: lower case words joined by hyphens, starting with a letter, at most 60 characters. */
export function parseToolName(text: string): Result<ToolName, string> {
  const r = toolName(text);
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a tool name: lower case words joined by hyphens, starting with a letter, at most 60 characters`);
}

/** A version from text: one to four numbers joined by dots, with an optional suffix after a hyphen or a plus sign; `latest`, an empty text and a range are refused. */
export function parseVersion(text: string): Result<Version, string> {
  if (text === "latest") return err(`${JSON.stringify(text)} is not a version: a pin is one exact version, never latest`);
  if (/[\^~*<>|\s]|\bx\b/.test(text)) return err(`${JSON.stringify(text)} is not a version: a pin is one exact version, never a range`);
  const r = version(text);
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a version: one to four numbers joined by dots, with an optional suffix after a hyphen or a plus sign`);
}

function partsOf(v: string): { readonly numbers: readonly number[]; readonly pre: string | undefined } {
  const cut = v.search(/[-+]/);
  const core = cut < 0 ? v : v.slice(0, cut);
  const rest = cut < 0 ? undefined : v.slice(cut);
  return { numbers: core.split(".").map((n) => Number(n)), pre: rest !== undefined && rest.startsWith("-") ? rest.slice(1) : undefined };
}

/** The order of two versions: negative where `a` is the earlier, positive where it is the later, 0 where they are the same. A version with a pre-release suffix comes before the same numbers without one. */
export function compareVersions(a: string, b: string): number {
  const x = partsOf(a);
  const y = partsOf(b);
  const length = Math.max(x.numbers.length, y.numbers.length);
  for (let i = 0; i < length; i++) {
    const d = (x.numbers[i] ?? 0) - (y.numbers[i] ?? 0);
    if (d !== 0) return d;
  }
  if (x.pre === undefined && y.pre === undefined) return 0;
  if (x.pre === undefined) return 1;
  if (y.pre === undefined) return -1;
  return x.pre < y.pre ? -1 : x.pre > y.pre ? 1 : 0;
}
