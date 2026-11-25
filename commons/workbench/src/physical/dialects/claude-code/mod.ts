// Spec: 0006-workbench-dialects FR-001, FR-006
/**
 * The dialect of Claude Code: a requirement is checked at the start of a session by a hook that runs `workbench ready`, and a gate is a deny rule, so the harness refuses what only a person may do. It renders the settings the
 * harness reads (`.claude/settings.json`: permission deny entries and a SessionStart hook) and the file that sends it to `AGENTS.md`. The format is the one the harness documents at the time of writing and is checked against its current
 * documentation before a release.
 *
 * @module
 */
import type { Contract, Requirement } from "@intellectual-frontiers/workbench/governance";
import type { Dialect, Disposition, RenderedFile } from "@intellectual-frontiers/workbench/logical";

/** How the dialect receives a requirement. */
function express(r: Requirement): Disposition {
  return r.kind === "authority"
    ? { kind: "unexpressed", reason: `the gate ${r.gate} needs a person`, needsPerson: true }
    : { kind: "expressed", how: "checked by `workbench ready` in a SessionStart hook" };
}

/** The dialect. */
export const dialect: Dialect = { name: "claude-code", holder: "agent", express: (r, _c) => express(r) };

/** The files the dialect makes for a contract: the same bytes for the same contract. */
export function render(contract: Contract, command = contract.command ?? "workbench"): readonly RenderedFile[] {
  const deny = [...new Set(contract.gates.flatMap((g) => g.commands))].sort().map((c) => `Bash(${c}:*)`);
  const settings = { hooks: { SessionStart: [{ matcher: "", hooks: [{ type: "command", command: `${command} ready` }] }] }, permissions: { deny } };
  return [
    { path: ".claude/settings.json", text: `${JSON.stringify(settings, null, 2)}\n` },
    { path: "CLAUDE.md", text: "Read [`AGENTS.md`](AGENTS.md); it is this repository's entry point for any agent.\n" },
  ];
}
