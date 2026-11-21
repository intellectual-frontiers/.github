// Spec: 0001-arcactl-pg-kit FR-008
/**
 * The check of the acceptance kits of this library (`bun run acceptance` runs it, in `commons/data`): the trace of each kit's sources and checks to the acceptance specifications (`acceptance/spec-kit`, commons 0015-trace), what
 * its table of enforcement says of each check, and the rule that keeps the three tiers of specifications apart: an acceptance specification may cite the library's, and nothing of the library's or of the repository's may cite an
 * acceptance specification or name a kit. Findings of the trace are held against `trace.baseline.txt`, which only shrinks.
 *
 * ```sh
 * bun acceptance/tools/check.ts                    check
 * bun acceptance/tools/check.ts --write-baseline   hold what is found now (the first time only)
 * bun acceptance/tools/check.ts --write            write the notes of the table of enforcement from the checks
 * ```
 *
 * @module
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as kernel from "@intellectual-frontiers/mizan/trace";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { noteOf, type Proof, rowsOf, staleRows } from "../../tools/enforcement.ts";

const ACCEPTANCE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ACCEPTANCE, "..");
const COMMONS = join(DATA, "..");
const BASELINE = "trace.baseline.txt";
const COMMENTS = [
  "# The findings of the trace check of the acceptance kits of commons data (acceptance/tools/check.ts) that existed when each was first held.",
  "# A new finding fails the check, and so does a line below that no longer occurs: when you fix one, delete its line.",
  "# Never add a line to make a check pass.",
] as const;

const PROVES = /\bproves\(\s*\[([^\]]*)\]\s*,\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;

/** The kits: each folder of `acceptance/` that is not the specification kit or the tools. */
export const kits = (): readonly string[] =>
  readdirSync(ACCEPTANCE).filter((d) => d !== "spec-kit" && d !== "tools" && d !== "node_modules" && statSync(join(ACCEPTANCE, d)).isDirectory()).toSorted();

/** Every check of every kit (`<kit>/checks/*.test.ts`) with the requirements it proves, by its path from `acceptance/`. */
export function proofsOf(): readonly Proof[] {
  const out: Proof[] = [];
  for (const kit of kits()) {
    const dir = join(ACCEPTANCE, kit, "checks");
    let names: string[] = [];
    try {
      names = readdirSync(dir).filter((f) => f.endsWith(".test.ts")).toSorted();
    } catch {
      continue;
    }
    for (const name of names) {
      for (const m of readFileSync(join(dir, name), "utf8").matchAll(PROVES)) {
        const tags = [...(m[1] ?? "").matchAll(/"([^"]+)"/g)].map((t) => t[1] as string);
        const raw = m[2] ?? "";
        out.push({ file: `${kit}/checks/${name}`, title: JSON.parse(raw.startsWith("`") ? JSON.stringify(raw.slice(1, -1)) : raw) as string, tags });
      }
    }
  }
  return out;
}

/** The trace of the kits to the acceptance specifications. */
export async function traceFindings(): Promise<readonly kernel.Keyed[]> {
  const folders = (sub: (kit: string) => readonly string[]): string[] => kits().flatMap((k) => sub(k).map((s) => `${k}/${s}`));
  const subs = (k: string): string[] => readdirSync(join(ACCEPTANCE, k)).filter((s) => statSync(join(ACCEPTANCE, k, s)).isDirectory());
  const sources = await runtime.readSources(ACCEPTANCE, ["tools", ...folders((k) => subs(k).filter((s) => s !== "checks"))]);
  const tests = await runtime.readSources(ACCEPTANCE, folders((k) => (subs(k).includes("checks") ? ["checks"] : [])));
  const specs = await runtime.readSpecs(ACCEPTANCE, "spec-kit/specs");
  return kernel.traceFindings({ specs, sources, tests, ontology: [], specsFolder: "spec-kit/specs" });
}

/** The acceptance specifications' ids, from the registry. */
export const specIds = (): readonly string[] =>
  readFileSync(join(ACCEPTANCE, "spec-kit/registry.tsv"), "utf8").split("\n").slice(1).filter((l) => l.trim() !== "").map((l) => {
    const [number, slug] = l.split("\t");
    return `${number}-${slug}`;
  });

const walk = (dir: string, keep: (p: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") return [];
    return e.isDirectory() ? walk(p, keep) : keep(p) ? [p] : [];
  });

/** What in the library's and the repository's specifications and the library's tests names an acceptance specification or a kit: nothing may. */
export function citations(planted: readonly { readonly path: string; readonly text: string }[] = []): readonly string[] {
  const ids = specIds();
  const names = [...ids, ...kits().map((k) => `acceptance/${k}`)];
  const places = [
    ...walk(join(COMMONS, "spec-kit"), (p) => /\.(md|tsv)$/.test(p)),
    ...walk(join(DATA, "spec-kit"), (p) => /\.(md|tsv)$/.test(p)),
    ...walk(join(DATA, "suite"), (p) => p.endsWith(".ts")),
  ];
  const out: string[] = [];
  const texts = [...places.map((p) => ({ path: relative(COMMONS, p), text: readFileSync(p, "utf8") })), ...planted];
  for (const { path, text } of texts) {
    for (const n of names) if (text.includes(n)) out.push(`${path}: names ${n}, an acceptance specification or kit: the specifications of the library and of the repository never cite the acceptance kits`);
  }
  return out;
}

/** The command line: the exit status, and what to print. */
export async function main(argv: readonly string[]): Promise<{ readonly code: 0 | 1; readonly lines: readonly string[] }> {
  const lines: string[] = [];
  let code: 0 | 1 = 0;
  const found = await traceFindings();
  if (argv.includes("--write-baseline")) {
    writeFileSync(join(ACCEPTANCE, BASELINE), kernel.formatBaseline(found, COMMENTS));
    return { code: 0, lines: [`acceptance-check: wrote ${BASELINE} (${found.length} findings held)`] };
  }
  const baseline = (() => {
    try {
      return readFileSync(join(ACCEPTANCE, BASELINE), "utf8");
    } catch {
      return "";
    }
  })();
  const judged = kernel.judge(found, kernel.parseBaseline(baseline));
  if (!kernel.passes(judged)) code = 1;
  lines.push(...kernel.report(judged, "acceptance-check", BASELINE));
  // the table of enforcement
  const file = join(ACCEPTANCE, "spec-kit/enforcement.tsv");
  const proofs = proofsOf();
  if (argv.includes("--write")) {
    writeFileSync(
      file,
      rowsOf(readFileSync(file, "utf8")).map((c) => {
        const note = c.length >= 4 && c[1] === "check" ? noteOf(proofs, c[0] as string) : undefined;
        return note === undefined ? c.join("\t") : [c[0], c[1], c[2], note].join("\t");
      }).join("\n"),
    );
  }
  const stale = staleRows(readFileSync(file, "utf8"), proofs);
  if (stale.length > 0) {
    code = 1;
    lines.push(...stale.map((s) => `acceptance-check: enforcement: ${s}`));
  }
  const cited = citations();
  if (cited.length > 0) {
    code = 1;
    lines.push(...cited.map((c) => `acceptance-check: ${c}`));
  }
  return { code, lines };
}

if (import.meta.main) {
  const r = await main(process.argv.slice(2));
  for (const line of r.lines) console.log(line);
  process.exit(r.code);
}
