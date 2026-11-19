/**
 * Tests of the typed manifest (commons 0003-host FR-001, 0002-workspace-model FR-011, FR-019, FR-020): it is decoded once by the kernel's decoder, and every field that is wrong is reported with its
 * place; two remotes whose paths differ only in case or in Unicode normalization are both refused and named; a path deeper than the host's manager offers is refused; a self-managed GitLab is the
 * manifest's word. Pure: the manifest is a value.
 *
 * @module
 */
import { decodeManifest, issueFinding, type ManifestIssue } from "../src/manifest.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const issues = (input: unknown): readonly ManifestIssue[] => {
  const r = decodeManifest(input);
  return r.kind === "err" ? r.error : [];
};
const rules = (input: unknown): string[] => issues(input).map((i) => `${i.rule} ${i.path}`);

proves(["0003-host FR-001"], "a manifest decodes into typed repositories with their paths, clone URLs, branches and worktrees", () => {
  const r = decodeManifest({
    repositories: [
      {
        remote: "git@github.com:octo/hello.git",
        branch: "main",
        group: "core",
        worktrees: ["issue-10/x"],
      },
      { remote: "https://gitlab.com/g/s/deep/proj" },
      { remote: "https://git.example.org/team/tool.git" },
    ],
    identity: { name: "A Person", email: "a@example.org" },
  });
  assert(r.kind === "ok");
  if (r.kind !== "ok") return;
  assertEquals(
    r.value.repositories.map((x) => [x.path, x.cloneUrl, x.ref.kind]),
    [
      ["github.com/octo/hello", "https://github.com/octo/hello.git", "Github"],
      ["gitlab.com/g/s/deep/proj", "https://gitlab.com/g/s/deep/proj.git", "Gitlab"],
      ["git.example.org/team/tool", "https://git.example.org/team/tool.git", "Git"],
    ],
  );
  assertEquals(r.value.repositories[0]?.branch, "main");
  assertEquals(r.value.repositories[0]?.group, "core");
  assertEquals(
    r.value.repositories[0]?.worktrees.map((w) => [w.branch, w.path]),
    [["issue-10/x", ".worktrees/github.com/octo/hello/issue-10-x"]],
  );
  assertEquals(r.value.identity, {
    name: "A Person",
    email: "a@example.org",
  });
  assertEquals(r.value.policy.requiresSignedCommits, false);
  assertEquals(r.value.policy.unapprovedGraceDays, 90);
});

proves(
  ["0003-host FR-001"],
  "a manifest that does not decode is reported with the path of each field that is wrong, and nothing is guessed",
  () => {
    assertEquals(rules(null), ["ergonex/manifest-shape $"]);
    assertEquals(rules({}), ["ergonex/manifest-shape $.repositories"]);
    assertEquals(rules({ repositories: [{ remote: 3 }] }), ["ergonex/manifest-shape $.repositories[0].remote"]);
    assertEquals(rules({ repositories: [], policy: { regulatedDomain: "x" } }), ["ergonex/manifest-shape $.policy.regulatedDomain"]);
    assertEquals(
      rules({
        repositories: [
          { remote: "" },
          { remote: "/srv/repo.git" },
          { remote: "ftp://h/a/b" },
          { remote: "https://github.com/only" },
          { remote: "https://github.com/a/b", branch: "a..b" },
        ],
      }),
      [
        "ergonex/manifest-remote $.repositories[0].remote",
        "ergonex/manifest-remote $.repositories[1].remote",
        "ergonex/manifest-remote $.repositories[2].remote",
        "ergonex/manifest-remote $.repositories[3].remote",
        "ergonex/manifest-branch $.repositories[4].branch",
      ],
    );
    assertEquals(
      rules({
        repositories: [{ remote: "https://github.com/a/b", worktrees: ["ok", "bad branch"] }],
      }),
      ["ergonex/manifest-branch $.repositories[0].worktrees[1]"],
    );
    const f = issueFinding(issues(null)[0] as ManifestIssue, "2026-11-17");
    assertEquals([f.severity, f.ruleId, f.subject, f.firstSeen], ["Error", "ergonex/manifest-shape", "$", "2026-11-17"]);
  },
);

proves(
  ["0002-workspace-model FR-011"],
  "two remotes whose paths differ only in case, or in normalization, are both refused and each names the other, on every file system",
  () => {
    const found = issues({
      repositories: [
        { remote: "https://github.com/Org/tool" },
        { remote: "https://github.com/org/tool" },
        { remote: "https://github.com/org/fine" },
        { remote: "https://gitlab.com/g/école" },
        { remote: "https://gitlab.com/g/École" },
      ],
    });
    // the NFD spelling is refused as a name before it can collide; the others collide
    assertEquals(
      found.map((i) => `${i.rule} ${i.path}`),
      [
        "ergonex/manifest-path $.repositories[3].remote",
        "ergonex/path-collision $.repositories[0].remote",
        "ergonex/path-collision $.repositories[1].remote",
      ],
    );
    const a = found.find((i) => i.path === "$.repositories[0].remote");
    assert(
      a !== undefined &&
        a.message.includes("github.com/Org/tool") &&
        a.message.includes("github.com/org/tool") &&
        a.message.includes("$.repositories[1].remote"),
    );
    const nfc = issues({
      repositories: [{ remote: "https://gitlab.com/g/café" }, { remote: "https://gitlab.com/g/CAFÉ" }],
    });
    assertEquals(
      nfc.map((i) => i.rule),
      ["ergonex/path-collision", "ergonex/path-collision"],
    );
    // the same remote twice, spelled two ways, is the same path
    assertEquals(
      issues({
        repositories: [{ remote: "git@github.com:o/r.git" }, { remote: "https://github.com/o/r" }],
      }).length,
      2,
    );
    // a worktree path that collides with another is refused too
    assertEquals(
      rules({
        repositories: [
          {
            remote: "https://github.com/o/r",
            worktrees: ["Feature/x", "feature/X"],
          },
        ],
      }),
      ["ergonex/path-collision $.repositories[0].worktrees[0]", "ergonex/path-collision $.repositories[0].worktrees[1]"],
    );
  },
);

proves(
  ["0002-workspace-model FR-020", "0002-workspace-model FR-019"],
  "a path deeper than the manager offers is refused, and a self-managed GitLab is the manifest's word",
  () => {
    const deep = {
      repositories: [{ remote: "https://gitlab.example.org/g/s1/s2/p" }],
    };
    // not named: plain Git, which has no nested groups
    const plain = issues(deep);
    assertEquals(
      plain.map((i) => i.rule),
      ["ergonex/manifest-path"],
    );
    assert(plain[0]?.message.includes("Git") && plain[0]?.message.includes("g/s1/s2/p"));
    const named = decodeManifest({
      ...deep,
      gitlabHosts: ["gitlab.example.org"],
    });
    assert(named.kind === "ok");
    assertEquals(named.kind === "ok" ? [named.value.repositories[0]?.ref.kind, named.value.repositories[0]?.path] : [], [
      "Gitlab",
      "gitlab.example.org/g/s1/s2/p",
    ]);
    // the same path on GitHub: refused
    assertEquals(rules({ repositories: [{ remote: "https://github.com/g/s1/p" }] }), ["ergonex/manifest-path $.repositories[0].remote"]);
    // a GitLab host that is not a host name, and GitHub named as GitLab, are told
    assertEquals(rules({ repositories: [], gitlabHosts: ["git lab"] }), ["ergonex/manifest-host $.gitlabHosts[0]"]);
    assertEquals(rules({ repositories: [], gitlabHosts: ["github.com"] }), ["ergonex/manifest-host $.gitlabHosts[0]"]);
  },
);

proves(
  ["0002-workspace-model FR-008", "0002-workspace-model FR-009"],
  "a remote that names a folder of the workspace or a Windows device is refused naming it",
  () => {
    const msgs = issues({
      repositories: [
        { remote: "https://github.com/octo/.worktrees" },
        { remote: "https://github.com/octo/con" },
        { remote: "https://github.com/octo/aux.git" },
        { remote: "https://github.com/.git/x" },
      ],
    }).map((i) => i.message);
    assertEquals(msgs.length, 4);
    assert(msgs[0]?.includes(".worktrees"));
    assert(msgs[1]?.includes("CON"));
    assert(msgs[2]?.includes("AUX"));
    assert(msgs[3]?.includes(".git"));
  },
);

proves(
  ["0002-workspace-model FR-032"],
  "a regulated domain makes the policy require signed commits, and the policy limits the hosts",
  () => {
    const r = decodeManifest({
      repositories: [{ remote: "https://github.com/o/r" }],
      policy: { regulatedDomain: ["MedicalDevices"] },
    });
    assertEquals(r.kind === "ok" ? [r.value.policy.requiresSignedCommits, r.value.policy.regulatedDomain] : [], [true, ["MedicalDevices"]]);
    assertEquals(
      rules({
        repositories: [{ remote: "https://git.example.org/a/b" }],
        policy: { allowedGitHost: ["github.com", "gitlab.com"] },
      }),
      ["ergonex/host-not-allowed $.repositories[0].remote"],
    );
    assertEquals(
      rules({
        repositories: [{ remote: "https://GitHub.com/a/b" }],
        policy: { allowedGitHost: ["github.com"] },
      }),
      [],
    );
  },
);

proves(
  ["0003-host FR-001"],
  "a remote in the manifest needs no https:// where the domain says the rest, `owner/repo` is GitHub, and the address of a branch's page names the repository and its branch unless the entry names one",
  () => {
    const r = decodeManifest({
      repositories: [
        { remote: "github.com/octo/hello" },
        { remote: "gitlab.com/g/s/deep/proj/-/tree/feature" },
        { remote: "octo/other" },
        { remote: "github.com/octo/third/tree/dev", branch: "main" },
      ],
    });
    assert(r.kind === "ok");
    if (r.kind !== "ok") return;
    assertEquals(
      r.value.repositories.map((x) => [x.path, x.cloneUrl, x.branch]),
      [
        ["github.com/octo/hello", "https://github.com/octo/hello.git", undefined],
        ["gitlab.com/g/s/deep/proj", "https://gitlab.com/g/s/deep/proj.git", "feature"],
        ["github.com/octo/other", "https://github.com/octo/other.git", undefined],
        ["github.com/octo/third", "https://github.com/octo/third.git", "main"],
      ],
    );
  },
);
