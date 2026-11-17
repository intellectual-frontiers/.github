/**
 * Tests of the typed templates and the generated files (commons 0024-ifws-host FR-003 to FR-008, FR-014, FR-015, FR-022, FR-023, 0023-if-workspaces FR-013): a manifest is decoded, the templates run on
 * it, and the files they give are read as bytes: their paths, their headers, their one final newline, the relative paths of a `*.auto.code-workspace` file, the guide an agent is given, the hooks as
 * `sh` scripts that `sh -n` accepts, and the same bytes for the same data. A real `sh` runs each hook with no `ifws` on the `PATH`, and a regulated manifest's hook fails where the other's lets the
 * commit pass. Nothing here is a stand-in: the manifest is the real decoder's, the files are the real templates', the shell is the system's.
 *
 * @module
 */
import { mkdir, readDirSync, readTextFileSync, withTempDir, writeTextFile } from "../runtime/fs.ts";
import { dirname, fromFileUrl, join, resolve } from "../runtime/path.ts";
import { build, run, which } from "../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { settingsOf } from "../workspaces/desired.ts";
import { decodeManifest, type Manifest } from "../workspaces/manifest.ts";
import { checkFiles, generated, headerText } from "../workspaces/render.ts";
import { renderAll, type TemplateData } from "../workspaces/templates/mod.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const skipSh =
  which("sh") === undefined || build.os === "windows"
    ? { skip: "sh is not installed, or this is Windows, where Git for Windows runs the hooks and the tests here do not" }
    : {};

function manifestOf(input: unknown): Manifest {
  const r = decodeManifest(input);
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  return r.value;
}

const BASE = {
  repositories: [
    { remote: "https://github.com/acme/app", group: "core" },
    { remote: "git@github.com:acme/lib.git", group: "core" },
    { remote: "https://gitlab.com/team/sub/deep/tool", group: "tools" },
    { remote: "https://github.com/acme/loose" },
  ],
  modules: [{ name: "hello", program: "/opt/ifws-hello" }],
};

function dataOf(input: unknown, direnv = false): TemplateData {
  return { manifest: manifestOf(input), direnv, tools: [] };
}

function filesOf(data: TemplateData): Map<string, { content: string; mode: string }> {
  const r = renderAll(data);
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  return new Map(r.value.map((f) => [f.path, { content: f.content, mode: f.mode }]));
}

proves(
  ["0024-ifws-host FR-005", "0024-ifws-host FR-006", "0023-if-workspaces FR-013"],
  "the templates make a code-workspace file for each group, listing its folders by relative paths with / between segments, and no symbolic link",
  () => {
    const files = filesOf(dataOf(BASE));
    assertEquals(
      [...files.keys()].filter((p) => p.endsWith(".code-workspace")),
      ["core.auto.code-workspace", "tools.auto.code-workspace"],
    );
    const core = JSON.parse(files.get("core.auto.code-workspace")?.content ?? "{}") as { folders: { name: string; path: string }[] };
    assertEquals(core.folders, [
      { name: "app", path: "github.com/acme/app" },
      { name: "lib", path: "github.com/acme/lib" },
    ]);
    const tools = JSON.parse(files.get("tools.auto.code-workspace")?.content ?? "{}") as { folders: { name: string; path: string }[] };
    assertEquals(tools.folders, [{ name: "tool", path: "gitlab.com/team/sub/deep/tool" }]);
    for (const f of [core, tools])
      for (const folder of f.folders) {
        assert(!folder.path.includes("\\") && !folder.path.startsWith("/") && !folder.path.includes(".."), folder.path);
      }
    // the ungrouped repository is in no group's file, and the files are plain files: the code names no symbolic link
    assert(!(files.get("core.auto.code-workspace")?.content ?? "").includes("github.com/acme/loose"));
    const source = readDirSync(join(ROOT, "workspaces/templates"))
      .map((e) => readTextFileSync(join(ROOT, "workspaces/templates", e.name)))
      .join("\n");
    assert(
      !/\bsymlink\b|symlinkSync|\bsymbolic link\b.*\bmake/.test(source.replace(/\/\*[\s\S]*?\*\//g, "")),
      "a template makes a symbolic link",
    );
  },
);

proves(
  ["0024-ifws-host FR-005", "0024-ifws-host FR-014", "0024-ifws-host FR-022"],
  "the templates make the guide, the registered modules, the resolved tools, the hooks and the lefthook file, each with its generator in its header",
  () => {
    const files = filesOf(dataOf(BASE));
    assertEquals([...files.keys()].sort(), [
      ".if-workspaces/hooks/commit-msg",
      ".if-workspaces/hooks/pre-commit",
      ".if-workspaces/hooks/pre-push",
      ".if-workspaces/modules.auto.json",
      ".if-workspaces/tools.auto.json",
      "AGENTS.auto.md",
      "core.auto.code-workspace",
      "lefthook.auto.yml",
      "tools.auto.code-workspace",
    ]);
    for (const [path, f] of files) assertStringIncludes(f.content, "Generated by ifws templates/", path);
    assertStringIncludes(files.get("AGENTS.auto.md")?.content ?? "", "<!-- Generated by ifws templates/agents.");
    assertStringIncludes(files.get("lefthook.auto.yml")?.content ?? "", "# Generated by ifws templates/lefthook.");
    const modules = JSON.parse(files.get(".if-workspaces/modules.auto.json")?.content ?? "{}") as {
      _generated: string;
      modules: { name: string }[];
    };
    assertStringIncludes(modules._generated, "Do not edit by hand");
    assertEquals(
      modules.modules.map((m) => m.name),
      ["hello"],
    );
    // a JSON file's header is its first member
    assert((files.get(".if-workspaces/tools.auto.json")?.content ?? "").startsWith('{\n  "_generated"'));
    for (const name of ["pre-commit", "commit-msg", "pre-push"]) assertEquals(files.get(`.if-workspaces/hooks/${name}`)?.mode, "0755");
    assertEquals(files.get("AGENTS.auto.md")?.mode, "0644");
  },
);

proves(
  ["0024-ifws-host FR-022"],
  "the guide tells an agent the layout, the rules and the commands from the manifest, with no secret and no absolute path of the computer",
  () => {
    const text = filesOf(dataOf(BASE)).get("AGENTS.auto.md")?.content ?? "";
    for (const w of [
      "plan before apply",
      "Fast-forward only",
      "One issue for every commit",
      "No credential in a file",
      "ifws status",
      "ifws worktree",
    ]) {
      assertStringIncludes(text.toLowerCase(), w.toLowerCase());
    }
    assertStringIncludes(text, "`github.com/acme/app`");
    assertStringIncludes(text, "`gitlab.com/team/sub/deep/tool`");
    assert(!/(\/home\/|\/Users\/|[A-Z]:\\|\/tmp\/|ghp_|glpat-|BEGIN [A-Z ]*PRIVATE KEY)/.test(text), "the guide names a path or a secret");
    const regulated = filesOf(dataOf({ ...BASE, policy: { regulatedDomain: ["FDA"] } })).get("AGENTS.auto.md")?.content ?? "";
    assertStringIncludes(regulated, "regulated domain (FDA)");
  },
);

proves(
  ["0024-ifws-host FR-007"],
  "a generated file is the same bytes for the same data: UTF-8 with no byte-order mark, LF line endings, one final newline, no time, host or user name",
  () => {
    const a = filesOf(dataOf(BASE, true));
    const b = filesOf(dataOf({ ...BASE, repositories: [...BASE.repositories].reverse() }, true));
    assertEquals([...a.entries()], [...b.entries()]);
    for (const [path, f] of a) {
      assert(!f.content.startsWith("\uFEFF"), `${path} starts with a byte-order mark`);
      assert(!f.content.includes("\r"), `${path} holds a carriage return`);
      assert(f.content.endsWith("\n") && !f.content.endsWith("\n\n"), `${path} does not end in exactly one newline`);
      assert(!/\b20[0-9]{2}-[0-9]{2}-[0-9]{2}T/.test(f.content), `${path} holds a time`);
    }
    // text with CRLF, a byte-order mark and trailing blank lines is made the same as without
    const x = generated("x.auto.md", { format: "markdown", text: "\uFEFFa\r\nb\r\n\r\n\r\n" }, { generator: "g" });
    const y = generated("x.auto.md", { format: "markdown", text: "a\nb" }, { generator: "g" });
    assert(x.kind === "ok" && y.kind === "ok");
    if (x.kind === "ok" && y.kind === "ok") assertEquals(x.value.content, y.value.content);
  },
);

proves(
  ["0024-ifws-host FR-004", "0024-ifws-host FR-008"],
  "a generated file's path is refused where it holds .., is absolute, names a drive, lacks .auto., collides after case folding or is inside a repository",
  () => {
    const body = { format: "markdown", text: "x" } as const;
    const refused = (path: string): string => {
      const r = generated(path, body, { generator: "g" });
      return r.kind === "err" ? r.error.kind : "accepted";
    };
    assertEquals(refused("../x.auto.md"), "bad-path");
    assertEquals(refused("a/../x.auto.md"), "bad-path");
    assertEquals(refused("/etc/x.auto.md"), "bad-path");
    assertEquals(refused("C:/x.auto.md"), "bad-path");
    assertEquals(refused("a\\x.auto.md"), "bad-path");
    assertEquals(refused("notes.md"), "not-auto");
    assertEquals(refused("x.auto.md"), "accepted");
    assertEquals(refused(".envrc.auto"), "accepted");
    assertEquals(refused(".if-workspaces/hooks/pre-commit"), "accepted");
    assertEquals(refused(".if-workspaces/other/pre-commit"), "not-auto");
    const a = generated("A.auto.md", body, { generator: "g" });
    const b = generated("a.auto.md", body, { generator: "g" });
    assert(a.kind === "ok" && b.kind === "ok");
    if (a.kind === "ok" && b.kind === "ok") {
      const c = checkFiles([a.value, b.value], []);
      assert(c.kind === "err");
      if (c.kind === "err")
        assertEquals(
          c.error.map((e) => e.kind),
          ["collision", "collision"],
        );
      const inside = checkFiles([a.value], ["A.auto.md"]);
      assert(inside.kind === "ok", "a file is not inside a repository of the same name");
      const nested = generated("github.com/acme/app/x.auto.md", body, { generator: "g" });
      assert(nested.kind === "ok");
      if (nested.kind === "ok") {
        const r = checkFiles([nested.value], ["github.com/acme/app"]);
        assert(r.kind === "err");
        if (r.kind === "err")
          assertEquals(
            r.error.map((e) => e.kind),
            ["inside-repository"],
          );
      }
    }
    // the header says what made it and that it is not to be edited
    assertStringIncludes(headerText("ifws templates/x"), "ifws templates/x");
    assertStringIncludes(headerText("ifws templates/x"), "Do not edit");
  },
);

proves(
  ["0024-ifws-host FR-003", "0024-ifws-host FR-021"],
  "no template parser, no eval, no new Function and no dotfiles manager is in the templates or the generator",
  () => {
    const code = (t: string): string =>
      t
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
        .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
    const files = [
      ...readDirSync(join(ROOT, "workspaces/templates")).map((e) => `workspaces/templates/${e.name}`),
      "workspaces/render.ts",
      "workspaces/desired.ts",
    ];
    for (const f of files) {
      const text = code(readTextFileSync(join(ROOT, f)));
      assert(!/\beval\s*\(|new Function\b|\bFunction\s*\(|\bvm\./.test(text), `${f} evaluates text`);
    }
    // nothing under workspaces/ imports or runs a dotfiles manager, by its program's name in code
    const everything: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readDirSync(dir)) {
        if (e.isDirectory) walk(join(dir, e.name));
        else if (e.name.endsWith(".ts")) everything.push(join(dir, e.name));
      }
    };
    walk(join(ROOT, "workspaces"));
    for (const f of everything) {
      const text = code(readTextFileSync(f));
      assert(!/chezmoi|\byadm\b|\bstow\b|\bdotbot\b/i.test(text), `${f} names a dotfiles manager in code`);
    }
  },
);

proves(
  ["0024-ifws-host FR-023"],
  ".envrc.auto exists only where direnv is wanted and found, and only adds the tools folder to the PATH by a relative path",
  () => {
    assert(!filesOf(dataOf(BASE, false)).has(".envrc.auto"));
    const found = filesOf(dataOf({ ...BASE, direnv: true }, true)).get(".envrc.auto");
    assertStringIncludes(found?.content ?? "", "PATH_add .if-workspaces/tools/bin");
    const body = (found?.content ?? "").split("\n").filter((l) => l !== "" && !l.startsWith("#"));
    assertEquals(body, ["PATH_add .if-workspaces/tools/bin"]);
    // the manifest's wish alone does not make it: the probe must find direnv
    assert(!filesOf({ manifest: manifestOf({ ...BASE, direnv: true }), direnv: false, tools: [] }).has(".envrc.auto"));
  },
);

proves(
  ["0024-ifws-host FR-014", "0024-ifws-host FR-015"],
  "each hook is a POSIX sh script that only reads; with no checker it fails where a regulated domain is named and passes with the same message elsewhere",
  async () => {
    for (const [name, input, expectedCode] of [
      ["regulated", { ...BASE, policy: { regulatedDomain: ["FDA"] } }, 1],
      ["unregulated", BASE, 0],
    ] as const) {
      const files = filesOf(dataOf(input));
      for (const hook of ["pre-commit", "commit-msg", "pre-push"]) {
        const text = files.get(`.if-workspaces/hooks/${hook}`)?.content ?? "";
        assert(text.startsWith("#!/bin/sh\n"), `${hook} does not begin with its interpreter`);
        assert(
          !/\b(curl|wget|git (commit|add|checkout|reset|config|apply)|rm |sed -i)\b/.test(text),
          `${hook} changes or fetches something (${name})`,
        );
        assert(!/\/home\/|\/Users\/|\/tmp\//.test(text), `${hook} holds an absolute path`);
        if (which("sh") === undefined) continue;
        // run it where neither bun nor node nor ifws is on the PATH
        await withTempDir(async (dir) => {
          const area = join(dir, ".if-workspaces", "hooks");
          await mkdir(area, { recursive: true });
          await writeTextFile(join(area, hook), text, { mode: 0o755 });
          const sh = which("sh") ?? "sh";
          const r = await run([sh, join(area, hook), "message-file"], { env: { PATH: "" }, clearEnv: true });
          assertEquals(r.code, expectedCode, `${name} ${hook}: ${r.stderr}`);
          assertStringIncludes(r.stderr, "cannot run its checker");
        });
      }
    }
  },
  skipSh,
);

proves(
  ["0024-ifws-host FR-014"],
  "each hook script is accepted by sh -n",
  async () => {
    const files = filesOf(dataOf(BASE));
    for (const hook of ["pre-commit", "commit-msg", "pre-push"]) {
      await withTempDir(async (dir) => {
        const file = join(dir, hook);
        await writeTextFile(file, files.get(`.if-workspaces/hooks/${hook}`)?.content ?? "");
        const r = await run([which("sh") ?? "sh", "-n", file]);
        assert(r.success, `${hook}: ${r.stderr}`);
      });
    }
  },
  skipSh,
);

proves(
  ["0024-ifws-host FR-013"],
  "the settings of a repository's local configuration are the hooks path, the signing the policy requires, the identity and, on Windows, core.longpaths, and nothing else",
  () => {
    const plain = settingsOf(manifestOf(BASE), { homePosix: "/w", windows: false });
    assertEquals(plain, { "core.hooksPath": "/w/.if-workspaces/hooks" });
    const signed = settingsOf(
      manifestOf({
        ...BASE,
        policy: { regulatedDomain: ["FDA"] },
        signing: { format: "ssh", key: "/k.pub" },
        identity: { name: "A", email: "a@example.org" },
      }),
      { homePosix: "C:/Users/a/workspaces/", windows: true },
    );
    assertEquals(signed, {
      "core.hooksPath": "C:/Users/a/workspaces/.if-workspaces/hooks",
      "commit.gpgsign": "true",
      "gpg.format": "ssh",
      "user.signingkey": "/k.pub",
      "user.name": "A",
      "user.email": "a@example.org",
      "core.longpaths": "true",
    });
    // a signing format that is neither is refused by the manifest
    assertEquals(decodeManifest({ ...BASE, signing: { format: "pgp" } }).kind, "err");
  },
);
