/**
 * The runtime's part of trace and layers (commons 0015-trace FR-011): it reads the files the kernel's checks judge (`kernel/trace.ts`,
 * `kernel/layers.ts`) and holds their findings against a baseline file. A harness's tool calls it and prints the lines it gives; it prints
 * nothing itself.
 *
 * @example
 * ```ts
 * import * as t from "../trace.ts";
 * import { holdBaseline, readSources, readSpecs } from "./trace.ts";
 * const root = ".";
 * const findings = t.traceFindings({
 *   specs: await readSpecs(root, "specs"),
 *   sources: await readSources(root, ["src"]),
 *   tests: await readSources(root, ["tests"]),
 *   ontology: [],
 * });
 * const held = await holdBaseline({ root, file: "tools/trace.baseline.txt", findings, name: "trace" });
 * for (const line of held.lines) console.log(line);
 * ```
 *
 * @module
 */
import { formatBaseline, judge, parseBaseline, parseSpec, report, type Finding, type SourceFile, type Spec } from "../trace.ts";
import { ensureDir, listDirs, readTextOr, walkFiles, writeTextFile } from "@intellectual-frontiers/system/fs";
import { dirname, join } from "@intellectual-frontiers/system/path";

/** The specifications of a folder (`<folder>/NNN-slug/spec.md`, and `reviewed.tsv` where there is one), in the order of their names. */
export async function readSpecs(root: string, folder = "specs"): Promise<readonly Spec[]> {
  const out: Spec[] = [];
  for (const slug of await listDirs(join(root, folder))) {
    const text = await readTextOr(join(root, folder, slug, "spec.md"));
    if (text === undefined) continue;
    out.push(parseSpec(slug, text, (await readTextOr(join(root, folder, slug, "reviewed.tsv"))) ?? ""));
  }
  return out;
}

/** A relative path with `/` between its parts, whatever the system's separator (FR-011). */
export function posixPath(p: string): string {
  return p.replaceAll("\\", "/");
}

/** The files under roots (folders or files, from `root`) whose names end in a suffix (`.ts` by default), leaving out `node_modules`, by path from `root` with `/`. */
export async function readSources(
  root: string,
  roots: readonly string[],
  suffixes: readonly string[] = [".ts"],
): Promise<readonly SourceFile[]> {
  const out: SourceFile[] = [];
  const keep = (rel: string): boolean => suffixes.some((s) => rel.endsWith(s)) && !rel.split("/").includes("node_modules");
  for (const r of roots) {
    const base = r.replace(/\/+$/, "");
    // Paths are relative and `/`-separated on every system (FR-011): Windows walks with `\\`.
    const rels = keep(base) ? [base] : (await walkFiles(join(root, base))).map((f) => `${base}/${posixPath(f)}`);
    for (const rel of rels) {
      if (!keep(rel)) continue;
      const text = await readTextOr(join(root, rel));
      if (text !== undefined) out.push({ path: rel, text: text.replaceAll("\r\n", "\n") });
    }
  }
  return out;
}

/** What `holdBaseline` is given: the repository, the baseline file (from it), the findings, the check's name, and whether to write. */
export type HoldOptions = {
  readonly root: string;
  readonly file: string;
  readonly findings: readonly Finding[];
  readonly name: string;
  readonly write?: boolean;
  /** The comment lines a written baseline begins with. */
  readonly comments?: readonly string[];
};

/** The lines to print and the exit status of a check held against its baseline. */
export type Held = { readonly code: 0 | 1; readonly lines: readonly string[] };

/** Findings held against a baseline file (FR-002, FR-003, FR-011), or, with `write`, the baseline written from them. */
export async function holdBaseline(o: HoldOptions): Promise<Held> {
  const path = join(o.root, o.file);
  if (o.write === true) {
    const text = formatBaseline(o.findings, o.comments ?? []);
    await ensureDir(dirname(path));
    await writeTextFile(path, text);
    return { code: 0, lines: [`${o.name}: wrote ${o.file} (${parseBaseline(text).length} findings held)`] };
  }
  const j = judge(o.findings, parseBaseline((await readTextOr(path)) ?? ""));
  return { code: j.fresh.length === 0 && j.stale.length === 0 ? 0 : 1, lines: report(j, o.name, o.file) };
}
