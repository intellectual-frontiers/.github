/**
 * The command `quality` (commons 0021-ifqs FR-005, FR-012, FR-013, FR-016 to FR-018) on a record that the real `ifc test run` wrote: a
 * fixture suite (a test that names its ISO/IEC 25010 characteristic, one that fails, a requirement no test proves) is run on the runtime
 * that runs this file, its record is kept on the `quality` branch of a real temporary repository by `quality record`, verified by
 * `quality verify` (and found broken after a rewrite), and rendered by `quality render`. The command runs as a real process on this
 * runtime, as a harness runs it. `ifc test` is the one that ran the suite, unchanged.
 *
 * @module
 */
import { makeTempDir, readTextFile, remove, writeTextFile } from "../runtime/fs.ts";
import { dirname, fromFileUrl, join, resolve, toFileUrl } from "../runtime/path.ts";
import { execPath, run, runtimeName } from "../runtime/proc.ts";
import { runTests } from "../runtime/test-run.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { needsGit, repositoryWithCommit } from "./quality-fixtures.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const TEST_TS = toFileUrl(join(ROOT, "runtime", "test.ts")).href;
const QUALITY = join(ROOT, "quality", "quality.ts");

const SUITE = `
import { assertEquals, proves } from ${JSON.stringify(TEST_TS)};
proves(["fixture FR-001"], "passes", () => assertEquals(1, 1), { characteristic: "reliability" });
proves(["fixture FR-002"], "fails", () => assertEquals(1, 2));
`;

const quality = (...words: string[]): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> =>
  run([execPath(), QUALITY, ...words]);

proves(
  ["0021-ifqs FR-005", "0021-ifqs FR-012", "0021-ifqs FR-013", "0021-ifqs FR-016", "0021-ifqs FR-017", "0021-ifqs FR-018"],
  "the record of a real run is kept on the quality branch, verified, found broken after a rewrite, and rendered",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-quality-" });
    try {
      const tested = await repositoryWithCommit(repo);
      await writeTextFile(join(repo, "suite.test.ts"), SUITE);
      await writeTextFile(join(repo, "requirements.txt"), "fixture FR-001\nfixture FR-002\nfixture FR-003\n");
      const ran = await runTests({
        runtimes: [runtimeName()],
        paths: ["suite.test.ts"],
        cwd: repo,
        out: "out",
        requirements: "requirements.txt",
        reports: [],
        output: "null",
      });
      assert(ran.kind === "ok", ran.kind === "err" ? ran.error : "");
      assertEquals(ran.value.code, 1);
      // `ifc test` wrote the characteristic the test named
      assertStringIncludes(await readTextFile(ran.value.recordPath), "ifc.test.characteristic");

      const kept = await quality(
        "record",
        "--record",
        ran.value.recordPath,
        "--repo",
        repo,
        "--commit",
        tested,
        "--no-sign",
        "--not-run",
        "fixture FR-003=no network",
      );
      assertEquals(kept.code, 0, kept.stderr);
      assertStringIncludes(kept.stdout, "kept quality/evidence/");
      assertStringIncludes(kept.stdout, "grade E3 (not signed)");
      assertStringIncludes(kept.stdout, "1 not_run");
      assertStringIncludes(kept.stdout, `noted ${tested}`);

      // the same record kept again is refused: a file is never replaced
      const again = await quality("record", "--record", ran.value.recordPath, "--repo", repo, "--commit", tested, "--no-sign");
      assertEquals(again.code, 1);
      assertStringIncludes(again.stderr, "already kept");

      const verified = await quality("verify", "--repo", repo);
      assertEquals(verified.code, 0, verified.stderr);
      assertStringIncludes(verified.stdout, "1 file chained from 64 zeros");
      assertStringIncludes(verified.stdout, `${tested} E3`);

      // rendered on demand, with the count of not_run and the grade
      const rendered = await quality(
        "render",
        "--repo",
        repo,
        "--run",
        ran.value.run.traceId,
        "--format",
        "junit,ctrf,sarif,tap,completion",
        "--out",
        join(repo, "reports"),
      );
      assertEquals(rendered.code, 0, rendered.stderr);
      const ctrf = await readTextFile(join(repo, "reports", `${ran.value.run.traceId}.ctrf.json`));
      assertStringIncludes(ctrf, '"notRun": 1');
      assertStringIncludes(ctrf, '"characteristic": "reliability"');
      assertStringIncludes(await readTextFile(join(repo, "reports", `${ran.value.run.traceId}.junit.xml`)), 'type="not_run"');
      assertStringIncludes(await readTextFile(join(repo, "reports", `${ran.value.run.traceId}.completion.md`)), "# Test Completion Report");
      const shown = await quality("render", "--repo", repo, "--run", ran.value.run.traceId, "--format", "tap", "--grade", "E4");
      assertStringIncludes(shown.stdout, "# grade E4 attested");

      // a second run is chained to the first, and a rewrite that changes the first file by one byte is found
      const next = await runTests({
        runtimes: [runtimeName()],
        paths: ["suite.test.ts"],
        cwd: repo,
        out: "out2",
        requirements: "requirements.txt",
        reports: [],
        output: "null",
      });
      assert(next.kind === "ok");
      const second = await quality("record", "--record", next.value.recordPath, "--repo", repo, "--commit", tested, "--no-sign");
      assertEquals(second.code, 0, second.stderr);
      assertEquals((await quality("verify", "--repo", repo)).code, 0);
      const path = /kept (\S+)/.exec(kept.stdout)?.[1] ?? "";
      assert(path.startsWith("quality/evidence/"), path);
      const rewrite = await run(
        ["git", "-C", repo, "filter-branch", "-f", "--tree-filter", `sed -i 's/"ifc-test"/"ifc-tesT"/' ${path}`, "quality"],
        {
          env: { FILTER_BRANCH_SQUELCH_WARNING: "1" },
        },
      );
      assert(rewrite.success, rewrite.stderr);
      const broken = await quality("verify", "--repo", repo);
      assertEquals(broken.code, 1);
      assertStringIncludes(broken.stderr, "the chain breaks at");
      assertStringIncludes(broken.stderr, path);
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-005"],
  "a case that did not run with no reason, a missing option and an unknown command are usage errors, exit 2",
  async () => {
    assertEquals((await quality("record", "--record", "x.json", "--not-run", "fixture FR-001=")).code, 2);
    assertEquals((await quality("render", "--format", "junit")).code, 2);
    assertEquals((await quality("render", "--record", "x.json", "--format", "docx")).code, 2);
    assertEquals((await quality("frobnicate")).code, 2);
    const help = await quality("record", "--help");
    assertEquals(help.code, 0);
    assertStringIncludes(help.stdout, "--not-run");
  },
);
