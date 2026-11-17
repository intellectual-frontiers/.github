/**
 * The append-only `quality` branch and its notes, with real `git` (commons 0021-ifqs FR-016 to FR-018, FR-021): `keepRun` makes a run's
 * record canonical (chained to the file before it), writes it as one new file `quality/evidence/YYYY/MM/DD/<trace id>.otlp.json` in a commit
 * on the orphan branch `quality` (signed through the host's own Git signing where asked) and puts a note under `refs/notes/quality` on the
 * tested commit; `verifyBranch` walks the branch and its chain and names the first thing that does not match; `gradeOfCommit` says what a
 * commit's evidence is worth (a commit with no note is `E0`).
 *
 * @remarks
 * The branch is written with Git's plumbing (`hash-object`, a temporary index, `write-tree`, `commit-tree`, `update-ref` with the old tip
 * as its guard), so the working tree and the index of the repository are never touched, and a branch that moved while a run was kept is
 * refused rather than overwritten. A file already on the branch is never replaced (`exists`). Git signs: `gpg.format`, `user.signingkey`
 * and `commit.gpgsign` are the host's, and no key is read here. A force-push cannot be refused by a client; `refuseRewrite` configures a
 * repository that receives pushes to refuse non-fast-forward updates and deletions, and `verifyBranch` finds a branch that was rewritten
 * (a commit that changes or removes a file, or a chain that no longer matches).
 *
 * @example
 * ```ts
 * import { keepRun, verifyBranch } from "./branch.ts";
 * // const kept = await keepRun({ repo: ".", record: assembled.record });
 * // const ok = await verifyBranch(".");
 * ```
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { GENESIS } from "../../kernel/evidence.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import type { Sha256 } from "../../kernel/sha256.ts";
import { AlreadyExists } from "../../runtime/errors.ts";
import { makeTempDir, remove, writeTextFile } from "../../runtime/fs.ts";
import { join } from "../../runtime/path.ts";
import {
  type ChainBreak,
  type EvidenceNote,
  type EvidencePath,
  evidencePath,
  fileDigest,
  formatChainBreak,
  formatNote,
  gradeOf,
  type KeptFile,
  parseEvidencePath,
  parseNotes,
  verifyChain,
  verifyNote,
} from "../pure/chain.ts";
import { EVIDENCE_ROOT, type Grade, NO_GRADE, NOTES_REF, QUALITY_BRANCH } from "../pure/names.ts";
import { canonicalize, formatQualityError, type NotRun, type QualityRecord } from "../pure/record.ts";
import { formatHostError, git, gitRaw, type GitInput, gitText, type HostError, text } from "./git.ts";

const BRANCH_REF = `refs/heads/${QUALITY_BRANCH}`;

// ---------------------------------------------------------------------------------------------------------------------------- reading the branch

/** One commit of the branch: what it added and whether it is signed. */
export type BranchCommit = {
  readonly commit: string;
  readonly parents: readonly string[];
  readonly changes: readonly { readonly status: string; readonly path: string }[];
  /** Git's one-letter signature status (`G` good, `N` none, `U` good with unknown validity, `B`, `E`, ...). */
  readonly signature: string;
};

/** The tip of the branch, or none where the repository has no `quality` branch yet. */
export async function branchTip(repo: string): Promise<Result<string | undefined, HostError>> {
  const r = await gitRaw(repo, ["rev-parse", "--verify", "--quiet", `${BRANCH_REF}^{commit}`]);
  if (r.kind === "err") return r;
  return ok(r.value.code === 0 ? text(r.value.stdout).trim() : undefined);
}

function signerConfig(allowedSigners: string | undefined): readonly string[] {
  return allowedSigners === undefined ? [] : ["-c", `gpg.ssh.allowedSignersFile=${allowedSigners}`];
}

/** The commits of the branch, oldest first, each with its changes and signature status. */
export async function listCommits(
  repo: string,
  options: { readonly allowedSigners?: string } = {},
): Promise<Result<readonly BranchCommit[], HostError>> {
  const listed = await gitText(repo, ["rev-list", "--reverse", "--topo-order", "--parents", BRANCH_REF]);
  if (listed.kind === "err") return listed;
  const out: BranchCommit[] = [];
  for (const line of listed.value.split("\n")) {
    const [commit, ...parents] = line.trim().split(" ");
    if (commit === undefined || commit === "") continue;
    const diff = await git(repo, ["diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "-z", "--no-renames", commit]);
    if (diff.kind === "err") return diff;
    const fields = text(diff.value)
      .split("\0")
      .filter((f) => f !== "");
    const changes: { status: string; path: string }[] = [];
    for (let i = 0; i + 1 < fields.length; i += 2) changes.push({ status: fields[i] ?? "", path: fields[i + 1] ?? "" });
    const sig = await gitText(repo, [...signerConfig(options.allowedSigners), "log", "-1", "--format=%G?", commit]);
    if (sig.kind === "err") return sig;
    out.push({ commit, parents, changes, signature: sig.value });
  }
  return ok(out);
}

async function blobAt(repo: string, commit: string, path: string): Promise<Result<string, HostError>> {
  const r = await git(repo, ["cat-file", "blob", `${commit}:${path}`]);
  return r.kind === "ok" ? ok(text(r.value)) : r;
}

// ---------------------------------------------------------------------------------------------------------------------------- keeping a run

/** What `keepRun` is given. */
export type KeepOptions = {
  readonly repo: string;
  /** The run's document as 0008-test-evidence assembles it, or its text. */
  readonly record: unknown;
  /** What was planned and did not run (FR-005). */
  readonly notRun?: readonly NotRun[];
  /** The tested commit; the record's own revision, else `HEAD`, where it is not given. */
  readonly commit?: string;
  /** Whether to sign the commit that keeps it: true, false, or (not given) as the host's `commit.gpgsign` says. */
  readonly sign?: boolean;
};

/** A run that was kept. */
export type Kept = {
  readonly path: EvidencePath;
  readonly sha256: Sha256;
  readonly grade: Grade;
  /** The commit of the `quality` branch that holds the file. */
  readonly branchCommit: string;
  /** The commit that was tested, and so carries the note; none where the repository has no commit to name. */
  readonly tested?: string;
  readonly signed: boolean;
  readonly record: QualityRecord;
};

/** Why a run could not be kept. */
export type KeepError = HostError | { readonly kind: "record"; readonly reason: string };

/** A keep error as one sentence. */
export function formatKeepError(e: KeepError): string {
  return e.kind === "record" ? `the record cannot be kept: ${e.reason}` : formatHostError(e);
}

async function gitDir(repo: string): Promise<Result<string, HostError>> {
  return gitText(repo, ["rev-parse", "--absolute-git-dir"]);
}

/** The file the head commit of the branch added: its path and text, where there is one. */
async function lastFile(repo: string, tip: string): Promise<Result<KeptFile, HostError>> {
  const diff = await git(repo, ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "-z", tip]);
  if (diff.kind === "err") return diff;
  const path = text(diff.value)
    .split("\0")
    .find((p) => p.startsWith(`${EVIDENCE_ROOT}/`));
  if (path === undefined) return err({ kind: "unreadable", reason: `the head of the ${QUALITY_BRANCH} branch adds no evidence file` });
  const body = await blobAt(repo, tip, path);
  return body.kind === "ok" ? ok({ path, text: body.value }) : body;
}

async function signedCommit(repo: string, commit: string): Promise<Result<boolean, HostError>> {
  const raw = await gitText(repo, ["cat-file", "commit", commit]);
  if (raw.kind === "err") return raw;
  const headers = raw.value.split("\n\n")[0] ?? "";
  return ok(/^gpgsig(?:-sha256)? /m.test(headers));
}

async function testedCommit(
  repo: string,
  given: string | undefined,
  revision: string | undefined,
): Promise<Result<string | undefined, HostError>> {
  const wanted = given ?? revision;
  if (wanted === undefined) {
    const head = await gitRaw(repo, ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]);
    if (head.kind === "err") return head;
    return ok(head.value.code === 0 ? text(head.value.stdout).trim() : undefined);
  }
  if (wanted.startsWith("-")) return err({ kind: "unknown-commit", commit: wanted });
  const r = await gitRaw(repo, ["rev-parse", "--verify", "--quiet", `${wanted}^{commit}`]);
  if (r.kind === "err") return r;
  if (r.value.code !== 0) return err({ kind: "unknown-commit", commit: wanted });
  return ok(text(r.value.stdout).trim());
}

async function writeCommit(
  repo: string,
  tip: string | undefined,
  path: string,
  body: string,
  message: string,
  sign: boolean | undefined,
): Promise<Result<string, HostError>> {
  const blob = await gitText(repo, ["hash-object", "-w", "--stdin"], { input: body });
  if (blob.kind === "err") return blob;
  const dir = await gitDir(repo);
  if (dir.kind === "err") return dir;
  const scratch = await makeTempDir({ dir: dir.value, prefix: "ifc-quality-" });
  const index = join(scratch, "index");
  const env: GitInput = { env: { GIT_INDEX_FILE: index } };
  try {
    if (tip !== undefined) {
      const read = await git(repo, ["read-tree", tip], env);
      if (read.kind === "err") return read;
    }
    const add = await git(repo, ["update-index", "--add", "--cacheinfo", `100644,${blob.value},${path}`], env);
    if (add.kind === "err") return add;
    const tree = await gitText(repo, ["write-tree"], env);
    if (tree.kind === "err") return tree;
    const args = ["commit-tree", tree.value, ...(tip === undefined ? [] : ["-p", tip]), ...(sign === true ? ["-S"] : []), "-m", message];
    const made = await gitRaw(repo, args);
    if (made.kind === "err") return made;
    if (made.value.code !== 0)
      return sign === true
        ? err({ kind: "unsigned", reason: made.value.stderr })
        : err({ kind: "git", args, code: made.value.code, message: made.value.stderr });
    return ok(text(made.value.stdout).trim());
  } finally {
    await remove(scratch, { recursive: true });
  }
}

async function signingFollowsConfig(repo: string): Promise<boolean> {
  const r = await gitRaw(repo, ["config", "--type=bool", "--get", "commit.gpgsign"]);
  return r.kind === "ok" && r.value.code === 0 && text(r.value.stdout).trim() === "true";
}

/**
 * Keeps a run (FR-016 to FR-018): the record is made canonical with the digest of the last file of the branch as its predecessor, written as
 * a new file in a commit on the orphan `quality` branch (created by this commit where there is none), and noted on the tested commit with
 * the file's path, its SHA-256 and its grade. A path already kept is refused, and so is a trace already kept; a branch that moved is
 * refused and nothing is changed. The grade is `E4` where the commit is signed and `E3` where it is not.
 */
export async function keepRun(options: KeepOptions): Promise<Result<Kept, KeepError>> {
  const repo = options.repo;
  const tip = await branchTip(repo);
  if (tip.kind === "err") return tip;
  let previous: Sha256 | undefined;
  if (tip.value !== undefined) {
    const last = await lastFile(repo, tip.value);
    if (last.kind === "err") return last;
    previous = await fileDigest(last.value.text);
  }
  const canonical = await canonicalize({
    record: options.record,
    previous: previous ?? GENESIS,
    ...(options.notRun === undefined ? {} : { notRun: options.notRun }),
  });
  if (canonical.kind === "err") return err({ kind: "record", reason: formatQualityError(canonical.error) });
  const q = canonical.value.record;
  const path = evidencePath(q.traceId, q.run.end);
  if (path.kind === "err") return err({ kind: "record", reason: path.error });
  if (tip.value !== undefined) {
    const listed = await gitText(repo, ["ls-tree", "-r", "--name-only", tip.value, "--", EVIDENCE_ROOT]);
    if (listed.kind === "err") return listed;
    const clash = listed.value.split("\n").find((p) => p.endsWith(`/${q.traceId}.otlp.json`));
    if (clash !== undefined) return err({ kind: "exists", path: clash });
  }
  const tested = await testedCommit(repo, options.commit, q.run.runner.revision);
  if (tested.kind === "err") return tested;
  const sign = options.sign ?? (await signingFollowsConfig(repo));
  const message = `Evidence of run ${q.traceId}${tested.value === undefined ? "" : ` for ${tested.value.slice(0, 12)}`}\n\nKept by ifc quality (commons 0021-ifqs).`;
  const commit = await writeCommit(repo, tip.value, path.value, canonical.value.text, message, sign);
  if (commit.kind === "err") return commit;
  const guard = tip.value ?? "0".repeat(commit.value.length);
  const moved = await gitRaw(repo, ["update-ref", "-m", `keep ${q.traceId}`, BRANCH_REF, commit.value, guard]);
  if (moved.kind === "err") return moved;
  if (moved.value.code !== 0) return err({ kind: "moved", branch: QUALITY_BRANCH });
  const signed = await signedCommit(repo, commit.value);
  if (signed.kind === "err") return signed;
  const digest = await fileDigest(canonical.value.text);
  const grade = gradeOf({ record: true, chained: true, signed: signed.value, linked: tested.value !== undefined, broken: false });
  if (tested.value !== undefined) {
    const note: EvidenceNote = { path: path.value, sha256: digest, grade };
    const noted = await git(repo, ["notes", "--ref", NOTES_REF, "append", "-F", "-", tested.value], { input: formatNote(note) });
    if (noted.kind === "err") return noted;
  }
  return ok({
    path: path.value,
    sha256: digest,
    grade,
    branchCommit: commit.value,
    ...(tested.value === undefined ? {} : { tested: tested.value }),
    signed: signed.value,
    record: q,
  });
}

// ---------------------------------------------------------------------------------------------------------------------------- verifying

/** The first thing wrong with the branch (FR-016 to FR-018): what, and where. */
export type BranchProblem =
  | { readonly kind: "no-branch" }
  | { readonly kind: "not-append"; readonly commit: string; readonly reason: string }
  | { readonly kind: "chain"; readonly break: ChainBreak }
  | { readonly kind: "unsigned-commit"; readonly commit: string; readonly path: string; readonly status: string }
  | { readonly kind: "note"; readonly commit: string; readonly reason: string };

/** What can go wrong verifying: the host, or the branch. */
export type VerifyError = HostError | BranchProblem;

/** A verification failure as one sentence. */
export function formatVerifyError(e: VerifyError): string {
  switch (e.kind) {
    case "no-branch":
      return `the repository has no ${QUALITY_BRANCH} branch`;
    case "not-append":
      return `commit ${e.commit} of the ${QUALITY_BRANCH} branch does not only append a file: ${e.reason}`;
    case "chain":
      return formatChainBreak(e.break);
    case "unsigned-commit":
      return `commit ${e.commit} that keeps ${e.path} is not signed by a key this harness trusts (status ${e.status})`;
    case "note":
      return `the note on ${e.commit} does not match the evidence: ${e.reason}; its grade is E0`;
    case "git-missing":
    case "git":
    case "exists":
    case "moved":
    case "unknown-commit":
    case "unsigned":
    case "refused":
    case "unreadable":
      return formatHostError(e);
    default:
      return absurd(e);
  }
}

/** One evidence file as the verifier found it. */
export type VerifiedFile = { readonly path: string; readonly commit: string; readonly traceId: string; readonly signed: boolean };

/** A tested commit and what its evidence is worth. */
export type CommitGrade = { readonly commit: string; readonly grade: Grade; readonly path: string };

/** A branch that verifies. */
export type Verified = {
  readonly count: number;
  readonly head: Sha256;
  readonly files: readonly VerifiedFile[];
  readonly grades: readonly CommitGrade[];
};

/** How to verify. */
export type VerifyOptions = {
  /** An SSH allowed-signers file the harness trusts; where given, a commit is signed only when Git verifies it against it. */
  readonly allowedSigners?: string;
  /** Fail on a commit that is not signed (and trusted, where `allowedSigners` is given). */
  readonly requireSigned?: boolean;
};

async function noteOf(repo: string, commit: string): Promise<Result<string | undefined, HostError>> {
  const r = await gitRaw(repo, ["notes", "--ref", NOTES_REF, "show", commit]);
  if (r.kind === "err") return r;
  return ok(r.value.code === 0 ? text(r.value.stdout) : undefined);
}

function isSigned(status: string, trusted: boolean): boolean {
  return trusted ? status === "G" : status !== "N" && status !== "";
}

/**
 * Walks the `quality` branch (FR-016 to FR-018): every commit only appends one evidence file, the chain of `ifc.quality.previous.sha256`
 * holds from the first file to the last, and, where asked, every commit is signed. Then each note under `refs/notes/quality` is read and
 * must name a file on the branch with the SHA-256 it says. The first thing that does not match is returned, naming the file or the commit.
 */
export async function verifyBranch(repo: string, options: VerifyOptions = {}): Promise<Result<Verified, VerifyError>> {
  const tip = await branchTip(repo);
  if (tip.kind === "err") return tip;
  if (tip.value === undefined) return err({ kind: "no-branch" });
  const commits = await listCommits(repo, options.allowedSigners === undefined ? {} : { allowedSigners: options.allowedSigners });
  if (commits.kind === "err") return commits;
  const files: KeptFile[] = [];
  const meta: VerifiedFile[] = [];
  for (const c of commits.value) {
    if (c.parents.length > 1) return err({ kind: "not-append", commit: c.commit, reason: "it is a merge" });
    const [only, ...rest] = c.changes;
    if (only === undefined || rest.length > 0)
      return err({ kind: "not-append", commit: c.commit, reason: `it changes ${c.changes.length} paths, and must add exactly one` });
    if (only.status !== "A")
      return err({ kind: "not-append", commit: c.commit, reason: `it ${only.status === "D" ? "removes" : "changes"} ${only.path}` });
    const p = parseEvidencePath(only.path);
    if (p.kind === "err") return err({ kind: "not-append", commit: c.commit, reason: p.error });
    const body = await blobAt(repo, c.commit, only.path);
    if (body.kind === "err") return body;
    files.push({ path: only.path, text: body.value });
    meta.push({
      path: only.path,
      commit: c.commit,
      traceId: p.value.traceId,
      signed: isSigned(c.signature, options.allowedSigners !== undefined),
    });
  }
  const chain = await verifyChain(files);
  if (chain.kind === "err") return err({ kind: "chain", break: chain.error });
  if (options.requireSigned === true) {
    for (const [i, c] of commits.value.entries()) {
      const m = meta[i];
      if (m !== undefined && !m.signed) return err({ kind: "unsigned-commit", commit: c.commit, path: m.path, status: c.signature });
    }
  }
  const grades: CommitGrade[] = [];
  const noted = await gitRaw(repo, ["notes", "--ref", NOTES_REF, "list"]);
  if (noted.kind === "err") return noted;
  const tested =
    noted.value.code === 0
      ? text(noted.value.stdout)
          .split("\n")
          .map((l) => l.trim().split(" ")[1])
          .filter((c): c is string => c !== undefined && c !== "")
      : [];
  for (const commit of tested) {
    const raw = await noteOf(repo, commit);
    if (raw.kind === "err") return raw;
    const notes = parseNotes(raw.value ?? "");
    if (notes.kind === "err") return err({ kind: "note", commit, reason: notes.error });
    for (const n of notes.value) {
      const at = files.findIndex((f) => f.path === n.path);
      const f = files[at];
      const m = meta[at];
      if (f === undefined || m === undefined)
        return err({ kind: "note", commit, reason: `${n.path} is not on the ${QUALITY_BRANCH} branch` });
      if (!(await verifyNote(n, f.text))) return err({ kind: "note", commit, reason: `${n.path} has another SHA-256 than the note's` });
      grades.push({ commit, path: n.path, grade: gradeOf({ record: true, chained: true, signed: m.signed, linked: true, broken: false }) });
    }
  }
  return ok({ count: files.length, head: chain.value.head, files: meta, grades });
}

/**
 * What the evidence of a commit is worth (FR-018, FR-021): `E0` where the commit has no note, where its note does not match its file or
 * the branch does not verify; else the grade of its newest run, `E4` where that run is signed and chained and `E3` where it is not.
 */
export async function gradeOfCommit(repo: string, commit: string, options: VerifyOptions = {}): Promise<Result<Grade, HostError>> {
  const full = await gitText(repo, ["rev-parse", "--verify", "--quiet", `${commit}^{commit}`]);
  if (full.kind === "err") return err({ kind: "unknown-commit", commit });
  const v = await verifyBranch(repo, options);
  if (v.kind === "err") {
    const e = v.error;
    return e.kind === "git-missing" || e.kind === "git" ? err(e) : ok(NO_GRADE);
  }
  const mine = v.value.grades.filter((g) => g.commit === full.value);
  return ok(mine[mine.length - 1]?.grade ?? NO_GRADE);
}

/** The evidence file text of a run kept on the branch, by its trace id. */
export async function readKeptRun(repo: string, traceId: string): Promise<Result<string, HostError>> {
  const tip = await branchTip(repo);
  if (tip.kind === "err") return tip;
  if (tip.value === undefined) return err({ kind: "unreadable", reason: `the repository has no ${QUALITY_BRANCH} branch` });
  const listed = await gitText(repo, ["ls-tree", "-r", "--name-only", tip.value, "--", EVIDENCE_ROOT]);
  if (listed.kind === "err") return listed;
  const path = listed.value.split("\n").find((p) => p.endsWith(`/${traceId}.otlp.json`));
  if (path === undefined) return err({ kind: "unreadable", reason: `no run ${traceId} is kept on the ${QUALITY_BRANCH} branch` });
  return blobAt(repo, tip.value, path);
}

/**
 * Whether the branch is still an extension of an earlier tip (FR-016): a rewrite of the branch is not. A CI job that remembers the tip it
 * saw last (or a hook on the repository that receives pushes) refuses the update where this is false.
 */
export async function extendsTip(repo: string, earlier: string): Promise<Result<boolean, HostError>> {
  const r = await gitRaw(repo, ["merge-base", "--is-ancestor", earlier, BRANCH_REF]);
  if (r.kind === "err") return r;
  if (r.value.code === 0) return ok(true);
  if (r.value.code === 1) return ok(false);
  return err({ kind: "git", args: ["merge-base", "--is-ancestor"], code: r.value.code, message: r.value.stderr });
}

/**
 * Configures a repository that receives pushes (a bare one) to refuse a force-push and the deletion of any branch (FR-016):
 * `receive.denyNonFastForwards` and `receive.denyDeletes`. A host that is not Git itself (a forge) has its own protected-branch setting.
 */
export async function refuseRewrite(repo: string): Promise<Result<void, HostError>> {
  for (const key of ["receive.denyNonFastForwards", "receive.denyDeletes"]) {
    const r = await git(repo, ["config", key, "true"]);
    if (r.kind === "err") return r;
  }
  return ok(undefined);
}

/** Pushes the branch and its notes, never forced: a remote that has moved on, or been rewritten, refuses it. */
export async function pushQuality(repo: string, remote: string): Promise<Result<void, HostError>> {
  const refs = [`${BRANCH_REF}:${BRANCH_REF}`, `${NOTES_REF}:${NOTES_REF}`];
  const r = await git(repo, ["push", remote, ...refs]);
  return r.kind === "ok" ? ok(undefined) : r;
}

/** Writes a file for tests and tools that keep an evidence file outside Git (a copy for an assessor): refuses to overwrite one (FR-016). */
export async function writeOnce(path: string, body: string): Promise<Result<void, HostError>> {
  try {
    await writeTextFile(path, body, { createNew: true });
    return ok(undefined);
  } catch (e) {
    if (e instanceof AlreadyExists) return err({ kind: "exists", path });
    return err({ kind: "unreadable", reason: e instanceof Error ? e.message : String(e) });
  }
}
