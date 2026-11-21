// Spec: 0003-findings-importers FR-006
/**
 * Reading report files: a file given by name must be a report an importer reads; a folder is walked, and a JSON or XML file in it that no importer reads is skipped without a word. The findings of all the reports are given identities (the same finding in two reports is one, and the count of repeats is said),
 * and each is kept with the file it was read from.
 *
 * @example
 * ```ts
 * import { importPaths } from "./files.ts";
 * // await importPaths(["reports/"], { asset: "portal" }) // { findings, problems, files, repeats }
 * ```
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { identify, type Finding, type RawFinding } from "@intellectual-frontiers/findings/governance";
import { detectFormat, importReport, type ReportFormat } from "@intellectual-frontiers/findings/logical";

/** What reading several paths gave. */
export type ImportedPaths = { readonly findings: readonly Finding[]; readonly problems: readonly string[]; readonly files: readonly { readonly source: string; readonly format: ReportFormat; readonly findings: number }[]; readonly repeats: number };

const SKIPPED = new Set(["node_modules", ".git"]);
const READABLE = /\.(json|jsonl|sarif|xml|nessus)$/i;

/** The findings of the reports at the paths; `asset` is what a SARIF report is of. */
export async function importPaths(paths: readonly string[], options: { readonly asset?: string } = {}): Promise<ImportedPaths> {
  const raw: RawFinding[] = [];
  const problems: string[] = [];
  const files: { source: string; format: ReportFormat; findings: number }[] = [];
  const one = async (file: string, explicit: boolean): Promise<void> => {
    const text = await fs.readTextFile(file).catch(() => undefined);
    if (text === undefined) {
      if (explicit) problems.push(`${file}: cannot be read`);
      return;
    }
    if (detectFormat(text) === undefined && !explicit) return;
    const r = importReport(file, text, options.asset ?? "");
    problems.push(...r.problems);
    if (r.format !== undefined && r.problems.length === 0) files.push({ source: file, format: r.format, findings: r.findings.length });
    raw.push(...r.findings);
  };
  for (const p of paths) {
    const st = await fs.stat(p).catch(() => undefined);
    if (st === undefined) {
      problems.push(`${p}: no such file or folder`);
      continue;
    }
    if (!st.isDirectory) {
      await one(p, true);
      continue;
    }
    for (const rel of await fs.walkFiles(p)) {
      if (rel.split("/").some((part) => SKIPPED.has(part)) || !READABLE.test(rel)) continue;
      await one(path.join(p, rel), false);
    }
  }
  const { findings, repeats } = await identify(raw);
  return { findings, problems, files, repeats };
}
