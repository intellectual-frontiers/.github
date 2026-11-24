// Spec: 0005-git-remote FR-001, FR-002, FR-003
/**
 * The branch of a store, and only it, sent to a remote and brought back from one. A push is never forced: a remote that has commits the branch lacks refuses it, and that is a value, not a failure. A fetch
 * reads the remote's branch into a private reference and moves the branch of the store only where that is a fast-forward; a branch that has diverged is left as it is and said so. The name of a remote is checked
 * before Git sees it (no option, no line break, no transport that runs a program), and only the transports for files, SSH and the web are allowed.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { failure, type Git, textOf } from "../git.ts";

/** Why a push or a fetch did not do what was asked: a closed union. */
export type RemoteProblem =
  | { readonly kind: "no-branch"; readonly message: string }
  | { readonly kind: "rejected"; readonly message: string }
  | { readonly kind: "failed"; readonly message: string };

/** What a push did. */
export type Pushed = { readonly remote: string; readonly branch: string; readonly tip: string };

/** What a fetch did: a closed union. */
export type Fetched =
  | { readonly kind: "up-to-date"; readonly tip: string }
  | { readonly kind: "fast-forwarded"; readonly from: string | undefined; readonly to: string }
  | { readonly kind: "ahead"; readonly local: string; readonly remote: string }
  | { readonly kind: "diverged"; readonly local: string; readonly remote: string }
  | { readonly kind: "absent" };

const PROTOCOLS = "file:git:http:https:ssh";

/** Why a text cannot be the name or address of a remote, or nothing where it can. */
export function remoteProblem(remote: string): string | undefined {
  if (remote === "" || remote.trim() !== remote) return "a remote is named by a text with no space around it";
  if (remote.startsWith("-")) return `${JSON.stringify(remote)} starts with a dash, which Git would read as an option`;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/u.test(remote)) return "a remote holds no control character";
  if (/^(?:ext|fd)::/iu.test(remote)) return `${JSON.stringify(remote.slice(0, 8))} is a transport that runs a program, which is not allowed`;
  return undefined;
}

const env = { GIT_ALLOW_PROTOCOL: PROTOCOLS };

/** Pushes the branch, and only it, to a remote, never forced. */
export async function pushBranch(git: Git, branch: string, remote: string): Promise<Result<Pushed, RemoteProblem>> {
  const bad = remoteProblem(remote);
  if (bad !== undefined) return err({ kind: "failed", message: bad });
  const ref = `refs/heads/${branch}`;
  const tip = await git.run(["rev-parse", "--verify", "-q", `${ref}^{commit}`]);
  if (!tip.success) return err({ kind: "no-branch", message: `the branch ${branch} has no commit to push` });
  const out = await git.run(["push", "--porcelain", "--no-follow-tags", "--", remote, `${ref}:${ref}`], { env });
  const said = `${textOf(out.stdout)}\n${textOf(out.stderr)}`;
  if (out.success) return ok({ remote, branch, tip: textOf(tip.stdout).trim() });
  if (/\[rejected\]|non-fast-forward|fetch first|stale info/u.test(said)) {
    return err({ kind: "rejected", message: `the remote has commits that ${branch} lacks, and a push is never forced: ${failure(out)}` });
  }
  return err({ kind: "failed", message: failure(out) });
}

/** Brings the branch up to a remote's where that is a fast-forward. */
export async function fetchBranch(git: Git, branch: string, remote: string): Promise<Result<Fetched, RemoteProblem>> {
  const bad = remoteProblem(remote);
  if (bad !== undefined) return err({ kind: "failed", message: bad });
  const ref = `refs/heads/${branch}`;
  const keep = `refs/anyfs/fetched/${branch}`;
  const got = await git.run(["fetch", "--no-tags", "--quiet", "--", remote, `+${ref}:${keep}`], { env });
  if (!got.success) {
    return /couldn't find remote ref|no such remote ref/iu.test(textOf(got.stderr)) ? ok({ kind: "absent" }) : err({ kind: "failed", message: failure(got) });
  }
  const remoteTip = textOf((await git.run(["rev-parse", "--verify", `${keep}^{commit}`])).stdout).trim();
  const local = await git.run(["rev-parse", "--verify", "-q", `${ref}^{commit}`]);
  if (!local.success) {
    const made = await git.run(["update-ref", "-m", "anyfs: fetch", ref, remoteTip, "0".repeat(remoteTip.length)]);
    return made.success ? ok({ kind: "fast-forwarded", from: undefined, to: remoteTip }) : err({ kind: "failed", message: failure(made) });
  }
  const localTip = textOf(local.stdout).trim();
  if (localTip === remoteTip) return ok({ kind: "up-to-date", tip: localTip });
  if ((await git.run(["merge-base", "--is-ancestor", localTip, remoteTip])).success) {
    const moved = await git.run(["update-ref", "-m", "anyfs: fetch", ref, remoteTip, localTip]);
    return moved.success ? ok({ kind: "fast-forwarded", from: localTip, to: remoteTip }) : err({ kind: "failed", message: failure(moved) });
  }
  if ((await git.run(["merge-base", "--is-ancestor", remoteTip, localTip])).success) return ok({ kind: "ahead", local: localTip, remote: remoteTip });
  return ok({ kind: "diverged", local: localTip, remote: remoteTip });
}
