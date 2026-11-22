// Spec: 0006-agents FR-009, FR-010
/**
 * The brief (commons ergonex 0006-agents FR-009, FR-010): the map of the workspace for an agent, as data and as Markdown. Pure and deterministic: the same state gives the same bytes. It holds no secret
 * and none of a repository's files but the few lines it takes from `AGENTS.md` that say how to run the checks. The Markdown is at most 32 KiB, the size Codex reads as instructions by default; where the
 * map is larger the repositories are listed by the time of their last change, newest first, and the number omitted is named.
 *
 * @example
 * ```ts
 * import { renderBrief, type Brief } from "./brief.ts";
 * ```
 *
 * @module
 */
import { type AgentCommand, type AgentsPolicy, AGENT_COMMANDS, NO_AGENT_POLICY } from "./policy.ts";
import { REDACTED } from "./redact.ts";

/** One repository of the map. */
export type BriefRepo = {
  readonly path: string;
  readonly remote: string;
  readonly branch: string | undefined;
  /** The state, in the words of `ergonex status`. */
  readonly state: string;
  readonly worktrees: readonly string[];
  /** The seconds since the epoch of the last commit; 0 where there is none. */
  readonly changed: number;
  /** The lines of the repository's `AGENTS.md` that say how to run the checks. */
  readonly checks: readonly string[];
};

/** One pinned tool. */
export type BriefTool = { readonly name: string; readonly version: string; readonly present: boolean };

/** What the brief is made from. */
export type BriefInput = {
  readonly root: string;
  readonly area: string;
  readonly repos: readonly BriefRepo[];
  readonly tools: readonly BriefTool[];
  readonly hooks: readonly string[];
  readonly regulatedDomain: readonly string[];
  readonly requiresSignedCommits: boolean;
  readonly agents: AgentsPolicy | undefined;
  readonly persona: "human" | "agent";
  readonly harness: string;
};

/** The brief as data. */
export type Brief = {
  readonly root: string;
  readonly area: string;
  readonly persona: string;
  readonly harness: string;
  readonly repos: readonly BriefRepo[];
  readonly omitted: number;
  readonly tools: readonly BriefTool[];
  readonly hooks: readonly string[];
  readonly policy: { readonly regulatedDomain: readonly string[]; readonly requiresSignedCommits: boolean };
  readonly agents: AgentsPolicy;
  readonly mayRun: readonly string[];
  readonly mayNotRun: readonly AgentCommand[];
  readonly commit: { readonly name: string; readonly email: string; readonly trailer: string } | undefined;
};

/** The size the Markdown does not pass (bytes). */
export const BRIEF_MAX_BYTES = 32 * 1024;

/** The commands that only read: what the persona may always run. */
export const READING_COMMANDS: readonly string[] = ["start", "status", "doctor", "verify", "plan", "paths", "tools", "modules", "worktree list", "agent brief", "agent doctor", "agent jobs list", "agent jobs show", "agent jobs wait", "agent keys line", "mcp", "remote run (ergonex commands only)"];

const SECRET_SHAPES = /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g;

/** A line with anything of the shape of a token written `[secret]`. */
export function scrubLine(line: string): string {
  return line.replace(SECRET_SHAPES, REDACTED);
}

const CHECK_WORDS = /\b(test|check|verify|lint|build)\b/i;

/** The lines of an `AGENTS.md` that name a command to run for the checks: at most five, each a line with a command in backticks and one of the words, at most 200 characters. */
export function checkLines(agentsMd: string): readonly string[] {
  const out: string[] = [];
  for (const raw of agentsMd.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.length > 200 || !line.includes("`") || !CHECK_WORDS.test(line)) continue;
    out.push(scrubLine(line));
    if (out.length === 5) break;
  }
  return out;
}

/** The brief as data, with the repositories newest first and as many as the Markdown can hold (`limit` repositories at most). */
export function briefOf(input: BriefInput, limit = Number.POSITIVE_INFINITY): Brief {
  const agents = input.agents ?? NO_AGENT_POLICY;
  const sorted = [...input.repos].sort((a, b) => b.changed - a.changed || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const kept = sorted.slice(0, limit);
  return {
    root: input.root,
    area: input.area,
    persona: input.persona,
    harness: input.harness,
    repos: kept,
    omitted: sorted.length - kept.length,
    tools: [...input.tools].sort((a, b) => (a.name < b.name ? -1 : 1)),
    hooks: [...input.hooks].sort(),
    policy: { regulatedDomain: input.regulatedDomain, requiresSignedCommits: input.requiresSignedCommits },
    agents,
    mayRun: [...READING_COMMANDS, ...agents.allow],
    mayNotRun: AGENT_COMMANDS.filter((c) => !agents.allow.includes(c)),
    commit: agents.commit,
  };
}

function markdownOf(b: Brief): string {
  const lines: string[] = [];
  lines.push("# The workspace", "");
  lines.push(`Root: \`${b.root}\`. Ergonex keeps its own files in \`${b.area}\`. You are the persona \`${b.persona}\` (harness \`${b.harness}\`).`, "");
  lines.push("## Repositories", "");
  if (b.repos.length === 0) lines.push("The manifest names none.");
  for (const r of b.repos) {
    lines.push(`- \`${r.path}\`: ${r.state}; remote ${r.remote}${r.branch === undefined ? "" : `; branch \`${r.branch}\``}${r.worktrees.length === 0 ? "" : `; worktrees ${r.worktrees.map((w) => `\`${w}\``).join(", ")}`}`);
    for (const c of r.checks) lines.push(`  - checks: ${c}`);
  }
  if (b.omitted > 0) lines.push("", `${b.omitted} more repositories are omitted (the oldest by last change); run \`ergonex status\` for all.`);
  lines.push("", "## Pinned tools", "");
  if (b.tools.length === 0) lines.push("None.");
  for (const t of b.tools) lines.push(`- ${t.name} ${t.version}: ${t.present ? "present" : "not present"}`);
  lines.push("", "## Policy", "");
  lines.push(b.policy.regulatedDomain.length === 0 ? "- The workspace is not regulated." : `- Regulated domains: ${b.policy.regulatedDomain.join(", ")}.`);
  lines.push(`- Signed commits: ${b.policy.requiresSignedCommits ? "required" : "not required"}.`);
  lines.push(`- Hooks: ${b.hooks.length === 0 ? "none generated" : b.hooks.join(", ")}.`);
  lines.push(`- Tier of the tool server: \`${b.agents.tier}\`; disposable machine: ${b.agents.disposable ? "yes" : "not declared"}.`);
  lines.push(`- Repositories you may change: ${b.agents.repos === "all" ? "all" : b.agents.repos.length === 0 ? "none" : b.agents.repos.join(", ")}.`);
  lines.push("", "## What you may run", "");
  lines.push(`- Read: ${b.mayRun.filter((c) => !AGENT_COMMANDS.some((a) => a === c)).map((c) => `\`${c}\``).join(", ")}.`);
  lines.push(`- Also allowed by the policy: ${b.agents.allow.length === 0 ? "nothing" : b.agents.allow.map((c) => `\`${c}\``).join(", ")}.`);
  lines.push(`- Refused with \`E-AGENT-DENIED\`: ${b.mayNotRun.length === 0 ? "nothing" : b.mayNotRun.map((c) => `\`${c}\``).join(", ")}. A person allows one with \`agents: { allow: [...] }\` in the manifest.`);
  lines.push("- Output is JSON (`headless.envelope/1`) unless you pass `--text`; nothing prompts; a token is never an argument.");
  lines.push("", "## How to commit", "");
  if (b.commit === undefined) lines.push("The policy names no commit identity; use the one Git has.");
  else lines.push(`- Identity: ${b.commit.name} <${b.commit.email}> (set in each repository you may change).`, `- Every commit message ends with the line \`${b.commit.trailer}\`; the \`commit-msg\` hook refuses one that does not.`);
  return `${lines.join("\n")}\n`;
}

/** The Markdown of the brief, at most 32 KiB: where the map is larger the oldest repositories are dropped until it fits and the count omitted is named. */
export function renderBrief(input: BriefInput, max = BRIEF_MAX_BYTES): { readonly brief: Brief; readonly markdown: string } {
  const bytes = (s: string): number => new TextEncoder().encode(s).length;
  let limit = input.repos.length;
  for (;;) {
    const brief = briefOf(input, limit);
    const markdown = markdownOf(brief);
    if (bytes(markdown) <= max || limit === 0) return { brief, markdown };
    limit = Math.max(0, Math.min(limit - 1, Math.floor(limit * 0.9)));
  }
}
