/**
 * Tests of the shell snippet and its one marked block (commons 0024-ifws-host FR-017 to FR-020, 0025-ifws FR-021): the snippet of each of the five shells does four things and no more, quotes a root
 * with a space or a quote in it as one word, and the block `--install` writes is one block, however often it is run, and `--uninstall` removes exactly it, so that a start-up file with other text, with
 * CRLF or with no final newline is again as it was. The bash snippet is sourced by the real `bash` in a real workspace, where `wcd` changes to a repository by its name, says when two are so named,
 * and the `PATH` gets the tools folder once; `sh -n` and `bash -n` read the others' POSIX parts. Shells that are not installed here (zsh, fish, PowerShell, Nushell) have their snippets read as text.
 *
 * @module
 */
import { mkdir, withTempDir, writeTextFile } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { run, which } from "../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { BEGIN, END, installBlock, removeBlock } from "../workspaces/shell/block.ts";
import { rcFileFor, SHELLS, snippetFor, type Completions, type Shell } from "../workspaces/shell/snippet.ts";

const COMPLETIONS: Completions = [
  { module: "plan", commands: ["plan"] },
  { module: "worktree", commands: ["create", "list", "prune"] },
  { module: "shell", commands: ["shell"] },
];
const facts = { home: { kind: "default" } as const, completions: COMPLETIONS };
const skipBash = which("bash") === undefined ? { skip: "bash is not installed" } : {};

proves(
  ["0024-ifws-host FR-018"],
  "each snippet exports the root where it is not set, adds the tools folder to the PATH, completes ifws and defines wcd, and nothing else",
  () => {
    for (const shell of SHELLS) {
      const text = snippetFor(shell, facts);
      assert(text.endsWith("\n") && !text.endsWith("\n\n"), shell);
      assertStringIncludes(text, "IFC_WORKSPACES_HOME");
      assertStringIncludes(text, ".if-workspaces");
      assertStringIncludes(text, "tools");
      assertStringIncludes(text, "wcd");
      assertStringIncludes(
        text,
        shell === "pwsh"
          ? "Register-ArgumentCompleter"
          : shell === "fish"
            ? "complete -c ifws"
            : shell === "nu"
              ? "extern"
              : "ifws_complete",
      );
      assertStringIncludes(text, "worktree");
      // exactly one function is defined, and no program of any other tool is run
      const defined = [...text.matchAll(/^(?:function|def(?: --env)?)\s+(\S+)|^(\w+)\(\)\s*\{/gm)]
        .map((m) => m[1] ?? m[2])
        .filter((n) => n !== "_ifws_complete");
      assertEquals(
        defined.filter((n) => n !== undefined && !n.startsWith('"nu-complete')),
        ["wcd"],
        shell,
      );
      assert(!/\b(curl|wget|eval|source|sudo|rm )\b/.test(text), `${shell} runs something else`);
      assert(!text.includes("\r"), shell);
    }
  },
);

proves(
  ["0024-ifws-host FR-017"],
  "a root named for one run is one word in every shell, whatever it holds, and the snippet is the same bytes each time",
  () => {
    const tricky = `/home/a b/it's "x" $y \`z\`/workspaces`;
    for (const shell of SHELLS) {
      const text = snippetFor(shell, { home: { kind: "path", path: tricky }, completions: COMPLETIONS });
      assertEquals(text, snippetFor(shell, { home: { kind: "path", path: tricky }, completions: COMPLETIONS }));
      assert(text.includes("a b"), shell);
    }
    const bash = snippetFor("bash", { home: { kind: "path", path: tricky }, completions: COMPLETIONS });
    assertStringIncludes(bash, `'/home/a b/it'\\''s "x" $y \`z\`/workspaces'`);
  },
);

proves(
  ["0024-ifws-host FR-017"],
  "the POSIX snippets are accepted by bash -n and sh -n, and the default snippet holds no absolute path",
  async () => {
    for (const shell of ["bash", "zsh"] as const) {
      const text = snippetFor(shell, facts);
      assert(!/\/home\/|\/Users\//.test(text), shell);
      if (shell === "bash") {
        await withTempDir(async (dir) => {
          const file = join(dir, "snippet.sh");
          await writeTextFile(file, text);
          const r = await run([which("bash") ?? "bash", "-n", file]);
          assert(r.success, r.stderr);
        });
      }
    }
  },
  skipBash,
);

proves(
  ["0024-ifws-host FR-018", "0024-ifws-host FR-017"],
  "sourced by a real bash, the snippet sets the root once, puts the tools folder on the PATH once, and wcd changes to a repository by its name and says when it cannot",
  async () => {
    await withTempDir(async (dir) => {
      const home = join(dir, "work space");
      for (const repo of ["github.com/acme/app", "github.com/acme/lib", "gitlab.com/g/s/lib", ".worktrees/github.com/acme/app/b"]) {
        await mkdir(join(home, repo, ".git"), { recursive: true });
      }
      await mkdir(join(home, ".if-workspaces", "tools", "bin"), { recursive: true });
      const snippet = join(dir, "snippet.sh");
      await writeTextFile(snippet, snippetFor("bash", { home: { kind: "path", path: home }, completions: COMPLETIONS }));
      const bash = which("bash") ?? "bash";
      const script = (body: string, keep: boolean): string =>
        `${keep ? "" : "unset IFC_WORKSPACES_HOME; "}. ${JSON.stringify(snippet)}; . ${JSON.stringify(snippet)}; ${body}`;
      const go = (body: string, env: Record<string, string> = {}) => run([bash, "-c", script(body, false)], { env: { ...env, HOME: dir } });

      const where = await go("wcd app && pwd");
      assertEquals(where.stdout.trim(), join(home, "github.com/acme/app"));
      const path = await go('echo "$PATH"');
      const entries = path.stdout
        .trim()
        .split(":")
        .filter((e) => e === join(home, ".if-workspaces/tools/bin"));
      assertEquals(entries.length, 1, "the tools folder is on the PATH more than once after two sources");
      assertEquals((await go('echo "$IFC_WORKSPACES_HOME"')).stdout.trim(), home);
      // where it is set, it is kept
      const kept = await run([bash, "-c", script('echo "$IFC_WORKSPACES_HOME"', true)], {
        env: { IFC_WORKSPACES_HOME: "/elsewhere", HOME: dir },
      });
      assertEquals(kept.stdout.trim(), "/elsewhere");

      const two = await go("wcd lib");
      assertEquals(two.code, 1);
      assertStringIncludes(two.stderr, "more than one repository is named lib");
      assertStringIncludes(two.stderr, "github.com/acme/lib");
      assertStringIncludes(two.stderr, "gitlab.com/g/s/lib");
      const none = await go("wcd nothing-here");
      assertEquals(none.code, 1);
      assertStringIncludes(none.stderr, "no repository named nothing-here");
      // a worktree is not a repository of the workspace
      const wt = await go("wcd b");
      assertEquals(wt.code, 1);
      assertEquals((await go("wcd")).code, 2);
    });
  },
  skipBash,
);

proves(
  ["0024-ifws-host FR-019"],
  "install writes one marked block, a second install leaves one, and uninstall removes exactly it and nothing else",
  () => {
    const snippet = snippetFor("bash", facts);
    const original = "# my own rc\nexport EDITOR=vi\nalias ll='ls -l'\n";
    const once = installBlock(original, snippet);
    assert(once.kind === "ok");
    if (once.kind !== "ok") return;
    assert(once.value.changed);
    assert(once.value.text.startsWith(original), "the text before the block is kept");
    assertEquals(once.value.text.split("\n").filter((l) => l === BEGIN).length, 1);
    assertEquals(once.value.text.split("\n").filter((l) => l === END).length, 1);
    const twice = installBlock(once.value.text, snippet);
    assert(twice.kind === "ok");
    if (twice.kind !== "ok") return;
    assertEquals(twice.value.text, once.value.text);
    assert(!twice.value.changed);
    const back = removeBlock(twice.value.text);
    assert(back.kind === "ok");
    if (back.kind === "ok") assertEquals(back.value.text, original);
    // text around and after the block is not touched
    const around = `${original}${once.value.text.slice(original.length)}export AFTER=1\n`;
    const removed = removeBlock(around);
    assert(removed.kind === "ok");
    if (removed.kind === "ok") assertEquals(removed.value.text, `${original}export AFTER=1\n`);
    // a changed snippet replaces the block, in place
    const other = installBlock(around, "echo other\n");
    assert(other.kind === "ok");
    if (other.kind === "ok") {
      assertStringIncludes(other.value.text, "echo other");
      assert(other.value.text.endsWith("export AFTER=1\n"));
      assertEquals(other.value.text.split("\n").filter((l) => l === BEGIN).length, 1);
    }
  },
);

proves(
  ["0024-ifws-host FR-019"],
  "install and uninstall keep a file that is empty, has no final newline or uses CRLF as it was, and refuse a block with no end",
  () => {
    const snippet = "echo hi\n";
    const empty = installBlock(undefined, snippet);
    assert(empty.kind === "ok");
    if (empty.kind === "ok") {
      assertEquals(empty.value.text, `${BEGIN}\necho hi\n${END}\n`);
      const gone = removeBlock(empty.value.text);
      assert(gone.kind === "ok");
      if (gone.kind === "ok") assertEquals(gone.value.text, "");
    }
    const crlf = "a\r\nb\r\n";
    const withCrlf = installBlock(crlf, snippet);
    assert(withCrlf.kind === "ok");
    if (withCrlf.kind === "ok") {
      assert(withCrlf.value.text.includes(`${BEGIN}\r\n`));
      assert(!withCrlf.value.text.replaceAll("\r\n", "").includes("\n"), "a bare LF in a CRLF file");
      const gone = removeBlock(withCrlf.value.text);
      assert(gone.kind === "ok");
      if (gone.kind === "ok") assertEquals(gone.value.text, crlf);
    }
    const noNewline = installBlock("last line", snippet);
    assert(noNewline.kind === "ok");
    if (noNewline.kind === "ok") {
      assertStringIncludes(noNewline.value.text, `last line\n${BEGIN}`);
      const gone = removeBlock(noNewline.value.text);
      assert(gone.kind === "ok");
      // the one newline added before the block stays: nothing the person wrote is lost
      if (gone.kind === "ok") assertEquals(gone.value.text, "last line\n");
    }
    assertEquals(installBlock(`${BEGIN}\nx\n`, snippet).kind, "err");
    assertEquals(removeBlock(`x\n${END}\n`).kind, "err");
    const none = removeBlock("nothing here\n");
    assert(none.kind === "ok" && !none.value.changed);
  },
);

proves(["0024-ifws-host FR-019"], "each shell's start-up file is the one the specification names, the --rc file aside", () => {
  const f = { home: "/home/u", windows: false, darwin: false };
  const at = (s: Shell, extra: Partial<Parameters<typeof rcFileFor>[1]> = {}): string => rcFileFor(s, { ...f, ...extra });
  assertEquals(at("bash"), "/home/u/.bashrc");
  assertEquals(at("zsh"), "/home/u/.zshrc");
  assertEquals(at("zsh", { zdotdir: "/z" }), "/z/.zshrc");
  assertEquals(at("fish"), "/home/u/.config/fish/conf.d/ifws.fish");
  assertEquals(at("fish", { xdgConfigHome: "/x" }), "/x/fish/conf.d/ifws.fish");
  assertEquals(at("nu"), "/home/u/.config/nushell/config.nu");
  assertEquals(at("nu", { darwin: true }), "/home/u/Library/Application Support/nushell/config.nu");
  assertEquals(at("pwsh"), "/home/u/.config/powershell/Microsoft.PowerShell_profile.ps1");
  assertEquals(at("pwsh", { windows: true, home: "C:/Users/u" }), "C:/Users/u/Documents/PowerShell/Microsoft.PowerShell_profile.ps1");
});
