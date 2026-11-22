// Spec: 0006-agents FR-013
/**
 * The adapter `claude-code` (commons ergonex 0006-agents FR-013, OQ-6): the brief as a block of `AGENTS.md`, a `CLAUDE.md` that imports it where there is none, the server `ergonex` registered with
 * `claude mcp add` where that command exists and in `.mcp.json` where it does not, the server enabled in the user's `settings.json` so that no approval is asked, and a `SessionStart` hook that gives
 * Claude Code the brief as context.
 *
 * @module
 */
import { join } from "../../../platform/r-path.ts";
import { setBlock, setClaudeSettings, setMcpServer } from "../../files.ts";
import { folderOf, instructionsFile, type HarnessAdapter, type Step } from "./port.ts";

/** The block of the brief in `AGENTS.md`. */
export const BRIEF_BLOCK = "ergonex-brief";
const OWN_HOOK = /\bagent brief --harness claude-code\b/;

/** The adapter. */
export const claudeCode: HarnessAdapter = {
  harness: "claude-code",
  steps: (site) => {
    const user = site.scope === "user";
    const claudeHome = join(site.home, ".claude");
    const harnessFolder = user ? claudeHome : site.folder;
    const steps: Step[] = [];
    const ins = instructionsFile(site, harnessFolder);
    steps.push({ kind: "file", path: ins.path, what: "the brief, as a block of AGENTS.md", edit: (old) => setBlock(old ?? "", BRIEF_BLOCK, site.brief), ...(ins.shared ? { onlyIfDir: folderOf(ins.path) } : {}) });
    if (!ins.shared) {
      const claudeMd = join(harnessFolder, "CLAUDE.md");
      steps.push({ kind: "file", path: claudeMd, what: "CLAUDE.md imports AGENTS.md", edit: (old) => (old !== undefined && /^@AGENTS\.md\s*$/m.test(old) ? old : setBlock(old ?? "", "ergonex-import", "@AGENTS.md")) });
    }
    const claude = site.which("claude");
    if (claude !== undefined) {
      steps.push({
        kind: "command",
        argv: ["claude", "mcp", "add", "--scope", user ? "user" : "project", "ergonex", "--", site.ergonexPath, "mcp"],
        what: "register the tool server with claude mcp add",
        cwd: site.folder,
        probe: ["claude", "mcp", "get", "ergonex"],
        probeContains: site.ergonexPath,
      });
    } else if (!user) {
      steps.push({ kind: "file", path: join(site.folder, ".mcp.json"), what: "register the tool server in .mcp.json", edit: (old) => setMcpServer(old ?? "", ".mcp.json", "ergonex", { command: site.ergonexPath, args: ["mcp"] }) });
    }
    const settings = user ? join(claudeHome, "settings.json") : join(site.folder, ".claude", "settings.json");
    // where a distribution keeps one shared file for every harness, no folder is made for a harness that was never used (FR-017)
    const unused = user && site.distro.id === "omarchy" ? { onlyIfDir: claudeHome } : {};
    const hook = `${site.ergonexPath} agent brief --harness claude-code --format md`;
    steps.push({ kind: "file", path: settings, what: "the SessionStart hook that gives the brief", edit: (old) => setClaudeSettings(old ?? "", settings, "ergonex", hook, (c) => OWN_HOOK.test(c), false), ...unused });
    if (!user) {
      const userSettings = join(site.home, ".claude", "settings.json");
      steps.push({ kind: "file", path: userSettings, what: "enable the project server without a prompt", edit: (old) => setClaudeSettings(old ?? "", userSettings, "ergonex", `${site.ergonexPath} agent brief --harness claude-code --format md`, (c) => OWN_HOOK.test(c), true) });
    }
    return Promise.resolve(steps);
  },
};
