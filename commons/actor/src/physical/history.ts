// Spec: 0004-actor-trailers FR-007
/**
 * The actors of a repository's history (commons 0048-actors FR-063, FR-070): the commits of `git log`, each with its author, its instant, its files and the actors its trailers name. It only reads; it never writes a
 * commit, a note or a tag.
 *
 * @example
 * ```ts
 * import { readHistory } from "./history.ts";
 * const r = await readHistory(".", { max: 50 });
 * if (r.kind === "ok") console.log(r.value.filter((c) => c.decoded.actors.preparedBy?.kind === "agent").length);
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { proc } from "@intellectual-frontiers/system";
import { type Decoded, decodeMessage } from "@intellectual-frontiers/actor/logical";

/** A commit and what its trailers say of its actors. */
export interface CommitActs {
  readonly sha: string;
  /** The name Git records as the author. */
  readonly author: string;
  /** The instant it was authored, as Git writes it (ISO 8601). */
  readonly at: string;
  readonly subject: string;
  readonly message: string;
  readonly files: readonly string[];
  readonly decoded: Decoded;
}

const FORMAT = "%x1e%H%x1f%an%x1f%aI%x1f%B%x1f";

/** The commits of a repository, newest first, at most `max` of them (500 where none is given), from `since` (a revision or a date Git reads) where it is given. */
export async function readHistory(repo: string, options: { readonly max?: number; readonly since?: string } = {}): Promise<Result<readonly CommitActs[], string>> {
  const args = ["git", "--no-pager", "-C", repo, "log", `--max-count=${options.max ?? 500}`, `--format=${FORMAT}`, "--name-only"];
  if (options.since !== undefined) {
    if (options.since.startsWith("-")) return err("since may not start with -");
    args.push(`--since=${options.since}`);
  }
  let out: proc.Output;
  try {
    out = await proc.output(args, { env: { GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat", LC_ALL: "C" } });
  } catch (e) {
    return err(`git could not be run: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (out.code !== 0) return err(`git log failed: ${new TextDecoder().decode(out.stderr).trim()}`);
  const text = new TextDecoder().decode(out.stdout);
  const commits: CommitActs[] = [];
  for (const record of text.split("\x1e")) {
    if (record.trim() === "") continue;
    const [sha = "", author = "", at = "", message = "", rest = ""] = record.split("\x1f");
    const files = rest.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    commits.push({ sha: sha.trim(), author, at, subject: message.split("\n")[0] ?? "", message, files, decoded: decodeMessage(message) });
  }
  return ok(commits);
}
