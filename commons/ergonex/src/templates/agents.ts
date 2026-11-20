// Spec: 0003-host FR-022
/**
 * The `AGENTS.auto.md` template (commons 0003-host FR-022): what an agent that works in the workspace is told, from the manifest: the layout (the root, where a repository and a worktree are, the
 * groups and their repositories by path), the rules (plan before apply, fast-forward only, one issue for every commit, no credential in a file) and the commands. It holds no secret and no absolute
 * path of the user's computer: every path in it is below the root.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { isRegulated } from "../policy.ts";
import { generated } from "../render.ts";
import type { Template, TemplateData } from "./data.ts";

/** The text of the guide, from the data. */
export function agentsText(data: TemplateData): string {
  const { manifest } = data;
  const groups = [...new Set(manifest.repositories.map((r) => r.group ?? ""))].sort();
  const repositories = groups.flatMap((g) => [
    g === "" ? "Repositories in no group:" : `Group \`${g}\` (opens as \`${g}.auto.code-workspace\`):`,
    "",
    ...manifest.repositories
      .filter((r) => (r.group ?? "") === g)
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .map((r) => `- \`${r.path}\` (${r.cloneUrl})`),
    "",
  ]);
  return [
    "# Workspace guide for agents",
    "",
    "This is an Intellectual Frontiers workspace, managed by `ergonex`. It is the place a person or an agent works in; read this before you change anything here.",
    "",
    "## Layout",
    "",
    "- The root is `$ERGONEX_HOME` (the folder this file is in). A repository is at `<host>/<path>/<repo>` below it and mirrors its remote.",
    "- A worktree is at `.worktrees/<host>/<path>/<repo>/<branch>`. Make one only where another person or agent, or uncommitted work, is on the repository; otherwise work in the repository's own checkout.",
    "- The workspace's own folder is `.ergonex/`: the manifest `workspace.ts` (the source of everything generated), the generated Git configuration, the hooks and the lists of tools and modules. What ergonex remembers (the state record, the evidence of every run) is in its state folder, and the tools it installs are in its data folder (`ergonex paths` says where).",
    "- A file whose name carries `.auto.` is generated. Do not edit it: change `workspace.ts` and run `ergonex render`.",
    "",
    "## The repositories",
    "",
    ...(manifest.repositories.length === 0 ? ["The manifest names none yet.", ""] : repositories),
    "## Rules",
    "",
    "- Plan before apply: `ergonex plan` shows what would change and changes nothing; `ergonex apply` carries it out.",
    "- Fast-forward only: nothing here rebases, resets, merges, forces or discards. A repository with changes of its own, or one that has diverged, is left as it is and reported.",
    "- One issue for every commit: each commit message names its issue on a line of its own (`Refs #N`, and `Closes #N` on the commit that finishes it); the `commit-msg` hook checks it.",
    "- No credential in a file: never write a token, a password or a private key into the manifest, a generated file, a remote URL or a repository's configuration; the `pre-commit` hook scans for them.",
    ...(isRegulated(manifest.policy)
      ? [
          `- Signed commits: this workspace names a regulated domain (${manifest.policy.regulatedDomain.join(", ")}); every commit must be signed and verified, and the hooks fail where they cannot check.`,
        ]
      : manifest.policy.requiresSignedCommits
        ? ["- Signed commits: the policy requires every commit to be signed and verified."]
        : []),
    "",
    "## Commands",
    "",
    "- `ergonex status`: every repository, its state, how far it is ahead and behind, whether it is locked.",
    "- `ergonex plan`, `ergonex apply`: the typed plan, and carrying it out.",
    "- `ergonex render`, `ergonex verify`: write the generated files, and check them against the state record.",
    "- `ergonex doctor`: check the runtime, the layout, the file system, the policy and the generated files.",
    "- `ergonex worktree create|list|prune`: worktrees, named for their issue.",
    "- `ergonex modules`, `ergonex help`: the modules and the commands.",
    "",
    "Every run writes one evidence record into ergonex's state folder (`ergonex paths` says where); none holds a credential.",
  ].join("\n");
}

/** The template: one file at the root. */
export const agentsTemplate: Template = {
  name: "agents",
  render: (data) => {
    const file = generated("AGENTS.auto.md", { format: "markdown", text: agentsText(data) }, { generator: "ergonex templates/agents" });
    return file.kind === "err" ? err([file.error]) : ok([file.value]);
  },
};
