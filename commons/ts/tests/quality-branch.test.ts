/**
 * The `quality` branch with real `git` (commons 0021-ifqs FR-016 to FR-018, FR-021): a run kept as one new file on an orphan branch, the
 * chain of `ifc.quality.previous.sha256` from file to file, the note on the tested commit, the verifier that names the first file that does
 * not match (a changed file, a removed one, a commit that edits or deletes), the refusal to overwrite, the refusal of a forced push to a
 * repository set to refuse it, and signing through the host's own Git signing with an SSH key that `ssh-keygen` makes where it is installed
 * (those tests are skipped, with the reason, where it is not). Every repository is a real one in a temporary folder.
 *
 * @module
 */
import { sha256 } from "../kernel/sha256.ts";
import { mkdir, readTextFile, withTempDir, writeTextFile } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { run } from "../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { parseNotes } from "../quality/pure/chain.ts";
import { NOTES_REF, QUALITY_BRANCH } from "../quality/pure/names.ts";
import {
  extendsTip,
  formatVerifyError,
  gradeOfCommit,
  keepRun,
  listCommits,
  pushQuality,
  readKeptRun,
  refuseRewrite,
  verifyBranch,
  writeOnce,
} from "../quality/host/branch.ts";
import { assembledRun, git, needsGit, needsSshKeygen, nextCommit, repositoryWithCommit, sshSigning } from "./quality-fixtures.ts";

/** A result as one sentence for an assertion message (a record holds integers that JSON cannot write). */
function said(r: { readonly kind: "ok" | "err"; readonly error?: unknown }): string {
  return r.kind === "ok"
    ? "ok"
    : (typeof r.error === "object" && r.error !== null && "kind" in r.error ? String(r.error.kind) : "failed") +
        ": " +
        JSON.stringify(r.error, (_k, v: unknown) => (typeof v === "bigint" ? String(v) : v));
}

/** A repository with a commit, and the evidence of two runs of it kept unsigned. */
async function withTwoRuns<T>(f: (repo: string, tested: string, files: readonly string[]) => Promise<T>): Promise<T> {
  return withTempDir(async (repo) => {
    const tested = await repositoryWithCommit(repo);
    const paths: string[] = [];
    for (const n of [1, 2]) {
      const kept = await keepRun({
        repo,
        record: await assembledRun(n, [{ name: `case ${n}`, requirements: ["0021-ifqs FR-016"] }], { revision: tested }),
        sign: false,
      });
      assert(kept.kind === "ok", said(kept));
      paths.push(kept.value.path);
    }
    return f(repo, tested, paths);
  });
}

proves(
  ["0021-ifqs FR-016"],
  "a run is kept as one new file on an orphan quality branch at quality/evidence/YYYY/MM/DD/<trace id>.otlp.json",
  async () => {
    await withTempDir(async (repo) => {
      const tested = await repositoryWithCommit(repo);
      const record = await assembledRun(1, [{ name: "adds", requirements: ["0021-ifqs FR-016"] }], { revision: tested });
      const kept = await keepRun({ repo, record, sign: false });
      assert(kept.kind === "ok", said(kept));
      assertEquals(kept.value.path, "quality/evidence/2026/11/17/00000000000000000000000000000001.otlp.json");
      // an orphan branch: its first commit has no parent, and it shares no history with main
      assertEquals(await git(repo, "rev-list", "--max-parents=0", QUALITY_BRANCH), kept.value.branchCommit);
      assertEquals(await git(repo, "merge-base", "main", QUALITY_BRANCH).catch(() => "none"), "none");
      // the file is in the commit and holds the record; the working tree was not touched
      assertEquals(await git(repo, "ls-tree", "-r", "--name-only", QUALITY_BRANCH), kept.value.path);
      assertEquals(await git(repo, "status", "--porcelain"), "");
      const q = await readKeptRun(repo, "00000000000000000000000000000001");
      assert(q.kind === "ok");
      assertEquals(await sha256(q.value), kept.value.sha256);
      // another run is another file in another commit that only appends
      const second = await keepRun({ repo, record: await assembledRun(2, [{ name: "b" }], { revision: tested }), sign: false });
      assert(second.kind === "ok");
      const commits = await listCommits(repo);
      assert(commits.kind === "ok");
      assertEquals(commits.value.length, 2);
      for (const c of commits.value)
        assertEquals(
          c.changes.map((x) => x.status),
          ["A"],
        );
      assertEquals(commits.value[1]?.parents, [kept.value.branchCommit]);
    });
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-016"],
  "a file kept is never changed or replaced: the same run again is refused and the branch is left as it was",
  async () => {
    await withTempDir(async (repo) => {
      const tested = await repositoryWithCommit(repo);
      const record = await assembledRun(1, [{ name: "adds" }], { revision: tested });
      const first = await keepRun({ repo, record, sign: false });
      assert(first.kind === "ok");
      const tip = await git(repo, "rev-parse", QUALITY_BRANCH);
      const again = await keepRun({ repo, record, sign: false });
      assert(again.kind === "err");
      assertEquals(again.error.kind, "exists");
      assertEquals(await git(repo, "rev-parse", QUALITY_BRANCH), tip);
      // a correction is a new run, which stays beside the first
      const fixed = await keepRun({ repo, record: await assembledRun(2, [{ name: "adds" }], { revision: tested }), sign: false });
      assert(fixed.kind === "ok");
      assertEquals((await git(repo, "ls-tree", "-r", "--name-only", QUALITY_BRANCH)).split("\n").length, 2);
      // and a file outside Git is never overwritten either
      const copy = join(repo, "copy.json");
      assert((await writeOnce(copy, "{}")).kind === "ok");
      const over = await writeOnce(copy, "{ }");
      assert(over.kind === "err");
      assertEquals(over.error.kind, "exists");
      assertEquals(await readTextFile(copy), "{}");
    });
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-017"],
  "each file names the SHA-256 of the file before it, 64 zeros for the first, and a chain that holds verifies",
  async () => {
    await withTwoRuns(async (repo) => {
      const first = await readKeptRun(repo, "00000000000000000000000000000001");
      const second = await readKeptRun(repo, "00000000000000000000000000000002");
      assert(first.kind === "ok" && second.kind === "ok");
      assertStringIncludes(first.value, "0".repeat(64));
      assertStringIncludes(second.value, await sha256(first.value));
      const v = await verifyBranch(repo);
      assert(v.kind === "ok", said(v));
      assertEquals(v.value.count, 2);
      assertEquals(v.value.head, await sha256(second.value));
    });
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-017"],
  "a file of the branch changed by one byte is found: the first file whose chain does not match is named",
  async () => {
    await withTwoRuns(async (repo, _tested, paths) => {
      assert((await verifyBranch(repo)).kind === "ok");
      // rewrite the branch so that its first file differs by one byte, in every commit that holds it
      const first = paths[0] ?? "";
      const r = await run(["git", "-C", repo, "filter-branch", "-f", "--tree-filter", `sed -i 's/"bun"/"bux"/' ${first}`, QUALITY_BRANCH], {
        env: { FILTER_BRANCH_SQUELCH_WARNING: "1", GIT_TERMINAL_PROMPT: "0" },
      });
      assert(r.success, r.stderr);
      const v = await verifyBranch(repo);
      assert(v.kind === "err", "the rewrite is found");
      assertEquals(v.error.kind, "chain");
      const message = formatVerifyError(v.error);
      // the second file is where the chain breaks, and the first, whose digest it names, is the one that changed
      assertStringIncludes(message, paths[1] ?? "");
      assertStringIncludes(message, paths[0] ?? "");
      assertStringIncludes(message, "was changed, or a file between them was removed or inserted");
    });
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-016", "0021-ifqs FR-017"],
  "a commit that edits or deletes a file of the branch, or adds anything else, is found and named",
  async () => {
    await withTwoRuns(async (repo, _tested, paths) => {
      const first = paths[0] ?? "";
      const tip = await git(repo, "rev-parse", QUALITY_BRANCH);
      // a commit on top of the branch that edits a kept file
      for (const [what, change] of [
        ["edits", async (dir: string) => writeTextFile(join(dir, first), "{}\n")],
        ["removes", async (dir: string) => run(["rm", join(dir, first)])],
        ["adds", async (dir: string) => writeTextFile(join(dir, "notes.txt"), "a note\n")],
      ] as const) {
        await withTempDir(async (work) => {
          await git(work, "clone", "-q", "--branch", QUALITY_BRANCH, repo, ".");
          await git(work, "config", "user.name", "ci");
          await git(work, "config", "user.email", "ci@example.com");
          await git(work, "config", "commit.gpgsign", "false");
          await change(work);
          await git(work, "add", "-A");
          await git(work, "commit", "-q", "-m", what);
          await git(work, "push", "-q", "origin", `HEAD:refs/heads/${QUALITY_BRANCH}-next`);
        });
        await git(repo, "update-ref", `refs/heads/${QUALITY_BRANCH}`, await git(repo, "rev-parse", `${QUALITY_BRANCH}-next`));
        const v = await verifyBranch(repo);
        assert(v.kind === "err", what);
        assertEquals(v.error.kind, "not-append", what);
        await git(repo, "update-ref", `refs/heads/${QUALITY_BRANCH}`, tip);
        await git(repo, "branch", "-q", "-D", `${QUALITY_BRANCH}-next`);
      }
      assert((await verifyBranch(repo)).kind === "ok");
    });
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-016", "0021-ifqs FR-002"],
  "the branch holds records and nothing else: a result in another form (JUnit XML) is not evidence and is refused by the chain",
  async () => {
    await withTempDir(async (repo) => {
      await repositoryWithCommit(repo);
      await git(repo, "switch", "-q", "--orphan", QUALITY_BRANCH);
      const path = "quality/evidence/2026/11/17/00000000000000000000000000000009.otlp.json";
      await mkdir(join(repo, "quality/evidence/2026/11/17"), { recursive: true });
      await writeTextFile(join(repo, path), '<?xml version="1.0"?><testsuites tests="1"/>\n');
      await git(repo, "add", "-A");
      await git(repo, "commit", "-q", "-m", "a result in another form");
      await git(repo, "switch", "-q", "main");
      const v = await verifyBranch(repo);
      assert(v.kind === "err");
      assertEquals(v.error.kind, "chain");
      assertStringIncludes(formatVerifyError(v.error), "does not read as a record");
    });
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-016"],
  "a force-push or a deletion of the quality branch is refused by a repository set to refuse it, and an ordinary push is accepted",
  async () => {
    await withTempDir(async (dir) => {
      const remote = join(dir, "remote.git");
      const repo = join(dir, "repo");
      await mkdir(repo);
      await git(dir, "init", "-q", "--bare", remote);
      assert((await refuseRewrite(remote)).kind === "ok");
      const tested = await repositoryWithCommit(repo);
      await git(repo, "remote", "add", "origin", remote);
      for (const n of [1, 2]) {
        const k = await keepRun({ repo, record: await assembledRun(n, [{ name: `c${n}` }], { revision: tested }), sign: false });
        assert(k.kind === "ok");
        if (n === 1) assert((await pushQuality(repo, "origin")).kind === "ok");
      }
      assert((await pushQuality(repo, "origin")).kind === "ok", "appending is accepted");
      assertEquals(await git(remote, "rev-parse", QUALITY_BRANCH), await git(repo, "rev-parse", QUALITY_BRANCH));
      // the history is rewritten locally to drop the second run, and pushed by force
      const first = await git(repo, "rev-parse", `${QUALITY_BRANCH}~1`);
      await git(repo, "update-ref", `refs/heads/${QUALITY_BRANCH}`, first);
      const forced = await run([
        "git",
        "-C",
        repo,
        "push",
        "--force",
        "origin",
        `refs/heads/${QUALITY_BRANCH}:refs/heads/${QUALITY_BRANCH}`,
      ]);
      assert(!forced.success, "the force-push is refused");
      assertStringIncludes(forced.stderr, "denying non-fast-forward");
      const deleted = await run(["git", "-C", repo, "push", "origin", `:refs/heads/${QUALITY_BRANCH}`]);
      assert(!deleted.success, "the deletion is refused");
      // the remote still has both runs, and a client can see the branch it holds is not an extension of what it saw
      assertEquals((await git(remote, "ls-tree", "-r", "--name-only", QUALITY_BRANCH)).split("\n").length, 2);
      const earlier = await git(remote, "rev-parse", QUALITY_BRANCH);
      assertEquals(await extendsTip(repo, earlier), { kind: "ok", value: false });
    });
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-018", "0021-ifqs FR-042"],
  "a Git note under refs/notes/quality on the tested commit gives the evidence file's path, its SHA-256 and its grade",
  async () => {
    await withTempDir(async (repo) => {
      const tested = await repositoryWithCommit(repo);
      const kept = await keepRun({
        repo,
        record: await assembledRun(1, [{ name: "adds", requirements: ["0021-ifqs FR-018"] }], { revision: tested }),
        sign: false,
      });
      assert(kept.kind === "ok");
      assertEquals(kept.value.tested, tested);
      const shown = await git(repo, "notes", "--ref", NOTES_REF, "show", tested);
      const notes = parseNotes(shown);
      assert(notes.kind === "ok");
      assertEquals(notes.value, [{ path: kept.value.path, sha256: kept.value.sha256, grade: "E3" }]);
      // the commit itself is unchanged
      assertEquals(await git(repo, "rev-parse", "HEAD"), tested);
      // another run of the same commit adds a stanza, the first stays
      const again = await keepRun({ repo, record: await assembledRun(2, [{ name: "adds" }], { revision: tested }), sign: false });
      assert(again.kind === "ok");
      const both = parseNotes(await git(repo, "notes", "--ref", NOTES_REF, "show", tested));
      assert(both.kind === "ok");
      assertEquals(
        both.value.map((n) => n.path),
        [kept.value.path, again.value.path],
      );
      assertEquals(await gradeOfCommit(repo, tested), { kind: "ok", value: "E3" });
    });
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-018", "0021-ifqs FR-021", "0021-ifqs FR-042"],
  "a commit with no note has no evidence (E0), and a note whose SHA-256 differs from its file breaks the evidence",
  async () => {
    await withTempDir(async (repo) => {
      const tested = await repositoryWithCommit(repo);
      const other = await nextCommit(repo, "b.txt");
      const kept = await keepRun({ repo, record: await assembledRun(1, [{ name: "adds" }], { revision: tested }), sign: false });
      assert(kept.kind === "ok");
      assertEquals(await gradeOfCommit(repo, tested), { kind: "ok", value: "E3" });
      assertEquals(await gradeOfCommit(repo, other), { kind: "ok", value: "E0" });
      // a note that names the file with another digest
      const wrong = `path ${kept.value.path}\nsha256 ${"1".repeat(64)}\ngrade E4\n`;
      await git(repo, "notes", "--ref", NOTES_REF, "add", "-f", "-m", wrong, tested);
      const v = await verifyBranch(repo);
      assert(v.kind === "err");
      assertEquals(v.error.kind, "note");
      assertEquals(await gradeOfCommit(repo, tested), { kind: "ok", value: "E0" });
      // a note that names a file the branch does not hold
      const missing = `path quality/evidence/2026/11/17/${"a".repeat(32)}.otlp.json\nsha256 ${kept.value.sha256}\ngrade E3\n`;
      await git(repo, "notes", "--ref", NOTES_REF, "add", "-f", "-m", missing, tested);
      const w = await verifyBranch(repo);
      assert(w.kind === "err");
      assertStringIncludes(formatVerifyError(w.error), "is not on the quality branch");
    });
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-016", "0021-ifqs FR-021", "0021-ifqs FR-042"],
  "a commit signed through the host's SSH signing is graded E4 and verifies against the allowed signers; an unsigned one is E3 and fails where signing is required",
  async () => {
    await withTempDir(async (repo) => {
      await withTempDir(async (keys) => {
        const tested = await repositoryWithCommit(repo);
        const allowed = await sshSigning(repo, keys);
        const signed = await keepRun({ repo, record: await assembledRun(1, [{ name: "adds" }], { revision: tested }), sign: true });
        assert(signed.kind === "ok", said(signed));
        assertEquals(signed.value.signed, true);
        assertEquals(signed.value.grade, "E4");
        const v = await verifyBranch(repo, { allowedSigners: allowed, requireSigned: true });
        assert(v.kind === "ok", said(v));
        assertEquals(
          v.value.files.map((f) => f.signed),
          [true],
        );
        assertEquals(await gradeOfCommit(repo, tested, { allowedSigners: allowed }), { kind: "ok", value: "E4" });
        // the second run is not signed: E3, and the branch fails where every commit must be signed
        const unsigned = await keepRun({ repo, record: await assembledRun(2, [{ name: "b" }], { revision: tested }), sign: false });
        assert(unsigned.kind === "ok");
        assertEquals(unsigned.value.grade, "E3");
        const strict = await verifyBranch(repo, { allowedSigners: allowed, requireSigned: true });
        assert(strict.kind === "err");
        assertEquals(strict.error.kind, "unsigned-commit");
        assert((await verifyBranch(repo, { allowedSigners: allowed })).kind === "ok");
        // signing follows the host's configuration where it is not asked for
        await git(repo, "config", "commit.gpgsign", "true");
        const follows = await keepRun({ repo, record: await assembledRun(3, [{ name: "c" }], { revision: tested }) });
        assert(follows.kind === "ok");
        assertEquals(follows.value.signed, true);
      });
    });
  },
  { ...needsSshKeygen },
);

proves(
  ["0021-ifqs FR-016"],
  "where signing is asked for and the host cannot sign, nothing is kept",
  async () => {
    await withTempDir(async (repo) => {
      const tested = await repositoryWithCommit(repo);
      await git(repo, "config", "gpg.format", "ssh");
      await git(repo, "config", "gpg.ssh.program", "ssh-keygen");
      await git(repo, "config", "user.signingkey", join(repo, "no-such-key.pub"));
      const r = await keepRun({ repo, record: await assembledRun(1, [{ name: "a" }], { revision: tested }), sign: true });
      assert(r.kind === "err");
      assertEquals(r.error.kind, "unsigned");
      const refs = await run(["git", "-C", repo, "rev-parse", "--verify", "--quiet", QUALITY_BRANCH]);
      assert(!refs.success, "no branch was made");
    });
  },
  { ...needsGit },
);
