/**
 * The installers (commons ergonex 0004-onboarding FR-008, commons 0031-install-locations FR-006): the files are what the generator makes, the Bun version is commons' where commons is beside the library, the script for
 * Windows installs by `winget` with package identifiers and downloads nothing of its own, is ASCII with a byte order mark and parses in the PowerShell that is there, and the script for Linux and macOS is read by `sh`,
 * runs ergonex with the Bun that is there, and asks Bun's own installer for the pinned version where there is none.
 *
 * @module
 */
import { chmod, exists, makeTempDir, mkdir, readFile, readTextFile, remove, writeTextFile } from "../src/platform/r-fs.ts";
import { dirname, join, resolve, fromFileUrl } from "../src/platform/r-path.ts";
import { build, run, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { BUN_INSTALLER, BUN_VERSION, WINGET } from "../src/install/pins.ts";
import { installerPs1, installerSh, withBom } from "../src/install/scripts.ts";
import { ERGONEX_VERSION } from "../src/state-record.ts";
import { outputs, synchronize } from "../tools/generate-installers.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const sh = which("sh");
const needsSh = sh === undefined || build.os === "windows" ? { skip: "sh is not installed, or this is Windows" } : {};

proves(
  ["0004-onboarding FR-008"],
  "the installers are what the generator makes, the version is the package's, and the Bun version is the one commons pins",
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
    const pinned = /^BUN_VERSION=(.*)$/m.exec(await readTextFile(env))?.[1];
    assertEquals(BUN_VERSION, pinned);
  },
);

proves(
  ["0004-onboarding FR-008", "0031-install-locations FR-006"],
  "the script for Windows installs Bun, Git and GitHub CLI with winget by package identifier and downloads nothing of its own; it is ASCII with a byte order mark, never calls exit, and parses in the PowerShell that is installed",
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
    for (const id of Object.values(WINGET)) assertStringIncludes(text, id);
    assertStringIncludes(text, "winget install --id $Id --exact");
    const code = text.replace(/^\s*#.*$/gm, "");
    for (const download of [
      "Invoke-WebRequest",
      "Invoke-RestMethod",
      "Start-BitsTransfer",
      "Expand-Archive",
      "Get-FileHash",
      "DownloadFile",
    ])
      assert(!code.includes(download), `the installer downloads for itself (${download})`);
    assert(!/\.bun\\bin|\.ergonex/.test(code), "the installer names a folder of its own");
    assert(!/(^|\s)exit(\s|$)/m.test(code), "a script run by iex must not call exit");
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
  ["0004-onboarding FR-008", "0031-install-locations FR-006"],
  "the script for Linux and macOS is read by sh, runs ergonex with the Bun that is there and gives it the arguments, and where there is no Bun asks Bun's own installer for the pinned version and installs nothing itself",
  async () => {
    const file = join(ROOT, "install", "ergonex-install.auto.sh");
    const syntax = await run([sh ?? "sh", "-n", file]);
    assertEquals(syntax.code, 0, syntax.stderr);
    const text = await readTextFile(file);
    assertStringIncludes(text, `curl -fsSL ${BUN_INSTALLER} | bash -s "bun-v${BUN_VERSION}"`);
    assert(
      !/\.ergonex|\.local\/bin|chmod|unzip|sha256sum|shasum/.test(text),
      "the installer puts something of its own somewhere or checks a download of its own",
    );
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
      const ok = await run([sh ?? "sh", file, "--home", "a b"], {
        env,
        clearEnv: true,
      });
      assertEquals(ok.code, 0, ok.stderr);
      assertStringIncludes(ok.stdout, "using Bun 9.9.9");
      assertEquals(
        (await readTextFile(record)).split("\n").filter((l) => l !== ""),
        ["@intellectual-frontiers/ergonex@7.7.7", "init", "--home", "a b"],
      );
      // no Bun: Bun's own installer is asked for the pinned version (a made-up curl gives a script that records its argument and makes the Bun it would install)
      await remove(join(fake, "bun"));
      await remove(join(fake, "bunx"));
      if (which("bun", "/usr/bin:/bin") !== undefined) return; // a Bun in the system's own folders cannot be hidden from the script
      const asked = join(dir, "installer.args");
      const installer = `printf '%s\\n' "$@" >'${asked}'; mkdir -p "$HOME/.bun/bin"; printf '#!/bin/sh\\necho 9.9.9\\n' >"$HOME/.bun/bin/bun"; printf '#!/bin/sh\\nprintf "%%s\\\\n" "$@" >"${record}"\\n' >"$HOME/.bun/bin/bunx"; chmod 755 "$HOME/.bun/bin/bun" "$HOME/.bun/bin/bunx"`;
      await script("curl", `printf '%s\\n' '${installer.replaceAll("'", `'\\''`)}'`);
      const fresh = await run([sh ?? "sh", file], {
        env: { PATH: `${fake}:/usr/bin:/bin`, HOME: home },
        clearEnv: true,
      });
      assertEquals(fresh.code, 0, `${fresh.stdout}${fresh.stderr}`);
      assertEquals((await readTextFile(asked)).trim(), `bun-v${BUN_VERSION}`);
      assertStringIncludes(await readTextFile(record), "@intellectual-frontiers/ergonex@");
    } finally {
      await remove(dir, { recursive: true }).catch(() => {});
    }
  },
  needsSh,
);
