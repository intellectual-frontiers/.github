// Spec: 0001-kanon-checker FR-007; 0002-kanon-content-checks FR-010
/**
 * The command a library that declares `kanon` runs in its `verify` (commons 0033-kanon FR-014): the import check over its own table, from its folder.
 *
 *     bun ../kanon/src/check.ts                    check the library in the working folder; exit 1 on a finding the baseline does not hold, or a line of it that no longer occurs
 *     bun ../kanon/src/check.ts --root DIR         the library's folder
 *     bun ../kanon/src/check.ts --write-baseline   hold what is found now in kanon.baseline.txt (the first time only)
 *
 * @remarks
 * Exit status: 0 where nothing is new or stale, 1 where something is, 2 where the table cannot be read.
 *
 * @module
 */
import process from "node:process";
import { readTextFileSync, writeTextFileSync, existsSync } from "@intellectual-frontiers/system/fs";
import { stdio } from "@intellectual-frontiers/system";
import { verifyBundle } from "./bundle.ts";
import { droppedFindings } from "./dropped.ts";
import { modelFindings } from "./vocabulary.ts";
import type { Finding } from "./imports.ts";
import { BASELINE, findings, judge, parseBaseline, readBundle } from "./host.ts";

const COMMENTS = [
  "# The findings of the Kanon import check (bun ../kanon/src/check.ts) that existed when each was first held.",
  "# A new finding fails the check, and so does a line below that no longer occurs: when you fix one, delete its line.",
  "# Never add a line to make a check pass.",
].join("\n");

type RecordOfFinding = { readonly rule: string; readonly file: string; readonly line: number; readonly message: string; readonly key: string };
type CheckResult = { readonly code: 0 | 1 | 2; readonly lines: readonly string[]; readonly records?: readonly RecordOfFinding[] };
const describe = (f: Finding): string => `${f.file}:${f.line}: ${f.rule}: ${f.message}`;

/** Run the check over `root`; the lines to print and the exit status. */
export function run(root: string, argv: readonly string[]): CheckResult {
  const found = findings(root);
  if (found.kind === "err") return { code: 2, lines: [`kanon-check: ${found.error}`] };
  const file = `${root}/${BASELINE}`;
  if (argv.includes("--write-baseline")) {
    const syntax = found.value.filter((f) => f.rule === "layers/syntax");
    if (syntax.length !== 0) return { code: 1, lines: syntax.map(describe), records: syntax };
    const keys = [...new Set(found.value.map((f) => f.key))].sort();
    writeTextFileSync(file, `${COMMENTS}\n${keys.join("\n")}${keys.length === 0 ? "" : "\n"}`);
    return { code: 0, lines: [`kanon-check: wrote ${BASELINE} (${keys.length} findings held)`] };
  }
  const baseline = parseBaseline(existsSync(file) ? readTextFileSync(file) : "");
  const { fresh, stale } = judge(found.value, baseline);
  const lines = [
    ...fresh.map(describe),
    ...stale.map((k) => `${BASELINE}: stale, no longer occurs: ${k}`),
  ];
  if (lines.length === 0)
    return { code: 0, lines: [`kanon-check: passed: ${fresh.length} new, ${stale.length} stale, ${baseline.size} held by ${BASELINE}`] };
  return { code: 1, lines, records: [...fresh, ...stale.map((key) => ({
    rule: "layers/stale-baseline", file: BASELINE, line: 1, message: `No finding matches ${key}`, key,
  }))] };
}

/** Verify the bundle before checking any of its decoded content. */
export async function runBundle(dir: string): Promise<CheckResult> {
  const input = readBundle(dir);
  if (input.kind === "err") return { code: 2, lines: [`kanon-check: ${input.error}`] };
  const bundle = await verifyBundle(input.value);
  if (bundle.kind === "err") return {
    code: 2,
    lines: bundle.error.map((fault) => `${fault.path}:1: kanon/bundle: ${fault.message}`),
    records: bundle.error.map((fault) => ({ rule: "kanon/bundle", file: fault.path, line: 1, message: fault.message, key: `${fault.kind} ${fault.path}` })),
  };
  const found = [...modelFindings(bundle.value.model), ...droppedFindings(bundle.value.model)];
  return found.length === 0
    ? { code: 0, lines: ["kanon-check: verified bundle and model"] }
    : { code: 1, lines: found.map(describe), records: found };
}

function rootOf(argv: readonly string[]): string {
  const i = argv.indexOf("--root");
  const given = i >= 0 ? argv[i + 1] : undefined;
  return given ?? process.cwd();
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const bundle = argv.indexOf("--bundle");
  const dir = bundle < 0 ? undefined : argv[bundle + 1];
  const r: CheckResult = bundle < 0 ? run(rootOf(argv), argv) : dir === undefined
    ? { code: 2, lines: ["kanon-check: --bundle needs a directory"] }
    : await runBundle(dir);
  for (const l of r.lines) (r.code === 0 ? stdio.stdout : stdio.stderr).writeSync(`${l}\n`);
  const incomplete = r.code === 2 || r.lines.some((line) => line.includes(": layers/syntax:"));
  const outcome = incomplete ? "tool-error" : r.code === 0 ? "ok" : "findings";
  for (const record of r.records ?? []) stdio.stdout.writeSync(`kanon-check: finding ${JSON.stringify(record)}\n`);
  stdio.stdout.writeSync(`kanon-check: ${bundle < 0 ? "import" : "model"} result ${outcome}\n`);
  process.exit(r.code);
}
