// Spec: 0006-agents FR-016
/**
 * The adapter `other` (commons ergonex 0006-agents FR-016): only the block of `AGENTS.md`, which every harness that reads that convention finds.
 *
 * @module
 */
import { setBlock } from "../../files.ts";
import { BRIEF_BLOCK } from "./claude-code.ts";
import { folderOf, instructionsFile, type HarnessAdapter } from "./port.ts";

/** The adapter. */
export const other: HarnessAdapter = {
  harness: "other",
  steps: (site) => {
    const ins = instructionsFile(site, site.folder);
    return Promise.resolve([{ kind: "file" as const, path: ins.path, what: "the brief, as a block of AGENTS.md", edit: (old: string | undefined) => setBlock(old ?? "", BRIEF_BLOCK, site.brief), ...(ins.shared ? { onlyIfDir: folderOf(ins.path) } : {}) }]);
  },
};
