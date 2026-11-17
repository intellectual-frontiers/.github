/**
 * Archiving the `quality` branch by a tag, with real `git` (commons 0021-ifqs FR-047): once the retention period the harness states has passed
 * for its oldest evidence, `archiveBranch` makes a Git tag on the tip of the branch so that what the branch held then can always be found, and
 * deletes nothing: there is no function here that removes a tag, a commit, a file or the branch, a tag that exists is never moved, and a branch
 * that has no tip is not made.
 *
 * @remarks
 * The period and the day are arguments (`pure/retention.ts` judges them); the command reads the period from the harness's record
 * (`ifccm.declaration.ts`) and the day from the clock. The tag is annotated, so Git's own signing of tags (`tag.gpgSign`) applies as the host
 * configures it.
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import { parseEvidencePath } from "../pure/chain.ts";
import { judgeRetention, type RetentionJudgement, tagNameProblem } from "../pure/retention.ts";
import { branchTip, listCommits } from "./branch.ts";
import { formatHostError, gitRaw, gitText, type HostError, text } from "./git.ts";

/** Why a branch was not archived. */
export type ArchiveError =
  | HostError
  | { readonly kind: "no-branch" }
  | { readonly kind: "bad-tag"; readonly reason: string }
  | { readonly kind: "tag-exists"; readonly tag: string }
  | { readonly kind: "retention"; readonly reason: string };

/** A refusal as a sentence. */
export function formatArchiveError(e: ArchiveError): string {
  switch (e.kind) {
    case "git-missing":
    case "git":
      return formatHostError(e);
    case "no-branch":
      return "the repository has no quality branch: there is nothing to archive";
    case "bad-tag":
      return e.reason;
    case "tag-exists":
      return `the tag ${e.tag} exists already: an archive tag is never moved or replaced; give another name`;
    case "retention":
      return e.reason;
    default:
      return absurd(e);
  }
}

/** What `archiveBranch` did. */
export type Archived =
  | { readonly kind: "tagged"; readonly tag: string; readonly tip: string; readonly judgement: RetentionJudgement }
  /** The period has not passed, there is no evidence or the harness states no period: nothing was written. */
  | { readonly kind: "not-archived"; readonly judgement: RetentionJudgement };

/** What `archiveBranch` is given. */
export type ArchiveOptions = {
  readonly repo: string;
  /** The name of the tag to make. */
  readonly tag: string;
  /** The retention period the harness states, in days. */
  readonly retentionDays: number | undefined;
  /** The day today. */
  readonly today: string;
};

/** The UTC day of the oldest evidence file of the branch, `YYYY-MM-DD`, or none where the branch holds none. */
export async function oldestEvidenceDay(repo: string): Promise<Result<string | undefined, HostError>> {
  const commits = await listCommits(repo);
  if (commits.kind === "err") return commits;
  let oldest: string | undefined;
  for (const c of commits.value)
    for (const change of c.changes) {
      const p = parseEvidencePath(change.path);
      if (p.kind === "err") continue;
      const day = p.value.day.replaceAll("/", "-");
      if (oldest === undefined || day < oldest) oldest = day;
    }
  return ok(oldest);
}

/**
 * Archives the branch by a tag where the retention period of its oldest evidence has passed (FR-047). It refuses a name that is not a tag name
 * and a tag that exists, and it only ever adds the one tag.
 */
export async function archiveBranch(options: ArchiveOptions): Promise<Result<Archived, ArchiveError>> {
  const problem = tagNameProblem(options.tag);
  if (problem !== undefined) return err({ kind: "bad-tag", reason: problem });
  const tip = await branchTip(options.repo);
  if (tip.kind === "err") return tip;
  if (tip.value === undefined) return err({ kind: "no-branch" });
  const oldest = await oldestEvidenceDay(options.repo);
  if (oldest.kind === "err") return oldest;
  const judged = judgeRetention({ oldestDay: oldest.value, retentionDays: options.retentionDays, today: options.today });
  if (judged.kind === "err") return err({ kind: "retention", reason: judged.error });
  if (judged.value.kind !== "due") return ok({ kind: "not-archived", judgement: judged.value });
  const there = await gitRaw(options.repo, ["rev-parse", "--verify", "--quiet", `refs/tags/${options.tag}`]);
  if (there.kind === "err") return there;
  if (there.value.code === 0) return err({ kind: "tag-exists", tag: options.tag });
  const message =
    `Archive of the quality branch at ${tip.value}: the retention period of its oldest evidence (${judged.value.oldestDay}) ended on ${judged.value.dueOn}.\n` +
    "Evidence is archived by this tag and never deleted (0021-ifqs FR-047).";
  const made = await gitText(options.repo, ["tag", "-a", "-m", message, options.tag, tip.value]);
  if (made.kind === "err") return made;
  return ok({ kind: "tagged", tag: options.tag, tip: tip.value, judgement: judged.value });
}

/** The commit a tag points to (peeled), or none where the tag is not there: the proof that an archive tag names the tip it was made on. */
export async function tagTarget(repo: string, tag: string): Promise<Result<string | undefined, HostError>> {
  const r = await gitRaw(repo, ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`]);
  if (r.kind === "err") return r;
  return ok(r.value.code === 0 ? text(r.value.stdout).trim() : undefined);
}
