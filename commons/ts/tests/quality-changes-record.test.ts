/**
 * The `changes` check leaves its result as a quality record (commons 0020-ifccm FR-031, 0021-ifqs FR-005, FR-015): `tools/changes.ts` run as a real
 * program on real temporary Git repositories with real commits. Each rule is a case, each finding a failed case with its rule, file and line, each
 * rule that could not run (the strict rules where the repository is plain Git, where no host was asked, the commit rules where no range was
 * given) a case that is `not_run` with its reason and never a pass; the record is written to the repository's `test-results` and, with
 * `--keep-record`, kept on the `quality` branch. No Git host account is needed: the repository's `origin` is an address no one answers, which is
 * plain Git to the adapters.
 *
 * @module
 */
import { verifyBranch } from "../quality/host/branch.ts";
import { readQuality, type QualityRecord } from "../quality/pure/record.ts";
import { sarif } from "../quality/pure/render.ts";
import { makeTempDir, readDirSync, readTextFileSync, remove, removeSync, writeTextFile } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { execPath, run } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { at, list, parsed } from "./quality-fixtures.ts";
import { git, needsGit, repositoryWithCommit } from "./quality-fixtures.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const CHANGES = join(ROOT, "tools", "changes.ts");

const changes = (...words: string[]): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> =>
  run([execPath(), CHANGES, ...words], { env: { GIT_TERMINAL_PROMPT: "0" } });

/** The record the check left in the repository's `test-results`, read back and taken away so that the next run's is the only one. */
function leftRecord(repo: string): QualityRecord {
  const folder = join(repo, "test-results");
  const names = readDirSync(folder)
    .map((e) => e.name)
    .filter((n) => n.startsWith("changes-") && n.endsWith(".otlp.json"))
    .sort();
  assertEquals(names.length, 1, "one run, one record");
  const name = names[0];
  assert(name !== undefined, "the check left a record");
  const q = readQuality(readTextFileSync(join(folder, name)));
  removeSync(folder, { recursive: true });
  assert(q.kind === "ok", q.kind === "err" ? JSON.stringify(q.error) : "");
  return q.value;
}

const byRule = (q: QualityRecord, rule: string) => q.cases.filter((c) => c.rule === rule);

proves(
  ["0020-ifccm FR-031", "0021-ifqs FR-015"],
  "a run of the changes check leaves each rule as a case and each finding as a failed case with its rule, file and line; the rules that could not run are not_run with their reason, never passed",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-changes-record-" });
    try {
      const first = await repositoryWithCommit(repo);
      await writeTextFile(join(repo, "b.txt"), "b\n");
      await git(repo, "add", "-A");
      await git(repo, "commit", "-q", "-m", "A change that names no issue");
      await writeTextFile(join(repo, "c.txt"), "c\n");
      await git(repo, "add", "-A");
      await git(repo, "commit", "-q", "-m", "A change that names one\n\nRefs #10");
      const second = await git(repo, "rev-parse", "HEAD~1");
      await git(repo, "remote", "add", "origin", "https://git.example.invalid/team/repo.git");

      // with a range, and the host not asked: the commit rules ran, the strict ones did not
      const ranged = await changes("--repo", repo, "--range", `${first}..HEAD`);
      assertEquals(ranged.code, 1, ranged.stderr);
      assertStringIncludes(ranged.stderr, "changes: record ");
      const q = leftRecord(repo);
      assertEquals(q.run.runner.role, "changes");
      const noIssue = byRule(q, "changes/no-issue");
      assertEquals(
        noIssue.map((c) => [c.outcome, c.file, c.line !== undefined]),
        [["fail", `commit:${second.slice(0, 12)}`, true]],
      );
      assertStringIncludes(noIssue[0]?.message ?? "", "names no change request");
      for (const rule of ["changes/closing-keyword", "changes/gate-relaxed", "changes/declaration"])
        assertEquals(
          byRule(q, rule).map((c) => c.outcome),
          ["pass"],
          rule,
        );
      for (const rule of ["changes/unknown-issue", "changes/closed-issue", "changes/early-close", "changes/issue-shape"]) {
        const c = byRule(q, rule);
        assertEquals(
          c.map((x) => x.outcome),
          ["not_run"],
          rule,
        );
        assertEquals(c[0]?.reason, "--strict was not given, so the host was not asked", rule);
      }
      assertEquals([q.counts.failed, q.counts.notRun], [1, 4]);
      // the finding renders as a SARIF result with its rule
      const results = list(at(parsed(sarif(q)), "runs", 0, "results"));
      assertEquals(
        results.some((r) => at(r, "ruleId") === "changes/no-issue" && at(r, "level") === "error"),
        true,
      );

      // --strict on plain Git: the strict rules are not_run with the reason that there is no host API, never passed
      const strict = await changes("--repo", repo, "--range", `${first}..HEAD`, "--strict");
      assertEquals(strict.code, 1, strict.stderr);
      const s = leftRecord(repo);
      for (const rule of ["changes/unknown-issue", "changes/early-close"]) {
        const c = byRule(s, rule);
        assertEquals(
          c.map((x) => x.outcome),
          ["not_run"],
          rule,
        );
        assertStringIncludes(c[0]?.reason ?? "", "there is no host API", rule);
      }
      assertEquals(
        s.cases.some((c) => c.outcome === "pass" && (c.rule ?? "").startsWith("changes/unknown")),
        false,
      );

      // no range: no commit was judged, and the commit rules say so
      const none = await changes("--repo", repo);
      assertEquals(none.code, 0, none.stderr);
      const n = leftRecord(repo);
      assertEquals(
        byRule(n, "changes/no-issue").map((c) => [c.outcome, c.reason]),
        [["not_run", "no --range was given, so no commit was judged"]],
      );
      assertEquals(
        byRule(n, "changes/declaration").map((c) => c.outcome),
        ["pass"],
      );

      // a command line that does not fit: the run judged nothing, and the record says so
      const usage = await changes("--repo", repo, "--strict");
      assertEquals(usage.code, 2);
      const u = leftRecord(repo);
      assertEquals(
        u.cases.map((c) => [c.rule, c.outcome]),
        [["changes/run", "not_run"]],
      );
      assertStringIncludes(u.cases[0]?.reason ?? "", "exited with status 2");
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  { ...needsGit },
);

proves(
  ["0020-ifccm FR-031"],
  "with --keep-record the run's record is kept as evidence on the quality branch, in a chain that verifies, and --record-dir says where the file is written",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-changes-record-" });
    try {
      const first = await repositoryWithCommit(repo);
      await writeTextFile(join(repo, "b.txt"), "b\n");
      await git(repo, "add", "-A");
      await git(repo, "commit", "-q", "-m", "Names an issue\n\nRefs #10");
      const kept = await changes("--repo", repo, "--range", `${first}..HEAD`, "--keep-record", "--record-dir", "out");
      assertEquals(kept.code, 0, kept.stderr);
      assertStringIncludes(kept.stderr, "changes: kept quality/evidence/");
      assertEquals(readDirSync(join(repo, "out")).filter((e) => e.name.startsWith("changes-")).length, 1);
      const v = await verifyBranch(repo);
      assert(v.kind === "ok", v.kind === "err" ? JSON.stringify(v.error) : "");
      assertEquals(v.value.count, 1);
      // a flag that needs a value, and has none, is a command line that does not fit
      assertEquals((await changes("--repo", repo, "--record-dir")).code, 2);
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  { ...needsGit },
);
