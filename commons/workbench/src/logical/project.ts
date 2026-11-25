// Spec: 0006-workbench-dialects FR-004
/**
 * The projections of a contract: the setup script of a workshop, its Containerfile, the step of a pipeline and the block of `AGENTS.md` that every harness reads. Each is generated and never written by hand, is the same bytes
 * for the same contract, holds no secret and no credential value, and carries only the BASE: what a task needs beyond it arrives when the task runs (`ready --for`), so a new workshop is not made to install what nobody uses.
 *
 * @example
 * ```ts
 * import { AGENTS_MARKS } from "./project.ts";
 * AGENTS_MARKS.begin; // "<!-- workbench:begin -->"
 * ```
 *
 * @module
 */
import { CONCEPTS, DEFINITIONS, type Contract, type Requirement } from "@intellectual-frontiers/workbench/governance";

/** The marks between which the generated block of `AGENTS.md` is kept. */
export const AGENTS_MARKS = { begin: "<!-- workbench:begin -->", end: "<!-- workbench:end -->" } as const;

/** The command that runs the workbench in the repository the contract is of. */
export const commandOf = (c: Contract): string => c.command ?? "workbench";

const quote = (a: string): string => (/^[A-Za-z0-9_@%+=:,./-]+$/u.test(a) ? a : `'${a.replace(/'/gu, "'\\''")}'`);
const baseWithInstall = (c: Contract): readonly (Requirement & { readonly install: readonly string[] })[] =>
  c.base.filter((r): r is Requirement & { readonly install: readonly string[] } => (r.kind === "program" || r.kind === "install") && r.install !== undefined && r.install.length > 0).sort((a, b) => (a.id < b.id ? -1 : 1));

/** The setup script of a workshop: each program of the base that is missing is installed by its declared argument vector, once. Idempotent; installs nothing else. */
export function setupScript(contract: Contract): string {
  const lines = baseWithInstall(contract).map((r) => (r.kind === "program" ? `command -v ${quote(r.name)} >/dev/null 2>&1 || ${r.install.map(quote).join(" ")}` : `${r.install.map(quote).join(" ")}`));
  return ["#!/bin/sh", `# Generated from the workbench contract ${contract.name}: the base only. What a task needs beyond it is obtained when the task runs: ${commandOf(contract)} ready --for TASK --ensure.`, "set -eu", ...lines, ""].join("\n");
}

/** The Containerfile of a workshop: a small base image and the base's installs, one layer each. */
export function containerfile(contract: Contract, from = "docker.io/library/debian:13-slim"): string {
  return [`# Generated from the workbench contract ${contract.name}: the base only.`, `FROM ${from}`, ...baseWithInstall(contract).map((r) => `RUN ${r.install.map(quote).join(" ")}`), "WORKDIR /root/workspaces", ""].join("\n");
}

/** The step of a pipeline that makes the workbench ready for the work of the job, and fails on a declared program that is missing. */
export function ciStep(command = "workbench"): string {
  return [`- name: "The workbench is ready for the work of this job"`, `  run: ${command} ready --for "$WORKBENCH_TASK" --ensure --ci`, ""].join("\n");
}

/** The block of `AGENTS.md`: the four terms, the first command, the roles, the stages with their levels and the gates; and the date from which the checks stop being hints. */
export function agentsBlock(contract: Contract): string {
  const rows = [
    AGENTS_MARKS.begin,
    "## The workbench",
    "",
    `Generated from the workbench contract \`${contract.name}\`; do not edit between the marks. Until ${contract.enforceFrom} every finding but a safety rule is a hint: it says what to do and never stops you.`,
    "",
    `**Before you start, run \`${commandOf(contract)} ready\`. For the task you are about to do, run \`${commandOf(contract)} ready --for TASK --ensure\`: it installs only what that task needs.**`,
    "",
    ...CONCEPTS.map((c) => `- **${c}**: ${DEFINITIONS[c]}`),
    "",
    "| Role | Held by | May |",
    "|---|---|---|",
    ...contract.roles.map((r) => `| ${r.id} | ${r.holder} | ${r.may.join(", ")} |`),
    "",
    "| Stage | Autonomy | Gates |",
    "|---|---|---|",
    ...contract.stages.map((s) => `| ${s.id} | ${s.level} | ${s.gates.join(", ") || "none"} |`),
    "",
    "| Gate | Approver | What stops |",
    "|---|---|---|",
    ...contract.gates.map((g) => `| ${g.id} | ${g.approver} | ${g.summary} |`),
    "",
    "An agent that meets a gate stops and hands back; it never retries a denial and never approves its own work.",
    AGENTS_MARKS.end,
    "",
  ];
  return rows.join("\n");
}

/** A file with its generated block put in place: replaced between the marks where they are, or added at the end. */
export function spliceBlock(file: string, block: string): string {
  const a = file.indexOf(AGENTS_MARKS.begin);
  const b = file.indexOf(AGENTS_MARKS.end);
  if (a >= 0 && b > a) return `${file.slice(0, a)}${block.trimEnd()}${file.slice(b + AGENTS_MARKS.end.length)}`;
  return `${file.trimEnd()}\n\n${block}`;
}
