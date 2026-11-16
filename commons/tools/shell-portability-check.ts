/**
 * Find, in shell scripts, what only GNU tools have (commons 0004-rules): the `shell-portability` rules of commons/generated/rules.auto.toml.
 *
 *     bun commons/tools/shell-portability-check.ts FILE...      print `file:line: uses X ...` for each, exit 1 if there is one
 *
 * A comment line, and a trailing comment, may name what a script avoids and are not read. It needs Bun or Node 26 and the kernel's TOML reader alone; `scan(path, rules, allow)` gives the findings as data, where `allow` is text whose presence on a line excuses it (a line that picks the right tool for the
 * computer it runs on).
 *
 * @module
 */
import process from "node:process";
import { formatTomlError, parseToml } from "../ts/kernel/toml.ts";
import { err, ok, pathOfUrl, PY_SPACE, readText, type Result, splitLines, writeAll } from "./core.ts";

export const RULES = pathOfUrl(new URL("../generated/rules.auto.toml", import.meta.url));

/** A rule of the set `shell-portability`, its pattern compiled. */
export type PortabilityRule = { readonly id: string; readonly pattern: RegExp; readonly label: string; readonly reason: string };

const field = (o: unknown, key: string): string | null => {
  if (typeof o !== "object" || o === null || !(key in o)) return null;
  const v: unknown = Reflect.get(o, key);
  return typeof v === "string" ? v : null;
};

/** The `shell-portability` rules of a rules table; why not, where the table is not one. */
export function rules(path: string = RULES): Result<PortabilityRule[], string> {
  const parsed = parseToml(readText(path));
  if (parsed.kind === "err") return err(`${path} is not TOML: ${formatTomlError(parsed.error)}`);
  const doc: unknown = parsed.value;
  const all: unknown = typeof doc === "object" && doc !== null ? Reflect.get(doc, "rules") : undefined;
  if (!Array.isArray(all)) return err(`${path} has no [[rules]]`);
  const out: PortabilityRule[] = [];
  for (const r of all) {
    const [id, set, pattern, label, reason] = [field(r, "id"), field(r, "set"), field(r, "pattern"), field(r, "label"), field(r, "reason")];
    if (id === null || set === null || pattern === null || label === null || reason === null)
      return err(`${path}: a rule needs an id, a set, a pattern, a label and a reason`);
    if (set !== "shell-portability") continue;
    try {
      out.push({ id, pattern: new RegExp(pattern), label, reason });
    } catch (e) {
      return err(`${path}: rule ${id}: the pattern is not a regular expression: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return ok(out);
}

const COMMENT_LINE = new RegExp(`^[${PY_SPACE}]*#`, "u");
const TRAILING_COMMENT = new RegExp(`[${PY_SPACE}]#[${PY_SPACE}][^\\n]*$`, "u");
const strip = (s: string): string => s.replace(new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, "gu"), "");

/** Each line of the script at `path` that matches a rule, as `name:line: uses X, which a Mac's tools lack (reason): the line`. */
export function scan(path: string, table: readonly PortabilityRule[], allow: readonly string[] = []): string[] {
  const name = path.replace(/^.*[\\/]/, "");
  const found: string[] = [];
  splitLines(readText(path)).forEach((line, i) => {
    if (COMMENT_LINE.test(line) || allow.some((a) => line.includes(a))) return;
    const code = line.replace(TRAILING_COMMENT, "");
    for (const r of table)
      if (r.pattern.test(code)) found.push(`${name}:${i + 1}: uses ${r.label}, which a Mac's tools lack (${r.reason}): ${strip(line)}`);
  });
  return found;
}

export function main(argv: readonly string[]): number {
  const table = rules();
  if (!table.ok) {
    writeAll("stderr", `${table.error}\n`);
    return 2;
  }
  const found = argv.flatMap((a) => scan(a, table.value));
  writeAll("stderr", found.map((f) => `${f}\n`).join(""));
  return found.length > 0 ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
