// Spec: 0006-agents FR-014
/**
 * The adapter `codex` (commons ergonex 0006-agents FR-014): the brief as a block of `AGENTS.md` (the project's, or the user's `~/.codex/AGENTS.md`) and the table `[mcp_servers.ergonex]` of
 * `config.toml` with the absolute path of the command and a startup timeout of 30 seconds. `codex mcp list` reads the configuration and does not connect, so nothing here says the server works.
 *
 * @module
 */
import { join } from "../../../platform/r-path.ts";
import { setBlock, setCodexServer } from "../../files.ts";
import { BRIEF_BLOCK } from "./claude-code.ts";
import { folderOf, instructionsFile, type HarnessAdapter, type Step } from "./port.ts";

/** The adapter. */
export const codex: HarnessAdapter = {
  harness: "codex",
  steps: (site) => {
    const user = site.scope === "user";
    const codexHome = join(site.home, ".codex");
    const ins = user && site.distro.sharedInstructions(site.home) === undefined ? { path: join(codexHome, "AGENTS.md"), shared: false } : instructionsFile(site, site.folder);
    const config = user ? join(codexHome, "config.toml") : join(site.folder, ".codex", "config.toml");
    const steps: Step[] = [
      { kind: "file", path: ins.path, what: "the brief, as a block of AGENTS.md", edit: (old) => setBlock(old ?? "", BRIEF_BLOCK, site.brief), ...(ins.shared ? { onlyIfDir: folderOf(ins.path) } : {}) },
      {
        kind: "file",
        path: config,
        what: "register the tool server in config.toml",
        edit: (old) => setCodexServer(old ?? "", "ergonex", site.ergonexPath, ["mcp"], 30),
        ...(user && site.distro.id === "omarchy" ? { onlyIfDir: codexHome } : {}),
      },
    ];
    return Promise.resolve(steps);
  },
};
