// Spec: 0003-estate-iac-importers FR-008
/**
 * Reading files for the importers: a path that is a file is read and must be one an importer reads; a path that is a folder is walked, and a JSON or YAML file in it that no importer reads is skipped without a word (a folder holds much besides infrastructure), except that folders of tools
 * (`node_modules`, `.git`, `.terraform`) are not entered. The files are read as text and nothing is run. Two assets of one identity in two files are one problem and the first is kept.
 *
 * @example
 * ```ts
 * import { importPaths } from "./files.ts";
 * // await importPaths(["infra/plan.json", "deploy/"]) // { assets, links, problems, files }
 * ```
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import type { Imported, ImportedLink, Tool } from "@intellectual-frontiers/estate-iac/governance";
import { detectTool, importText } from "@intellectual-frontiers/estate-iac/logical";

/** What reading several paths gave. */
export type ImportedPaths = { readonly assets: readonly Imported[]; readonly links: readonly ImportedLink[]; readonly problems: readonly string[]; readonly files: readonly { readonly source: string; readonly tool: Tool; readonly assets: number }[] };

const SKIPPED = new Set(["node_modules", ".git", ".terraform", ".terragrunt-cache"]);
const READABLE = /\.(json|ya?ml)$/i;

/** The assets and links of the files and folders at the paths. `prefer` says which of OpenTofu and Terraform wrote a `show -json`. */
export async function importPaths(paths: readonly string[], prefer: "opentofu" | "terraform" = "terraform"): Promise<ImportedPaths> {
  const assets: Imported[] = [];
  const links: ImportedLink[] = [];
  const problems: string[] = [];
  const files: { source: string; tool: Tool; assets: number }[] = [];
  const seen = new Map<string, string>();
  const one = async (file: string, explicit: boolean): Promise<void> => {
    const text = await fs.readTextFile(file).catch(() => undefined);
    if (text === undefined) {
      if (explicit) problems.push(`${file}: cannot be read`);
      return;
    }
    if (detectTool(file, text, prefer) === undefined && !explicit) return;
    const r = importText(file, text, prefer);
    problems.push(...r.problems);
    const kept = new Set<string>();
    const clashes = new Map<string, number>();
    for (const a of r.assets) {
      const first = seen.get(a.id);
      if (first !== undefined) {
        clashes.set(first, (clashes.get(first) ?? 0) + 1);
        continue;
      }
      seen.set(a.id, file);
      kept.add(a.id);
      assets.push(a);
    }
    for (const [first, n] of clashes) problems.push(`${file}: ${n} identit${n === 1 ? "y is" : "ies are"} also in ${first}; the first is kept`);
    links.push(...r.links.filter((l) => kept.has(l.from) && kept.has(l.to)));
    if (r.problems.length === 0 || r.assets.length > 0) files.push({ source: file, tool: r.tool, assets: kept.size });
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
  return { assets, links, problems, files };
}
