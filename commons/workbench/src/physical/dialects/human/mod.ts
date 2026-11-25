// Spec: 0006-workbench-dialects FR-001, FR-005
/**
 * The dialect of a person: every requirement is a line of a checklist, and every gate is a step that a named approver takes, with the record they leave. The runbook says what each stage allows an agent to do, how to review an
 * agent's work in a worktree of your own and how to approve it, so that a regulated stage has a person who knows what to do when an agent stops.
 *
 * @module
 */
import type { Contract, Requirement } from "@intellectual-frontiers/workbench/governance";
import type { Dialect, Disposition, RenderedFile } from "@intellectual-frontiers/workbench/logical";

function express(r: Requirement, c: Contract): Disposition {
  if (r.kind !== "authority") return { kind: "expressed", how: "a line of the setup checklist, and `workbench ready`" };
  const gate = c.gates.find((g) => g.id === r.gate);
  return { kind: "expressed", how: `gate ${r.gate}: approved by ${gate?.approver ?? "its approver"}, who is never the author` };
}

/** The dialect. */
export const dialect: Dialect = { name: "human", holder: "human", express };

/** The runbook for a contract: the same bytes for the same contract. */
export function render(contract: Contract): readonly RenderedFile[] {
  const base = contract.base.filter((r) => r.kind !== "authority");
  const lines = [
    `# Runbook: ${contract.name}`,
    "",
    `Generated from the workbench contract; do not edit. Until ${contract.enforceFrom} the checks only give hints. After it they are prescriptive, and a safety rule (a secret in a file) always is.`,
    "",
    "## Set up your workstation",
    "",
    ...base.map((r) => `- [ ] ${r.summary} (\`${r.id}\`)`),
    "",
    "Then run `workbench ready`. For the work you are about to do, `workbench ready --for TASK --ensure` installs only what that task needs.",
    "",
    "## Stages and how far an agent goes",
    "",
    ...contract.stages.map((s) => `- **${s.id}**: ${s.level}${s.gates.length > 0 ? `; gates: ${s.gates.join(", ")}` : ""}`),
    "",
    "## Gates: what only a person does",
    "",
    ...contract.gates.flatMap((g) => [`### ${g.id}`, "", `${g.summary} Approver: **${g.approver}**, never the author of the change.`, "", "Record of the approval:", "", "```", `gate: ${g.id}`, "approver: <you>", "author: <who made the change>", "approved: <the hash of what you reviewed>", "date: <day>", "```", ""]),
    "## Reviewing an agent's work",
    "",
    "Open the agent's branch as a worktree of your own, beside the repository: `git worktree add ../<repo>.wt/<you>/review-<task> <branch>`. Read the hand-back report it left, run the checks, and approve or send it back.",
    "",
  ];
  return [{ path: "RUNBOOK.md", text: lines.join("\n") }];
}
