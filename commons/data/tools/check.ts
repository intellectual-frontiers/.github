// Spec: 0001-layers FR-011
/**
 * The check `bun run verify` runs on the library (commons data 0001-layers FR-011, commons 0027-commons-libraries FR-006): the trace of its sources and tests
 * to its own specifications (commons 0015-trace) and the layers check of this library (`layers.ts`), their findings held against `trace.baseline.txt`, which only
 * shrinks. It prints the lines of the judgement and exits with 0, or with 1 where a finding is new or a line of the baseline is stale.
 *
 * ```sh
 * bun tools/check.ts                    check
 * bun tools/check.ts --write-baseline   hold what is found now (the first time only)
 * ```
 *
 * @module
 */
import * as kernel from "@intellectual-frontiers/mizan/trace";
import { fs, path } from "@intellectual-frontiers/system";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { type LayerFinding, layerFindings } from "./layers.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const BASELINE = "trace.baseline.txt";
const COMMENTS = [
  "# The findings of the trace and layers checks of commons data (tools/check.ts) that existed when each was first held.",
  "# A new finding fails the check, and so does a line below that no longer occurs: when you fix one, delete its line.",
  "# Never add a line to make a check pass.",
] as const;

/** Every finding of the library at `root`: the trace first, then the layers. */
export async function findings(root: string): Promise<readonly kernel.Keyed[]> {
  const pkg = JSON.parse(await fs.readTextFile(path.join(root, "package.json"))) as { exports?: Record<string, string> };
  const sources = await runtime.readSources(root, ["about.ts", "engine", "governance", "issues", "models", "extensions", "sql", "tools", "examples"]);
  const tests = await runtime.readSources(root, ["suite"]);
  const specs = await runtime.readSpecs(root, "spec-kit/specs");
  const traced = kernel.traceFindings({ specs, sources, tests, ontology: [], specsFolder: "spec-kit/specs" });
  const layered: readonly LayerFinding[] = layerFindings([...sources, ...tests], pkg.exports ?? {});
  return [...traced, ...layered];
}

/** The command line: the exit status, and what to print. */
export async function main(argv: readonly string[]): Promise<{ readonly code: 0 | 1; readonly lines: readonly string[] }> {
  const found = await findings(ROOT);
  if (argv.includes("--write-baseline")) {
    await fs.writeTextFile(path.join(ROOT, BASELINE), kernel.formatBaseline(found, COMMENTS));
    return { code: 0, lines: [`data-check: wrote ${BASELINE} (${found.length} findings held)`] };
  }
  const text = await fs.readTextFile(path.join(ROOT, BASELINE)).catch(() => "");
  const judged = kernel.judge(found, kernel.parseBaseline(text));
  return { code: kernel.passes(judged) ? 0 : 1, lines: kernel.report(judged, "data-check", BASELINE) };
}

if (import.meta.main) {
  const r = await main(process.argv.slice(2));
  for (const line of r.lines) console.log(line);
  process.exit(r.code);
}
