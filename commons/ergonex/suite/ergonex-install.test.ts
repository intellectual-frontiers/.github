/**
 * The installers (commons ergonex 0004-onboarding FR-008): the files are what the generator makes from the pins, the pins are commons', the script for Windows is ASCII with a byte order mark and parses in the
 * PowerShell that is there, the script for Linux and macOS is read by `sh`, runs ergonex with the Bun that is there (a made-up `bunx` records what it was given), and refuses a Bun that is not the pinned one.
 *
 * @module
 */
import { chmod, exists, makeTempDir, mkdir, readFile, readTextFile, remove, writeTextFile } from "../src/platform/r-fs.ts";
import { dirname, join, resolve, fromFileUrl } from "../src/platform/r-path.ts";
import { build, run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { BUN_RELEASES, BUN_VERSION } from "../src/install/pins.ts";
import { installerPs1, installerSh, withBom } from "../src/install/scripts.ts";
import { ERGONEX_VERSION } from "../src/state-record.ts";
import { outputs, synchronize } from "../tools/generate-installers.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const sh = which("sh");
const needsSh = sh === undefined || build.os === "windows" ? { skip: "sh is not installed, or this is Windows" } : {};

proves(
  ["0004-onboarding FR-008"],
  "the installers are what the generator makes from the pins, the version is the package's, and the pins are the ones commons pins",
  async () => {
    assertEquals(await synchronize(ROOT, true), []);
    assertEquals([...outputs().keys()], ["install/ergonex-install.auto.sh", "install/ergonex-install.auto.ps1"]);
    const pkg = JSON.parse(await readTextFile(join(ROOT, "package.json"))) as {
      version: string;
    };
    assertEquals(ERGONEX_VERSION, pkg.version);
    assertStringIncludes(installerSh(ERGONEX_VERSION), `\${ERGONEX_VERSION:-${ERGONEX_VERSION}}`);
    const env = join(ROOT, "..", "generated", "pins.auto.env");
    if (!(await exists(env))) return; // a copy of the library with no commons beside it cannot compare
    const pins = new Map(
      (await readTextFile(env)).split(/\r?\n/).flatMap((l) => (/^([A-Z0-9_]+)=(.*)$/.exec(l) ? [[RegExp.$1, RegExp.$2] as const] : [])),
    );
    assertEquals(BUN_VERSION, pins.get("BUN_VERSION"));
    const keys: Record<string, string> = {
      "linux-x64": "X86_64",
      "linux-aarch64": "AARCH64",
      "darwin-x64": "MACOS_X64",
      "darwin-aarch64": "MACOS_ARM64",
      "windows-x64": "WINDOWS_X64",
    };
    for (const [system, key] of Object.entries(keys)) assertEquals(BUN_RELEASES[system]?.sha256, pins.get(`BUN_SHA256_${key}`), system);
  },
);

proves(
  ["0004-onboarding FR-008"],
  "the script for Windows is ASCII with a byte order mark, pins Bun's hash, never calls exit, and parses in the PowerShell that is installed",
  async () => {
    const bytes = await readFile(join(ROOT, "install", "ergonex-install.auto.ps1"));
    assertEquals([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    const body = bytes.slice(3);
    assert(
      body.every((b) => b < 0x80),
      "a character outside ASCII",
    );
    const text = new TextDecoder().decode(body);
    assert(text.startsWith("#Requires -Version 5.1\n"), "the first line is the version it needs");
    assertStringIncludes(text, BUN_RELEASES["windows-x64"]?.sha256 ?? "x");
    assertStringIncludes(text, "Get-FileHash -Algorithm SHA256");
    assert(!/(^|\s)exit(\s|$)/m.test(text.replace(/^\s*#.*$/gm, "")), "a script run by iex must not call exit");
    assertEquals(withBom(installerPs1(ERGONEX_VERSION)), bytes);
    const ps = which("pwsh") ?? which("powershell");
    if (ps === undefined) return;
    const file = join(ROOT, "install", "ergonex-install.auto.ps1");
    const r = await run(
      [
        ps,
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$e = $null; [System.Management.Automation.Language.Parser]::ParseFile($env:ERGONEX_PS1, [ref]$null, [ref]$e) | Out-Null; if ($e) { $e | ForEach-Object { $_.Message }; exit 1 }",
      ],
      { env: { ERGONEX_PS1: file } },
    );
    assertEquals(r.code, 0, `${r.stdout}${r.stderr}`);
  },
);

proves(
  ["0004-onboarding FR-008"],
  "the script for Linux and macOS is read by sh, runs ergonex with the Bun that is there and gives it the arguments, and installs nothing where Bun's hash is not the pinned one",
  async () => {
    const file = join(ROOT, "install", "ergonex-install.auto.sh");
    const syntax = await run([sh ?? "sh", "-n", file]);
    assertEquals(syntax.code, 0, syntax.stderr);
    const shellcheck = which("shellcheck");
    if (shellcheck !== undefined) {
      const r = await run([shellcheck, "--shell=sh", "--exclude=SC2016", file]);
      assertEquals(r.code, 0, r.stdout);
    }
    const dir = await makeTempDir();
    try {
      const fake = join(dir, "bin");
      const home = join(dir, "home");
      await mkdir(fake);
      await mkdir(home);
      const record = join(dir, "bunx.args");
      const script = (name: string, body: string): Promise<void> =>
        writeTextFile(join(fake, name), `#!/bin/sh\n${body}\n`).then(() => chmod(join(fake, name), 0o755));
      // a Bun that is there: the script runs bunx with the package at the version and `init`, and every argument after
      await script("bun", "echo 9.9.9");
      await script("bunx", `printf '%s\\n' "$@" >'${record}'`);
      const env = {
        PATH: `${fake}:/usr/bin:/bin`,
        HOME: home,
        ERGONEX_VERSION: "7.7.7",
      };
      const ok = await run([sh ?? "sh", file, "--no-path", "--home", "a b"], {
        env,
        clearEnv: true,
      });
      assertEquals(ok.code, 0, ok.stderr);
      assertStringIncludes(ok.stdout, "using Bun 9.9.9");
      assertEquals(
        (await readTextFile(record)).split("\n").filter((l) => l !== ""),
        ["@intellectual-frontiers/ergonex@7.7.7", "init", "--no-path", "--home", "a b"],
      );
      // no Bun: a download that is not the pinned Bun is refused, and nothing is installed
      await remove(join(fake, "bun"));
      await remove(join(fake, "bunx"));
      if (which("bun", `/usr/bin:/bin`) !== undefined) return; // a Bun in the system's own folders cannot be hidden from the script
      await script("unzip", "exit 0");
      await script("curl", 'out=""; while [ $# -gt 0 ]; do if [ "$1" = -o ]; then out="$2"; fi; shift; done; echo not-bun >"$out"');
      const refused = await run([sh ?? "sh", file], {
        env: { PATH: `${fake}:/usr/bin:/bin`, HOME: home },
        clearEnv: true,
      });
      assertEquals(refused.code, 1);
      assert(/is not the one expected|has no build for this computer/.test(refused.stderr), refused.stderr);
      assert(!(await exists(join(home, ".bun", "bin", "bun"))), "Bun was installed");
    } finally {
      await remove(dir, { recursive: true }).catch(() => {});
    }
  },
  needsSh,
);
