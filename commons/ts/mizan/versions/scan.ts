/**
 * The records of the works under a folder, found by walking it (commons 0026-works-versioning FR-032): every file named `release.ts`, with its path from the folder, for the rule plugin of
 * `holdHarness` that judges what a folder can judge offline.
 *
 * @remarks
 * Host layer: it reads the file system. It skips `node_modules`, `.git`, `.claude` and `_site`, which hold no work's record. The command (`../versions.ts`) reads the tracked files of Git instead,
 * so that an untracked file is no work; this walk is for a harness's check of a folder with no Git.
 *
 * @limits
 * It reads text and does not decode it: `plugin.ts` does.
 *
 * @example
 * ```ts
 * import { readWorks } from "./scan.ts";
 * readWorks(".").map((w) => w.path); // ["commons/ts/release.ts", ...]
 * ```
 *
 * @module
 */
import { readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import type { WorkFile } from "./plugin.ts";
import { RECORD_FILE } from "./record.ts";

const SKIPPED = new Set(["node_modules", ".git", ".claude", "_site"]);

/** Every `release.ts` under `root`, as `{ path (from root, with /), text }`, in path order. */
export function readWorks(root: string): readonly WorkFile[] {
  const out: WorkFile[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const e of readDirSync(dir)) {
      const path = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory) {
        if (!SKIPPED.has(e.name)) walk(join(dir, e.name), path);
      } else if (e.isFile && e.name === RECORD_FILE) out.push({ path, text: readTextFileSync(join(dir, e.name)) });
    }
  };
  walk(root, "");
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
