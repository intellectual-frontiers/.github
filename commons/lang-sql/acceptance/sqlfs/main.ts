/**
 * The command `sqlfs` (commons lang-sql 0011-acceptance FR-003): `sqlfs [--root DIR] [--explain] [--format table|json|paths] [--max-rows N] [--max-depth N] 'SELECT ...'` searches a directory with SQL, in this process.
 *
 * Spec: 0011-acceptance FR-003, FR-008
 *
 * @module
 */
import process from "node:process";
import { type Outcome, failed, isDirectory, parseArgs, succeeded } from "../shared/cli.ts";
import { diskFs } from "../shared/walk.ts";
import { search } from "./mod.ts";

/** The command as a function of its arguments. */
export async function command(argv: readonly string[]): Promise<Outcome> {
  const parsed = parseArgs(argv, "sqlfs");
  if ("usage" in parsed) return { code: 2, out: "", err: parsed.usage };
  const o = parsed.options;
  if (!isDirectory(o.root)) return { code: 2, out: "", err: `sqlfs: no such directory: ${o.root}` };
  const warnings: string[] = [];
  const r = await search(diskFs(o.root), o.query, { maxRows: o.maxRows, maxDepth: o.maxDepth, warn: (m) => warnings.push(m), ...(o.now === undefined ? {} : { now: o.now }) });
  if (r.kind === "err") return failed(o.query, r.error);
  return succeeded(r.value, o, r.value.explained, warnings, r.value.truncated);
}

if (import.meta.main) {
  const out = await command(process.argv.slice(2));
  if (out.out !== "") process.stdout.write(`${out.out}\n`);
  if (out.err !== "") process.stderr.write(`${out.err}\n`);
  process.exitCode = out.code;
}
