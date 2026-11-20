/**
 * Tier 1 of the quality system run as a program on real temporary Git repositories (commons 0021-ifqs FR-007, FR-019, FR-022, FR-024, FR-025,
 * FR-029, FR-033, FR-036): proofs held against what changed in Git after their run (a test file edited, the requirement's own line edited, a
 * run on a commit outside the history), `quality freshness --open` opening the nonconformances itself, `quality record` verifying a CAPA by the
 * run that passes its test, the index derived from the branch and `--check`ed, the register shown with its evidence, the tier judged, the
 * statement, the review of an agent and the probe's result graded, and a spent error budget opening a nonconformance. The commands run as real
 * processes on the runtime this file runs on.
 *
 * @module
 */
import { decodeMetrics } from "@intellectual-frontiers/telemetry/otlp";
import { keepRun } from "../quality/host/branch.ts";
import { gather } from "../quality/host/gather.ts";
import { makeTempDir, mkdir, readTextFile, remove, writeTextFile } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { execPath, run } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { assembledRun, at, git, list, needsGit, parsed, repositoryWithCommit } from "./quality-fixtures.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const QUALITY = join(ROOT, "quality", "quality.ts");
const REGISTER = join(ROOT, "..", "spec-kit", "enforcement.tsv");
const DAY = "2026-11-17";

const quality = (...words: string[]): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> =>
  run([execPath(), QUALITY, ...words], { env: { GIT_TERMINAL_PROMPT: "0" } });

const SPEC = (second: string, third = ""): string =>
  `# Demo\n\n**Spec ID:** 0099-demo\n**Status:** Active\n\n## Requirements\n\n- **FR-001**: The first requirement.\n- **FR-002**: ${second}\n${third}`;

/** A repository with a specification of two requirements, a test that proves the first, and the commit that holds them. */
async function demo(dir: string): Promise<string> {
  await repositoryWithCommit(dir);
  await mkdir(join(dir, "specs", "0099-demo"), { recursive: true });
  await writeTextFile(join(dir, "specs", "0099-demo", "spec.md"), SPEC("The second requirement."));
  await writeTextFile(
    join(dir, "demo.test.ts"),
    `import { proves } from "./test.ts";\nproves(["0099-demo FR-001"], "the first holds", () => {});\n`,
  );
  await writeTextFile(
    join(dir, "second.test.ts"),
    `import { proves } from "./test.ts";\nproves(["0099-demo FR-002"], "the second holds", () => {});\n`,
  );
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", "a specification and its tests");
  return git(dir, "rev-parse", "HEAD");
}

async function keep(repo: string, n: number, cases: Parameters<typeof assembledRun>[1], revision: string): Promise<void> {
  const kept = await keepRun({ repo, record: await assembledRun(n, cases, { revision }), commit: revision, sign: false });
  assert(kept.kind === "ok", kept.kind === "err" ? JSON.stringify(kept.error) : "");
}

const BOTH = [
  { name: "the first holds", file: "demo.test.ts", requirements: ["0099-demo FR-001"] },
  { name: "the second holds", file: "second.test.ts", requirements: ["0099-demo FR-002"] },
] as const;

proves(
  ["0021-ifqs FR-025", "0021-ifqs FR-007"],
  "a proof goes stale where a file of its chain or the requirement's own line changed after its run, or its commit is outside the history, and the system opens the nonconformances itself",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-system-" });
    try {
      const c0 = await demo(repo);
      await keep(repo, 1, [...BOTH], c0);
      const fresh = await gather({ repo, today: DAY });
      assert(fresh.kind === "ok");
      for (const r of ["0099-demo FR-001", "0099-demo FR-002"]) {
        const j = fresh.value.byRequirement.get(r);
        assertEquals([j?.grade, j?.freshness, j?.proved], ["E3", "Fresh", true]);
      }
      // the first requirement's test file is edited: its proof is stale by change; the second's is not
      await writeTextFile(
        join(repo, "demo.test.ts"),
        `import { proves } from "./test.ts";\nproves(["0099-demo FR-001"], "the first holds", () => { /* edited */ });\n`,
      );
      await git(repo, "commit", "-q", "-am", "edit the test");
      const c1 = await git(repo, "rev-parse", "HEAD");
      const g1 = await gather({ repo, today: DAY });
      assert(g1.kind === "ok");
      const first = g1.value.byRequirement.get("0099-demo FR-001");
      assertEquals([first?.grade, first?.freshness, first?.stale?.freshness.by], ["E0", "None", "change"]);
      assertEquals(g1.value.changed.get("0099-demo FR-001"), ["demo.test.ts"]);
      assertEquals(g1.value.byRequirement.get("0099-demo FR-002")?.freshness, "Fresh");
      // the second requirement's own line is edited, and a third is added: the second is stale by its text, the first by nothing new
      await writeTextFile(
        join(repo, "specs", "0099-demo", "spec.md"),
        SPEC("The second requirement, now stricter.", "- **FR-003**: A third.\n"),
      );
      await git(repo, "commit", "-q", "-am", "edit the second requirement");
      const g2 = await gather({ repo, today: DAY });
      assert(g2.kind === "ok");
      assertEquals(g2.value.changed.get("0099-demo FR-001"), ["demo.test.ts"]);
      assertEquals(g2.value.changed.get("0099-demo FR-002")?.length, 1);
      assertStringIncludes(g2.value.changed.get("0099-demo FR-002")?.[0] ?? "", "0099-demo FR-002 in specs/0099-demo/spec.md");
      assertEquals(g2.value.byRequirement.get("0099-demo FR-002")?.stale?.freshness.by, "change");
      // the command finds the same, says it, and with --open opens a nonconformance for each
      const dry = await quality("freshness", "--repo", repo, "--today", DAY);
      assertEquals(dry.code, 1, dry.stderr);
      assertStringIncludes(dry.stdout, "0099-demo FR-001: stale by change, demo.test.ts changed after the run");
      assertStringIncludes(dry.stdout, "would open NC-0001 for 0099-demo FR-001 (stale)");
      assertStringIncludes(dry.stdout, "0099-demo FR-002: stale by change");
      const opened = await quality("freshness", "--repo", repo, "--today", DAY, "--open", "--no-sign");
      assertEquals(opened.code, 1, opened.stderr);
      assertStringIncludes(opened.stdout, "opening NC-0002 for 0099-demo FR-002 (stale)");
      assertStringIncludes(opened.stdout, "opening NC-0003 for objective:share-tested (budget-spent)");
      assertStringIncludes(opened.stdout, "4 nonconformances opened");
      const again = await quality("freshness", "--repo", repo, "--today", DAY, "--open", "--no-sign");
      assertStringIncludes(again.stdout, "no nonconformance to open");
      const listed = await quality("nonconformances", "--repo", repo);
      assertStringIncludes(listed.stdout, "NC-0001 open 0099-demo FR-001 (stale)");
      assertStringIncludes(listed.stdout, "4 open, 0 closed, 4 not linked to a Problem change request");
      const linked = await quality("nonconformances", "--repo", repo, "--link", "NC-0001", "--issue", "12", "--no-sign");
      assertEquals(linked.code, 0, linked.stderr);
      assertStringIncludes((await quality("nonconformances", "--repo", repo)).stdout, "Problem #12");
      // a new run at HEAD makes both fresh again
      const head = await git(repo, "rev-parse", "HEAD");
      await keep(repo, 2, [...BOTH], head);
      const g3 = await gather({ repo, today: DAY });
      assert(g3.kind === "ok");
      assertEquals(
        g3.value.judgements.map((j) => [j.requirement, j.grade, j.freshness]),
        [
          ["0099-demo FR-001", "E3", "Fresh"],
          ["0099-demo FR-002", "E3", "Fresh"],
        ],
      );
      // a run kept for a commit outside the history (a side branch that was never merged) is stale: its commit is not an ancestor of HEAD
      await git(repo, "checkout", "-q", "-b", "side", c0);
      await writeTextFile(join(repo, "side.txt"), "side\n");
      await git(repo, "add", "-A");
      await git(repo, "commit", "-q", "-m", "a side commit");
      const side = await git(repo, "rev-parse", "HEAD");
      await git(repo, "checkout", "-q", "main");
      assert(c1 !== side);
      await keep(repo, 3, [{ name: "the first holds", file: "demo.test.ts", requirements: ["0099-demo FR-001"] }], side);
      const g4 = await gather({ repo, today: DAY });
      assert(g4.kind === "ok");
      assertEquals(
        g4.value.changed.get("0099-demo FR-001")?.some((c) => c.includes("is not an ancestor of HEAD")),
        true,
      );
      // a run whose commit this repository does not hold is judged by time only, and says so
      const elsewhere = await keepRun({
        repo,
        record: await assembledRun(4, [{ name: "the first holds", file: "demo.test.ts", requirements: ["0099-demo FR-001"] }], {
          revision: "0123456789abcdef0123456789abcdef01234567",
        }),
        commit: c0,
        sign: false,
      });
      assert(elsewhere.kind === "ok");
      const g5 = await gather({ repo, today: DAY });
      assert(g5.kind === "ok");
      assertEquals(g5.value.unknownRevisions, ["0123456789abcdef0123456789abcdef01234567"]);
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-019", "0021-ifqs FR-031"],
  "the index is derived from the branch, deterministic, checkable against the file on disk, and carries the objectives as OpenTelemetry metrics",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-system-" });
    try {
      const c0 = await demo(repo);
      await keep(repo, 1, [...BOTH], c0);
      const file = join(repo, "index.json");
      const wrote = await quality("index", "--repo", repo, "--out", file, "--metrics", join(repo, "metrics.json"));
      assertEquals(wrote.code, 0, wrote.stderr);
      const text = await readTextFile(file);
      assertStringIncludes(text, '"schema": "ifqs-index/1"');
      assertStringIncludes(text, '"count": "2 proved (E3 2), review debt 0 (person 0, agent 0)"');
      assertStringIncludes(text, '"asOf": "2026-11-17"');
      assertEquals(list(at(parsed(text), "runs")).length, 1);
      // the same branch gives the same bytes
      const twice = await quality("index", "--repo", repo);
      assertEquals(twice.stdout, text);
      assertEquals((await quality("index", "--repo", repo, "--out", file, "--check")).code, 0);
      // the metrics read back through the OpenTelemetry decoder
      const metrics = decodeMetrics(JSON.parse(await readTextFile(join(repo, "metrics.json"))));
      assert(metrics.kind === "ok");
      assertEquals(metrics.value.flatMap((b) => b.metrics.map((m) => m.name)).includes("ifc.quality.review_debt"), true);
      // a file edited by hand is not what the branch gives; so is one the branch has moved on from
      await writeTextFile(file, text.replace('"proved": 2', '"proved": 3'));
      const edited = await quality("index", "--repo", repo, "--out", file, "--check");
      assertEquals(edited.code, 1);
      assertStringIncludes(edited.stderr, "is not what the quality branch gives");
      await writeTextFile(file, text);
      await keep(repo, 2, [{ name: "the first holds", file: "demo.test.ts", requirements: ["0099-demo FR-001"] }], c0);
      assertEquals((await quality("index", "--repo", repo, "--out", file, "--check")).code, 1);
      assertEquals((await quality("index", "--repo", repo, "--out", file)).code, 0);
      assertEquals((await quality("index", "--repo", repo, "--out", file, "--check")).code, 0);
      // a repository with no quality branch has an empty index, and says no evidence
      const empty = await makeTempDir({ prefix: "ifc-system-" });
      try {
        await repositoryWithCommit(empty);
        const none = await quality("index", "--repo", empty);
        assertEquals(none.code, 0, none.stderr);
        assertStringIncludes(none.stdout, '"runs": []');
        assertStringIncludes(none.stdout, '"tip": null');
      } finally {
        await remove(empty, { recursive: true });
      }
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-022", "0021-ifqs FR-036", "0021-ifqs FR-006"],
  "the register is shown with the grade and day of each row's evidence and checked against the file, and the tier a harness claims is judged against the real register",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-system-" });
    try {
      const c0 = await demo(repo);
      await keep(repo, 1, [BOTH[0]], c0);
      const register = join(repo, "enforcement.tsv");
      await writeTextFile(
        register,
        "requirement\tmechanism\tby\tnote\n0099-demo FR-001\tcheck\t.github: bun test\tproved\n0099-demo FR-002\tnone\t-\tPlanned\n",
      );
      const view = join(repo, "register.auto.tsv");
      const wrote = await quality("register", "--repo", repo, "--register", register, "--out", view);
      assertEquals(wrote.code, 0, wrote.stderr);
      const text = (await readTextFile(view)).replaceAll("\r\n", "\n");
      assertStringIncludes(text, "0099-demo FR-001\tcheck\tE3\t2026-11-17\tFresh\tyes");
      assertStringIncludes(text, "0099-demo FR-002\tnone\tE0\t-\tNone\tno");
      assertStringIncludes(text, "# 2 requirements; 1 proved (E3 1), review debt 0 (person 0, agent 0)");
      assertEquals((await quality("register", "--repo", repo, "--register", register, "--out", view, "--check")).code, 0);
      await writeTextFile(view, text.replace("E3\t2026", "E4\t2026"));
      assertEquals((await quality("register", "--repo", repo, "--register", register, "--out", view, "--check")).code, 1);
      // the tier: the real register holds Tier 1 and the tiers below it, and not Tier 2
      const t1 = await quality("tier", "--claim", "Tier1", "--register", REGISTER);
      assertEquals(t1.code, 0, t1.stdout + t1.stderr);
      assertStringIncludes(t1.stdout, "Tier1 is met");
      const t2 = await quality("tier", "--claim", "Tier2", "--register", REGISTER);
      assertEquals(t2.code, 1);
      assertStringIncludes(t2.stdout, "0021-ifqs FR-037: held by none");
      assertStringIncludes(t2.stderr, "Tier2 is refused");
      assertEquals((await quality("tier", "--claim", "Tier9", "--register", REGISTER)).code, 2);
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-024", "0021-ifqs FR-021", "0021-ifqs FR-023"],
  "a statement is E1, a review E2 (an agent's said so and no higher), a probe's typed result E5; the review debt counts the first two",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-system-" });
    try {
      await repositoryWithCommit(repo);
      const kept = async (...words: string[]) => {
        const r = await quality("attest", "--repo", repo, "--today", DAY, "--no-sign", ...words);
        assertEquals(r.code, 0, r.stderr);
        return r.stdout;
      };
      assertStringIncludes(await kept("--kind", "statement", "--requirement", "0099-demo FR-001", "--who", "A. Person"), "(E1)");
      assertStringIncludes(
        await kept("--kind", "review", "--requirement", "0099-demo FR-002", "--by", "agent", "--who", "a reviewing agent"),
        "(E2, an agent's)",
      );
      assertStringIncludes(await kept("--kind", "review", "--requirement", "0099-demo FR-003", "--who", "A. Person", "--sample"), "(E2)");
      assertStringIncludes(await kept("--kind", "probe", "--requirement", "0099-demo FR-004", "--source", "the health probe"), "(E5)");
      // a statement that names no one, and a requirement that is not one, are refused
      assertEquals((await quality("attest", "--repo", repo, "--kind", "statement", "--requirement", "0099-demo FR-001")).code, 1);
      assertEquals((await quality("attest", "--repo", repo, "--kind", "statement", "--requirement", "nonsense", "--who", "x")).code, 1);
      const g = await gather({ repo, today: DAY, changes: false });
      assert(g.kind === "ok");
      const by = g.value.byRequirement;
      assertEquals(
        ["FR-001", "FR-002", "FR-003", "FR-004"].map((f) => [by.get(`0099-demo ${f}`)?.grade, by.get(`0099-demo ${f}`)?.byAgent]),
        [
          ["E1", false],
          ["E2", true],
          ["E2", false],
          ["E5", false],
        ],
      );
      // the review debt is the requirements held at E1 or E2: three; the probe's is proved, an E5 above E3
      assertEquals(g.value.judgements.filter((j) => j.grade === "E1" || j.grade === "E2").length, 3);
      assertEquals(by.get("0099-demo FR-004")?.proved, true);
      const index = await quality("index", "--repo", repo);
      assertStringIncludes(index.stdout, '"count": "1 proved (E5 1), review debt 3 (person 2, agent 1)"');
      assertStringIncludes(index.stdout, '"byAgent": true');
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  { ...needsGit },
);

proves(
  ["0021-ifqs FR-029", "0021-ifqs FR-030", "0021-ifqs FR-033", "0021-ifqs FR-003"],
  "run as programs: a failed run opens a nonconformance, `quality record` verifies the CAPA the passing run closes, only a person closes it, and a spent error budget opens a nonconformance of its own",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-system-" });
    try {
      const c0 = await demo(repo);
      await keep(
        repo,
        1,
        [{ name: "the first holds", file: "demo.test.ts", outcome: "fail", message: "boom", requirements: ["0099-demo FR-001"] }],
        c0,
      );
      // a case that was planned and did not run spends the not_run objective's budget on its one day
      const notRun = await keepRun({
        repo,
        record: await assembledRun(2, [{ name: "the second holds", file: "second.test.ts", requirements: ["0099-demo FR-002"] }], {
          revision: c0,
        }),
        notRun: [{ requirements: ["0099-demo FR-003"], name: "0099-demo FR-003", reason: "no network" }],
        commit: c0,
        sign: false,
      });
      assert(notRun.kind === "ok");
      const opened = await quality("freshness", "--repo", repo, "--today", DAY, "--open", "--no-sign");
      assertEquals(opened.code, 1, opened.stderr);
      assertStringIncludes(opened.stdout, "0099-demo FR-001: failed (the first holds: boom)");
      assertStringIncludes(opened.stdout, "opening NC-0001 for 0099-demo FR-001 (failed)");
      assertStringIncludes(opened.stdout, "for objective:not-run (budget-spent)");
      const listed = (await quality("nonconformances", "--repo", repo)).stdout;
      assertStringIncludes(listed, "NC-0003 open objective:not-run (budget-spent)");
      // a CAPA must name a test that exists
      const refused = await quality(
        "capa",
        "open",
        "--repo",
        repo,
        "--nonconformance",
        "NC-0001",
        "--action",
        "fix",
        "--test-requirement",
        "0099-demo FR-001",
        "--test-name",
        "no such test",
        "--corrective",
        c0,
        "--no-sign",
      );
      assertEquals(refused.code, 1);
      assertStringIncludes(refused.stderr, "names a test that exists");
      // the corrective change, then the CAPA that names the test of the first requirement
      await writeTextFile(join(repo, "fix.txt"), "fixed\n");
      await git(repo, "add", "-A");
      await git(repo, "commit", "-q", "-m", "the fix");
      const fix = await git(repo, "rev-parse", "HEAD");
      const capa = await quality(
        "capa",
        "open",
        "--repo",
        repo,
        "--nonconformance",
        "NC-0001",
        "--action",
        "fix the first",
        "--test-requirement",
        "0099-demo FR-001",
        "--test-name",
        "the first holds",
        "--corrective",
        fix,
        "--author",
        "dev@example.com",
        "--no-sign",
      );
      assertEquals(capa.code, 0, capa.stderr);
      // closing it before it is verified is refused
      const early = await quality(
        "capa",
        "close",
        "--repo",
        repo,
        "--capa",
        "CAPA-0001",
        "--person",
        "A. Reviewer",
        "--decision",
        "D-1",
        "--no-sign",
      );
      assertEquals(early.code, 1);
      assertStringIncludes(early.stderr, "only from CapaVerified");
      // the passing run, recorded by the command on the real record file, verifies it
      const file = join(repo, "run.otlp.json");
      await writeTextFile(
        file,
        JSON.stringify(
          await assembledRun(5, [{ name: "the first holds", file: "demo.test.ts", requirements: ["0099-demo FR-001"] }], { revision: fix }),
        ),
      );
      const recorded = await quality("record", "--record", file, "--repo", repo, "--commit", fix, "--no-sign");
      assertEquals(recorded.code, 0, recorded.stderr);
      assertStringIncludes(recorded.stdout, "CAPA-0001 is verified by this run; a person closes it");
      // an automated run and an agent cannot close it; the author cannot, under a regulated domain; a named person can
      for (const as of ["automated", "agent"]) {
        const r = await quality(
          "capa",
          "close",
          "--repo",
          repo,
          "--capa",
          "CAPA-0001",
          "--person",
          "someone",
          "--decision",
          "D-1",
          "--as",
          as,
          "--no-sign",
        );
        assertEquals(r.code, 1, as);
      }
      const author = await quality(
        "capa",
        "close",
        "--repo",
        repo,
        "--capa",
        "CAPA-0001",
        "--person",
        "ci@example.com",
        "--decision",
        "D-1",
        "--regulated",
        "--no-sign",
      );
      assertEquals(author.code, 1);
      assertStringIncludes(author.stderr, "author of the corrective change");
      const closed = await quality(
        "capa",
        "close",
        "--repo",
        repo,
        "--capa",
        "CAPA-0001",
        "--person",
        "A. Reviewer",
        "--role",
        "quality",
        "--decision",
        "D-1",
        "--regulated",
        "--no-sign",
      );
      assertEquals(closed.code, 0, closed.stderr);
      const all = (await quality("nonconformances", "--repo", repo, "--all")).stdout;
      assertStringIncludes(all, "NC-0001 closed 0099-demo FR-001 (failed)");
      assertStringIncludes(all, "CAPA-0001 CapaClosed");
      assertStringIncludes(all, "2 open, 1 closed");
      assertEquals((await quality("verify", "--repo", repo)).code, 0);
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  { ...needsGit },
);
