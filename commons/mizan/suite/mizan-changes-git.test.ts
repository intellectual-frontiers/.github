/**
 * The host layer and the command of the `changes` check (commons 0020-ifccm), run on real programs: real `git` repositories in temporary folders with real commits, merges and reverts; the
 * command itself, in this process and as a program on the runtime this test runs on. The one thing that is not real is the Git host: `fakeHost` below is an in-memory fake of the HOST's
 * answers (a GitHub or GitLab account is outside the code under test, and the adapters that speak to a real one are another agent's, tested with recorded exchanges), made to the
 * `GitHostClient` interface of `@intellectual-frontiers/githost`; the code under test is given it as an argument, as it is in use. What needs an account is left untested here.
 *
 * @module
 */
import type {
  BranchProtection,
  Capability,
  ChangeRequestInfo,
  GitHostClient,
  HostFailure,
  HostKind,
  HostResult,
  IssueInfo,
  RepoInfo,
  RepoRef,
} from "@intellectual-frontiers/githost/types";
import { err, ok } from "@intellectual-frontiers/core";
import { run as changes, RECORD_FILE } from "@intellectual-frontiers/libraries/changes";
import { dayOf, decodeHarnessRecord, relaxations } from "@intellectual-frontiers/mizan/changes/declaration";
import { declarationHistory, readRange } from "@intellectual-frontiers/mizan/changes/git-log";
import { type CommitFacts, commitFindings, relaxationFindings } from "@intellectual-frontiers/mizan/changes/rules";
import { askHost, NO_HOST_API } from "@intellectual-frontiers/mizan/changes/strict";
import { mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { execPath, run, which } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const HERE = dirname(fromFileUrl(import.meta.url));
const CHANGES = resolve(HERE, "..", "..", "libraries", "src", "changes.ts");
const skip = which("git") === undefined ? { skip: "git is not installed" } : {};

/** git run in `repo` as a throwaway committer, failing the test where it fails. */
async function git(repo: string, ...args: string[]): Promise<string> {
  const r = await run(
    [
      "git",
      "-C",
      repo,
      "-c",
      "user.name=ci",
      "-c",
      "user.email=ci@example.com",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.autocrlf=false",
      "-c",
      "init.defaultBranch=main",
      ...args,
    ],
    { env: { GIT_TERMINAL_PROMPT: "0" } },
  );
  assert(r.success, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A commit with `message` on `at` (a day), by `who`; an empty commit unless `files` are written first. */
async function commit(
  repo: string,
  message: string,
  at: string,
  files: Readonly<Record<string, string>> = {},
  who = "ci@example.com",
): Promise<string> {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, name)), { recursive: true });
    writeTextFileSync(join(repo, name), text);
  }
  await git(repo, "add", "-A");
  const date = `${at}T12:00:00Z`;
  const r = await run(
    [
      "git",
      "-C",
      repo,
      "-c",
      `user.name=${who.split("@")[0] ?? "ci"}`,
      "-c",
      `user.email=${who}`,
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      message,
    ],
    {
      env: { GIT_TERMINAL_PROMPT: "0", GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    },
  );
  assert(r.success, r.stderr);
  return git(repo, "rev-parse", "HEAD");
}

async function init(repo: string): Promise<void> {
  await git(repo, "init", "-q", "-b", "main");
}

const HOME: RepoRef = { kind: "Github", host: "github.com", path: ["owner", "repo"] };

/** An in-memory fake of a host's answers: the issues it has, and a count of what it was asked. */
function fakeHost(
  kind: HostKind,
  issues: Readonly<Record<string, IssueInfo>>,
  failure?: HostFailure,
): GitHostClient & { readonly asked: string[] } {
  const asked: string[] = [];
  const capabilities: ReadonlySet<Capability> =
    kind === "Git" ? new Set<Capability>(["CloneUrl"]) : new Set<Capability>(["CloneUrl", "Issues", "ChangeRequests"]);
  const unsupported = <T>(c: Capability): HostResult<T> => err({ kind: "unsupported", capability: c, host: kind });
  return {
    kind,
    capabilities,
    asked,
    repository: (): Promise<HostResult<RepoInfo>> => Promise.resolve(unsupported("DefaultBranch")),
    issue: (ref: RepoRef, number: number): Promise<HostResult<IssueInfo>> => {
      asked.push(`${ref.path.join("/")}#${number}`);
      if (failure !== undefined) return Promise.resolve(err(failure));
      const found = issues[`${ref.path.join("/")}#${number}`];
      return Promise.resolve(found === undefined ? err({ kind: "not-found", what: `issue ${number}` }) : ok(found));
    },
    changeRequest: (): Promise<HostResult<ChangeRequestInfo>> => Promise.resolve(unsupported("ChangeRequests")),
    branchProtection: (): Promise<HostResult<BranchProtection>> => Promise.resolve(unsupported("ProtectedBranches")),
    commitVerified: (): Promise<HostResult<boolean>> => Promise.resolve(unsupported("SignedCommits")),
  };
}

const issue = (number: number, over: Partial<IssueInfo> = {}): IssueInfo => ({
  number,
  title: `Issue ${number}`,
  body: "## Why\n\nx\n\n## Today\n\nx\n\n## Scope\n\nx\n\n## Done when\n\n- [x] 0020-ifccm FR-005\n",
  state: "open",
  url: `https://example.org/issues/${number}`,
  parent: 1,
  children: [],
  labels: ["capability"],
  ...over,
});

/** The command in this process: its status and what it wrote. */
async function cmd(
  args: string[],
  deps: { client?: GitHostClient; home?: RepoRef } = {},
): Promise<{ code: number; out: string; err: string }> {
  let out = "";
  let errText = "";
  const code = await changes(args, { ...deps, out: (t) => void (out += t), err: (t) => void (errText += t) });
  return { code, out, err: errText };
}

const decl = (domains: string[], on?: string): string =>
  `export const declaration = {\n  regulatedDomains: [${domains.map((d) => JSON.stringify(d)).join(", ")}],\n${on === undefined ? "" : `  productionDeclaredOn: ${JSON.stringify(on)},\n`}};\n`;

proves(
  ["0020-ifccm FR-007"],
  "a default merge commit with no body is judged by its parents: exempt where its parents name an issue, and the parent that names none is reported once, not the merge",
  async () => {
    await withTempDir(async (repo) => {
      await init(repo);
      const root = await commit(repo, "Root\n\nRefs #1\n", "2026-11-01");
      await git(repo, "switch", "-q", "-c", "work");
      const a = await commit(repo, "Work\n\nRefs #10\n", "2026-11-02");
      await git(repo, "switch", "-q", "main");
      const b = await commit(repo, "Main\n\nRefs #12\n", "2026-11-03");
      await git(repo, "switch", "-q", "work");
      // the message git writes itself, with no body: "Merge branch 'main' into work"
      await git(repo, "merge", "-q", "--no-ff", "--no-edit", "main");
      const clean = await git(repo, "rev-parse", "HEAD");
      assertEquals((await git(repo, "log", "-1", "--format=%B")).split("\n")[0], "Merge branch 'main' into work");
      const rangeOf = async (): Promise<readonly CommitFacts[]> => {
        const r = await readRange(repo, `${root}..HEAD`);
        assert(r.kind === "ok", JSON.stringify(r));
        return r.value;
      };
      const ctx = { phase: "warn", decisions: [], roles: {} } as const;
      assertEquals([...(await rangeOf()).map((c) => c.sha)].sort(), [a, b, clean].sort());
      assertEquals(commitFindings(await rangeOf(), ctx), []);
      // a parent that names no issue is reported on its own, and the merge of it is not reported again
      await git(repo, "switch", "-q", "main");
      const bare = await commit(repo, "No reference at all\n", "2026-11-04");
      await git(repo, "switch", "-q", "work");
      await git(repo, "merge", "-q", "--no-ff", "--no-edit", "main");
      const merged = await git(repo, "rev-parse", "HEAD");
      const found = commitFindings(await rangeOf(), ctx);
      assertEquals(
        found.map((f) => [f.rule, f.key.split(" ")[1]]),
        [["changes/no-issue", bare]],
      );
      assert(!found.some((f) => f.key.includes(merged)));
      // an ordinary commit that names none is reported as before
      const loose = await commit(repo, "Loose\n", "2026-11-05");
      assertEquals(
        commitFindings(await rangeOf(), ctx).map((f) => f.key.split(" ")[1]),
        [bare, loose],
      );
    });
  },
  skip,
);

proves(
  ["0020-ifccm FR-005", "0020-ifccm FR-007", "0020-ifccm FR-008"],
  "the commits of a real range are read with their parents, and the rules find the one with no issue, the revert, and the closing word, and exempt the merge",
  async () => {
    await withTempDir(async (repo) => {
      await init(repo);
      const root = await commit(repo, "Root\n\nRefs #1\n", "2026-11-01");
      await git(repo, "switch", "-q", "-c", "feature");
      const feat = await commit(repo, "Feature\n\nRefs #10\n", "2026-11-02");
      await git(repo, "switch", "-q", "main");
      const other = await commit(repo, "Other\n\nRefs #12\n", "2026-11-03");
      await git(repo, "merge", "-q", "--no-ff", "-m", "Merge branch 'feature'", "feature");
      const merge = await git(repo, "rev-parse", "HEAD");
      const revert = await commit(repo, 'Revert "Other"\n\nThis reverts commit abc.\n', "2026-11-04");
      const fixes = await commit(repo, "Fix the thing\n\nFixes #10\n", "2026-11-05");
      const range = await readRange(repo, `${root}..HEAD`);
      assert(range.kind === "ok", JSON.stringify(range));
      assertEquals(
        range.value.map((c) => c.sha),
        [feat, other, merge, revert, fixes],
      );
      assertEquals(range.value.find((c) => c.sha === merge)?.parents, [other, feat]);
      assertEquals(range.value.find((c) => c.sha === fixes)?.day, "2026-11-05");
      assertEquals(range.value.find((c) => c.sha === feat)?.message, "Feature\n\nRefs #10");
      const found = commitFindings(range.value, { phase: "warn", decisions: [], roles: {} });
      assertEquals(
        found.map((f) => [f.rule, f.key.split(" ")[1]]),
        [
          ["changes/no-issue", revert],
          ["changes/closing-keyword", fixes],
        ],
      );
      // a range that does not exist, and one that reads as an option, are errors and not an empty answer
      assertEquals((await readRange(repo, "nope..HEAD")).kind, "err");
      assertEquals((await readRange(repo, "--all")).kind, "err");
      assertEquals((await readRange(join(repo, "missing"), "HEAD")).kind, "err");
    });
  },
  skip,
);

proves(
  ["0020-ifccm FR-012"],
  "a declaration moved later after its day is found in the real history of its file, and only a Decision that covers its revision clears it",
  async () => {
    await withTempDir(async (repo) => {
      await init(repo);
      await commit(repo, "Declare\n\nRefs #10\n", "2026-09-01", { [RECORD_FILE]: decl(["DeviceQuality"], "2026-10-01") });
      await commit(repo, "Other work\n\nRefs #10\n", "2026-10-15", { "a.txt": "a" });
      const moved = await commit(repo, "Postpone\n\nRefs #10\n", "2026-11-17", { [RECORD_FILE]: decl(["DeviceQuality"], "2026-12-01") });
      const history = await declarationHistory(repo, RECORD_FILE);
      assert(history.kind === "ok");
      assertEquals(
        history.value.map((v) => String(v.declaration?.productionDeclaredOn)),
        ["2026-10-01", "2026-12-01"],
      );
      const relaxed = relaxations(history.value);
      assertEquals(
        relaxed.map((r) => [r.revision, r.how]),
        [[moved, "day-moved-later"]],
      );
      const found = relaxationFindings(relaxed, [], "gate", RECORD_FILE);
      assertEquals(
        found.map((f) => [f.rule, f.severity]),
        [["changes/gate-relaxed", "gate"]],
      );
      // only a Decision clears it, by the revision, in full or from its seventh character
      const decision = { id: "D-1", approvedBy: "quality", covers: [`gate-relaxed ${moved.slice(0, 7)}`] };
      assertEquals(relaxationFindings(relaxed, [decision], "gate", RECORD_FILE), []);
      assertEquals(relaxationFindings(relaxed, [{ ...decision, covers: ["0020-ifccm FR-012"] }], "gate", RECORD_FILE).length, 1);
      // a regulated domain dropped, then the file removed
      await commit(repo, "Drop\n\nRefs #10\n", "2026-11-18", { [RECORD_FILE]: decl([], "2026-12-01") });
      const again = await declarationHistory(repo, RECORD_FILE);
      assert(again.kind === "ok");
      assertEquals(
        relaxations(again.value).map((r) => r.how),
        ["day-moved-later", "domain-dropped"],
      );
      // a history of a file that never existed is empty, and of a repository that is not one is an error
      const none = await declarationHistory(repo, "nothing.ts");
      assert(none.kind === "ok" && none.value.length === 0);
      assertEquals((await declarationHistory(join(repo, "missing"), RECORD_FILE)).kind, "err");
      assertEquals(dayOf("2026-11-17") !== undefined, true);
    });
  },
  skip,
);

proves(
  ["0020-ifccm FR-011", "0020-ifccm FR-012", "0020-ifccm FR-032"],
  "the command exits 0 clean, 1 on findings, 2 on usage and 3 on environment, holds warnings by a baseline and never a finding in the gate phase",
  async () => {
    await withTempDir(async (repo) => {
      await init(repo);
      const base = await commit(repo, "Base\n\nRefs #1\n", "2026-11-01");
      await commit(repo, "No issue here\n", "2026-11-02");
      const args = ["--repo", repo, "--range", `${base}..HEAD`, "--today", "2026-11-17"];
      // before production: the finding is a warning that fails until a baseline holds it
      const first = await cmd(args);
      assertEquals(first.code, 1);
      assertStringIncludes(first.err, "changes/no-issue");
      const written = await cmd([...args, "--write-baseline"]);
      assertEquals(written.code, 0);
      assertStringIncludes(readTextFileSync(join(repo, "changes.baseline.txt")), "changes/no-issue ");
      assertEquals((await cmd(args)).code, 0);
      // a baseline line for a commit that is no longer there is stale and fails
      writeTextFileSync(
        join(repo, "changes.baseline.txt"),
        `${readTextFileSync(join(repo, "changes.baseline.txt"))}changes/no-issue ${"0".repeat(40)}\n`,
      );
      const stale = await cmd(args);
      assertEquals(stale.code, 1);
      assertStringIncludes(stale.err, "stale");
      writeTextFileSync(
        join(repo, "changes.baseline.txt"),
        readTextFileSync(join(repo, "changes.baseline.txt")).replace(`changes/no-issue ${"0".repeat(40)}\n`, ""),
      );
      // from the declared day the baseline holds nothing
      writeTextFileSync(join(repo, RECORD_FILE), decl(["DeviceQuality"], "2026-11-17"));
      const gate = await cmd(args);
      assertEquals(gate.code, 1);
      assertStringIncludes(gate.err, "stale");
      assertStringIncludes(gate.err, "changes (gate)");
      // the day before it, the same commit is a held warning; a regulated domain with no day is refused whatever the day
      assertEquals((await cmd([...args.slice(0, -1), "2026-11-16"])).code, 0);
      writeTextFileSync(join(repo, RECORD_FILE), decl(["DeviceQuality"]));
      const refused = await cmd([...args.slice(0, -1), "2026-11-16"]);
      assertEquals(refused.code, 1);
      assertStringIncludes(refused.err, "states no production day");
      // usage and environment
      assertEquals((await cmd(["--strict"])).code, 2);
      assertEquals((await cmd(["--bogus"])).code, 2);
      assertEquals((await cmd(["--range"])).code, 2);
      assertEquals((await cmd(["--today", "soon"])).code, 2);
      assertEquals((await cmd(["--check"])).code, 2);
      assertEquals((await cmd(["--repo", repo, "--range", "nope..HEAD"])).code, 3);
      assertEquals((await cmd(["--repo", repo, "--declaration", "missing.ts"])).code, 3);
      writeTextFileSync(join(repo, "bad.ts"), 'export const declaration = { regulatedDomains: ["Medicine"] };\n');
      assertEquals((await cmd(["--repo", repo, "--declaration", "bad.ts"])).code, 3);
    });
  },
  skip,
);

proves(
  ["0020-ifccm FR-011", "0020-ifccm FR-012"],
  "a declaration whose day moved later is found by the command from Git history, as a gate once the day has passed",
  async () => {
    await withTempDir(async (repo) => {
      await init(repo);
      await commit(repo, "Declare\n\nRefs #10\n", "2026-09-01", { [RECORD_FILE]: decl(["DeviceQuality"], "2026-10-01") });
      const moved = await commit(repo, "Postpone\n\nRefs #10\n", "2026-11-17", { [RECORD_FILE]: decl(["DeviceQuality"], "2026-12-01") });
      const r = await cmd(["--repo", repo, "--today", "2026-11-20"]);
      assertEquals(r.code, 1);
      assertStringIncludes(r.err, "changes/gate-relaxed");
      assertStringIncludes(r.err, moved.slice(0, 12));
      // a Decision in the record clears it
      writeTextFileSync(
        join(repo, RECORD_FILE),
        `${decl(["DeviceQuality"], "2026-12-01")}export const decisions = [{ id: "D-1", approvedBy: "quality", covers: ["gate-relaxed ${moved.slice(0, 7)}"] }];\n`,
      );
      assertEquals((await cmd(["--repo", repo, "--today", "2026-11-20"])).code, 0);
    });
  },
  skip,
);

proves(
  ["0020-ifccm FR-005", "0020-ifccm FR-009"],
  "with --strict the command asks the host for each change request a commit names, and without it the host is never asked",
  async () => {
    await withTempDir(async (repo) => {
      await init(repo);
      const base = await commit(repo, "Base\n\nRefs #1\n", "2026-11-01");
      await commit(repo, "Names a ghost\n\nRefs #999\n", "2026-11-02");
      await commit(repo, "Names a closed one\n\nRefs #11\nRefs owner/other#5\n", "2026-11-03");
      await commit(repo, "Finishes\n\nCloses #10\n", "2026-11-04");
      const host = fakeHost("Github", {
        "owner/repo#1": issue(1),
        "owner/repo#10": issue(10, { body: "## Why\n\nx\n\n## Done when\n\n- [x] one\n- [ ] two\n" }),
        "owner/repo#11": issue(11, { state: "closed" }),
        "owner/other#5": issue(5),
      });
      const args = ["--repo", repo, "--range", `${base}..HEAD`, "--today", "2026-11-17"];
      // offline: no commit is wrong, and the host is not asked
      const offline = await cmd(args, { client: host, home: HOME });
      assertEquals(offline.code, 0, offline.err);
      assertEquals(host.asked, []);
      // strict
      const strict = await cmd([...args, "--strict"], { client: host, home: HOME });
      assertEquals(strict.code, 1);
      for (const rule of ["changes/unknown-issue", "changes/closed-issue", "changes/early-close", "changes/issue-shape"])
        assertStringIncludes(strict.err, rule);
      assertEquals([...new Set(host.asked)].sort(), ["owner/other#5", "owner/repo#10", "owner/repo#11", "owner/repo#999"]);
      assert(!strict.err.includes("not_run"), strict.err);
    });
  },
  skip,
);

proves(
  ["0020-ifccm FR-009", "0020-ifccm FR-030"],
  "a strict run that cannot ask the host is not_run with its reason and is never reported as passed: plain Git, no client, an unreachable host",
  async () => {
    await withTempDir(async (repo) => {
      await init(repo);
      const base = await commit(repo, "Base\n\nRefs #1\n", "2026-11-01");
      await commit(repo, "Work\n\nRefs #10\n", "2026-11-02");
      const args = ["--repo", repo, "--range", `${base}..HEAD`, "--today", "2026-11-17", "--strict"];
      const plain = fakeHost("Git", {});
      const onPlain = await cmd(args, { client: plain, home: { kind: "Git", host: "example.org", path: ["a", "b"] } });
      assertEquals(onPlain.code, 0);
      assertStringIncludes(onPlain.err, "changes/unknown-issue: not_run: ");
      assertStringIncludes(onPlain.err, NO_HOST_API);
      assertEquals(plain.asked, []);
      const noClient = await cmd(args);
      assertEquals(noClient.code, 0);
      assertStringIncludes(noClient.err, "changes/closed-issue: not_run: no Git host client was given");
      const down = fakeHost("Gitlab", {}, { kind: "unreachable", reason: "connection refused" });
      const unreachable = await cmd(args, { client: down, home: { kind: "Gitlab", host: "gitlab.example.org", path: ["g", "h", "p"] } });
      assertEquals(unreachable.code, 0);
      assertStringIncludes(unreachable.err, "changes/early-close: not_run: ");
      assertStringIncludes(unreachable.err, "unreachable: connection refused");
      assertEquals(down.asked, ["g/h/p#10"]);
      // the outcome of the host layer itself, with a commit that is wrong
      const range = await readRange(repo, `${base}..HEAD`);
      assert(range.kind === "ok");
      const outcome = await askHost(plain, HOME, range.value);
      assertEquals([outcome.answers.size, outcome.notRun], [0, NO_HOST_API]);
      const denied = await askHost(fakeHost("Github", {}, { kind: "unauthorized", reason: "no token" }), HOME, range.value);
      assertStringIncludes(denied.notRun ?? "", "not authorized: no token");
    });
  },
  skip,
);

proves(
  ["0020-ifccm FR-016", "0020-ifccm FR-017"],
  "the command writes the view of capabilities by rung into a document and --check fails where it differs",
  async () => {
    await withTempDir(async (dir) => {
      writeTextFileSync(
        join(dir, "capabilities.ts"),
        [
          'export const rungs = [{ id: "rung-5", label: "Checks", provedBy: ["bun test"] }];',
          'export const capabilities = [{ id: 10, title: "The check", touchesRung: ["rung-5"], lastRevision: "abcdef0123" }];',
          'export const runs = [{ command: "bun test", revision: "abcdef0123", passed: true }];',
          "",
        ].join("\n"),
      );
      writeTextFileSync(join(dir, "ARCH.md"), "# Architecture\n\n<!-- capabilities:begin -->\nstale\n<!-- capabilities:end -->\n\nEnd.\n");
      const args = ["--repo", dir, "--capabilities", "capabilities.ts", "--document", "ARCH.md"];
      const before = await cmd([...args, "--check"]);
      assertEquals(before.code, 1);
      assertStringIncludes(before.err, "differs");
      assertEquals((await cmd(args)).code, 0);
      assertStringIncludes(readTextFileSync(join(dir, "ARCH.md")), "- #10 The check: proved at abcdef0");
      assertEquals((await cmd([...args, "--check"])).code, 0);
      writeTextFileSync(join(dir, "ARCH.md"), readTextFileSync(join(dir, "ARCH.md")).replace("proved", "open"));
      assertEquals((await cmd([...args, "--check"])).code, 1);
      // a run that failed makes it open, and a document with no markers is an error
      writeTextFileSync(
        join(dir, "capabilities.ts"),
        readTextFileSync(join(dir, "capabilities.ts")).replace("passed: true", "passed: false"),
      );
      assertEquals((await cmd(args)).code, 0);
      assertStringIncludes(readTextFileSync(join(dir, "ARCH.md")), "open, `bun test` has no passing run at abcdef0");
      writeTextFileSync(join(dir, "NOMARK.md"), "# none\n");
      assertEquals((await cmd(["--repo", dir, "--capabilities", "capabilities.ts", "--document", "NOMARK.md"])).code, 3);
      assertEquals((await cmd(["--repo", dir, "--capabilities", "missing.ts", "--document", "ARCH.md"])).code, 3);
    });
  },
);

proves(["0020-ifccm FR-015"], "the command reports, for each requirement of a Done when, where its chain ends", async () => {
  await withTempDir(async (dir) => {
    mkdirSync(join(dir, "specs", "0099-demo"), { recursive: true });
    writeTextFileSync(
      join(dir, "specs", "0099-demo", "spec.md"),
      "# Demo\n\n**Status:** Draft\n\n- **FR-001**: It MUST work.\n- **FR-002**: It MUST work too.\n",
    );
    writeTextFileSync(join(dir, "a.ts"), "// Spec: 0099-demo FR-001\nexport const a = 1;\n");
    writeTextFileSync(join(dir, "a.test.ts"), 'proves(["0099-demo FR-001"], "a", () => {});\n');
    writeTextFileSync(join(dir, "body.md"), "## Why\n\nx\n\n## Done when\n\n- [ ] 0099-demo FR-001 by the test\n- [ ] 0099-demo FR-002\n");
    const r = await cmd(["--repo", dir, "--trace", "body.md"]);
    assertEquals(r.code, 1);
    // no ontology term of commons names a demo requirement, so the chain ends at the term; and FR-002 ends at the term too
    assertStringIncludes(r.out, "0099-demo FR-001: ends at StageTerm (StageIssue > StageRequirement)");
    assertStringIncludes(r.out, "0099-demo FR-002: ends at StageTerm (StageIssue > StageRequirement)");
    // a Done when naming a requirement the specification lacks ends at the requirement
    writeTextFileSync(join(dir, "body.md"), "## Done when\n\n- [ ] 0099-demo FR-009\n");
    assertStringIncludes((await cmd(["--repo", dir, "--trace", "body.md"])).out, "0099-demo FR-009: ends at StageRequirement (StageIssue)");
    // a body with no requirement is not a whole chain
    writeTextFileSync(join(dir, "body.md"), "## Done when\n\n- [ ] a review\n");
    assertEquals((await cmd(["--repo", dir, "--trace", "body.md"])).code, 1);
    assertEquals((await cmd(["--repo", dir, "--trace", "missing.md"])).code, 3);
  });
});

proves(
  ["0020-ifccm FR-032"],
  "the command runs as a program on this runtime: 0 for a clean range, 1 for a finding, and its strict cases are not_run where no host client is wired",
  async () => {
    await withTempDir(async (repo) => {
      await init(repo);
      const base = await commit(repo, "Base\n\nRefs #1\n", "2026-11-01");
      await commit(repo, "Fine\n\nRefs #10\n", "2026-11-02");
      const clean = await run([execPath(), CHANGES, "--repo", repo, "--range", `${base}..HEAD`, "--today", "2026-11-17"]);
      assertEquals(clean.code, 0, clean.stderr);
      const strict = await run([execPath(), CHANGES, "--repo", repo, "--range", `${base}..HEAD`, "--today", "2026-11-17", "--strict"]);
      assertEquals(strict.code, 0, strict.stderr);
      assertStringIncludes(strict.stderr, "not_run");
      await commit(repo, "Nothing named\n", "2026-11-03");
      const bad = await run([execPath(), CHANGES, "--repo", repo, "--range", `${base}..HEAD`, "--today", "2026-11-17"]);
      assertEquals(bad.code, 1);
      assertStringIncludes(bad.stderr, "changes/no-issue");
      assertEquals((await run([execPath(), CHANGES, "--nope"])).code, 2);
      assertEquals(decodeHarnessRecord(decl(["DeviceQuality"], "2027-01-01")).kind, "ok");
    });
  },
  skip,
);

proves(
  ["0020-ifccm FR-046", "0020-ifccm FR-047", "0020-ifccm FR-048"],
  "in a real repository a commit with no Refs fails, the same range passes with a Decision that names its revision, another commit is not covered and a malformed Decision is a finding",
  async () => {
    await withTempDir(async (repo) => {
      await init(repo);
      const base = await commit(repo, "Base\n\nRefs #1\n", "2026-11-01");
      const bare = await commit(repo, "Chapter\n", "2026-11-02");
      const other = await commit(repo, "Other chapter\n", "2026-11-03");
      const args = ["--repo", repo, "--range", `${base}..HEAD`, "--today", "2026-11-22"];
      const record = (covers: string, extra = ""): string =>
        `export const decisions = [{ id: "D-9", approvedBy: "Shahid Shah", covers: [${JSON.stringify(covers)}], decidedOn: "2026-11-22", reason: "outside repoctl commit"${extra} }];\n`;
      // without a Decision both commits are reported
      const none = await cmd(args);
      assertEquals(none.code, 1);
      assertStringIncludes(none.err, bare.slice(0, 12));
      // the Decision covers the one commit (by a 7-character prefix); the other is still reported
      writeTextFileSync(join(repo, RECORD_FILE), record(`no-issue ${bare.slice(0, 7)}`));
      const one = await cmd(args);
      assertEquals(one.code, 1);
      assert(!one.err.includes(`${bare.slice(0, 12)}: the commit`), one.err);
      assertStringIncludes(one.err, other.slice(0, 12));
      assertStringIncludes(one.err, `changes/no-issue covered: ${bare.slice(0, 12)} by Decision D-9 (Shahid Shah, 2026-11-22): outside repoctl commit`);
      // both covered: the range passes
      writeTextFileSync(
        join(repo, RECORD_FILE),
        `export const decisions = [{ id: "D-9", approvedBy: "Shahid Shah", covers: ["no-issue ${bare}", "no-issue ${other.slice(0, 9)}"], decidedOn: "2026-11-22", reason: "outside repoctl commit" }];\n`,
      );
      const both = await cmd(args);
      assertEquals(both.code, 0, both.err);
      assertStringIncludes(both.err, "covered");
      // a Decision for a revision that is not in the range is a finding
      writeTextFileSync(join(repo, RECORD_FILE), record(`no-issue ${base.slice(0, 7)}`));
      const absent = await cmd(["--repo", repo, "--range", `${base}..HEAD`, "--today", "2026-11-22"]);
      assertStringIncludes(absent.err, "changes/decision");
      assertStringIncludes(absent.err, "not in the range");
      // a malformed Decision (no reason, a role as person) is a finding, and exempts nothing
      writeTextFileSync(
        join(repo, RECORD_FILE),
        `export const decisions = [{ id: "D-9", approvedBy: "Shahid Shah", covers: ["no-issue ${bare.slice(0, 7)}"], decidedOn: "2026-11-22" }];\n`,
      );
      const bad = await cmd(args);
      assertEquals(bad.code, 1);
      assertStringIncludes(bad.err, "states no reason");
      assertStringIncludes(bad.err, `${bare.slice(0, 12)}: the commit`);
      // a commit that names an issue makes the Decision unneeded
      const named = await commit(repo, "Named\n\nRefs #2\n", "2026-11-04");
      writeTextFileSync(join(repo, RECORD_FILE), record(`no-issue ${named.slice(0, 7)}`));
      assertStringIncludes((await cmd(args)).err, "not needed");
      void other;
    });
  },
  skip,
);
