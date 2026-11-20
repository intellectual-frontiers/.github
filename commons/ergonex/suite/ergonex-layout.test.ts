/**
 * Tests of the layout of the workspace (commons 0002-workspace-model FR-001, FR-006 to FR-008, FR-019, FR-020): a repository is at `<git-host>/<path...>/<repo>` and mirrors its remote in both
 * directions, a worktree is at `.worktrees/<git-host>/<path...>/<repo>/<branch-slug>` and is wanted only where another worker or uncommitted work is on the repository, a host or segment
 * named like a folder of the workspace is refused, and a path deeper than the manager offers is refused naming both. Pure: no program and no file.
 *
 * @module
 */
import fc from "fast-check";
import { parseRemote } from "@intellectual-frontiers/githost";
import type { RepoRef } from "@intellectual-frontiers/githost";
import {
  describeLayoutError,
  gitHostOf,
  homeOf,
  refOfPath,
  repoPathOf,
  slugOf,
  WORKSPACE_FOLDERS,
  worktreePathOf,
  worktreeWanted,
} from "../src/layout.ts";
import { branchName, gitHost, sha, version } from "../src/types.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const ref = (url: string, kinds: Readonly<Record<string, "Gitlab" | "Github">> = {}): RepoRef => {
  const r = parseRemote(url, kinds);
  if (r.kind === "err") throw new Error(url);
  return r.value;
};
const pathOf = (r: RepoRef): string => {
  const p = repoPathOf(r);
  return p.kind === "ok" ? p.value : `error:${p.error.kind}`;
};

proves(
  ["0002-workspace-model FR-006"],
  "a repository is at the host in lower case, then the path of its remote as the host writes it",
  () => {
    assertEquals(pathOf(ref("git@GitHub.com:Octo/Hello.git")), "github.com/Octo/Hello");
    assertEquals(pathOf(ref("https://github.com/octo/hello")), "github.com/octo/hello");
    assertEquals(pathOf(ref("https://gitlab.com/group/sub/deep/proj.git")), "gitlab.com/group/sub/deep/proj");
    assertEquals(pathOf(ref("ssh://git@git.example.org:2222/team/tool.git")), "git.example.org/team/tool");
    assertEquals(
      pathOf(
        ref("https://gitlab.example.org/a/b/c", {
          "gitlab.example.org": "Gitlab",
        }),
      ),
      "gitlab.example.org/a/b/c",
    );
    // the remote of a path is the path's mirror, and the two are inverses
    for (const url of ["https://github.com/octo/hello", "https://gitlab.com/g/s1/s2/p", "https://git.example.org/t/x"]) {
      const r = ref(url);
      const p = repoPathOf(r);
      assert(p.kind === "ok");
      if (p.kind === "ok") assertEquals(refOfPath(p.value), { kind: "ok", value: r }, url);
    }
    // a self-managed GitLab is the manifest's word for the host, not a guess from the path
    const p = repoPathOf(ref("https://gitlab.example.org/a/b"));
    assertEquals(p.kind === "ok" ? refOfPath(p.value, { "gitlab.example.org": "Gitlab" }) : undefined, {
      kind: "ok",
      value: { kind: "Gitlab", host: "gitlab.example.org", path: ["a", "b"] },
    });
    assertEquals(refOfPath("github.com/octo" as never).kind, "err");
    assertEquals(refOfPath(".worktrees/github.com/o/r/x" as never).kind, "err");
    assertEquals(refOfPath(".ergonex/a/b/c" as never).kind, "err");
    // a host is a Git host type, lower-cased
    const lowered = gitHost("GitHub.COM");
    const name: string = lowered.kind === "ok" ? lowered.value : "";
    assertEquals(name, "github.com");
    assertEquals(gitHost("github.com:443").kind, "err");
    assertEquals(gitHost("git hub.com").kind, "err");
    assertEquals(gitHost("").kind, "err");
    assertEquals(gitHost("a..b").kind, "err");
    assertEquals(gitHost("xn--bcher-kva.example").kind, "ok");
    assertEquals(gitHost("bücher.example").kind, "err");
  },
);

proves(
  ["0002-workspace-model FR-006"],
  "the path of a repository is a property of its remote: any valid remote that is accepted maps back to itself",
  () => {
    const word = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,10}$/);
    fc.assert(
      fc.property(
        fc.constantFrom("github.com", "gitlab.com", "git.example.org"),
        fc.array(word, { minLength: 2, maxLength: 4 }),
        (host, path) => {
          const r: RepoRef = {
            kind: host === "github.com" ? "Github" : host === "gitlab.com" ? "Gitlab" : "Git",
            host,
            path,
          };
          const p = repoPathOf(r);
          if (p.kind === "err") return; // refused for a device name, a workspace folder or a depth: asserted in the next tests
          assertEquals(p.value, [host, ...path].join("/"));
          assertEquals(refOfPath(p.value, host === "git.example.org" ? {} : {}), { kind: "ok", value: r });
        },
      ),
      { numRuns: 400 },
    );
  },
);

proves(["0002-workspace-model FR-007"], "a worktree is at `.worktrees/<git-host>/<path...>/<repo>/<branch-slug>`", () => {
  const r = ref("https://github.com/octo/hello.git");
  const wt = worktreePathOf(r, "issue-10/ergonex-core");
  assertEquals(wt.kind === "ok" ? wt.value : "", ".worktrees/github.com/octo/hello/issue-10-ergonex-core");
  const g = worktreePathOf(ref("https://gitlab.com/g/s/p"), "main");
  assertEquals(g.kind === "ok" ? g.value : "", ".worktrees/gitlab.com/g/s/p/main");
  // a slug has no character Windows refuses, no trailing dot or space, no repeated dash
  const slug = (b: string): string => {
    const s = slugOf(b);
    return s.kind === "ok" ? s.value : `error:${s.error.kind}`;
  };
  assertEquals(slug("feature/x."), "feature-x");
  assertEquals(slug("a:b"), "a-b");
  assertEquals(slug("fix//a  b"), "fix-a-b");
  assertEquals(slug("release/1.2.0"), "release-1.2.0");
  assertEquals(slug('a<b>c|d?e*f"g\\h'), "a-b-c-d-e-f-g-h");
  assertEquals(slug("con"), "con_");
  assertEquals(slug("aux.txt"), "aux_.txt");
  assertEquals(slug("///"), "error:empty");
  assertEquals(slug("e\u0301cole"), "\u00e9cole");
  assertEquals(slug("x".repeat(300)), "error:too-long");
  // a branch name that Git itself refuses is not a branch
  for (const bad of [
    "a..b",
    "a b",
    "a:b",
    "x.",
    "-x",
    "x.lock",
    "a@{b",
    "a~b",
    "a^b",
    "a?b",
    "a*b",
    "a[b",
    "a\\b",
    "/a",
    "a/",
    "a//b",
    ".a",
    "a/.b",
    "@",
    "",
  ]) {
    assertEquals(branchName(bad).kind, "err", JSON.stringify(bad));
  }
  for (const ok of ["main", "issue-10/x", "release/1.2.0", "a@b", "feat_x", "日本"]) assertEquals(branchName(ok).kind, "ok", ok);
  assertEquals(worktreePathOf(r, "").kind, "err");
});

proves(
  ["0002-workspace-model FR-007"],
  "a worktree is made only where another person or agent, or uncommitted work, is on the repository",
  () => {
    assertEquals(worktreeWanted({ uncommittedWork: false, otherWorker: false }), false);
    assertEquals(worktreeWanted({ uncommittedWork: true, otherWorker: false }), true);
    assertEquals(worktreeWanted({ uncommittedWork: false, otherWorker: true }), true);
    assertEquals(worktreeWanted({ uncommittedWork: true, otherWorker: true }), true);
  },
);

proves(["0002-workspace-model FR-008"], "a host or a path segment named like a folder of the workspace is refused, and named", () => {
  assertEquals([...WORKSPACE_FOLDERS].sort(), [".ergonex", ".git", ".worktrees"]);
  for (const name of WORKSPACE_FOLDERS) {
    for (const spelling of [name, name.toUpperCase()]) {
      const asRepo = repoPathOf({
        kind: "Git",
        host: "git.example.org",
        path: ["team", spelling],
      });
      assertEquals(asRepo.kind === "err" ? asRepo.error.kind : "ok", "workspace-folder", spelling);
      const asOwner = repoPathOf({
        kind: "Git",
        host: "git.example.org",
        path: [spelling, "tool"],
      });
      assertEquals(asOwner.kind === "err" ? asOwner.error.kind : "ok", "workspace-folder", spelling);
      const asHost = gitHostOf({
        kind: "Git",
        host: spelling,
        path: ["a", "b"],
      });
      assert(asHost.kind === "err", spelling);
      const wt = worktreePathOf({ kind: "Git", host: "git.example.org", path: [spelling, "tool"] }, "main");
      assertEquals(wt.kind === "err" ? wt.error.kind : "ok", "workspace-folder", spelling);
    }
  }
  const e = repoPathOf({
    kind: "Git",
    host: "h.example",
    path: ["a", ".worktrees"],
  });
  assert(e.kind === "err" && describeLayoutError(e.error).includes('".worktrees"'));
  // names that merely start like one are fine
  assertEquals(repoPathOf({ kind: "Git", host: "h.example", path: ["a", ".github"] }).kind, "ok");
  assertEquals(repoPathOf({ kind: "Git", host: "h.example", path: ["a", ".git-tools"] }).kind, "ok");
});

proves(
  ["0002-workspace-model FR-020", "0002-workspace-model FR-017"],
  "a path deeper than the manager offers is refused naming the manager and the path, and GitLab alone has no depth limit",
  () => {
    const deep = (kind: "Github" | "Gitlab" | "Git", host: string): RepoRef => ({ kind, host, path: ["g", "s1", "s2", "p"] });
    const gh = repoPathOf(deep("Github", "github.com"));
    assertEquals(gh, {
      kind: "err",
      error: {
        kind: "too-deep",
        manager: "Github",
        path: ["g", "s1", "s2", "p"],
        limit: 2,
      },
    });
    assert(gh.kind === "err" && describeLayoutError(gh.error).includes("Github") && describeLayoutError(gh.error).includes("g/s1/s2/p"));
    assertEquals(repoPathOf(deep("Git", "git.example.org")).kind, "err");
    assertEquals(repoPathOf({ kind: "Github", host: "github.com", path: ["a", "b", "c"] }).kind, "err");
    assertEquals(repoPathOf({ kind: "Github", host: "github.com", path: ["a", "b"] }).kind, "ok");
    assertEquals(pathOf(deep("Gitlab", "gitlab.com")), "gitlab.com/g/s1/s2/p");
    assertEquals(
      repoPathOf({
        kind: "Gitlab",
        host: "gitlab.com",
        path: Array.from({ length: 12 }, (_, i) => `g${i}`),
      }).kind,
      "ok",
    );
    assertEquals(repoPathOf({ kind: "Github", host: "github.com", path: ["only"] }).kind, "err");
  },
);

proves(
  ["0002-workspace-model FR-009"],
  "a repository named like a Windows device is refused naming the device, whichever way the remote writes it",
  () => {
    for (const url of [
      "https://github.com/octo/con",
      "https://github.com/octo/aux.git",
      "git@github.com:octo/NUL.git",
      "https://github.com/COM1/x",
    ]) {
      const p = repoPathOf(ref(url));
      assertEquals(p.kind === "err" ? p.error.kind : "ok", "portable", url);
      assert(p.kind === "err" && /device name/.test(describeLayoutError(p.error)), url);
    }
  },
);

proves(
  ["0002-workspace-model FR-001"],
  "the root is --home, else $ERGONEX_HOME, else $HOME/workspaces (%USERPROFILE%\\workspaces on Windows)",
  () => {
    assertEquals(
      homeOf({
        windows: false,
        home: "/home/a",
        workspacesHome: "/data/ws",
        override: "/tmp/x",
      }),
      {
        kind: "ok",
        value: "/tmp/x",
      },
    );
    assertEquals(homeOf({ windows: false, home: "/home/a", workspacesHome: "/data/ws" }), { kind: "ok", value: "/data/ws" });
    assertEquals(homeOf({ windows: false, home: "/home/a/" }), {
      kind: "ok",
      value: "/home/a/workspaces",
    });
    assertEquals(homeOf({ windows: true, home: "C:\\Users\\a" }), {
      kind: "ok",
      value: "C:\\Users\\a\\workspaces",
    });
    assertEquals(homeOf({ windows: false, home: "/home/a", workspacesHome: "  " }), { kind: "ok", value: "/home/a/workspaces" });
    assertEquals(homeOf({ windows: false }), {
      kind: "err",
      error: { kind: "no-home" },
    });
  },
);

proves(["0002-workspace-model FR-037"], "a pinned version is major.minor.patch, never latest and never a range", () => {
  for (const ok of ["1.2.3", "0.0.1", "20.11.0", "1.2.3-rc.1", "1.2.3+build.5", "1.2.3-beta.2+sha.5114f85"])
    assertEquals(version(ok).kind, "ok", ok);
  for (const bad of [
    "latest",
    "1",
    "1.2",
    "1.x",
    "^1.2.3",
    "~1.2.3",
    ">=1.2.3",
    "1.2.3 - 2.0.0",
    "v1.2.3",
    "",
    "*",
    "1.2.3||2.0.0",
    "01.2.3",
  ]) {
    assertEquals(version(bad).kind, "err", JSON.stringify(bad));
  }
  assertEquals(sha("a".repeat(40)).kind, "ok");
  assertEquals(sha("a".repeat(64)).kind, "ok");
  assertEquals(sha("A".repeat(40)).kind, "err");
  assertEquals(sha("a".repeat(39)).kind, "err");
});
