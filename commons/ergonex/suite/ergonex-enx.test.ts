/**
 * Tests of the short name `enx` (commons 0003-host FR-027, FR-028) with the REAL shells: the snippet that `ergonex shell print` makes is sourced by a real bash, zsh, fish, PowerShell and Nushell, with the real controller behind a program named `ergonex` on the
 * `PATH`. In each, `enx` runs what `ergonex` runs and has the completions of `ergonex`; where another program named `enx` is found, nothing is defined and that program runs (Nushell is told when the snippet is printed); sourcing twice is safe; and
 * `ergonex doctor` names each program called `enx` on the `PATH`. A shell that is not installed on the machine that runs the tests is skipped by name (the Windows jobs of CI run what they can; this suite was run on Linux, and Windows and macOS were not run here).
 *
 * @module
 */
import { chmod, mkdir, readTextFile, withTempDir, writeTextFile } from "../src/platform/r-fs.ts";
import { join } from "../src/platform/r-path.ts";
import { build, execPath, run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { enxChecks } from "../src/doctor.ts";
import { programsNamed } from "../src/host/probe.ts";
import { Ergonex, needsWorld, ONE_REPOSITORY, withWorld, type World } from "./ergonex-fixtures.ts";

type Shell = "bash" | "zsh" | "fish" | "pwsh" | "nu";
const missing = (shell: Shell): string | undefined =>
  build.os === "windows" ? "these tests run Unix shells and Unix paths" : which(shell) === undefined ? `${shell} is not installed on this machine` : undefined;

/** A folder of programs: `ergonex`, which runs the real controller, and, where asked, another program named `enx`. */
async function programs(dir: string, other: boolean): Promise<{ readonly bin: string; readonly otherBin: string }> {
  const bin = join(dir, "bin");
  const otherBin = join(dir, "other");
  await mkdir(bin, { recursive: true });
  await writeTextFile(join(bin, "ergonex"), `#!/bin/sh\nexec ${JSON.stringify(execPath())} ${JSON.stringify(Ergonex)} "$@"\n`);
  await chmod(join(bin, "ergonex"), 0o755);
  if (other) {
    await mkdir(otherBin, { recursive: true });
    await writeTextFile(join(otherBin, "enx"), "#!/bin/sh\necho OTHER-ENX\n");
    await chmod(join(otherBin, "enx"), 0o755);
  }
  return { bin, otherBin };
}

const envOf = (w: World, path: string): Record<string, string> => ({
  ...w.env,
  PATH: path,
  POWERSHELL_TELEMETRY_OPTOUT: "1",
  DOTNET_CLI_TELEMETRY_OPTOUT: "1",
  DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: "1",
  XDG_CONFIG_HOME: join(w.dir, "xdg", "config"),
});

/** The snippet as the real command prints it, written to a file. */
async function snippet(w: World, shell: Shell, path: string): Promise<string> {
  const r = await run([execPath(), Ergonex, "shell", "print", shell], { env: envOf(w, path), cwd: w.dir });
  assertEquals(r.code, 0, `${shell}: ${r.stderr}`);
  const file = join(w.dir, shell === "pwsh" ? "snippet.ps1" : `snippet.${shell}`);
  await writeTextFile(file, `${r.stdout}\n`);
  return file;
}

/** What a script of the shell says when it sources the snippet twice, asks for `enx start` and `ergonex start`, and tells the completions of `enx`. */
async function session(w: World, shell: Shell, path: string, file: string): Promise<{ readonly enx: string; readonly ergonex: string; readonly completion: string; readonly code: number; readonly err: string }> {
  const env = envOf(w, path);
  const script = join(w.dir, `script.${shell}`);
  const marker = "::complete::";
  let argv: string[];
  switch (shell) {
    case "bash":
      await writeTextFile(script, `shopt -s expand_aliases\n. ${JSON.stringify(file)}\n. ${JSON.stringify(file)}\nenx start\necho '::sep::'\nergonex start\necho '::sep::'\necho "${marker} $(complete -p enx 2>/dev/null)"\n`);
      argv = ["bash", script];
      break;
    case "zsh":
      await writeTextFile(script, `autoload -Uz compinit && compinit -u -d ${JSON.stringify(join(w.dir, "zcompdump"))}\n. ${JSON.stringify(file)}\n. ${JSON.stringify(file)}\nenx start\necho '::sep::'\nergonex start\necho '::sep::'\nprint -r -- "${marker} \${_comps[enx]}"\n`);
      argv = ["zsh", "-f", script];
      break;
    case "fish":
      await writeTextFile(script, `source ${JSON.stringify(file)}\nsource ${JSON.stringify(file)}\nenx start\necho '::sep::'\nergonex start\necho '::sep::'\necho "${marker} "(complete -c enx | string join ' ')\n`);
      argv = ["fish", "--no-config", script];
      break;
    case "pwsh":
      await writeTextFile(script, `. ${JSON.stringify(file)}\n. ${JSON.stringify(file)}\nenx start\n'::sep::'\nergonex start\n'::sep::'\n"${marker} " + ((TabExpansion2 'enx ' 4).CompletionMatches | ForEach-Object { $_.CompletionText } | Sort-Object) -join ','\n`);
      argv = ["pwsh", "-NoProfile", "-NonInteractive", "-File", script];
      break;
    case "nu":
      await writeTextFile(script, `source ${JSON.stringify(file)}\nenx start\nprint '::sep::'\nergonex start\nprint '::sep::'\nprint '${marker} nu'\n`);
      argv = ["nu", "--no-config-file", script];
      break;
  }
  const r = await run(argv, { env, cwd: w.dir });
  const [enx = "", ergonex = "", completion = ""] = r.stdout.split("::sep::\n");
  return { enx: enx.trim(), ergonex: ergonex.trim(), completion: completion.trim(), code: r.code, err: r.stderr };
}

for (const shell of ["bash", "zsh", "fish", "pwsh", "nu"] as const) {
  const why = missing(shell);
  proves(
    ["0003-host FR-027"],
    `sourced by a real ${shell} (twice), enx runs what ergonex runs and has its completions; where another program named enx is found, nothing is defined and that program runs`,
    async (t) => {
      if (why !== undefined) return t.skip(why);
      await withWorld(async (w) => {
        const { bin, otherBin } = await programs(w.dir, true);
        const base = process.env["PATH"] ?? "";
        // free: only the real controller is on the PATH
        const free = `${bin}:${base}`;
        const a = await session(w, shell, free, await snippet(w, shell, free));
        assertEquals(a.code, 0, `${shell}: ${a.err}`);
        assert(a.ergonex.length > 0, `${shell}: ergonex start said nothing: ${a.err}`);
        assertEquals(a.enx, a.ergonex, `${shell}: enx start is not what ergonex start is (${JSON.stringify(a.err)})`);
        if (shell === "bash") assertStringIncludes(a.completion, "_ergonex_complete");
        if (shell === "zsh") assertStringIncludes(a.completion, "_ergonex_complete");
        if (shell === "fish") assertStringIncludes(a.completion, "--wraps ergonex");
        if (shell === "pwsh") assertStringIncludes(a.completion, "plan");
        // taken: another program named enx is on the PATH, and nothing is shadowed
        const taken = `${bin}:${otherBin}:${base}`;
        const b = await session(w, shell, taken, await snippet(w, shell, taken));
        assertEquals(b.code, 0, `${shell}: ${b.err}`);
        assertEquals(b.enx, "OTHER-ENX", `${shell}: the other enx was shadowed`);
        assertEquals(b.ergonex, a.ergonex, `${shell}: ergonex changed where another enx exists`);
        if (shell === "nu") assertStringIncludes(await readTextFile(join(w.dir, "snippet.nu")), "# enx is not defined");
      });
    },
    needsWorld,
  );
}

proves(["0003-host FR-027"], "shell install writes the short name in the one block, twice leaves one, and uninstall removes exactly it; the snippets say that an alias exists in an interactive shell only", async () => {
  await withWorld(async (w) => {
    for (const shell of ["bash", "zsh"] as const) {
      const rc = join(w.dir, `rc.${shell}`);
      const original = "# a person's own start-up file\nexport EDITOR=vi\n";
      await writeTextFile(rc, original);
      assertEquals((await w.ergonex("shell", "install", shell, "--rc", rc)).code, 0);
      const once = await readTextFile(rc);
      assertEquals((await w.ergonex("shell", "install", shell, "--rc", rc)).code, 0);
      assertEquals(await readTextFile(rc), once, `${shell}: installing twice changed the file`);
      assertStringIncludes(once, "alias enx=ergonex");
      assertStringIncludes(once, "if ! command -v enx");
      assertStringIncludes(once, "a script or an agent uses ergonex");
      assertEquals((await w.ergonex("shell", "uninstall", shell, "--rc", rc)).code, 0);
      assertEquals(await readTextFile(rc), original, `${shell}: uninstall left something`);
    }
    for (const shell of ["fish", "pwsh", "nu"]) {
      const printed = await w.ergonex("shell", "print", shell);
      assertStringIncludes(printed.stdout, "a script or an agent uses ergonex");
      assertStringIncludes(printed.stdout, shell === "nu" ? "alias enx = ergonex" : "enx");
    }
  });
}, needsWorld);

proves(["0003-host FR-028"], "programsNamed finds each program of a name in the order of the PATH, enxChecks says it as a warning with the paths or as ok, and ergonex doctor reports it without running the program", async () => {
  await withTempDir(async (dir) => {
    const a = join(dir, "a");
    const b = join(dir, "b");
    const c = join(dir, "c");
    for (const d of [a, b, c]) await mkdir(d, { recursive: true });
    await writeTextFile(join(a, "enx"), "#!/bin/sh\ntouch RAN\n");
    await writeTextFile(join(b, "enx"), "#!/bin/sh\ntouch RAN\n");
    await mkdir(join(c, "enx"), { recursive: true });
    assertEquals(programsNamed("enx", `${a}:${join(dir, "missing")}:${b}:${c}:${a}`, false), [join(a, "enx"), join(b, "enx")]);
    assertEquals(programsNamed("enx", undefined, false), []);
    assertEquals(programsNamed("enx", "", false), []);
    assertEquals(enxChecks([]).map((x) => [x.level, x.id]), [["ok", "ergonex/enx"]]);
    const warn = enxChecks([join(a, "enx"), join(b, "enx")]);
    assertEquals(warn.length, 1);
    assertEquals(warn[0]?.level, "warn");
    assertStringIncludes(warn[0]?.message ?? "", join(a, "enx"));
    assertStringIncludes(warn[0]?.message ?? "", join(b, "enx"));
    assertStringIncludes(warn[0]?.message ?? "", "ergonex always works");
  });
  if (needsWorld.skip !== undefined) return;
  await withWorld(async (w) => {
    await w.manifest(ONE_REPOSITORY);
    const { bin, otherBin } = await programs(w.dir, true);
    const base = process.env["PATH"] ?? "";
    const withOther = await run([execPath(), Ergonex, "doctor"], { env: envOf(w, `${bin}:${otherBin}:${base}`), cwd: w.dir });
    assertStringIncludes(withOther.stdout + withOther.stderr, "another program named enx is on the PATH");
    assertStringIncludes(withOther.stdout + withOther.stderr, join(otherBin, "enx"));
    assert(!(await readTextFile(join(otherBin, "RAN")).then(() => true, () => false)), "doctor ran the program");
    const free = await run([execPath(), Ergonex, "doctor"], { env: envOf(w, `${bin}:${base}`), cwd: w.dir });
    assertStringIncludes(free.stdout + free.stderr, "the short name enx of `ergonex shell` is free");
  });
});

for (const shell of ["zsh", "fish", "pwsh", "nu"] as const) {
  const why = missing(shell);
  proves(
    ["0003-host FR-018"],
    `sourced by a real ${shell}, the snippet printed by the command is accepted whole (the token line is not masked, the paths are the shell's own) and wcd changes to a repository by its name and says when two are so named`,
    async (t) => {
      if (why !== undefined) return t.skip(why);
      await withWorld(async (w) => {
        for (const repo of ["github.com/acme/app", "github.com/acme/lib", "gitlab.com/g/lib"]) await mkdir(join(w.home, repo, ".git"), { recursive: true });
        const { bin } = await programs(w.dir, false);
        const path = `${bin}:${process.env["PATH"] ?? ""}`;
        const file = await snippet(w, shell, path);
        const text = await readTextFile(file);
        assert(!text.includes("***"), `${shell}: the printed snippet holds a masked part`);
        const script = join(w.dir, `wcd.${shell === "pwsh" ? "ps1" : shell}`);
        const body: Record<string, { cmd: string[]; text: string }> = {
          zsh: { cmd: ["zsh", "-f", script], text: `. ${JSON.stringify(file)}\nwcd app && pwd\nwcd lib 2>&1\n` },
          fish: { cmd: ["fish", "--no-config", script], text: `source ${JSON.stringify(file)}\nwcd app; pwd\nwcd lib 2>&1\n` },
          pwsh: { cmd: ["pwsh", "-NoProfile", "-NonInteractive", "-File", script], text: `. ${JSON.stringify(file)}\nwcd app\n(Get-Location).Path\ntry { wcd lib } catch { $_.Exception.Message }\n` },
          nu: { cmd: ["nu", "--no-config-file", script], text: `source ${JSON.stringify(file)}\nwcd app\nprint (pwd)\ntry { wcd lib } catch { |e| print $e.msg }\n` },
        };
        const b = body[shell];
        assert(b !== undefined);
        await writeTextFile(script, b.text);
        const r = await run(b.cmd, { env: envOf(w, path), cwd: w.dir });
        const out = r.stdout + r.stderr;
        assertStringIncludes(out, join(w.home, "github.com/acme/app"), `${shell}: wcd app did not change to the repository`);
        assertStringIncludes(out, "more than one repository is named lib", `${shell}: wcd lib did not say there are two`);
      });
    },
    needsWorld,
  );
}
