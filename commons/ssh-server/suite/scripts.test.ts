/**
 * Tests of the script renderers: determinism, drift against committed samples, no secret, shellcheck and PSScriptAnalyzer where they are installed, and the catalog of pins.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OSQUERY_PINS, archOf, defaultPlan, renderBootstrapPs, renderBootstrapSh } from "@intellectual-frontiers/ssh-server/logical";
import { syntheticFacts } from "./helpers.ts";

const SESSION = { id: "en-abcdefghijklmnop" };
const ENDPOINT = { host: "opsfolio", port: 2222 };
const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPlaceholderPlaceholderPlaceholderPlace";
const SH = (): string => renderBootstrapSh(SESSION, OSQUERY_PINS, ENDPOINT, { hostKey: KEY, pairing: { kind: "digits", length: 6 } });
const PS = (): string => renderBootstrapPs(SESSION, OSQUERY_PINS, ENDPOINT, { hostKey: KEY, pairing: { kind: "digits", length: 6 } });
const SAMPLES = join(import.meta.dirname ?? ".", "samples");
const has = (program: string, args: string[]): boolean => spawnSync(program, args, { stdio: "ignore" }).status === 0;

proves(["0004-scripts FR-004"], "a script is deterministic, holds no secret and no real name, and its hash is that of its bytes", () => {
  assertEquals(SH(), SH());
  assertEquals(PS(), PS());
  assert(SH() !== renderBootstrapSh({ id: "en-bbbbbbbbbbbbbbbb" }, OSQUERY_PINS, ENDPOINT), "the session is in the script");
  for (const text of [SH(), PS()]) {
    assert(!/(password|secret|passphrase)\s*=\s*['"][^'"]+['"]/i.test(text), "no secret");
    assert(!/BEGIN [A-Z ]*PRIVATE KEY/.test(text), "no private key");
    assert(!text.includes("tok-"), "no token");
    assert(text.includes("en-abcdefghijklmnop"));
  }
  assert(SH().startsWith("#!/bin/sh\n"));
  assert(SH().trimEnd().endsWith('main "$@"'), "the work runs from one call on the last line");
  assertEquals(createHash("sha256").update(SH()).digest("hex").length, 64);
});

proves(["0004-scripts FR-001", "0004-scripts FR-002", "0004-scripts FR-007"], "the script for sh is safe by construction: set -eu, no eval, argument vectors without a shell, and a hash check before an installer", () => {
  const sh = SH();
  assert(sh.includes("set -eu"));
  assert(!/\beval\b/.test(sh.replace(/#.*$/gm, "").replace(/never evaluates/g, "")), "no eval");
  assert(!/\bsh -c\b|\bbash -c\b/.test(sh), "no shell -c");
  assert(sh.includes('set -f'), "no globbing of a plan's words");
  assert(sh.indexOf('sha_of "$file"') < sh.indexOf("as_root dpkg -i"), "the hash is checked before dpkg");
  assert(sh.includes("StrictHostKeyChecking"), "strict host keys");
  assert(sh.includes("ssh-keygen -q -t ed25519"), "the key is made on the device");
  assert(sh.includes("/dev/tty"), "consent is asked on the terminal");
  assert(sh.indexOf("ask_consent; then") < sh.indexOf("step_install_package \"$f1\""), "consent comes before the install");
  assertEquals(SH().includes("opsfolio enroll approve"), true);
  const ps = PS();
  assert(ps.startsWith("#Requires -Version 7.0"));
  assert(ps.includes("Set-StrictMode -Version Latest") && ps.includes("$ErrorActionPreference = 'Stop'"));
  assert(!/Invoke-Expression|iex /.test(ps), "no Invoke-Expression");
  assert(ps.includes("Get-CimInstance") && ps.includes("Get-NetAdapter") && ps.includes("winget"));
  assert(ps.indexOf("Get-Consent") < ps.lastIndexOf("Invoke-Step"), "consent before the steps");
  assert(ps.indexOf("Get-Sha256 -Path $file") < ps.indexOf("msiexec.exe"), "the hash is checked before msiexec");
});

proves(["0004-scripts FR-005"], "the scripts are what the committed samples are (set UPDATE_SAMPLES=1 to write them after a change you mean)", () => {
  for (const [name, text] of [["bootstrap.sh", SH()], ["bootstrap.ps1", PS()]] as const) {
    const file = join(SAMPLES, name);
    if (process.env["UPDATE_SAMPLES"] === "1") writeFileSync(file, text);
    assertEquals(readFileSync(file, "utf8"), text, `${name} drifted from its sample`);
  }
});

proves(["0004-scripts FR-006"], "shellcheck and PSScriptAnalyzer find nothing in the scripts, and the shell and PowerShell parse them", () => {
  const dir = mkdtempSync(join(tmpdir(), "ssh-server-scripts-"));
  try {
    const variants: [string, string][] = [["a.sh", SH()], ["b.sh", renderBootstrapSh(SESSION, OSQUERY_PINS, ENDPOINT, { pairing: { kind: "letters", length: 4 } })]];
    for (const [name, text] of variants) {
      writeFileSync(join(dir, name), text);
      assertEquals(spawnSync("sh", ["-n", join(dir, name)]).status, 0, `${name} parses`);
      if (has("shellcheck", ["--version"])) {
        const r = spawnSync("shellcheck", ["-s", "sh", join(dir, name)], { encoding: "utf8" });
        assertEquals(r.status, 0, r.stdout);
      }
    }
    const ps = [["a.ps1", PS()], ["b.ps1", renderBootstrapPs(SESSION, OSQUERY_PINS, ENDPOINT, { pairing: { kind: "letters", length: 4 } })]] as const;
    if (has("pwsh", ["-NoProfile", "-Command", "exit 0"])) {
      for (const [name, text] of ps) {
        writeFileSync(join(dir, name), text);
        const parse = spawnSync("pwsh", ["-NoProfile", "-Command", `$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${join(dir, name)}',[ref]$null,[ref]$e); $e.Count`], { encoding: "utf8" });
        assertEquals(parse.stdout.trim(), "0", `${name} parses`);
        if (has("pwsh", ["-NoProfile", "-Command", "if (Get-Module -ListAvailable PSScriptAnalyzer) { exit 0 } else { exit 1 }"])) {
          const r = spawnSync("pwsh", ["-NoProfile", "-Command", `(Invoke-ScriptAnalyzer -Path '${join(dir, name)}' | Measure-Object).Count`], { encoding: "utf8" });
          assertEquals(r.stdout.trim(), "0", `${name}: PSScriptAnalyzer found something`);
        }
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

proves(["0004-scripts FR-008"], "the catalog holds osquery 5.24.1 of its official release with a SHA-256 for each platform, and the default plan picks by installer and architecture", () => {
  assertEquals(OSQUERY_PINS.length, 6);
  for (const p of OSQUERY_PINS) {
    assertEquals(p.step.version, "5.24.1");
    assert(p.step.url.startsWith("https://github.com/osquery/osquery/releases/download/5.24.1/"), p.step.url);
    assert(/^[0-9a-f]{64}$/.test(p.step.sha256));
  }
  assertEquals(new Set(OSQUERY_PINS.map((p) => p.step.sha256)).size, 6, "six different artifacts");
  const facts = syntheticFacts(1);
  const deb = defaultPlan(facts).steps[0];
  assert(deb?.kind === "install-package" && deb.installer === "deb" && deb.url.endsWith("amd64.deb"));
  const arm = defaultPlan({ ...facts, os: { ...facts.os, arch: "aarch64" } }).steps[0];
  assert(arm?.kind === "install-package" && arm.url.endsWith("arm64.deb"));
  const rpm = defaultPlan({ ...facts, packageManager: "dnf" }).steps[0];
  assert(rpm?.kind === "install-package" && rpm.installer === "rpm" && rpm.url.endsWith("x86_64.rpm"));
  const win = defaultPlan({ ...facts, os: { family: "windows", name: "Windows", version: "11", arch: "x86_64" }, packageManager: "winget" }).steps[0];
  assert(win?.kind === "install-package" && win.installer === "msi");
  const mac = defaultPlan({ ...facts, os: { family: "macos", name: "macOS", version: "15", arch: "aarch64" }, packageManager: "brew" }).steps[0];
  assert(mac?.kind === "install-package" && mac.installer === "pkg");
  assertEquals(defaultPlan({ ...facts, packageManager: "apk" }).steps, [], "no pin for apk: left out, not guessed");
  assertEquals(defaultPlan({ ...facts, os: { ...facts.os, arch: "riscv64" } }).steps, []);
  assertEquals(archOf("x86_64"), "amd64");
});
