// Spec: 0001-kanon-checker FR-007
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
import { BASELINE, findings, judge, parseBaseline } from "./host.ts";

const COMMENTS = [
  "# The findings of the Kanon import check (bun ../kanon/src/check.ts) that existed when each was first held.",
  "# A new finding fails the check, and so does a line below that no longer occurs: when you fix one, delete its line.",
  "# Never add a line to make a check pass.",
].join("\n");

/** Run the check over `root`; the lines to print and the exit status. */
export function run(root: string, argv: readonly string[]): { readonly code: 0 | 1 | 2; readonly lines: readonly string[] } {
  const found = findings(root);
  if (found.kind === "err") return { code: 2, lines: [`kanon-check: ${found.error}`] };
  const file = `${root}/${BASELINE}`;
  if (argv.includes("--write-baseline")) {
    const keys = [...new Set(found.value.map((f) => f.key))].sort();
    writeTextFileSync(file, `${COMMENTS}\n${keys.join("\n")}${keys.length === 0 ? "" : "\n"}`);
    return { code: 0, lines: [`kanon-check: wrote ${BASELINE} (${keys.length} findings held)`] };
  }
  const baseline = parseBaseline(existsSync(file) ? readTextFileSync(file) : "");
  const { fresh, stale } = judge(found.value, baseline);
  const lines = [
    ...fresh.map((f) => `${f.file}:${f.line}: ${f.rule}: ${f.message}`),
    ...stale.map((k) => `${BASELINE}: stale, no longer occurs: ${k}`),
  ];
  if (lines.length === 0)
    return { code: 0, lines: [`kanon-check: passed: ${fresh.length} new, ${stale.length} stale, ${baseline.size} held by ${BASELINE}`] };
  return { code: 1, lines };
}

function rootOf(argv: readonly string[]): string {
  const i = argv.indexOf("--root");
  const given = i >= 0 ? argv[i + 1] : undefined;
  return given ?? process.cwd();
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const r = run(rootOf(argv), argv);
  for (const l of r.lines) (r.code === 0 ? stdio.stdout : stdio.stderr).writeSync(`${l}\n`);
  process.exit(r.code);
}
