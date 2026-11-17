/**
 * Tests of the policy scans of IF Workspaces (commons 0023-if-workspaces FR-003, FR-031, FR-032, FR-033, 0025-ifws FR-011): the plaintext-token scan of managed files and local Git configuration,
 * the boundary of the root with a hostile manifest, the module-source rule and the signed-commits policy. The secrets in these tests are ASSEMBLED here from pieces so that no token of any shape
 * stands in this repository, and every one is a made-up value that no host ever issued. The signature letters come from the real `git log` over real commits, signed by an SSH key that the real
 * `ssh-keygen` makes where it is installed (the test is skipped, with the reason, where it is not). A real GPG key is not made (OpenPGP signing is Git's, the letters are the same).
 *
 * @module
 */
import { mkdir, makeTempDir, remove, symlink, writeTextFile, withTempDir } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { build } from "../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { forbiddenRead, isInside, readablePath, resolveInside } from "../workspaces/scan/boundary.ts";
import { commitSignatures, gitConfigFilesOf, modulesOnPath, readInside, scanRoot } from "../workspaces/scan/host/scan.ts";
import { moduleSourceFindings, signedCommitFindings, signatureLetter, type FoundModule } from "../workspaces/scan/policy-scans.ts";
import { isPlaceholder, scanFiles, scanText, secretFinding, secretsInLine } from "../workspaces/scan/secrets.ts";
import { decodeManifest } from "../workspaces/manifest.ts";
import { policyOf } from "../workspaces/policy.ts";
import { catalogOf, pinned, tarball } from "./ifws-tools-fixtures.ts";
import { git, needsGit, needsSshKeygen, nextCommit, repositoryWithCommit, sshSigning } from "./quality-fixtures.ts";

// made-up tokens, assembled so that no complete token is written in this file
const ghp = (): string => ["ghp", "_", "aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6"].join("");
const pat = (): string =>
  ["github_pat", "_", "11ABCDEFG0abcdefghij12", "_", "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV"].join("");
const glpat = (): string => ["glpat", "-", "aB3dE6gH9jK2mN5pQ8sT"].join("");
const pem = (kind: string): string => ["-----BEGIN", kind, "PRIVATE KEY-----"].join(" ");
const password = (): string => ["pw", "-", "Zx81QmLk"].join("");
const TODAY = "2026-11-17";

proves(
  ["0023-if-workspaces FR-031"],
  "the scan finds GitHub and GitLab tokens, private key blocks, a credential in a URL and an authorization header, each with its file and line",
  () => {
    const lines = [
      "name = ok",
      `token = ${ghp()}`,
      `token = ${pat()}`,
      `token: ${glpat()}`,
      pem("OPENSSH"),
      pem("RSA"),
      `url = https://octo:${password()}@github.com/octo/repo.git`,
      `url = https://${ghp()}@github.com/octo/repo.git`,
      `extraheader = Authorization: Bearer ${["abc", "DEF", "123", "xyz", "789"].join("")}`,
      `PRIVATE-TOKEN: ${["tok", "en", "Value", "12345"].join("")}`,
    ];
    const hits = scanText("workspace.ts", lines.join("\n"));
    assertEquals(
      hits.map((h) => [h.line, h.kind]),
      [
        [2, "github-token"],
        [3, "github-token"],
        [4, "gitlab-token"],
        [5, "private-key"],
        [6, "private-key"],
        [7, "url-credential"],
        [8, "github-token"],
        [8, "url-credential"],
        [9, "authorization-header"],
        [10, "authorization-header"],
      ],
    );
    assert(hits.every((h) => h.file === "workspace.ts"));
  },
);

proves(
  ["0023-if-workspaces FR-031"],
  "a finding is an error naming the file and the line, and never holds the secret, not a character of it",
  () => {
    const secrets = [ghp(), pat(), glpat(), password()];
    const text = [`a = ${ghp()}`, `b = ${pat()}`, `c = ${glpat()}`, `url = https://u:${password()}@host.example/x.git`].join("\n");
    const findings = scanFiles([{ file: "repo/.git/config", text }], TODAY);
    assertEquals(findings.length, 4);
    for (const [i, f] of findings.entries()) {
      assertEquals([f.severity, f.ruleId, f.subject, f.firstSeen], ["Error", "ifws/plaintext-token", `repo/.git/config:${i + 1}`, TODAY]);
      assertStringIncludes(f.message, `repo/.git/config:${i + 1}`);
      for (const s of secrets) {
        assert(!JSON.stringify(f).includes(s), "the finding holds the secret");
        // not even a long part of it
        for (let at = 0; at + 8 <= s.length; at += 4)
          assert(!JSON.stringify(f).includes(s.slice(at, at + 8)), "the finding holds part of the secret");
      }
    }
  },
);

proves(["0023-if-workspaces FR-031"], "a placeholder, an environment reference or an ordinary URL is not a secret", () => {
  const clean = [
    "url = https://github.com/octo/repo.git",
    "url = git@github.com:octo/repo.git",
    "url = https://x-access-token:${GITHUB_TOKEN}@github.com/octo/repo.git",
    "url = https://oauth2:$TOKEN@gitlab.example.org/g/r.git",
    "Authorization: Bearer ${GITLAB_TOKEN}",
    "Authorization: Bearer <your token>",
    "token = ghp_",
    "// the token goes in the environment as GITHUB_TOKEN",
    "email = person@example.org",
    "ssh://git@example.org/octo/repo.git",
  ];
  assertEquals(scanText("x", clean.join("\n")), []);
  for (const p of ["${X}", "$X", "%TOKEN%", "<token>", "{{ token }}", "REDACTED", "xxxx", "GITHUB_TOKEN"]) assert(isPlaceholder(p), p);
  assert(!isPlaceholder(password()));
  assertEquals(secretsInLine(`${glpat()} and ${ghp()}`), ["github-token", "gitlab-token"]);
  assertEquals(secretFinding({ file: "f", line: 3, kind: "private-key" }, TODAY).message.includes("a private key"), true);
});

proves(
  ["0023-if-workspaces FR-031"],
  "the scan reads the generated files, the manifest and each repository's local Git configuration inside the root, and finds a token pasted into a remote URL",
  async () => {
    const root = await makeTempDir({ prefix: "ifws-scan-" });
    try {
      await mkdir(join(root, "github.com", "octo", "repo", ".git"), { recursive: true });
      await writeTextFile(
        join(root, "github.com", "octo", "repo", ".git", "config"),
        `[remote "origin"]\n\turl = https://octo:${password()}@github.com/octo/repo.git\n`,
      );
      await writeTextFile(join(root, "workspace.ts"), "export default { repositories: [] };\n");
      await writeTextFile(join(root, "all.auto.code-workspace"), `{ "folders": [] }\n`);
      const files = ["workspace.ts", "all.auto.code-workspace", "lefthook.auto.yml", ...gitConfigFilesOf("github.com/octo/repo")];
      const report = await scanRoot(root, files, TODAY);
      assertEquals(report.scanned, ["workspace.ts", "all.auto.code-workspace", "github.com/octo/repo/.git/config"]);
      assertEquals(
        report.findings.map((f) => [f.severity, f.subject]),
        [["Error", "github.com/octo/repo/.git/config:2"]],
      );
      assert(!JSON.stringify(report).includes(password()), "the report holds the password");
      assertEquals(report.refused, []);
    } finally {
      await remove(root, { recursive: true });
    }
  },
);

proves(
  ["0023-if-workspaces FR-003"],
  "a hostile manifest cannot make IFWS read or write outside the root: absolute paths, `..`, drives, backslashes, the home folder and NUL are refused",
  () => {
    const root = "/home/p/workspaces";
    for (const bad of [
      "/etc/passwd",
      "../x",
      "a/../../x",
      "a/./b",
      "C:/Windows/x",
      "c:x",
      "a\\b",
      "~",
      "~/.ssh/id_ed25519",
      "a//b",
      "",
      "a\0b",
      "a/b/..",
      "..",
    ]) {
      const r = resolveInside(root, bad);
      assert(r.kind === "err" && r.error.kind === "outside", `${JSON.stringify(bad)} should be refused`);
    }
    assertEquals(resolveInside(root, "github.com/octo/repo"), { kind: "ok", value: "/home/p/workspaces/github.com/octo/repo" });
    assertEquals(resolveInside("C:\\w\\root\\", "a/b"), { kind: "ok", value: "C:/w/root/a/b" });
    assert(isInside(root, "/home/p/workspaces/a/b"));
    assert(isInside(root, root));
    assert(!isInside(root, "/home/p/workspaces-evil/a"));
    assert(!isInside(root, "/home/p/workspaces/../other"));
    assert(!isInside(root, "/home/p"));
  },
);

proves(["0023-if-workspaces FR-003"], "no private key, credential store or file of ~/.ssh is ever read, whatever the root", async () => {
  for (const f of [
    "/home/p/.ssh/config",
    "/home/p/.ssh/id_ed25519",
    "C:\\Users\\p\\.ssh\\known_hosts",
    "/home/p/.git-credentials",
    "/home/p/.netrc",
    "/home/p/.gnupg/secring.gpg",
    "/home/p/.aws/credentials",
    "/w/a/server.pem",
    "/w/a/id_rsa",
    "/home/p/.config/gh/hosts.yml",
  ]) {
    assert(forbiddenRead(f) !== undefined, f);
  }
  assertEquals(forbiddenRead("/w/github.com/o/r/README.md"), undefined);
  // a root that is itself the folder of keys still refuses the keys
  const r = readablePath("/home/p/.ssh", "id_ed25519");
  assert(r.kind === "err" && r.error.kind === "forbidden");
  // a manifest's hostile path is refused by the real reader, which reads nothing
  const root = await makeTempDir({ prefix: "ifws-scan-" });
  try {
    await writeTextFile(join(root, "ok.txt"), "fine\n");
    assertEquals(await readInside(root, "ok.txt"), { kind: "ok", value: "fine\n" });
    assertEquals(await readInside(root, "missing.txt"), { kind: "ok", value: undefined });
    for (const bad of ["../outside", "/etc/passwd", ".ssh/config", "x/.ssh/id_rsa"]) {
      const got = await readInside(root, bad);
      assert(got.kind === "err", bad);
    }
  } finally {
    await remove(root, { recursive: true });
  }
});

proves(["0023-if-workspaces FR-003"], "a link inside the root that leads outside it is refused by the reader", async () => {
  if (build.os === "windows") return;
  const root = await makeTempDir({ prefix: "ifws-scan-" });
  const outside = await makeTempDir({ prefix: "ifws-outside-" });
  try {
    await writeTextFile(join(outside, "secret.txt"), "outside\n");
    await symlink(join(outside, "secret.txt"), join(root, "link.txt"));
    await writeTextFile(join(root, "real.txt"), "inside\n");
    await symlink(join(root, "real.txt"), join(root, "inner.txt"));
    const out = await readInside(root, "link.txt");
    assert(out.kind === "err" && out.error.kind === "outside", JSON.stringify(out));
    assertEquals(await readInside(root, "inner.txt"), { kind: "ok", value: "inside\n" });
  } finally {
    await remove(root, { recursive: true });
    await remove(outside, { recursive: true });
  }
});

proves(
  ["0023-if-workspaces FR-003"],
  "a manifest whose paths are hostile is refused as a manifest, so that none of them is ever resolved",
  () => {
    const hostile = decodeManifest({
      repositories: [
        { remote: "https://github.com/octo/repo", worktrees: ["../../etc"] },
        { remote: "https://github.com/../../etc/passwd" },
        { remote: "file:///etc/passwd" },
      ],
    });
    assert(hostile.kind === "err");
    assert(hostile.error.length >= 2);
  },
);

const FIRST = "2026-11-01";

proves(
  ["0023-if-workspaces FR-033", "0025-ifws FR-011"],
  "an ifws-* executable outside the catalog is informational for 90 days and a warning after; one in the catalog or registered with its hash is not a finding",
  async () => {
    const art = tarball("ifws-extra", "1.0.0");
    const tool = await pinned("ifws-extra", "1.0.0", art, "https://example.org/x.tar.gz", "linux", "x64");
    const catalog = catalogOf(tool);
    const modules: FoundModule[] = [
      { name: "ifws-stranger", source: "path", firstSeen: FIRST },
      { name: "ifws-extra", source: "path", firstSeen: FIRST },
      { name: "ifws-hashed", source: "registered-with-hash", firstSeen: FIRST },
      { name: "ifws-loose", source: "registered", firstSeen: FIRST },
    ];
    const early = moduleSourceFindings(catalog, modules, "2026-11-17");
    assertEquals(
      early.map((f) => [f.subject, f.severity, f.ruleId]),
      [
        ["ifws-stranger", "Informational", "ifws/module-outside-catalog"],
        ["ifws-loose", "Informational", "ifws/module-outside-catalog"],
      ],
    );
    assertStringIncludes(early[1]?.message ?? "", "registered without its hash");
    assertEquals(
      moduleSourceFindings(catalog, modules, "2027-01-30").map((f) => f.severity),
      ["Informational", "Informational"],
    ); // day 90
    assertEquals(
      moduleSourceFindings(catalog, modules, "2027-01-31").map((f) => f.severity),
      ["Warning", "Warning"],
    ); // day 91
    assertEquals(
      moduleSourceFindings(catalog, modules, "2027-06-01", 365).map((f) => f.severity),
      ["Informational", "Informational"],
    );
  },
);

proves(
  ["0023-if-workspaces FR-033", "0025-ifws FR-011"],
  "ifws-* executables are found on a real PATH, in the order of the path, the first of each name, with the day first seen kept",
  async () => {
    if (build.os === "windows") return;
    const one = await makeTempDir({ prefix: "ifws-path-" });
    const two = await makeTempDir({ prefix: "ifws-path-" });
    try {
      for (const [d, n] of [
        [one, "ifws-alpha"],
        [one, "other-tool"],
        [two, "ifws-alpha"],
        [two, "ifws-beta"],
      ] as const)
        await writeTextFile(join(d, n), "#!/bin/sh\n", { mode: 0o755 });
      const found = modulesOnPath(`${one}:${two}:/no/such/dir`, { "ifws-alpha": "2026-01-01" }, "2026-11-17");
      assertEquals(
        found.map((m) => [m.name, m.source, m.firstSeen]),
        [
          ["ifws-alpha", "path", "2026-01-01"],
          ["ifws-beta", "path", "2026-11-17"],
        ],
      );
    } finally {
      await remove(one, { recursive: true });
      await remove(two, { recursive: true });
    }
  },
);

proves(
  ["0023-if-workspaces FR-032"],
  "an unsigned commit is an error where a regulated domain is named and a warning elsewhere, and a signed and verified one is nothing",
  () => {
    const commits = [
      { repo: "github.com/o/r", commit: "a".repeat(40), letter: "N" as const },
      { repo: "github.com/o/r", commit: "b".repeat(40), letter: "G" as const },
      { repo: "github.com/o/r", commit: "c".repeat(40), letter: "U" as const },
      { repo: "github.com/o/r", commit: "d".repeat(40), letter: "B" as const },
    ];
    const regulated = signedCommitFindings(policyOf({ regulatedDomain: ["medical-device"] }), commits, TODAY);
    assertEquals(
      regulated.map((f) => [f.subject, f.severity]),
      [
        ["github.com/o/r@aaaaaaaaaaaa", "Error"],
        ["github.com/o/r@cccccccccccc", "Error"],
        ["github.com/o/r@dddddddddddd", "Error"],
      ],
    );
    const plain = signedCommitFindings(policyOf({}), commits, TODAY);
    assertEquals(
      plain.map((f) => f.severity),
      ["Warning", "Warning", "Warning"],
    );
    assertStringIncludes(regulated[0]?.message ?? "", "it is not signed");
    assertStringIncludes(regulated[1]?.message ?? "", "not trusted");
    assertEquals(signatureLetter("G"), "G");
    assertEquals(signatureLetter("Z"), undefined);
  },
);

proves(
  ["0023-if-workspaces FR-032"],
  "the signature letters come from real commits: unsigned commits are N, and a commit signed through Git's SSH signing and checked against the allowed signers is G",
  async () => {
    await withTempDir(async (repo) => {
      const first = await repositoryWithCommit(repo);
      const second = await nextCommit(repo, "b.txt");
      const unsigned = await commitSignatures(repo);
      assert(unsigned.kind === "ok");
      assertEquals(
        unsigned.value.map((c) => [c.commit, c.letter]),
        [
          [second, "N"],
          [first, "N"],
        ],
      );
      const findings = signedCommitFindings(policyOf({ regulatedDomain: ["medical-device"] }), unsigned.value, TODAY);
      assertEquals(
        findings.map((f) => f.severity),
        ["Error", "Error"],
      );
      assert((await commitSignatures(repo, "no-such-ref")).kind === "err");
    });
  },
  { ...needsGit },
);

proves(
  ["0023-if-workspaces FR-032"],
  "a commit signed with an SSH key is read as G, and the same repository's unsigned commit still warns",
  async () => {
    await withTempDir(async (repo) => {
      await withTempDir(async (keys) => {
        await repositoryWithCommit(repo);
        const allowed = await sshSigning(repo, keys);
        await git(repo, "config", "gpg.ssh.allowedSignersFile", allowed);
        await writeTextFile(join(repo, "signed.txt"), "s\n");
        await git(repo, "add", "-A");
        await git(repo, "commit", "-q", "-S", "-m", "signed");
        const signed = await git(repo, "rev-parse", "HEAD");
        const got = await commitSignatures(repo);
        assert(got.kind === "ok");
        assertEquals(
          got.value.map((c) => c.letter),
          ["G", "N"],
        );
        assertEquals(got.value[0]?.commit, signed);
        assertEquals(
          signedCommitFindings(policyOf({}), got.value, TODAY).map((f) => f.severity),
          ["Warning"],
        );
      });
    });
  },
  { ...needsSshKeygen },
);
