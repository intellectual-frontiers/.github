// Spec: 0003-workbench-contract FR-006
/**
 * Collection: what the units of a repository contribute, read from their manifests. A library of commons keeps its contribution in its own `library.ts` (the field `workbench`), so that a library that is not part of a task
 * is never asked and one that is carries its own list of what it needs. This reads the manifests of a folder (the folders of a library, and of the extensions inside one) and decodes each contribution; a manifest that has none
 * contributes none.
 *
 * @example
 * ```ts
 * import { readManifestContributions } from "./collect.ts";
 * // const r = await readManifestContributions("/repo", "commons");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { decodeContribution, type Contribution } from "@intellectual-frontiers/workbench/governance";
import { fs, path } from "@intellectual-frontiers/system";

/** A manifest found: the unit it is of (its `name`), the folder it is in and what it says of the workbench. */
export type Manifest = { readonly unit: string; readonly folder: string; readonly workbench: unknown };

const MANIFEST = "library.ts";

/** The manifests of the libraries below `commons/` of a repository (a library and the extensions in its folder), by the folder they are in. */
export async function readManifests(root: string, folder = "commons"): Promise<readonly Manifest[]> {
  const base = path.join(root, folder);
  const dirs: string[] = [];
  const names = (dir: string): readonly string[] => {
    try {
      return fs.readDirSync(dir).filter((e) => e.isDirectory && e.name !== "node_modules").map((e) => e.name).sort();
    } catch {
      return [];
    }
  };
  for (const a of names(base)) {
    if (await fs.exists(path.join(base, a, MANIFEST))) dirs.push(a);
    for (const b of names(path.join(base, a))) if (await fs.exists(path.join(base, a, b, MANIFEST))) dirs.push(`${a}/${b}`);
  }
  const out: Manifest[] = [];
  for (const d of dirs) {
    const loaded = (await import(path.toFileUrl(path.join(base, d, MANIFEST)).href).catch(() => undefined)) as { library?: { name?: unknown; workbench?: unknown } } | undefined;
    const name = typeof loaded?.library?.name === "string" ? loaded.library.name : d.replace(/\//gu, "-");
    out.push({ unit: name, folder: `${folder}/${d}`, workbench: loaded?.library?.workbench });
  }
  return out;
}

/** The contributions the manifests declare, or every reason one is not valid: a manifest with no `workbench` field contributes nothing and is left out. */
export async function readManifestContributions(root: string, folder = "commons"): Promise<Result<readonly Contribution[], readonly string[]>> {
  const out: Contribution[] = [];
  const problems: string[] = [];
  for (const m of await readManifests(root, folder)) {
    if (m.workbench === undefined) continue;
    const c = decodeContribution(m.unit, m.workbench);
    if (c.kind === "err") problems.push(...c.error);
    else out.push(c.value);
  }
  return problems.length > 0 ? err(problems) : ok(out);
}
