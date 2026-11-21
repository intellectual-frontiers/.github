/**
 * The command `sqlfind` (commons lang-sql 0011-acceptance FR-004 to FR-006): `sqlfind [--root DIR] [--explain] [--emit argv|shell] [--flavor gnu|bsd] [--format table|json|paths] 'SELECT ...'` compiles a query to a `find` command and, unless it is
 * asked only to say the command, runs it and the rest of the query.
 *
 * Spec: 0011-acceptance FR-004, FR-005, FR-006, FR-008
 *
 * @module
 */
import process from "node:process";
import { type Outcome, failed, isDirectory, parseArgs, succeeded } from "../shared/cli.ts";
import { compileFind, detectFlavor, runFind, toShell } from "./mod.ts";

/** The command as a function of its arguments. */
export async function command(argv: readonly string[]): Promise<Outcome> {
  const parsed = parseArgs(argv, "sqlfind");
  if ("usage" in parsed) return { code: 2, out: "", err: parsed.usage };
  const o = parsed.options;
  if (!isDirectory(o.root)) return { code: 2, out: "", err: `sqlfind: no such directory: ${o.root}` };
  const flavor = o.flavor === "auto" ? await detectFlavor() : o.flavor;
  const c = compileFind(o.query, o.root, flavor, o.maxDepth);
  if (c.kind === "err") return failed(o.query, c.error);
  if (o.emit !== undefined) return { code: 0, out: o.emit === "argv" ? JSON.stringify(c.value.argv) : toShell(c.value.argv), err: "" };
  const warnings: string[] = [];
  const r = await runFind(c.value, { maxRows: o.maxRows, warn: (m) => warnings.push(m), ...(o.now === undefined ? {} : { now: o.now }) });
  if (r.kind === "err") return failed(o.query, r.error);
  return succeeded(r.value, o, r.value.explained, warnings, r.value.truncated);
}

if (import.meta.main) {
  const out = await command(process.argv.slice(2));
  if (out.out !== "") process.stdout.write(`${out.out}\n`);
  if (out.err !== "") process.stderr.write(`${out.err}\n`);
  process.exitCode = out.code;
}
