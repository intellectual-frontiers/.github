/**
 * Tests of the three Git host adapters behind `GitHostClient` (commons 0020-ifccm FR-039 to FR-042, FR-020, 0020-ifccm FR-027 to FR-030). GitHub and GitLab are asked through the runtime's
 * `recordedTransport` with exchanges written by hand from the documented answers of REST API v3 and v4 (real JSON bodies, the statuses and messages the hosts document): they reach no host. Plain Git
 * is asked of a real bare repository in a temporary folder with the real `git`, and a signed commit is made with a key `ssh-keygen` generates (skipped, with the reason, where it is not installed).
 * All three pass the same conformance function. What needs an account (a real private repository on either host) is not tested; the header of `githost-live.test.ts` says what is.
 *
 * @module
 */
import { githubClient } from "../githost/github.ts";
import { plainGitClient } from "../githost/git.ts";
import { gitlabClient } from "../githost/gitlab.ts";
import type { RepoRef } from "../githost/types.ts";
import { mkdir, withTempDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import { type Exchange, recordedTransport } from "@intellectual-frontiers/net/http-client";
import { join } from "@intellectual-frontiers/system/path";
import { run, which } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "../runtime/test.ts";
import { conformance } from "./githost-conformance.ts";

const JSON_TYPE = { "content-type": "application/json; charset=utf-8" };
const ok = (url: string, body: unknown): Exchange => ({ method: "GET", url, status: 200, headers: JSON_TYPE, body: JSON.stringify(body) });
const bad = (url: string, status: number, body: unknown, headers: Record<string, string> = {}): Exchange => ({
  method: "GET",
  url,
  status,
  headers: { ...JSON_TYPE, ...headers },
  body: JSON.stringify(body),
});

const SIGNED = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const UNSIGNED = "0f1e2d3c4b5a69788796a5b4c3d2e1f001122334";

// ---- GitHub: the documented answers of REST API v3

const GH = "https://api.github.com/repos/octo/hello";
const GH_NOT_FOUND = { message: "Not Found", documentation_url: "https://docs.github.com/rest", status: "404" };
const ghIssue = (n: number, extra: Record<string, unknown> = {}): unknown => ({
  url: `${GH}/issues/${n}`,
  number: n,
  title: n === 1 ? "Capability: workspaces" : "A child task",
  state: "open",
  body: "## Why\n\nBecause.\n\n## Done when\n\n- [ ] it works\n",
  html_url: `https://github.com/octo/hello/issues/${n}`,
  labels: [{ id: 1, name: "capability", color: "ededed" }, "plain-label"],
  user: { login: "octocat" },
  ...extra,
});

const github: Exchange[] = [
  ok(GH, {
    id: 1296269,
    full_name: "octo/hello",
    private: false,
    visibility: "public",
    default_branch: "main",
    clone_url: "https://github.com/octo/hello.git",
    ssh_url: "git@github.com:octo/hello.git",
    archived: false,
  }),
  bad(`${GH.replace("hello", "missing")}`, 404, GH_NOT_FOUND),
  ok(`${GH}/issues/1`, ghIssue(1)),
  bad(`${GH}/issues/1/parent`, 404, GH_NOT_FOUND),
  ok(`${GH}/issues/1/sub_issues?per_page=100`, [ghIssue(2), ghIssue(3)]),
  ok(`${GH}/issues/2`, ghIssue(2)),
  ok(`${GH}/issues/2/parent`, ghIssue(1)),
  ok(`${GH}/issues/2/sub_issues?per_page=100`, []),
  ok(`${GH}/issues/7`, ghIssue(7, { pull_request: { url: `${GH}/pulls/7` } })),
  ok(`${GH}/issues/8`, ghIssue(8, { body: null, labels: [] })),
  bad(`${GH}/issues/8/parent`, 404, GH_NOT_FOUND),
  bad(`${GH}/issues/8/sub_issues?per_page=100`, 404, GH_NOT_FOUND),
  bad(`${GH}/issues/9`, 410, { message: "This issue was deleted" }),
  ok(`${GH}/pulls/1`, {
    number: 1,
    title: "Add the thing",
    state: "closed",
    merged: true,
    merged_at: "2026-11-01T10:00:00Z",
    html_url: `${GH.replace("api.github.com/repos", "github.com")}/pull/1`,
    head: { ref: "feature/x", sha: SIGNED },
    base: { ref: "main", sha: UNSIGNED },
  }),
  ok(`${GH}/pulls/2`, {
    number: 2,
    title: "Not yet",
    state: "open",
    merged: false,
    merged_at: null,
    html_url: "https://github.com/octo/hello/pull/2",
    head: { ref: "wip", sha: SIGNED },
    base: { ref: "main", sha: UNSIGNED },
  }),
  ok(`${GH}/branches/main`, { name: "main", protected: true }),
  ok(`${GH}/branches/main/protection`, {
    url: `${GH}/branches/main/protection`,
    required_pull_request_reviews: { required_approving_review_count: 1 },
    allow_force_pushes: { enabled: false },
  }),
  ok(`${GH}/branches/dev`, { name: "dev", protected: false }),
  ok(`${GH}/branches/ruleset`, { name: "ruleset", protected: true }),
  bad(`${GH}/branches/ruleset/protection`, 403, { message: "Resource not accessible by integration" }),
  bad(`${GH}/branches/gone`, 404, { message: "Branch not found" }),
  ok(`${GH}/commits/${SIGNED}`, { sha: SIGNED, commit: { verification: { verified: true, reason: "valid" } } }),
  ok(`${GH}/commits/${UNSIGNED}`, { sha: UNSIGNED, commit: { verification: { verified: false, reason: "unsigned" } } }),
  bad("https://api.github.com/repos/octo/private", 404, GH_NOT_FOUND),
  bad(
    "https://api.github.com/repos/octo/limited",
    403,
    { message: "API rate limit exceeded for 203.0.113.9." },
    { "x-ratelimit-remaining": "0", "retry-after": "42" },
  ),
  bad("https://api.github.com/repos/octo/denied", 403, { message: "Must have admin rights to Repository." }),
  bad("https://api.github.com/repos/octo/badcred", 401, { message: "Bad credentials" }),
  bad("https://api.github.com/repos/octo/broken", 502, { message: "Server Error" }),
  { method: "GET", url: "https://api.github.com/repos/octo/odd", status: 200, headers: JSON_TYPE, body: '{"full_name":"octo/odd"}' },
];

const ghRef = (...path: string[]): RepoRef => ({ kind: "Github", host: "github.com", path });

proves(["0020-ifccm FR-039", "0020-ifccm FR-041"], "the GitHub adapter passes the shared conformance tests", async () => {
  const token = "ghp_ConformanceTokenNeverSaid0123456789";
  await conformance({
    client: githubClient({ transport: recordedTransport(github), token }),
    existing: ghRef("octo", "hello"),
    defaultBranch: "main",
    missing: ghRef("octo", "missing"),
    deep: ghRef("octo", "group", "hello"),
    signed: SIGNED,
    unsigned: UNSIGNED,
    secrets: [token],
  });
});

proves(
  ["0020-ifccm FR-040", "0020-ifccm FR-027"],
  "GitHub: issues with their parent and sub-issues, pull requests, protected branches and signatures",
  async () => {
    const c = githubClient({ transport: recordedTransport(github) });
    const repo = ghRef("octo", "hello");
    const one = await c.issue(repo, 1);
    assertEquals(one.kind === "ok" ? one.value : undefined, {
      number: 1,
      title: "Capability: workspaces",
      body: "## Why\n\nBecause.\n\n## Done when\n\n- [ ] it works\n",
      state: "open",
      url: "https://github.com/octo/hello/issues/1",
      children: [2, 3],
      labels: ["capability", "plain-label"],
      hierarchy: "known",
    });
    const two = await c.issue(repo, 2);
    assertEquals(two.kind === "ok" ? [two.value.parent, two.value.children] : undefined, [1, []]);
    const eight = await c.issue(repo, 8);
    assertEquals(eight.kind === "ok" ? [eight.value.body, eight.value.hierarchy, eight.value.parent] : undefined, [
      "",
      "unavailable",
      undefined,
    ]);
    assertEquals(await c.issue(repo, 7), {
      kind: "err",
      error: { kind: "not-found", what: "issue #7 of github.com/octo/hello (that number is a pull request)" },
    });
    assertEquals(await c.issue(repo, 9), { kind: "err", error: { kind: "unexpected", status: 410, reason: "This issue was deleted" } });

    const merged = await c.changeRequest(repo, 1);
    assertEquals(merged.kind === "ok" ? [merged.value.state, merged.value.sourceBranch, merged.value.targetBranch] : undefined, [
      "merged",
      "feature/x",
      "main",
    ]);
    const open = await c.changeRequest(repo, 2);
    assertEquals(open.kind === "ok" ? open.value.state : undefined, "open");

    assertEquals(await c.branchProtection(repo, "main"), {
      kind: "ok",
      value: { branch: "main", protected: true, requiresReview: true, allowsForcePush: false, detail: "full" },
    });
    assertEquals(await c.branchProtection(repo, "dev"), {
      kind: "ok",
      value: { branch: "dev", protected: false, requiresReview: false, allowsForcePush: true, detail: "full" },
    });
    assertEquals(await c.branchProtection(repo, "ruleset"), {
      kind: "ok",
      value: { branch: "ruleset", protected: true, requiresReview: false, allowsForcePush: false, detail: "protected-only" },
    });
    assertEquals((await c.branchProtection(repo, "gone")).kind === "err" ? "err" : "ok", "err");
  },
);

proves(
  ["0020-ifccm FR-042"],
  "GitHub: a private repository asked with no credential is not-found, as GitHub says, and every refusal is typed",
  async () => {
    const anon = githubClient({ transport: recordedTransport(github) });
    const priv = await anon.repository(ghRef("octo", "private"));
    assertEquals(priv.kind === "err" ? priv.error.kind : "ok", "not-found");
    assert(priv.kind === "err" && priv.error.kind === "not-found" && /no credential/.test(priv.error.what));
    const authed = githubClient({ transport: recordedTransport(github), token: "ghp_x" });
    const priv2 = await authed.repository(ghRef("octo", "private"));
    assert(priv2.kind === "err" && priv2.error.kind === "not-found" && !/no credential/.test(priv2.error.what));

    assertEquals(await anon.repository(ghRef("octo", "limited")), { kind: "err", error: { kind: "rate-limited", retryAfterSeconds: 42 } });
    const denied = await authed.repository(ghRef("octo", "denied"));
    assertEquals(denied.kind === "err" ? denied.error.kind : "ok", "unauthorized");
    const badcred = await authed.repository(ghRef("octo", "badcred"));
    assertEquals(badcred.kind === "err" ? badcred.error.kind : "ok", "unauthorized");
    const none = await anon.repository(ghRef("octo", "badcred"));
    assert(none.kind === "err" && none.error.kind === "unauthorized" && /none was given/.test(none.error.reason));
    assertEquals(await anon.repository(ghRef("octo", "broken")), {
      kind: "err",
      error: { kind: "unexpected", status: 502, reason: "Server Error" },
    });
    const odd = await anon.repository(ghRef("octo", "odd"));
    assert(odd.kind === "err" && odd.error.kind === "unexpected" && /not what was expected/.test(odd.error.reason));
    // no recorded exchange: the transport refuses, and that is "unreachable"
    const none2 = await anon.repository(ghRef("octo", "unrecorded"));
    assertEquals(none2.kind === "err" ? none2.error.kind : "ok", "unreachable");
    // another host is never asked, so a token is never sent there
    const other = await authed.repository({ kind: "Github", host: "ghe.example.org", path: ["a", "b"] });
    assertEquals(other.kind === "err" ? other.error.kind : "ok", "not-found");
    assertEquals((await authed.repository(ghRef("only-owner"))).kind, "err");
  },
);

// ---- GitLab: the documented answers of REST API v4

const GL = "https://gitlab.com/api/v4/projects/group%2Fsub%2Fproj";
const GL_NOT_FOUND = { message: "404 Project Not Found" };
const glIssue = (iid: number): unknown => ({
  id: 100 + iid,
  iid,
  project_id: 7,
  title: "A capability",
  description: "## Why\n\nBecause.\n",
  state: "opened",
  labels: ["capability", "ifws"],
  web_url: `https://gitlab.com/group/sub/proj/-/issues/${iid}`,
});

const gitlab: Exchange[] = [
  ok(GL, {
    id: 7,
    path_with_namespace: "group/sub/proj",
    visibility: "public",
    default_branch: "main",
    http_url_to_repo: "https://gitlab.com/group/sub/proj.git",
    ssh_url_to_repo: "git@gitlab.com:group/sub/proj.git",
    archived: false,
  }),
  bad("https://gitlab.com/api/v4/projects/group%2Fsub%2Fmissing", 404, GL_NOT_FOUND),
  ok(`${GL}/issues/1`, glIssue(1)),
  ok(`${GL}/merge_requests/1`, {
    id: 11,
    iid: 1,
    title: "Draft: a change",
    state: "merged",
    web_url: "https://gitlab.com/group/sub/proj/-/merge_requests/1",
    source_branch: "feature/x",
    target_branch: "main",
  }),
  ok(`${GL}/merge_requests/2`, {
    iid: 2,
    title: "Locked",
    state: "locked",
    web_url: "https://gitlab.com/group/sub/proj/-/merge_requests/2",
    source_branch: "a",
    target_branch: "main",
  }),
  ok(`${GL}/repository/branches/main`, { name: "main", protected: true, default: true }),
  ok(`${GL}/protected_branches/main`, {
    id: 1,
    name: "main",
    push_access_levels: [{ id: 1, access_level: 0, access_level_description: "No one" }],
    merge_access_levels: [{ id: 2, access_level: 40, access_level_description: "Maintainers" }],
    allow_force_push: false,
    code_owner_approval_required: false,
  }),
  ok(`${GL}/repository/branches/dev`, { name: "dev", protected: false }),
  ok(`${GL}/repository/branches/loose`, { name: "loose", protected: true }),
  ok(`${GL}/protected_branches/loose`, {
    name: "loose",
    push_access_levels: [{ access_level: 30 }],
    merge_access_levels: [{ access_level: 30 }],
    allow_force_push: true,
    code_owner_approval_required: true,
  }),
  ok(`${GL}/repository/branches/release%2F1`, { name: "release/1", protected: true }),
  bad(`${GL}/protected_branches/release%2F1`, 404, { message: "404 Not found" }),
  ok(`${GL}/repository/commits/${SIGNED}/signature`, { signature_type: "SSH", verification_status: "verified", commit_source: "gitaly" }),
  bad(`${GL}/repository/commits/${UNSIGNED}/signature`, 404, { message: "404 GPG Signature Not Found" }),
  bad(`${GL}/repository/commits/${"f".repeat(40)}/signature`, 404, { message: "404 Commit Not Found" }),
  bad("https://gitlab.com/api/v4/projects/group%2Fsub%2Fprivate", 404, GL_NOT_FOUND),
  bad("https://gitlab.com/api/v4/projects/group%2Fsub%2Flimited", 429, { message: "Retry later" }, { "retry-after": "30" }),
  bad("https://gitlab.com/api/v4/projects/group%2Fsub%2Fdenied", 403, { message: "403 Forbidden" }),
  bad("https://gitlab.com/api/v4/projects/group%2Fsub%2Fbadcred", 401, { message: "401 Unauthorized" }),
];

const glRef = (...path: string[]): RepoRef => ({ kind: "Gitlab", host: "gitlab.com", path });

proves(
  ["0020-ifccm FR-039", "0020-ifccm FR-044"],
  "the GitLab adapter passes the shared conformance tests, groups to any depth included",
  async () => {
    const token = "glpat-ConformanceTokenNeverSaid0123456789";
    await conformance({
      client: gitlabClient({ transport: recordedTransport(gitlab), token }),
      existing: glRef("group", "sub", "proj"),
      defaultBranch: "main",
      missing: glRef("group", "sub", "missing"),
      deep: glRef("group", "sub", "proj"),
      signed: SIGNED,
      unsigned: UNSIGNED,
      secrets: [token],
    });
  },
);

proves(
  ["0020-ifccm FR-040", "0020-ifccm FR-027"],
  "GitLab: issues and merge requests, protected branches and signatures, as the API offers them",
  async () => {
    const c = gitlabClient({ transport: recordedTransport(gitlab) });
    const repo = glRef("group", "sub", "proj");
    const issue = await c.issue(repo, 1);
    assertEquals(issue.kind === "ok" ? issue.value : undefined, {
      number: 1,
      title: "A capability",
      body: "## Why\n\nBecause.\n",
      state: "open",
      url: "https://gitlab.com/group/sub/proj/-/issues/1",
      children: [],
      labels: ["capability", "ifws"],
      hierarchy: "unavailable",
    });
    const mr = await c.changeRequest(repo, 1);
    assertEquals(mr.kind === "ok" ? [mr.value.number, mr.value.state, mr.value.sourceBranch] : undefined, [1, "merged", "feature/x"]);
    const locked = await c.changeRequest(repo, 2);
    assertEquals(locked.kind === "ok" ? locked.value.state : undefined, "open");

    assertEquals(await c.branchProtection(repo, "main"), {
      kind: "ok",
      value: { branch: "main", protected: true, requiresReview: true, allowsForcePush: false, detail: "full" },
    });
    assertEquals(await c.branchProtection(repo, "loose"), {
      kind: "ok",
      value: { branch: "loose", protected: true, requiresReview: true, allowsForcePush: true, detail: "full" },
    });
    assertEquals(await c.branchProtection(repo, "dev"), {
      kind: "ok",
      value: { branch: "dev", protected: false, requiresReview: false, allowsForcePush: true, detail: "full" },
    });
    assertEquals(await c.branchProtection(repo, "release/1"), {
      kind: "ok",
      value: { branch: "release/1", protected: true, requiresReview: false, allowsForcePush: false, detail: "protected-only" },
    });
    const unknown = await c.commitVerified(repo, "f".repeat(40));
    assertEquals(unknown.kind === "err" ? unknown.error.kind : "ok", "not-found");
    // another host is not this client's
    assertEquals((await c.repository({ kind: "Gitlab", host: "gitlab.example.org", path: ["a", "b"] })).kind, "err");
  },
);

proves(
  ["0020-ifccm FR-042"],
  "GitLab: a private project asked with no credential is not-found, as GitLab says, and every refusal is typed",
  async () => {
    const anon = gitlabClient({ transport: recordedTransport(gitlab) });
    const authed = gitlabClient({ transport: recordedTransport(gitlab), token: "glpat-x" });
    const priv = await anon.repository(glRef("group", "sub", "private"));
    assert(priv.kind === "err" && priv.error.kind === "not-found" && /no credential/.test(priv.error.what));
    assertEquals(await anon.repository(glRef("group", "sub", "limited")), {
      kind: "err",
      error: { kind: "rate-limited", retryAfterSeconds: 30 },
    });
    const denied = await authed.repository(glRef("group", "sub", "denied"));
    assertEquals(denied.kind === "err" ? denied.error.kind : "ok", "unauthorized");
    const badcred = await authed.repository(glRef("group", "sub", "badcred"));
    assertEquals(badcred.kind === "err" ? badcred.error.kind : "ok", "unauthorized");
    assertEquals((await anon.repository(glRef("only"))).kind, "err");
  },
);

// ---- plain Git: a real bare repository, the real git

const gitOk = which("git") === undefined ? { skip: "git is not installed" } : {};
const sshOk = which("git") === undefined || which("ssh-keygen") === undefined ? { skip: "git or ssh-keygen is not installed" } : {};

/** git in `cwd` as a throwaway committer; the test fails where it fails. */
async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await run(["git", "-C", cwd, "-c", "user.name=ci", "-c", "user.email=ci@example.com", "-c", "commit.gpgsign=false", ...args], {
    env: { GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  });
  assert(r.success, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

proves(
  ["0020-ifccm FR-039", "0020-ifccm FR-041"],
  "the plain Git adapter passes the shared conformance tests on a real repository and a real signature",
  async () => {
    await withTempDir(async (dir) => {
      const bare = join(dir, "remote.git");
      const clone = join(dir, "clone");
      await mkdir(clone);
      await git(clone, "init", "-q", "-b", "trunk");
      // a signed commit needs an SSH key: made here, and trusted by an allowed-signers file, as a person's Git does
      const key = join(dir, "signing");
      const kg = await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "ci@example.com", "-f", key]);
      assert(kg.success, kg.stderr);
      const pub = (await run(["cat", `${key}.pub`])).stdout.trim();
      await writeTextFile(join(dir, "allowed"), `ci@example.com ${pub}\n`);
      await writeTextFile(join(clone, "a.txt"), "one\n");
      await git(clone, "add", "a.txt");
      await git(clone, "-c", "gpg.format=ssh", "-c", `user.signingkey=${key}`, "-c", "commit.gpgsign=true", "commit", "-q", "-m", "signed");
      const signed = await git(clone, "rev-parse", "HEAD");
      await writeTextFile(join(clone, "b.txt"), "two\n");
      await git(clone, "add", "b.txt");
      await git(clone, "commit", "-q", "-m", "unsigned");
      const unsigned = await git(clone, "rev-parse", "HEAD");
      await git(clone, "config", "gpg.format", "ssh");
      await git(clone, "config", "gpg.ssh.allowedSignersFile", join(dir, "allowed"));
      await run(["git", "clone", "-q", "--bare", clone, bare]);
      await git(bare, "symbolic-ref", "HEAD", "refs/heads/trunk");

      const existing: RepoRef = { kind: "Git", host: "git.example.org", path: ["team", "tool"] };
      const client = plainGitClient({
        env: { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
        remoteOf: (r) => (r.path.at(-1) === "tool" ? bare : join(dir, "nowhere.git")),
        localOf: (r) => (r.path.at(-1) === "tool" ? clone : undefined),
      });
      await conformance({
        client,
        existing,
        defaultBranch: "trunk",
        missing: { kind: "Git", host: "git.example.org", path: ["team", "gone"] },
        deep: { kind: "Git", host: "git.example.org", path: ["team", "group", "tool"] },
        signed,
        unsigned,
        secrets: [],
      });
      // no local clone: plain Git cannot say, and says so
      const blind = await plainGitClient({ remoteOf: () => bare }).commitVerified(existing, signed);
      assertEquals(blind.kind === "err" ? blind.error.kind : "ok", "not-found");
      // plain Git says nothing of who may see it
      const info = await client.repository(existing);
      assertEquals(info.kind === "ok" ? [info.value.visibility, info.value.archived, info.value.cloneUrl] : undefined, [
        "unknown",
        false,
        "https://git.example.org/team/tool.git",
      ]);
    });
  },
  sshOk,
);

proves(
  ["0020-ifccm FR-041", "0020-ifccm FR-042"],
  "plain Git: a remote that wants a credential is unauthorized, never a prompt, and the program missing is unreachable",
  async () => {
    const askCredential = plainGitClient({ remoteOf: () => "https://127.0.0.1:1/never/there.git" });
    const r = await askCredential.repository({ kind: "Git", host: "git.example.org", path: ["a", "b"] });
    assertEquals(r.kind === "err" ? r.error.kind : "ok", "unreachable");
    const missingProgram = await plainGitClient({ program: "git-that-is-not-installed" }).repository({
      kind: "Git",
      host: "h",
      path: ["a", "b"],
    });
    assertEquals(missingProgram.kind === "err" ? missingProgram.error.kind : "ok", "unreachable");
  },
  gitOk,
);
