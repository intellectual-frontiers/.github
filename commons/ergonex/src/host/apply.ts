// Spec: 0002-workspace-model FR-022
/**
 * Carrying out a plan (commons 0002-workspace-model FR-022 to FR-030, 0003-host FR-011, 0001-ergonex FR-012, FR-017): the actions of `ergonex apply`, one by one, with the real `git` and the file system,
 * under the one-writer lock of the workspace. Before each action the repository it is about is observed again, and an action whose observed state is not the plan's is reported as skipped and not
 * carried out.
 *
 * @remarks
 * Fast-forward only: the one way a branch moves is `git merge --ff-only` of its upstream; there is no rebase, reset, merge, force or discard here. A folder that holds local work is never deleted: the
 * only thing `apply` removes is a generated file whose bytes are still the ones the state record holds, and only with `--allow-destructive`. A Git lock file is never removed (the repository is
 * `Locked` and skipped). A generated file whose bytes are not the recorded ones was edited by hand and is refused unless the run says `--force`. An action of a kind that changes the host (`InstallTool`,
 * `ConfigureHost`) is refused: only `ergonex setup --apply` carries one out. The state record is written last, by the same atomic write, and only where it changed, so that a second run changes nothing.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/commons/ts/kernel";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { type Sha256, sha256 } from "@intellectual-frontiers/commons/ts/kernel";
import { existsSync, mkdir, readTextFile, remove, rename, sha256File, writeTextFile } from "../platform/r-fs.ts";
import { acquireLock, describeHolder, readHolder } from "../platform/r-lock.ts";
import { dirname } from "../platform/r-path.ts";
import { run } from "../platform/r-proc.ts";
import type { Finding } from "../findings.ts";
import { type Action, describeAction, isDestructive, isHostChange, isSettled } from "../plan.ts";
import type { GeneratedFile } from "../render.ts";
import type { RepoState } from "../state.ts";
import { encodeStateRecord, ERGONEX_VERSION, STATE_RECORD_PATH, type StateRecord, withFile, withoutFile } from "../state-record.ts";
import type { Context } from "../modules/types.ts";
import { observe } from "./observe.ts";
import { createWorktree } from "./worktrees.ts";
import { AREA, native, type Situation } from "./workspace.ts";

/** How to apply. */
export type ApplyOptions = {
  /** Carry out a destructive action (`--allow-destructive`). */
  readonly allowDestructive: boolean;
  /** Replace a generated file that was edited by hand (`--force`). */
  readonly force: boolean;
  /** Wait for another run's lock instead of refusing (`--wait`). */
  readonly wait: boolean;
  /** Whether the state record names this plan as the last (false for `render`, whose plan is of the generated files alone). True by default. */
  readonly recordPlan?: boolean;
};

/** What became of one action. */
export type StepStatus = "done" | "skipped" | "refused" | "failed";

/** An action and what became of it. */
export type Step = {
  readonly action: Action;
  readonly status: StepStatus;
  readonly detail: string;
};

/** A plan carried out. */
export type Applied = {
  readonly steps: readonly Step[];
  /** The state record after the run. */
  readonly record: StateRecord;
  /** The hash of the state record's text on disk after the run. */
  readonly recordSha: Sha256;
  readonly findings: readonly Finding[];
};

/** Why nothing was done. */
export type ApplyError = { readonly kind: "locked"; readonly holder: string };

const GIT_ENV: Readonly<Record<string, string>> = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  PAGER: "cat",
  LC_ALL: "C",
  LANGUAGE: "C",
};

/** A line of Git's complaint, with any credential in a URL taken out of it. */
function say(stderr: string): string {
  const line = (stderr.split("\n").find((l) => l.trim() !== "") ?? "git failed").trim();
  return line.replace(/(\w+:\/\/)[^/@\s]+@/g, "$1");
}

async function git(folder: string | undefined, args: readonly string[]): Promise<Result<string, string>> {
  const r = await run(["git", ...(folder === undefined ? [] : ["-C", folder]), ...args], { env: GIT_ENV });
  return r.success ? ok(r.stdout.trim()) : err(say(r.stderr));
}

/** Writes a file so that it is there whole or not at all: to a temporary name beside it, then renamed over it. */
export async function writeAtomic(path: string, content: string, mode: GeneratedFile["mode"]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.ergonex-tmp`;
  await writeTextFile(temp, content, { mode: Number.parseInt(mode, 8) });
  await rename(temp, path);
}

/** The settings of a configuration action, set in the repository's own local configuration and nowhere else. */
async function configure(folder: string, settings: Readonly<Record<string, string>>): Promise<Result<string, string>> {
  for (const [key, value] of Object.entries(settings)) {
    const r = await git(folder, ["config", "--local", key, value]);
    if (r.kind === "err") return err(`${key}: ${r.error}`);
  }
  return ok(`set ${Object.keys(settings).sort().join(", ")}`);
}

/** Carries out the plan of a situation. Takes the lock of the workspace first; where another run holds it, nothing is done and the holder is named. */
export async function applyPlan(s: Situation, ctx: Context, options: ApplyOptions): Promise<Result<Applied, ApplyError>> {
  const lockPath = native(s.loaded, `${AREA}/ergonex.lock`);
  await mkdir(dirname(lockPath), { recursive: true });
  const held = await acquireLock(lockPath, {
    wait: options.wait,
    command: "ergonex apply",
  });
  if (held === undefined) {
    const holder = await readHolder(lockPath);
    return err({
      kind: "locked",
      holder: holder === undefined ? "another run" : describeHolder(holder),
    });
  }
  try {
    return ok(await carryOut(s, ctx, options));
  } finally {
    held.release();
  }
}

async function carryOut(s: Situation, ctx: Context, options: ApplyOptions): Promise<Applied> {
  const site = s.loaded;
  const repos = new Map(s.desired.repos.map((r) => [r.path as string, r]));
  const files = new Map(s.loaded.files.map((f) => [f.path as string, f]));
  const steps: Step[] = [];
  let record: StateRecord = s.loaded.record;

  const state = async (repo: string): Promise<RepoState | undefined> => {
    const r = repos.get(repo);
    if (r === undefined) return undefined;
    const seen = await observe(native(site, repo), r.ref);
    return seen.kind === "ok" ? seen.value : undefined;
  };
  const push = (action: Action, status: StepStatus, detail: string): void => void steps.push({ action, status, detail });
  const changed = (action: Action, what: string): void =>
    push(action, "skipped", `${what} since the plan was made, so it was not carried out`);

  const write = async (action: Action, target: string): Promise<void> => {
    const file = files.get(target);
    if (file === undefined) return push(action, "refused", "the templates no longer make this file");
    const disk = native(site, target);
    const onDisk = existsSync(disk) ? await sha256File(disk) : undefined;
    const recorded = record.files[target]?.sha256;
    const wanted = await sha256(file.content);
    if (onDisk !== undefined && onDisk !== wanted && onDisk !== recorded && !options.force)
      return changed(action, "the file was edited by hand");
    await writeAtomic(disk, file.content, file.mode);
    record = withFile(record, file, wanted);
    push(action, "done", "written");
  };

  for (const action of s.plan.actions) {
    try {
      switch (action.kind) {
        case "Skip":
          push(action, "skipped", describeAction(action));
          if (action.why.kind === "file-current") {
            // adopt a file that is as generated but not in the record, so that the record holds it
            const file = files.get(action.target);
            if (file !== undefined && record.files[action.target] === undefined)
              record = withFile(record, file, await sha256(file.content));
          }
          break;
        case "Refuse":
          if (action.why.kind === "generated-edited" && options.force && files.has(action.target)) await write(action, action.target);
          else push(action, "refused", describeAction(action));
          break;
        case "Clone": {
          const now = await state(action.target);
          if (now?.kind !== "Missing") {
            changed(action, "the folder is no longer empty");
            break;
          }
          const folder = native(site, action.target);
          await mkdir(dirname(folder), { recursive: true });
          const r = await git(undefined, [
            "clone",
            ...(action.branch === undefined ? [] : ["--branch", action.branch]),
            "--",
            action.url,
            folder,
          ]);
          if (r.kind === "ok") push(action, "done", `cloned ${action.url}`);
          else push(action, "failed", r.error);
          break;
        }
        case "FastForward": {
          const now = await state(action.target);
          if (now?.kind !== "Behind") {
            changed(action, "the repository is no longer only behind its remote");
            break;
          }
          const r = await git(native(site, action.target), ["merge", "--ff-only", "--quiet", "@{upstream}"]);
          if (r.kind === "ok") push(action, "done", `fast-forwarded by ${now.commits} commit${now.commits === 1 ? "" : "s"}`);
          else push(action, "failed", r.error);
          break;
        }
        case "ConfigureRepo": {
          const now = await state(action.target);
          if (
            now === undefined ||
            now.kind === "Missing" ||
            now.kind === "Locked" ||
            now.kind === "WrongRemote" ||
            now.kind === "NotARepo"
          ) {
            changed(action, `the repository is ${now?.kind ?? "not in the manifest"}`);
            break;
          }
          const r = await configure(native(site, action.target), action.settings);
          if (r.kind === "ok") push(action, "done", r.value);
          else push(action, "failed", r.error);
          break;
        }
        case "CreateWorktree": {
          const base = await state(action.repo);
          if (
            base === undefined ||
            base.kind === "Missing" ||
            base.kind === "Locked" ||
            base.kind === "WrongRemote" ||
            base.kind === "NotARepo"
          ) {
            changed(action, `the repository is ${base?.kind ?? "not in the manifest"}`);
            break;
          }
          const made = await createWorktree(native(site, action.repo), native(site, action.target), action.branch);
          if (made.kind === "ok") push(action, "done", made.value);
          else push(action, "failed", made.error);
          break;
        }
        case "WriteGenerated":
          await write(action, action.target);
          break;
        case "RemoveGenerated": {
          if (isDestructive(action) && !options.allowDestructive) {
            push(action, "skipped", "it is destructive and the run did not say --allow-destructive");
            break;
          }
          const disk = native(site, action.target);
          const recorded = record.files[action.target]?.sha256;
          if (!existsSync(disk)) {
            record = withoutFile(record, action.target);
            push(action, "skipped", "it is already gone");
            break;
          }
          if (recorded === undefined || (await sha256File(disk)) !== recorded) {
            changed(action, "the file was edited by hand");
            break;
          }
          await remove(disk);
          record = withoutFile(record, action.target);
          push(action, "done", "removed");
          break;
        }
        case "ConfigureHost":
        case "InstallTool":
          // a change of the host belongs to `ergonex setup --apply` alone (0002-workspace-model FR-030)
          push(action, "refused", isHostChange(action) ? "only `ergonex setup --apply` changes the host" : "not carried out");
          break;
        default:
          return absurd(action);
      }
    } catch (e) {
      push(action, "failed", e instanceof Error ? e.message : String(e));
    }
  }

  // a plan that changed something is the last plan; a settled one leaves the record as it is, so that a second run changes nothing
  if (options.recordPlan !== false && !isSettled(s.plan)) record = { ...record, plan: s.planSha };
  record = { ...record, ergonex: ERGONEX_VERSION };
  const text = encodeStateRecord(record);
  const recordPath = native(site, STATE_RECORD_PATH);
  const before = existsSync(recordPath) ? await readTextFile(recordPath) : undefined;
  if (before !== text) await writeAtomic(recordPath, text, "0644");

  const findings: Finding[] = [];
  for (const step of steps) {
    const target = "target" in step.action ? step.action.target : "";
    if (step.status === "failed")
      findings.push({
        ruleId: "ergonex/apply-failed",
        severity: "Error",
        message: `${describeAction(step.action)} failed: ${step.detail}`,
        subject: target,
        firstSeen: ctx.today,
      });
    else if (step.status === "refused")
      findings.push({
        ruleId: "ergonex/apply-refused",
        severity: "Warning",
        message: step.detail,
        subject: target,
        firstSeen: ctx.today,
      });
    else if (step.action.kind === "Skip" && (step.action.why.kind === "locked" || step.action.why.kind === "diverged"))
      findings.push({
        ruleId: `ergonex/repository-${step.action.why.kind}`,
        severity: "Warning",
        message: step.detail,
        subject: target,
        firstSeen: ctx.today,
      });
  }
  return { steps, record, recordSha: await sha256(text), findings };
}
