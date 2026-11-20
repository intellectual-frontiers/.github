/**
 * The host layer of the `changes` check that reads Git (commons 0020-ifccm FR-005, FR-007, FR-012): the commits of a range with their parents, authors, days and messages, and the history of a
 * declaration file, each read by running the real `git` by its argument vector (never through a shell), with no pager and no terminal prompt. Every failure is an `Err` naming what went wrong;
 * nothing here throws.
 *
 * @remarks
 * The range is any range `git log` takes (`A..B`, a single revision for its whole history). Commits come oldest first. A declaration's history is every commit that changed its file, oldest
 * first, each version read from Git as text and decoded without being run (`declaration.ts`); a version that does not decode is left out, since the rule judges declarations and not typing.
 *
 * @limits
 * It reads one repository and no remote: what a host says of an issue is `strict.ts`'s, through the host interface.
 *
 * @example
 * ```ts
 * import { readRange } from "./git-log.ts";
 * const r = await readRange(".", "origin/main..HEAD");
 * if (r.kind === "ok") console.log(r.value.length);
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { NotFound } from "@intellectual-frontiers/system/errors";
import { type GitError } from "@intellectual-frontiers/system/git";
import { output } from "@intellectual-frontiers/system/proc";
import { type DeclarationVersion, dayOf, decodeHarnessRecord } from "./declaration.ts";
import type { CapabilityCommit } from "./capability-trace.ts";
import type { CommitFacts } from "./rules.ts";

const ENV: Readonly<Record<string, string>> = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  PAGER: "cat",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
  LANGUAGE: "C",
};

/** `git --no-pager -C repo ...args` as text, or why it failed. */
async function gitText(repo: string, args: readonly string[]): Promise<Result<string, GitError>> {
  try {
    const r = await output(["git", "--no-pager", "-C", repo, ...args], { env: ENV });
    const stderr = new TextDecoder().decode(r.stderr).trim();
    if (r.code === 0) return ok(new TextDecoder().decode(r.stdout));
    if (/not a git repository|cannot change to/i.test(stderr)) return err({ kind: "not-a-repository", repo, message: stderr });
    if (/unknown revision|bad revision|ambiguous argument|invalid revision/i.test(stderr))
      return err({ kind: "bad-revision", rev: args.join(" "), message: stderr });
    return err({ kind: "failed", args, code: r.code, message: stderr });
  } catch (e) {
    if (e instanceof NotFound) return err({ kind: "git-missing", program: "git" });
    return err({ kind: "failed", args, code: -1, message: e instanceof Error ? e.message : String(e) });
  }
}

const FIELD = "\u001f";
const RECORD = "\u001e";

/** The commits of a range, oldest first: each with its parents, its author, the day it was committed and its whole message. A range that starts with `-` is refused, not passed to git. */
export async function readRange(repo: string, range: string): Promise<Result<readonly CommitFacts[], GitError>> {
  if (range === "" || range.startsWith("-"))
    return err({ kind: "bad-revision", rev: range, message: "a range may not be empty or start with -" });
  const r = await gitText(repo, [
    "log",
    "--reverse",
    `--format=%H${FIELD}%P${FIELD}%an${FIELD}%ae${FIELD}%cs${FIELD}%B${RECORD}`,
    range,
    "--",
  ]);
  if (r.kind === "err") return r;
  const out: CommitFacts[] = [];
  for (const record of r.value.split(RECORD)) {
    const text = record.replace(/^\n/, "");
    if (text.trim() === "") continue;
    const [sha = "", parents = "", authorName = "", authorEmail = "", cs = "", ...rest] = text.split(FIELD);
    const day = dayOf(cs);
    if (day === undefined) return err({ kind: "failed", args: ["log"], code: 0, message: `not a day: ${cs}` });
    out.push({
      sha,
      parents: parents.split(" ").filter((p) => p !== ""),
      authorName,
      authorEmail,
      day,
      message: rest.join(FIELD).trimEnd(),
    });
  }
  return ok(out);
}

/**
 * The versions of a declaration file in the history of `rev` (`HEAD` by default), oldest first: the revision that wrote each, the day of that commit and the declaration then. A commit that
 * removed the file gives a version with no declaration; one whose text does not decode is left out.
 */
export async function declarationHistory(
  repo: string,
  file: string,
  rev = "HEAD",
): Promise<Result<readonly DeclarationVersion[], GitError>> {
  const rel = file.replaceAll("\\", "/").replace(/^\.\//, "");
  const log = await gitText(repo, ["log", "--reverse", `--format=%H${FIELD}%cs`, rev, "--", rel]);
  if (log.kind === "err") return log;
  const out: DeclarationVersion[] = [];
  for (const line of log.value.split("\n")) {
    const [revision = "", cs = ""] = line.split(FIELD);
    const day = dayOf(cs);
    if (revision === "" || day === undefined) continue;
    const text = await gitText(repo, ["show", `${revision}:${rel}`]);
    if (text.kind === "err") {
      out.push({ revision, day, declaration: undefined });
      continue;
    }
    const record = decodeHarnessRecord(text.value);
    if (record.kind === "ok") out.push({ revision, day, declaration: record.value.declaration });
  }
  return ok(out);
}

/** The requirement a line of a `spec.md` states, as an added line of a diff reads it. */
const ADDED_REQUIREMENT = /^\+\s*-\s*\*\*(FR-\d{3}[a-z]?)\*\*/;

/**
 * The commits of a range as the offline trace reads them (0020-ifccm FR-035): each with its subject, its whole message, the files it changed and the requirements (`NNNN-slug FR-nnn`) whose
 * lines in a `specs/<slug>/spec.md` it added or edited. Three reads of the one range, each by an argument vector.
 */
export async function readRangeFacts(repo: string, range: string): Promise<Result<readonly CapabilityCommit[], GitError>> {
  const commits = await readRange(repo, range);
  if (commits.kind === "err") return commits;
  const files = await gitText(repo, ["log", "--reverse", `--format=${RECORD}%H`, "--name-only", "--no-renames", range, "--"]);
  if (files.kind === "err") return files;
  const changed = new Map<string, string[]>();
  for (const block of files.value.split(RECORD)) {
    const [sha = "", ...names] = block.split("\n").map((l) => l.trim());
    if (sha !== "")
      changed.set(
        sha,
        names.filter((n) => n !== ""),
      );
  }
  const diffs = await gitText(repo, [
    "log",
    "--reverse",
    `--format=${RECORD}%H`,
    "-p",
    "-U0",
    "--no-color",
    "--no-ext-diff",
    "--no-renames",
    range,
    "--",
    "*spec.md",
  ]);
  if (diffs.kind === "err") return diffs;
  const added = new Map<string, Set<string>>();
  for (const block of diffs.value.split(RECORD)) {
    const lines = block.split("\n");
    const sha = (lines[0] ?? "").trim();
    let slug: string | undefined;
    for (const line of lines.slice(1)) {
      if (line.startsWith("+++ ")) slug = /\bspecs\/([^/\s]+)\/spec\.md$/.exec(line)?.[1];
      const id = slug === undefined ? undefined : ADDED_REQUIREMENT.exec(line)?.[1];
      if (id !== undefined && slug !== undefined) {
        const set = added.get(sha) ?? new Set<string>();
        set.add(`${slug} ${id}`);
        added.set(sha, set);
      }
    }
  }
  return ok(
    commits.value.map((c) => ({
      sha: c.sha,
      subject: c.message.split("\n")[0] ?? "",
      message: c.message,
      files: changed.get(c.sha) ?? [],
      requirements: [...(added.get(c.sha) ?? [])].sort(),
    })),
  );
}
