// Spec: 0001-crypto FR-009
/**
 * The check `bun run verify` runs on the library (commons 0027-commons-libraries FR-006): the trace of its sources and tests to its own specifications (commons 0015-trace), the findings held against
 * `trace.baseline.txt`, which only shrinks. It prints the lines of the judgement and exits with 0, or with 1 where a finding is new or a line of the baseline is stale.
 *
 * ```sh
 * bun tools/check.ts                    check
 * bun tools/check.ts --write-baseline   hold what is found now (the first time only)
 * ```
 *
 * @module
 */
import { trace as kernel } from "@intellectual-frontiers/commons/ts/kernel";
import { fs, path } from "@intellectual-frontiers/system";
import { trace as runtime } from "@intellectual-frontiers/commons/ts/runtime";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const BASELINE = "trace.baseline.txt";
const COMMENTS = [
  "# The findings of the trace check of Crypto (tools/check.ts) that existed when it was first held.",
  "# A new finding fails the check, and so does a line below that no longer occurs: when you fix one, delete its line.",
  "# Never add a line to make a check pass.",
] as const;

/** Every finding of the library at `root`: the trace of its sources and tests to its specifications. */
export async function findings(root: string): Promise<readonly kernel.Keyed[]> {
  const sources = await runtime.readSources(root, ["about.ts", "src", "tools"]);
  const tests = await runtime.readSources(root, ["suite"]);
  const specs = await runtime.readSpecs(root, "spec-kit/specs");
  return kernel.traceFindings({
    specs,
    sources,
    tests,
    ontology: [],
    specsFolder: "spec-kit/specs",
  });
}

/** The command line: the exit status, and what to print. */
export async function main(argv: readonly string[]): Promise<{ readonly code: 0 | 1; readonly lines: readonly string[] }> {
  const found = await findings(ROOT);
  if (argv.includes("--write-baseline")) {
    await fs.writeTextFile(path.join(ROOT, BASELINE), kernel.formatBaseline(found, COMMENTS));
    return {
      code: 0,
      lines: [`crypto-check: wrote ${BASELINE} (${found.length} findings held)`],
    };
  }
  const text = await fs.readTextFile(path.join(ROOT, BASELINE)).catch(() => "");
  const judged = kernel.judge(found, kernel.parseBaseline(text));
  return {
    code: kernel.passes(judged) ? 0 : 1,
    lines: kernel.report(judged, "crypto-check", BASELINE),
  };
}

if (import.meta.main) {
  const r = await main(process.argv.slice(2));
  for (const line of r.lines) console.log(line);
  process.exit(r.code);
}
