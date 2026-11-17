/**
 * `ifws hook <pre-commit|commit-msg|pre-push>` (commons 0024-ifws-host FR-014, FR-015, 0023-if-workspaces FR-031, FR-032, FR-034): the checker the generated hooks run. `commit-msg` reads the message
 * file and applies the rules of 0020-ifccm (every commit names its issue on a line of its own, and no closing word a host reads is wrong); `pre-push` reads the refs Git gives on standard input and,
 * where the policy requires signed commits, reports each pushed commit that is not signed and verified; `pre-commit` runs the plaintext-token scan of the staged changes.
 *
 * @remarks
 * A hook only reads: it changes no commit, no tree and no configuration, uses no network and writes no evidence record (a Git hook is run at every commit). Its exit status is that of `ifws`: 0 to let
 * Git go on, 1 to stop it, and anything else (2, 3, or a program that cannot run) is "cannot run its checker", which the generated script turns into a stop where a regulated domain is named and
 * a message elsewhere. The staged-change scan is the policy scans' (`workspaces/scan/secrets.ts`, run on the index by `host/staged.ts`); `CHECKERS.stagedScan` is where it is wired in, and where it is not, `pre-commit` says it has no scanner.
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { err, ok } from "../../kernel/result.ts";
import { run } from "../../runtime/proc.ts";
import { readTextFile } from "../../runtime/fs.ts";
import { parseMessage } from "../../mizan/changes/commit-message.ts";
import type { Finding } from "../findings.ts";
import { unsignedCommitSeverity } from "../policy.ts";
import { HOOK_NAMES, isHookName } from "../templates/hooks.ts";
import { defineCommand, GLOBAL_OPTIONS, type Context, type IfwsModule, type Outcome } from "../modules/types.ts";
import { type StagedHit, stagedSecretsScan } from "../host/staged.ts";
import { loadFailureOutcome, loadWorkspace } from "../host/workspace.ts";
import { textOf } from "./common.ts";

/** What a hook calls on, which other modules of the workspace may replace. */
export type Checkers = {
  /** Reads the staged changes of the repository in the working folder and returns what it found. */
  stagedScan: ((cwd: string) => Promise<readonly StagedHit[]>) | undefined;
};

/** The checkers a hook calls: the plaintext-token scan of the staged changes (`host/staged.ts`, which uses `scan/secrets.ts`). */
export const CHECKERS: Checkers = { stagedScan: stagedSecretsScan };

export type { StagedHit };

const ZEROS = /^0+$/;

/** A finding that blocks a hook is an error; a warning is said and lets Git go on. */
function outcome(text: string[], findings: readonly Finding[]): Outcome {
  const blocks = findings.some((f) => f.severity === "Error");
  return ok({ text: textOf(text, findings), data: null, findings, status: blocks ? "Findings" : "Ok", noEvidence: true });
}

async function commitMsg(ctx: Context, file: string | undefined): Promise<Outcome> {
  if (file === undefined) return err({ kind: "usage", message: "commit-msg is given the file of the message", noEvidence: true });
  const parsed = parseMessage(await readTextFile(file));
  const findings: Finding[] = [];
  const at = (ruleId: string, message: string): number =>
    findings.push({ ruleId, severity: "Error", message, subject: "commit message", firstSeen: ctx.today });
  if (parsed.refs.length === 0)
    at(
      "changes/commit-names-no-issue",
      "the commit names no issue: put `Refs #N` on a line of its own (and `Closes #N` on the commit that finishes it)",
    );
  for (const w of parsed.wrongWords)
    at(
      "changes/wrong-closing-word",
      `line ${w.line}: \`${w.word} #${w.number}\` closes an issue on a host that reads it; use \`Closes #${w.number}\` on a line of its own, or \`Refs #${w.number}\``,
    );
  return outcome([], findings);
}

async function prePush(ctx: Context): Promise<Outcome> {
  const loaded = await loadWorkspace(ctx);
  if (loaded.kind === "err") return loadFailureOutcome(loaded.error, ctx);
  const policy = loaded.value.manifest.policy;
  if (!policy.requiresSignedCommits) return outcome([], []);
  const findings: Finding[] = [];
  const input = await ctx.stdin();
  for (const line of input.split("\n")) {
    const [localRef, local, , remote] = line.trim().split(/\s+/);
    if (localRef === undefined || local === undefined || ZEROS.test(local)) continue;
    const range = remote === undefined || ZEROS.test(remote) ? [local, "--not", "--remotes"] : [`${remote}..${local}`];
    const log = await run(["git", "log", "--format=%H %G?", ...range], { cwd: ctx.cwd, env: { GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" } });
    if (!log.success)
      return err({
        kind: "environment",
        noEvidence: true,
        message: `git log could not read ${localRef}: ${log.stderr.trim().split("\n")[0] ?? ""}`,
      });
    for (const entry of log.stdout.split("\n")) {
      const [sha, status] = entry.trim().split(" ");
      if (sha === undefined || sha === "") continue;
      const severity = unsignedCommitSeverity(policy, status === "G");
      if (severity !== undefined)
        findings.push({
          ruleId: "ifws/unsigned-commit",
          severity,
          message: `commit ${sha.slice(0, 12)} is not signed and verified (Git says ${status ?? "nothing"}); sign it, or amend it before pushing`,
          subject: localRef,
          firstSeen: ctx.today,
        });
    }
  }
  return outcome([], findings);
}

async function preCommit(ctx: Context): Promise<Outcome> {
  const scan = CHECKERS.stagedScan;
  if (scan === undefined)
    return err({
      kind: "environment",
      noEvidence: true,
      message: "no plaintext-token scanner is wired into this build of ifws (the policy scans are workspaces/scan/)",
    });
  let hits: readonly StagedHit[];
  try {
    hits = await scan(ctx.cwd);
  } catch (e) {
    return err({
      kind: "environment",
      noEvidence: true,
      message: `the staged changes could not be read: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
  const findings: Finding[] = hits.map((h) => ({
    ruleId: h.rule,
    severity: "Error",
    message: "a plaintext token is staged here; remove it and use a credential helper or the environment",
    subject: `${h.file}:${h.line}`,
    firstSeen: ctx.today,
  }));
  return outcome([], findings);
}

/** The checker a hook names, on the words after `--`. */
function check(ctx: Context, name: string, rest: readonly string[]): Promise<Outcome> {
  if (!isHookName(name))
    return Promise.resolve(err({ kind: "usage", message: `${JSON.stringify(name)} is not a hook: ${HOOK_NAMES.join(", ")}` }));
  switch (name) {
    case "commit-msg":
      return commitMsg(ctx, rest[0]);
    case "pre-push":
      return prePush(ctx);
    case "pre-commit":
      return preCommit(ctx);
    default:
      return absurd(name);
  }
}

const hook = defineCommand({
  name: "hook",
  summary: `The checker the generated Git hooks run (${HOOK_NAMES.join(", ")}); it only reads.`,
  options: { ...GLOBAL_OPTIONS },
  operands: [{ name: "HOOK", help: `One of ${HOOK_NAMES.join(", ")}.`, arity: "one" }],
  run: async (ctx, args) => {
    // a hook only reads: whatever it finds, it writes no evidence record (0025-ifws FR-026)
    const done = await check(ctx, args.positionals[0] ?? "", args.rest);
    return done.kind === "ok" ? ok({ ...done.value, noEvidence: true }) : err({ ...done.error, noEvidence: true });
  },
});

/** The module `ifws hook`. */
export const hookModule: IfwsModule = { name: "hook", summary: hook.summary, commands: [hook] };
