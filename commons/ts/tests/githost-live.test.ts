/**
 * Tests of the live transport path of the Git host adapters and of `clientFor` (commons 0023-if-workspaces FR-015, FR-018, FR-019): the adapters are run over the runtime's real `liveTransport`
 * (`fetch`) against a real HTTP server on the loopback interface. The server is a stand-in for the HOST, which is outside the code under test: it answers as GitHub's and GitLab's documented
 * APIs do (a private repository is `404` without its credential and `200` with it, `401` for a credential it does not know, `403` with `x-ratelimit-remaining: 0` for the rate) and records the
 * headers it was sent, so that a test can say which request carried a credential and which did not. What needs an account on the real hosts (a real private repository) is not tested.
 *
 * @module
 */
import { clientFor } from "../githost/mod.ts";
import { githubClient } from "../githost/github.ts";
import { gitlabClient } from "../githost/gitlab.ts";
import type { RepoRef } from "../githost/types.ts";
import { liveTransport } from "../runtime/http-client.ts";
import { serve, type Server } from "../runtime/serve.ts";
import { assert, assertEquals, proves } from "../runtime/test.ts";

const TOKEN = "ghp_LoopbackTokenThatMustNeverBeSaid0123";
const GL_TOKEN = "glpat-LoopbackTokenThatMustNeverBeSaid0123";
const JOB_TOKEN = "jobtoken-LoopbackTokenThatMustNeverBeSaid01";

type Seen = {
  readonly path: string;
  readonly authorization: string | null;
  readonly privateToken: string | null;
  readonly jobToken: string | null;
};

/** A server that answers like the two hosts' documented APIs, and what it saw. */
async function host(): Promise<{ readonly server: Server; readonly base: string; readonly seen: Seen[] }> {
  const seen: Seen[] = [];
  const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  const server = await serve({}, (req) => {
    const url = new URL(req.url);
    seen.push({
      path: url.pathname,
      authorization: req.headers.get("authorization"),
      privateToken: req.headers.get("private-token"),
      jobToken: req.headers.get("job-token"),
    });
    const bearer = req.headers.get("authorization");
    const knows =
      bearer === `Bearer ${TOKEN}` || req.headers.get("private-token") === GL_TOKEN || req.headers.get("job-token") === JOB_TOKEN;
    const given = bearer !== null || req.headers.has("private-token") || req.headers.has("job-token");
    if (given && !knows) return json(401, { message: "Bad credentials" });
    const p = url.pathname;
    if (p === "/repos/octo/hello" || p === "/api/v4/projects/octo%2Fhello") {
      return p.startsWith("/api")
        ? json(200, {
            visibility: "public",
            default_branch: "main",
            http_url_to_repo: "https://gitlab.example.org/octo/hello.git",
            archived: false,
          })
        : json(200, {
            private: false,
            visibility: "public",
            default_branch: "main",
            clone_url: "https://github.com/octo/hello.git",
            archived: false,
          });
    }
    if (p === "/repos/octo/secret" || p === "/api/v4/projects/octo%2Fsecret") {
      if (!knows) return json(404, { message: "Not Found" });
      return p.startsWith("/api")
        ? json(200, {
            visibility: "private",
            default_branch: "trunk",
            http_url_to_repo: "https://gitlab.example.org/octo/secret.git",
            archived: false,
          })
        : json(200, {
            private: true,
            visibility: "private",
            default_branch: "trunk",
            clone_url: "https://github.com/octo/secret.git",
            archived: false,
          });
    }
    if (p === "/repos/octo/limited")
      return json(403, { message: "API rate limit exceeded" }, { "x-ratelimit-remaining": "0", "retry-after": "17" });
    if (p === "/repos/octo/broken") return json(500, { message: "Server Error" });
    return json(404, { message: "Not Found" });
  });
  return { server, base: `http://127.0.0.1:${server.addr.port}`, seen };
}

const ghRef = (host: string, ...path: string[]): RepoRef => ({ kind: "Github", host, path });

proves(
  ["0023-if-workspaces FR-015", "0023-if-workspaces FR-018"],
  "GitHub over the live transport: public and private repositories, the credential only in a header, and every refusal typed",
  async () => {
    const { server, base, seen } = await host();
    try {
      const r = ghRef("127.0.0.1", "octo", "hello");
      const secret = ghRef("127.0.0.1", "octo", "secret");
      const anonymous = githubClient({ transport: liveTransport(), host: "127.0.0.1", apiBase: base });
      const pub = await anonymous.repository(r);
      assertEquals(pub.kind === "ok" ? [pub.value.visibility, pub.value.defaultBranch] : undefined, ["public", "main"]);
      const hidden = await anonymous.repository(secret);
      assertEquals(hidden.kind === "err" ? hidden.error.kind : "ok", "not-found");
      assert(
        seen.every((s) => s.authorization === null),
        "no credential was sent where there was none",
      );

      const authed = githubClient({ transport: liveTransport({ credentials: "allow" }), host: "127.0.0.1", apiBase: base, token: TOKEN });
      const priv = await authed.repository(secret);
      assertEquals(priv.kind === "ok" ? [priv.value.visibility, priv.value.defaultBranch] : undefined, ["private", "trunk"]);
      assertEquals(seen.at(-1)?.authorization, `Bearer ${TOKEN}`);
      assert(!JSON.stringify(priv).includes(TOKEN));

      const wrong = githubClient({
        transport: liveTransport({ credentials: "allow" }),
        host: "127.0.0.1",
        apiBase: base,
        token: "ghp_wrong",
      });
      const w = await wrong.repository(secret);
      assertEquals(w.kind === "err" ? w.error.kind : "ok", "unauthorized");
      assert(!JSON.stringify(w).includes("ghp_wrong"));

      assertEquals(await authed.repository(ghRef("127.0.0.1", "octo", "limited")), {
        kind: "err",
        error: { kind: "rate-limited", retryAfterSeconds: 17 },
      });
      const broken = await authed.repository(ghRef("127.0.0.1", "octo", "broken"));
      assertEquals(broken.kind === "err" ? broken.error.kind : "ok", "unexpected");

      // the transport that sends no credential refuses a request that carries one: the answer says why and not what
      const guarded = githubClient({ transport: liveTransport(), host: "127.0.0.1", apiBase: base, token: TOKEN });
      const g = await guarded.repository(r);
      assert(
        g.kind === "err" &&
          g.error.kind === "unreachable" &&
          /sends no credential/.test(g.error.reason) &&
          !JSON.stringify(g).includes(TOKEN),
      );
    } finally {
      await server.shutdown();
    }
    // nothing listens any more: unreachable, not a throw
    const down = await githubClient({
      transport: liveTransport({ timeoutSeconds: 2 }),
      host: "127.0.0.1",
      apiBase: "http://127.0.0.1:1",
    }).repository(ghRef("127.0.0.1", "octo", "hello"));
    assertEquals(down.kind === "err" ? down.error.kind : "ok", "unreachable");
  },
);

proves(
  ["0023-if-workspaces FR-015", "0023-if-workspaces FR-018"],
  "GitLab over the live transport: the credential in `PRIVATE-TOKEN` or `JOB-TOKEN`, never in a result",
  async () => {
    const { server, base, seen } = await host();
    try {
      const r: RepoRef = { kind: "Gitlab", host: "127.0.0.1", path: ["octo", "hello"] };
      const secret: RepoRef = { kind: "Gitlab", host: "127.0.0.1", path: ["octo", "secret"] };
      const anonymous = gitlabClient({ transport: liveTransport(), baseUrl: base });
      assertEquals((await anonymous.repository(r)).kind, "ok");
      const hidden = await anonymous.repository(secret);
      assertEquals(hidden.kind === "err" ? hidden.error.kind : "ok", "not-found");

      const access = gitlabClient({ transport: liveTransport({ credentials: "allow" }), baseUrl: base, token: GL_TOKEN });
      const a = await access.repository(secret);
      assertEquals(a.kind === "ok" ? a.value.visibility : "", "private");
      assertEquals(seen.at(-1)?.privateToken, GL_TOKEN);

      const job = gitlabClient({ transport: liveTransport({ credentials: "allow" }), baseUrl: base, token: JOB_TOKEN, tokenKind: "job" });
      assertEquals((await job.repository(secret)).kind, "ok");
      assertEquals(seen.at(-1)?.jobToken, JOB_TOKEN);
      assertEquals(seen.at(-1)?.privateToken, null);

      // the live transport refuses a job token too unless it is made to allow credentials
      const guarded = await gitlabClient({ transport: liveTransport(), baseUrl: base, token: JOB_TOKEN, tokenKind: "job" }).repository(r);
      assert(guarded.kind === "err" && guarded.error.kind === "unreachable" && !JSON.stringify(guarded).includes(JOB_TOKEN));
      assert(!JSON.stringify([a]).includes(GL_TOKEN));
    } finally {
      await server.shutdown();
    }
  },
);

proves(
  ["0023-if-workspaces FR-018", "0023-if-workspaces FR-019"],
  "clientFor reads a token only from the environment it is given, only for a host that may hold one, and chooses the adapter by the kind",
  async () => {
    const { server, base, seen } = await host();
    try {
      const gh = ghRef("127.0.0.1", "octo", "secret");
      const none = clientFor(gh, { env: {}, trustedHosts: ["127.0.0.1"], githubApiBase: base });
      assertEquals(none.kind, "Github");
      assertEquals((await none.repository(gh)).kind, "err");
      assertEquals(seen.at(-1)?.authorization, null);

      const viaGh = clientFor(gh, { env: { GH_TOKEN: TOKEN }, trustedHosts: ["127.0.0.1"], githubApiBase: base });
      assertEquals((await viaGh.repository(gh)).kind, "ok");
      assertEquals(seen.at(-1)?.authorization, `Bearer ${TOKEN}`);
      // GITHUB_TOKEN is read before GH_TOKEN
      const both = clientFor(gh, { env: { GITHUB_TOKEN: TOKEN, GH_TOKEN: "ghp_other" }, trustedHosts: ["127.0.0.1"], githubApiBase: base });
      assertEquals((await both.repository(gh)).kind, "ok");
      // the process's own environment is never read: a token in it is not used where it is not given
      const before = seen.length;
      const ignored = clientFor(gh, { env: {}, trustedHosts: ["127.0.0.1"], githubApiBase: base });
      await ignored.repository(gh);
      assertEquals(seen.at(-1)?.authorization, null);
      assertEquals(seen.length, before + 1);
      // a host nobody named is asked with no credential, so that the environment's token is never sent to it
      const untrusted = clientFor(gh, { env: { GITHUB_TOKEN: TOKEN }, githubApiBase: base });
      assertEquals((await untrusted.repository(gh)).kind, "err");
      assertEquals(seen.at(-1)?.authorization, null);
      // a token that would split a header is not a token
      const unsafe = clientFor(gh, { env: { GITHUB_TOKEN: `${TOKEN}\r\nx-evil: 1` }, trustedHosts: ["127.0.0.1"], githubApiBase: base });
      await unsafe.repository(gh);
      assertEquals(seen.at(-1)?.authorization, null);

      const gl: RepoRef = { kind: "Gitlab", host: "127.0.0.1", path: ["octo", "secret"] };
      const viaGl = clientFor(gl, {
        env: { GITLAB_TOKEN: GL_TOKEN, CI_JOB_TOKEN: JOB_TOKEN },
        trustedHosts: ["127.0.0.1"],
        gitlabBaseUrl: base,
      });
      assertEquals(viaGl.kind, "Gitlab");
      assertEquals((await viaGl.repository(gl)).kind, "ok");
      assertEquals(seen.at(-1)?.privateToken, GL_TOKEN);
      assertEquals(seen.at(-1)?.jobToken, null);
      const viaJob = clientFor(gl, { env: { CI_JOB_TOKEN: JOB_TOKEN }, trustedHosts: ["127.0.0.1"], gitlabBaseUrl: base });
      assertEquals((await viaJob.repository(gl)).kind, "ok");
      assertEquals(seen.at(-1)?.jobToken, JOB_TOKEN);

      assertEquals(clientFor({ kind: "Git", host: "git.example.org", path: ["a", "b"] }, { env: { GITHUB_TOKEN: TOKEN } }).kind, "Git");
      // no client holds a token as a property
      for (const c of [viaGh, viaGl, viaJob]) assert(!JSON.stringify(Object.entries(c)).includes("LoopbackToken"));
    } finally {
      await server.shutdown();
    }
  },
);
