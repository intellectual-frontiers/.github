// The two bootstraps, which only get Deno and hand over (erga's 009-machine-bootstrap): the pinned zip fetched from a local file, its SHA-256 checked before it
// is unpacked, kept in erga's toolchain store, a Deno already here used, the setup found beside the script or fetched from where the script came from, and
// every option handed over. A stand-in Deno records what it was asked to run.
import { assert, assertEquals, assertMatch, assertStringIncludes } from "@std/assert";
import { BOOT_PS1, BOOT_SH, DENO, exists, Fx, MAIN, OFF, PERMISSIONS, ROOT, sh, sha256Hex, zipBytes } from "./helpers.ts";
import { pins } from "../commons/generated/packaging.auto.ts";

const PINNED = pins.deno.version;
const SYSTEM = "/usr/bin:/bin";

/** A Deno that answers --version as the pin, and otherwise writes down its arguments and the variables the bootstrap sets. */
const FAKE_DENO = (version: string) =>
  `#!/bin/sh\n[ "$1" = --version ] && { echo "deno ${version} (stable)"; exit 0; }\nprintf '%s\\n' "$@" >"$RECORD"\necho "ERGA_BOOTSTRAP_DENO=$ERGA_BOOTSTRAP_DENO BOOTSTRAP_URL=$BOOTSTRAP_URL" >>"$RECORD.env"\nread -r x && echo "STDIN: $x" >>"$RECORD.env"\nexit 0\n`;

async function zipOf(fx: Fx, body: string): Promise<{ url: string; sha: string }> {
  const out = `${fx.tmp}/deno.zip`;
  Deno.writeFileSync(out, zipBytes({ deno: body }));
  return { url: `file://${out}`, sha: await sha256Hex(Deno.readFileSync(out)) };
}

function env(fx: Fx, extra: Record<string, string> = {}): Record<string, string> {
  return { PATH: `${fx.bin}:${SYSTEM}`, HOME: fx.home, TMPDIR: fx.tmp, RECORD: `${fx.tmp}/record`, LANG: "C", ...extra };
}
const store = (fx: Fx) => `${fx.home}/.local/share/erga/toolchain/deno/${PINNED}/linux-x64/deno`;
const recorded = (fx: Fx) => Deno.readTextFileSync(`${fx.tmp}/record`).split("\n").filter((l) => l !== "");
const skipUnlessX64 = Deno.build.os !== "linux" || Deno.build.arch !== "x86_64";

Deno.test({ name: "the pinned Deno is fetched, checked, kept in erga's store and run on the setup beside the script, with every option", ignore: skipUnlessX64 }, async () => {
  await using fx = await Fx.make();
  const z = await zipOf(fx, FAKE_DENO(PINNED));
  const p = await sh(["sh", BOOT_SH, "--dry-run", "--patient", "two words"], env(fx, { BOOTSTRAP_DENO_URL: z.url, BOOTSTRAP_DENO_SHA256: z.sha }));
  assertEquals(p.code, 0, p.stdout + p.stderr);
  assert(exists(store(fx)), "kept where erga's launchers look for it");
  assertEquals(recorded(fx), ["run", "-q", "--no-config", "--no-prompt", ...PERMISSIONS, MAIN, "--dry-run", "--patient", "two words"]);
  const e = Deno.readTextFileSync(`${fx.tmp}/record.env`);
  assertStringIncludes(e, `ERGA_BOOTSTRAP_DENO=${store(fx)} BOOTSTRAP_URL=https://raw.githubusercontent.com/intellectual-frontiers/.github/main`);
  assert(!e.includes("STDIN:"), "the setup does not read the bootstrap's standard input");
  // the second run uses the store's copy: nothing is fetched
  const again = await sh(["sh", BOOT_SH], env(fx, { BOOTSTRAP_DENO_URL: "file:///nonexistent.zip", BOOTSTRAP_DENO_SHA256: z.sha }));
  assertEquals(again.code, 0, again.stderr);
  assert(!again.stderr.includes("getting Deno"));
  // XDG_DATA_HOME moves the store, as it moves erga's
  const xdg = await sh(["sh", BOOT_SH], env(fx, { BOOTSTRAP_DENO_URL: z.url, BOOTSTRAP_DENO_SHA256: z.sha, XDG_DATA_HOME: `${fx.tmp}/data` }));
  assertEquals(xdg.code, 0, xdg.stderr);
  assert(exists(`${fx.tmp}/data/erga/toolchain/deno/${PINNED}/linux-x64/deno`));
});

Deno.test({ name: "a zip that is not the one pinned is refused, and nothing is unpacked", ignore: skipUnlessX64 }, async () => {
  await using fx = await Fx.make();
  const z = await zipOf(fx, FAKE_DENO(PINNED));
  const p = await sh(["sh", BOOT_SH], env(fx, { BOOTSTRAP_DENO_URL: z.url, BOOTSTRAP_DENO_SHA256: "0".repeat(64) }));
  assertEquals(p.code, 3);
  assertStringIncludes(p.stderr, "is not the Deno pinned (its SHA-256 is");
  assertStringIncludes(p.stderr, "nothing was unpacked");
  assert(!exists(store(fx)) && !exists(`${fx.tmp}/record`));
  const left = [...Deno.readDirSync(`${fx.home}/.local/share/erga/toolchain/deno/${PINNED}`)].map((d) => d.name);
  assertEquals(left, [], "no half-made folder is left");
});

Deno.test({ name: "the real pin is what the bootstrap checks: the release's own zip URL and the commons SHA-256", ignore: skipUnlessX64 }, async () => {
  await using fx = await Fx.make();
  const z = await zipOf(fx, FAKE_DENO(PINNED));
  // without BOOTSTRAP_DENO_SHA256 the override is refused: a mirror must say which file it serves
  const p = await sh(["sh", BOOT_SH], env(fx, { BOOTSTRAP_DENO_URL: z.url }));
  assert(p.code !== 0);
  assertStringIncludes(p.stderr, "BOOTSTRAP_DENO_URL needs BOOTSTRAP_DENO_SHA256");
  const text = Deno.readTextFileSync(BOOT_SH);
  assertStringIncludes(text, "url=https://github.com/denoland/deno/releases/download/v$DENO_VERSION/deno-$target.zip");
});

Deno.test("a Deno already on the PATH at the pin or later is used; an older one is not", async () => {
  await using fx = await Fx.make();
  fx.stub("deno", FAKE_DENO("2.10.1").replace("#!/bin/sh\n", ""));
  const p = await sh(["sh", BOOT_SH, "--setup"], env(fx, { BOOTSTRAP_DENO_URL: "file:///nonexistent.zip", BOOTSTRAP_DENO_SHA256: "0".repeat(64) }));
  assertEquals(p.code, 0, p.stderr);
  assertEquals(recorded(fx).at(-1), "--setup");
  assert(!exists(store(fx)));
  if (skipUnlessX64) return;
  fx.stub("deno", FAKE_DENO("2.0.0").replace("#!/bin/sh\n", ""));
  const z = await zipOf(fx, FAKE_DENO(PINNED));
  const old = await sh(["sh", BOOT_SH], env(fx, { BOOTSTRAP_DENO_URL: z.url, BOOTSTRAP_DENO_SHA256: z.sha }));
  assertEquals(old.code, 0, old.stderr);
  assert(exists(store(fx)), "an older Deno is not used: the pinned one is fetched");
});

Deno.test({ name: "from a pipe the setup is fetched from where the script came from, again on each run; BOOTSTRAP_SETUP names another", ignore: skipUnlessX64 }, async () => {
  await using fx = await Fx.make();
  const z = await zipOf(fx, FAKE_DENO(PINNED));
  const script = Deno.readTextFileSync(BOOT_SH);
  const piped = await sh(
    ["sh", "-s", "--", "--dry-run"],
    env(fx, { BOOTSTRAP_DENO_URL: z.url, BOOTSTRAP_DENO_SHA256: z.sha, BOOTSTRAP_URL: "https://example.test/repo/abc123/" }),
    { stdin: script },
  );
  assertEquals(piped.code, 0, piped.stderr);
  const r = recorded(fx);
  assert(r.includes("--reload=https://example.test/repo/abc123/"), r.join(" "));
  assertEquals(r.slice(-2), ["https://example.test/repo/abc123/bin/setup/main.ts", "--dry-run"]);
  const given = await sh(["sh", BOOT_SH], env(fx, { BOOTSTRAP_SETUP: "/somewhere/main.ts" }));
  assertEquals(given.code, 0, given.stderr);
  assertEquals(recorded(fx).at(-1), "/somewhere/main.ts");
  assert(!recorded(fx).some((x) => x.startsWith("--reload")));
});

Deno.test({ name: "the first download is tried again with a longer wait, and gives up after its tries", ignore: skipUnlessX64 }, async () => {
  await using fx = await Fx.make();
  fx.stub("sleep", `echo "$1" >>"${fx.tmp}/sleeps"`);
  const p = await sh(["sh", BOOT_SH], env(fx, { BOOTSTRAP_DENO_URL: "file:///nonexistent.zip", BOOTSTRAP_DENO_SHA256: "0".repeat(64), ERGA_RETRIES: "3" }));
  assertEquals(p.code, 3);
  assertStringIncludes(p.stderr, "trying again in 3s (attempt 2 of 3)");
  assertStringIncludes(p.stderr, "(3 tries; the network or DNS is the likely cause)");
  assertEquals(Deno.readTextFileSync(`${fx.tmp}/sleeps`).split("\n").filter((x) => x !== ""), ["3", "6"]);
  Deno.removeSync(`${fx.tmp}/sleeps`);
  const patient = await sh(["sh", BOOT_SH, "--patient"], env(fx, { BOOTSTRAP_DENO_URL: "file:///nonexistent.zip", BOOTSTRAP_DENO_SHA256: "0".repeat(64) }));
  assertStringIncludes(patient.stderr, "(attempt 15 of 15)");
});

Deno.test({ name: "without unzip, busybox or bsdtar, the one package line is named and nothing is unpacked", ignore: skipUnlessX64 }, async () => {
  await using fx = await Fx.make();
  const z = await zipOf(fx, FAKE_DENO(PINNED));
  const lean = `${fx.tmp}/lean`;
  Deno.mkdirSync(lean);
  for (const t of ["sh", "uname", "awk", "mkdir", "mktemp", "dirname", "curl", "sha256sum", "chmod", "mv", "rm", "cat", "sed", "printf", "sleep"]) {
    const real = (await sh(["sh", "-c", `command -v ${t}`], { PATH: SYSTEM })).stdout.trim();
    if (real.startsWith("/")) Deno.symlinkSync(real, `${lean}/${t}`);
  }
  const none = await sh(["sh", BOOT_SH], { ...env(fx, { BOOTSTRAP_DENO_URL: z.url, BOOTSTRAP_DENO_SHA256: z.sha }), PATH: lean });
  assertEquals(none.code, 3);
  assertStringIncludes(none.stderr, "sudo apt-get install -y unzip");
  assert(!exists(store(fx)));
});

Deno.test("a system with no Deno build stops with the Windows line where it is Windows-like", async () => {
  await using fx = await Fx.make();
  fx.stub("uname", 'case "$1" in -s) echo MINGW64_NT ;; -m) echo x86_64 ;; esac');
  const p = await sh(["sh", BOOT_SH], env(fx));
  assertEquals(p.code, 3);
  assertStringIncludes(p.stderr, "erga-bootstrap.ps1 | iex");
  fx.stub("uname", 'case "$1" in -s) echo Linux ;; -m) echo riscv64 ;; esac');
  assertStringIncludes((await sh(["sh", BOOT_SH], env(fx))).stderr, "no Deno for linux on riscv64");
});

Deno.test("end to end: the bootstrap from this checkout runs the real setup with the Deno running these tests", async () => {
  await using fx = await Fx.make();
  Deno.symlinkSync(DENO, `${fx.bin}/deno`);
  const osr = `${fx.tmp}/os-release`;
  Deno.writeTextFileSync(osr, 'ID=debian\nPRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nVERSION_ID=13\n');
  const base = { ...env(fx), TERM: "dumb", BOOTSTRAP_NO_NETCHECK: "1", BOOTSTRAP_OS_RELEASE: osr, DENO_DIR: `${fx.tmp}/deno-dir` };
  const dry = await sh(["sh", BOOT_SH, "--dry-run"], base);
  assertEquals(dry.code, 0, dry.stdout + dry.stderr);
  assertStringIncludes(dry.stdout, "Setting up erga in this account");
  assertStringIncludes(dry.stdout, "That was a dry run");
  const setup = await sh(["sh", `${ROOT}/bin/erga-setup.sh`], { ...base, ...OFF });
  assertEquals(setup.code, 0, setup.stdout + setup.stderr);
  assertStringIncludes(Deno.readTextFileSync(`${fx.home}/.config/erga/install.toml`), 'method = "setup"', "erga-setup.sh is the setup alone");
  assertEquals((await sh(["sh", BOOT_SH, "--nonsense"], base)).code, 2);
});

// ---- the scripts themselves

Deno.test("the shell scripts are POSIX sh, parse in every shell here, and pass shellcheck where it is installed", async () => {
  for (const f of [BOOT_SH, `${ROOT}/bin/erga-setup.sh`]) {
    const text = Deno.readTextFileSync(f);
    assertEquals(text.split("\n")[0], "#!/bin/sh");
    assert(((Deno.statSync(f).mode ?? 0) & 0o111) !== 0, f);
    for (const line of text.split("\n").filter((l) => !l.trimStart().startsWith("#"))) {
      assert(!/\[\[ | \]\]|<<<|\$\{!|(^|[;&|(]\s*)(source|local|declare|typeset|function|mapfile|readarray|shopt)\s/.test(line), `a bashism in ${f}: ${line}`);
      assert(!/(?<!\\)`/.test(line.replace(/\s#\s.*$/, "")), `a backtick, which the shell runs as a command: ${line}`);
    }
    for (const shell of [["sh", "-n"], ["dash", "-n"], ["bash", "--posix", "-n"], ["busybox", "ash", "-n"]]) {
      const found = (await sh(["sh", "-c", `command -v ${shell[0]}`], { PATH: SYSTEM })).code === 0;
      if (!found) continue;
      const p = await sh([...shell, f], { PATH: SYSTEM });
      assertEquals(p.code, 0, `${shell.join(" ")} ${f}: ${p.stderr}`);
    }
    if ((await sh(["sh", "-c", "command -v shellcheck"], { PATH: Deno.env.get("PATH") ?? SYSTEM })).code === 0) {
      const p = await sh(["shellcheck", "-s", "sh", "-S", "warning", f], { PATH: Deno.env.get("PATH") ?? SYSTEM });
      assertEquals(p.code, 0, p.stdout);
    }
  }
  assert(Deno.readTextFileSync(BOOT_SH).split("\n").length <= 120, "the bootstrap stays small: it only gets Deno");
});

Deno.test("the Deno pins in both bootstraps are commons' generated pins (commons 0002-packaging FR-014, FR-015)", () => {
  const env = Object.fromEntries(
    Deno.readTextFileSync(`${ROOT}/commons/generated/pins.auto.env`).split("\n").filter((l) => /^DENO_/.test(l)).map((l) => l.split("=") as [string, string]),
  );
  assertEquals(env.DENO_VERSION, PINNED);
  assertEquals(Object.keys(env).length, 6, "the version and five platforms");
  const shText = Deno.readTextFileSync(BOOT_SH);
  const psText = Deno.readTextFileSync(BOOT_PS1);
  for (const [k, v] of Object.entries(env)) {
    assertMatch(v, /^(\d+\.\d+\.\d+|[0-9a-f]{64})$/);
    if (k.includes("_WINDOWS_")) assert(!shText.includes(k), "a POSIX shell never runs on Windows: only the .ps1 carries that pin");
    else assertStringIncludes(shText, `\n${k}=${v}\n`);
    assertStringIncludes(psText, `\n$${k} = '${v}'\n`);
  }
  for (const [plat, sum] of Object.entries(pins.deno.sha256)) {
    assertEquals(
      env[`DENO_SHA256_${{ "linux-x64": "X86_64", "linux-arm64": "AARCH64", "macos-x64": "MACOS_X64", "macos-arm64": "MACOS_ARM64", "windows-x64": "WINDOWS_X64" }[plat]}`],
      sum,
      plat,
    );
  }
});

Deno.test("the PowerShell bootstrap gets Deno into erga's Windows store and hands over; the old Windows line runs it", async () => {
  const ps = Deno.readTextFileSync(BOOT_PS1);
  for (
    const n of [
      "Invoke-WebRequest",
      "Get-FileHash -Algorithm SHA256",
      "Expand-Archive",
      "erga\\toolchain\\deno\\$DENO_VERSION\\windows-x64",
      "deno.exe",
      "deno-x86_64-pc-windows-msvc.zip",
      "@args",
      "--no-config",
    ]
  ) {
    assertStringIncludes(ps, n);
  }
  for (const p of PERMISSIONS) assertStringIncludes(ps, p);
  assert(!ps.includes(" -A ") && !ps.includes("--allow-all"));
  assert(ps.split("\n").length <= 80, "the PowerShell bootstrap stays small");
  const old = Deno.readTextFileSync(`${ROOT}/bin/erga-windows.ps1`);
  assertStringIncludes(old, "erga-bootstrap.ps1");
  // erga's own bin/setup.ps1 keeps Deno in %LOCALAPPDATA%\erga\toolchain\deno\<version>\windows-x64: the same store
  assertStringIncludes(ps, 'Join-Path $DataHome "erga\\toolchain\\deno\\$DENO_VERSION\\windows-x64"');
  const pwsh = (await sh(["sh", "-c", "command -v pwsh || command -v powershell"], { PATH: Deno.env.get("PATH") ?? SYSTEM })).stdout.trim();
  if (pwsh !== "") {
    for (const f of [BOOT_PS1, `${ROOT}/bin/erga-windows.ps1`]) {
      const code = `$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('${f}',[ref]$null,[ref]$e); if($e){$e; exit 1}`;
      assertEquals((await sh([pwsh, "-NoProfile", "-Command", code], { PATH: SYSTEM })).code, 0, f);
    }
  }
});

Deno.test("bin holds the two bootstraps, the two agora installers, the two kept entry points and the TypeScript setup, and nothing else (FR-006)", () => {
  assertEquals([...Deno.readDirSync(`${ROOT}/bin`)].map((e) => e.name).sort(), [
    "agora-install.ps1",
    "agora-install.sh",
    "erga-bootstrap.ps1",
    "erga-bootstrap.sh",
    "erga-setup.sh",
    "erga-windows.ps1",
    "setup",
  ]);
  assert(Deno.readTextFileSync(`${ROOT}/bin/erga-setup.sh`).split("\n").length <= 8, "erga-setup.sh is a stub that runs the bootstrap");
});
