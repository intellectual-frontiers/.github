// Spec: 0006-agents FR-009
/**
 * What the brief and the doctor read of the machine (commons ergonex 0006-agents FR-009, FR-018): the repositories of the workspace with their state and last change, the pinned tools and whether each
 * is on the `PATH`, the hooks, and the distribution. The reading is the only impure part; `brief.ts` is pure.
 *
 * @module
 */
import { existsSync, readTextOr } from "../../platform/r-fs.ts";
import { join } from "../../platform/r-path.ts";
import { run, which } from "../../platform/r-proc.ts";
import { describeState } from "../../commands/status.ts";
import { native, type Loaded } from "../../host/workspace.ts";
import { observeFacts } from "../../host/observe.ts";
import { classify } from "../../state.ts";
import { HOOK_NAMES } from "../../templates/hooks.ts";
import { AREA } from "../../host/workspace.ts";
import { type BriefInput, type BriefRepo, checkLines } from "../brief.ts";
import { type Distro, distroOf } from "../distro.ts";
import type { Identity } from "../persona.ts";

const GIT_ENV = { GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" };

/** The distribution of this machine, from `/etc/os-release` where it exists. */
export async function thisDistro(): Promise<Distro> {
  return distroOf(await readTextOr("/etc/os-release", undefined));
}

/** The repositories of the manifest as the map shows them. */
export async function repoRows(loaded: Loaded): Promise<readonly BriefRepo[]> {
  const out: BriefRepo[] = [];
  for (const r of loaded.manifest.repositories) {
    const folder = native(loaded, r.path);
    const facts = await observeFacts(folder, {});
    const state = facts.kind === "ok" ? describeState(classify(facts.value, r.ref)) : "unknown (git cannot be run)";
    let changed = 0;
    if (existsSync(join(folder, ".git"))) {
      const log = await run(["git", "-C", folder, "log", "-1", "--format=%ct"], { env: GIT_ENV });
      if (log.success) changed = Number.parseInt(log.stdout.trim(), 10) || 0;
    }
    const agentsMd = await readTextOr(join(folder, "AGENTS.md"), undefined);
    out.push({
      path: r.path,
      remote: r.cloneUrl,
      branch: r.branch,
      state,
      worktrees: r.worktrees.map((w) => w.path),
      changed,
      checks: agentsMd === undefined ? [] : checkLines(agentsMd),
    });
  }
  return out;
}

/** The input of the brief for a loaded workspace and a run. */
export async function briefInput(loaded: Loaded, identity: Identity): Promise<BriefInput> {
  return {
    root: loaded.home,
    area: join(loaded.home, AREA),
    repos: await repoRows(loaded),
    tools: loaded.manifest.catalog.tools.map((t) => ({ name: t.name, version: String(t.version), present: t.provides.some((p) => which(p) !== undefined) })),
    hooks: loaded.files.map((f) => f.path).filter((p) => HOOK_NAMES.some((h) => p.endsWith(`/${h}`))),
    regulatedDomain: loaded.manifest.policy.regulatedDomain,
    requiresSignedCommits: loaded.manifest.policy.requiresSignedCommits,
    agents: loaded.manifest.agents,
    persona: identity.persona,
    harness: identity.harness,
  };
}
