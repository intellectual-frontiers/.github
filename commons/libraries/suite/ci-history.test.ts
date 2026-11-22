/**
 * The history branch of the findings (commons 0002-libraries-ci-findings FR-007, 0038-build-policy FR-012) on real `git`: a bare repository stands for the remote, the first run makes the orphan branch, a file is added by a commit that changes none, a file that is there is
 * never replaced, a branch that moved meanwhile is followed (the push is retried from the new tip, never forced) and the files are read back oldest first.
 *
 * @module
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FindingsFile } from "../src/ci/findings.ts";
import { BRANCH, keepRun, readHistory, runPath } from "../src/ci/history.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const SPEC = "0002-libraries-ci-findings";
const git = (cwd: string, ...args: string[]): string => execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } });
const file = (id: string, workflow = "ci", at = "2026-11-22T10:00:00Z"): FindingsFile => ({ schema: "build-findings/1", run: { id, workflow, commit: `c${id}`, at }, steps: [], findings: [] });

proves([`${SPEC} FR-007`], "a run is added to the orphan branch as one new file by a commit that changes none, a file that is there is never replaced, and the files are read back oldest first", () => {
  const root = mkdtempSync(join(tmpdir(), "history-"));
  try {
    const remote = join(root, "remote.git");
    git(root, "init", "-q", "--bare", remote);
    assertEquals(runPath(file("9").run), "runs/2026/11/22/ci-9.json");
    const a = keepRun(".", remote, file("1", "ci", "2026-11-20T00:00:00Z"));
    assertEquals(a.kind, "kept");
    const b = keepRun(".", remote, file("2", "tests", "2026-11-21T00:00:00Z"));
    assertEquals(b.kind, "kept");
    assertEquals(keepRun(".", remote, file("1", "ci", "2026-11-20T00:00:00Z")).kind, "exists", "a file that is there is never replaced");
    const log = git(remote, "log", "--format=%s", BRANCH).trim().split("\n");
    assertEquals(log, ["findings of tests run 2", "findings of ci run 1"]);
    const stat = git(remote, "log", "--format=", "--name-status", BRANCH).trim().split("\n");
    assert(stat.every((l) => l.startsWith("A\t")), "every commit adds a file and changes or removes none: " + stat.join(";"));
    assertEquals(git(remote, "rev-list", "--max-parents=0", BRANCH).trim().split("\n").length, 1, "the branch is orphan: one root");
    const clone = join(root, "clone");
    git(root, "clone", "-q", remote, clone);
    git(clone, "fetch", "-q", "origin", `${BRANCH}:refs/remotes/origin/${BRANCH}`);
    assertEquals(readHistory(clone).map((f) => f.path), ["runs/2026/11/20/ci-1.json", "runs/2026/11/21/tests-2.json"]);
    assertEquals(readHistory(root, "refs/remotes/origin/nothing").length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

proves([`${SPEC} FR-007`], "the program keeps a findings file given on the command line and says so where the file is not one", () => {
  const root = mkdtempSync(join(tmpdir(), "history-"));
  try {
    const remote = join(root, "remote.git");
    git(root, "init", "-q", "--bare", remote);
    const program = new URL("../src/ci/history.ts", import.meta.url).pathname;
    writeFileSync(join(root, "f.json"), JSON.stringify(file("5", "tests", "2026-11-22T10:00:00Z")));
    const ok = spawnSync("bun", [program, "--file", join(root, "f.json"), "--remote", remote], { encoding: "utf8" });
    assertEquals(ok.status, 0, ok.stderr);
    assert(ok.stdout.includes("history: kept runs/2026/11/22/tests-5.json"), ok.stdout);
    writeFileSync(join(root, "bad.json"), "{}");
    const bad = spawnSync("bun", [program, "--file", join(root, "bad.json"), "--remote", remote], { encoding: "utf8" });
    assertEquals(bad.status, 0, "a file that is not one is said and is never a red run");
    assert(bad.stdout.includes("is not a findings file"), bad.stdout);
    assertEquals(spawnSync("bun", [program], { encoding: "utf8" }).status, 2, "a call with no file is a wrong call");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

proves([`${SPEC} FR-007`], "two runs that push at once both land: the one that finds the branch moved retries from the new tip and nothing is forced", async () => {
  const root = mkdtempSync(join(tmpdir(), "history-"));
  try {
    const remote = join(root, "remote.git");
    git(root, "init", "-q", "--bare", remote);
    keepRun(".", remote, file("0"));
    // many writers at the same time, each a separate process of real git, so that the pushes really race
    const module = new URL("../src/ci/history.ts", import.meta.url).pathname;
    const writer = (i: number): Promise<string> =>
      new Promise((done) => {
        const script = `import { keepRun } from ${JSON.stringify(module)}; const r = keepRun(".", ${JSON.stringify(remote)}, { schema: "build-findings/1", run: { id: "w${i}", workflow: "ci", commit: "c", at: "2026-11-22T10:00:00Z" }, steps: [], findings: [] }, { attempts: 25 }); console.log(r.kind);`;
        const p = spawn("bun", ["-e", script], { env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } });
        let out = "";
        p.stdout.on("data", (c: Buffer) => (out += c.toString()));
        p.on("close", () => done(out.trim()));
      });
    const results = (await Promise.all([1, 2, 3, 4, 5, 6].map(writer))).map((kind) => ({ kind }));
    assert(results.every((r) => r.kind === "kept"), JSON.stringify(results.map((r) => r.kind)));
    const names = git(remote, "ls-tree", "-r", "--name-only", BRANCH).trim().split("\n");
    assertEquals(names.length, 7);
    assertEquals(git(remote, "log", "--format=%H", BRANCH).trim().split("\n").length, 7, "a linear history: no commit was lost and none replaced");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
