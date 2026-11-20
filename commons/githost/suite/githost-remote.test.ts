/**
 * Tests of `src/remote.ts` and `src/capabilities.ts` (commons githost 0001-githost FR-003 to FR-008): every spelling of a remote gives the same repository, a credential in a URL is
 * dropped and never appears in a result or an error, the kind of host is GitHub, GitLab or plain Git by the rule, and a capability a kind lacks is a typed answer. That the table is the
 * ontology's is held by `tests/commons-githost-ontology.test.ts`, which may read the ontology of change control. Pure: no program, no network.
 *
 * @module
 */
import { CAPABILITIES, COMMON_CAPABILITIES, maxDepth, supports, unsupported } from "../src/capabilities.ts";
import { cloneUrlOf, describeRemoteError, hostKindOf, parseRemote, readRemote, sameRepository } from "../src/remote.ts";
import type { HostKind, RepoRef } from "../src/types.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const ref = (text: string, kinds: Readonly<Record<string, HostKind>> = {}): RepoRef => {
  const r = parseRemote(text, kinds);
  if (r.kind === "err") throw new Error(`${text}: ${describeRemoteError(r.error)}`);
  return r.value;
};

proves(["0001-githost FR-007"], "https, ssh, scp-like and git forms of one remote are one repository", () => {
  const forms = [
    "https://github.com/octo/hello.git",
    "https://github.com/octo/hello",
    "https://github.com/octo/hello/",
    "http://GitHub.com/octo/hello.git",
    "git@github.com:octo/hello.git",
    "github.com:octo/hello",
    "ssh://git@github.com/octo/hello.git",
    "ssh://git@github.com:22/octo/hello.git",
    "git://github.com/octo/hello.git",
    "https://github.com:443/octo/hello.git?x=1#y",
  ];
  for (const f of forms) assertEquals(ref(f), { kind: "Github", host: "github.com", path: ["octo", "hello"] }, f);
  assert(sameRepository(ref("git@github.com:Octo/Hello.git"), ref("https://github.com/octo/hello")));
  assert(!sameRepository(ref("git@github.com:octo/hello.git"), ref("https://github.com/octo/other")));
  assertEquals(cloneUrlOf(ref("git@github.com:octo/hello.git")), "https://github.com/octo/hello.git");
});

proves(
  ["0001-githost FR-005"],
  "the kind of host is GitHub, GitLab or plain Git by the rule, and a self-managed GitLab is named, never guessed",
  () => {
    assertEquals(hostKindOf("github.com"), "Github");
    assertEquals(hostKindOf("GitLab.com"), "Gitlab");
    assertEquals(hostKindOf("gitlab.example.org"), "Git", "a name that says gitlab is not enough");
    assertEquals(hostKindOf("git.example.org"), "Git");
    assertEquals(hostKindOf("gitlab.example.org", { "gitlab.example.org": "Gitlab" }), "Gitlab");
    assertEquals(ref("https://gitlab.example.org/a/b").kind, "Git");
    assertEquals(ref("https://gitlab.example.org/a/b", { "gitlab.example.org": "Gitlab" }).kind, "Gitlab");
    assertEquals(ref("git@git.example.org:team/tool.git").kind, "Git");
    assertEquals(ref("https://gitlab.com/g/s1/s2/proj.git"), { kind: "Gitlab", host: "gitlab.com", path: ["g", "s1", "s2", "proj"] });
    // the map is read by its own keys: a host named like an object member is plain Git
    assertEquals(hostKindOf("constructor", {}), "Git");
  },
);

proves(["0001-githost FR-004", "0001-githost FR-007"], "a credential in a remote is dropped, and no result and no error holds it", () => {
  const secret = "ghp_SECRETSECRETSECRET0123456789";
  for (const url of [
    `https://user:${secret}@github.com/octo/hello.git`,
    `https://${secret}@github.com/octo/hello.git`,
    `ssh://git:${secret}@github.com/octo/hello.git`,
    `https://oauth2:${secret}@github.com:443/octo/hello`,
  ]) {
    const r = parseRemote(url);
    assertEquals(r.kind, "ok");
    assert(!JSON.stringify(r).includes(secret), url);
    assertEquals(r.kind === "ok" ? r.value.host : "", "github.com");
  }
  for (const url of [
    `ftp://user:${secret}@host/a/b`,
    `https://user:${secret}@/a/b`,
    `https://user:${secret}@github.com/`,
    `https://${secret}@github.com/onlyowner`,
  ]) {
    const r = parseRemote(url);
    assertEquals(r.kind, "err", url);
    const said = r.kind === "err" ? JSON.stringify(r.error) + describeRemoteError(r.error) : "";
    assert(!said.includes(secret) && !said.includes("user:"), `${url}: ${said}`);
  }
});

proves(["0001-githost FR-007"], "a text that is not a remote of a host is told by what is wrong with it", () => {
  const kind = (t: string): string => {
    const r = parseRemote(t);
    return r.kind === "ok" ? "ok" : r.error.kind;
  };
  assertEquals(kind(""), "empty");
  assertEquals(kind("   "), "empty");
  assertEquals(kind("/srv/git/repo.git"), "local-path");
  assertEquals(kind("./repo"), "local-path");
  assertEquals(kind("C:\\work\\repo"), "local-path");
  assertEquals(kind("C:/work/repo"), "local-path");
  assertEquals(kind("file:///srv/git/repo.git"), "local-path");
  assertEquals(kind("repo"), "local-path");
  assertEquals(kind("ftp://host/a/b"), "unsupported-scheme");
  assertEquals(kind("https:///a/b"), "no-host");
  assertEquals(kind("https://github.com"), "no-path");
  assertEquals(kind("https://github.com/owner"), "no-path");
  assertEquals(kind("https://github.com/owner/.git"), "no-path");
  assertEquals(kind("https://github.com/a/%E0%A4%A"), "bad-segment");
  assertEquals(kind("https://github.com/a/b%2Fc"), "bad-segment");
});

proves(
  ["0001-githost FR-003", "0001-githost FR-006"],
  "a capability a kind lacks is a typed answer naming both, and the depth a kind allows is told",
  () => {
    for (const kind of ["Github", "Gitlab", "Git"] as const) {
      for (const c of COMMON_CAPABILITIES) assert(supports(kind, c), `${kind} offers ${c}`);
      assertEquals(
        [...CAPABILITIES[kind]].every((c) => supports(kind, c)),
        true,
        kind,
      );
    }
    assertEquals(unsupported("Github", "NestedGroups"), {
      kind: "err",
      error: { kind: "unsupported", capability: "NestedGroups", host: "Github" },
    });
    assertEquals(maxDepth("Github"), 2);
    assertEquals(maxDepth("Git"), 2);
    assertEquals(maxDepth("Gitlab"), Number.POSITIVE_INFINITY);
    assert(!supports("Github", "NestedGroups") && supports("Gitlab", "NestedGroups") && !supports("Git", "Issues"));
  },
);

proves(
  ["0001-githost FR-008"],
  "a remote as a person writes it needs no scheme where the domain says the rest, `owner/repo` is GitHub, the address of a branch's page is the repository and the branch, and a path on this computer is still no remote",
  () => {
    const read = (text: string, kinds: Readonly<Record<string, HostKind>> = {}) => {
      const r = readRemote(text, kinds);
      if (r.kind === "err") throw new Error(`${text}: ${describeRemoteError(r.error)}`);
      return r.value;
    };
    const hello = { kind: "Github", host: "github.com", path: ["octocat", "Hello-World"] } as const;
    for (const f of [
      "github.com/octocat/Hello-World",
      "GitHub.com/octocat/Hello-World.git",
      "octocat/Hello-World",
      "github:octocat/Hello-World",
      "https://github.com/octocat/Hello-World.git",
      "git@github.com:octocat/Hello-World.git",
      "github.com:octocat/Hello-World",
    ])
      assertEquals(read(f), { ref: hello }, f);
    assertEquals(read("github.com/octocat/Hello-World/tree/main"), { ref: hello, branch: "main" });
    assertEquals(read("https://github.com/octocat/Hello-World/blob/dev/README.md"), { ref: hello, branch: "dev" });
    assertEquals(read("gitlab.com/gitlab-org/ci-cd/runner"), {
      ref: { kind: "Gitlab", host: "gitlab.com", path: ["gitlab-org", "ci-cd", "runner"] },
    });
    assertEquals(read("gitlab:gitlab-org/ci-cd/runner"), read("gitlab.com/gitlab-org/ci-cd/runner"));
    assertEquals(read("https://gitlab.com/g/s/r/-/tree/feature"), {
      ref: { kind: "Gitlab", host: "gitlab.com", path: ["g", "s", "r"] },
      branch: "feature",
    });
    assertEquals(read("gitlab.example.com/team/sub/app", { "gitlab.example.com": "Gitlab" }).ref.kind, "Gitlab");
    assertEquals(read("gitlab.example.com/team/app").ref.kind, "Git");
    assertEquals(read("bitbucket.org/atlassian/repo").ref, { kind: "Git", host: "bitbucket.org", path: ["atlassian", "repo"] });
    assertEquals(read("https://user:secret@github.com/octocat/Hello-World"), { ref: hello });
    for (const f of ["/tmp/x", "./x/y", "~/x", "C:\\src\\x", "file:///tmp/x", "", "github.com/octocat", "octocat"])
      assert(readRemote(f).kind === "err", f);
  },
);
