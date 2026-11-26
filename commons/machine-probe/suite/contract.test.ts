/**
 * Tests of the contract of the probe (commons machine-probe 0002-machine-probe-contract FR-001 to FR-004): the three requests and the refusals, the key line that restricts a key, the command line of the ssh client, and the POSIX script
 * run for real with the requests a restricted key would send. Every name is made up.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as proc from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { target } from "@intellectual-frontiers/headless/logical";
import { sshExecutor } from "@intellectual-frontiers/headless/targets/ssh";
import { encodeRequest, parseRequest, PROBE_PATH } from "../src/governance/mod.ts";
import { probeCommand, probeScriptPath, probeKeyLine, probeScript, scriptKindOf, sendVia } from "../src/physical/mod.ts";

const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl";

proves(["0002-machine-probe-contract FR-001"], "only facts, version and one osquery SELECT are accepted, every other request is refused with its reason, and an encoded request is read back", () => {
  assertEquals(parseRequest("facts"), { kind: "ok", value: { kind: "facts" } });
  assertEquals(parseRequest("version"), { kind: "ok", value: { kind: "version" } });
  const q = parseRequest(encodeRequest({ kind: "osquery", sql: "SELECT name FROM users; " }));
  assertEquals(q, { kind: "ok", value: { kind: "osquery", sql: "SELECT name FROM users" } });
  assertEquals(parseRequest(encodeRequest({ kind: "osquery", sql: "with t as (select 1) select * from t" })).kind, "ok");
  for (const bad of ["id", "facts; id", "FACTS", "", "osquery", "osquery !!!"]) assertEquals(parseRequest(bad).kind, "err", JSON.stringify(bad));
  const del = parseRequest(encodeRequest({ kind: "osquery", sql: "DELETE FROM users" }));
  assert(del.kind === "err" && del.error.startsWith("delete is not in the language read-only"));
  const two = parseRequest(encodeRequest({ kind: "osquery", sql: "SELECT 1; SELECT 2" }));
  assert(two.kind === "err" && two.error.startsWith("the text has 2 statements"));
  const unknown = parseRequest("id");
  assert(unknown.kind === "err" && unknown.error.includes("facts, version, osquery"));
});

proves(["0002-machine-probe-contract FR-002"], "the key line forces the probe and restricts the key, may be limited to addresses, and a text that is not one public key line is refused", () => {
  assertEquals(probeKeyLine(`${KEY} probe@fleet`), { kind: "ok", value: `restrict,command="${PROBE_PATH}" ${KEY} probe@fleet` });
  assertEquals(probeKeyLine(KEY, ["10.0.0.0/8"]), { kind: "ok", value: `restrict,from="10.0.0.0/8",command="${PROBE_PATH}" ${KEY}` });
  for (const bad of ["", "not a key", `${KEY}\nssh-ed25519 AAAA`, ["-----BEGIN OPENSSH", "PRIVATE KEY-----"].join(" "), "command=\"x\" ssh-ed25519 AAAAC3Nza"]) assertEquals(probeKeyLine(bad).kind, "err", JSON.stringify(bad));
  assertEquals(probeKeyLine(KEY, ['a",command="x']).kind, "err", "an address pattern that is not one");
});

proves(["0002-machine-probe-contract FR-003"], "a request is sent as the last argument of the ssh target's batch call that checks the host key against the repository's file, and a request that is not one of the three is not sent", async () => {
  const t = target({ id: "synthetic-server-03", class: "server", address: "synthetic-server-03.example", user: "probe", port: 2222, credential: "probe" });
  assert(t.kind === "ok");
  const calls: string[][] = [];
  const run = async (argv: readonly string[]) => (calls.push([...argv]), { code: 0, success: true, signal: null, stdout: new TextEncoder().encode("1\n"), stderr: new Uint8Array() });
  const ex = sshExecutor(t.value, [t.value], { knownHostsRepository: "/repo/known_hosts", knownHostsUser: "/home/a/.ssh/known_hosts", identityFor: () => "/keys/probe" }, run);
  const send = sendVia(ex);
  assertEquals((await send("version")).stdout, "1\n");
  const a = calls[0] ?? [];
  for (const o of ["-T", "BatchMode=yes", "IdentitiesOnly=yes", "StrictHostKeyChecking=yes", "UserKnownHostsFile=/repo/known_hosts /home/a/.ssh/known_hosts", "PasswordAuthentication=no"]) assert(a.includes(o), `has ${o}`);
  assert(!a.includes("StrictHostKeyChecking=no"));
  assertEquals(a.slice(-2), ["probe@synthetic-server-03.example", "version"]);
  await send(encodeRequest({ kind: "osquery", sql: "SELECT 1" }));
  assertEquals(calls[1]?.at(-1), `osquery ${btoa("SELECT 1")}`);
  for (const bad of ["id", "facts; id", "osquery !!!"]) {
    const r = await send(bad);
    assertEquals(r.code, 2, JSON.stringify(bad));
  }
  assertEquals(calls.length, 2, "nothing else was sent");
});

const sh = async (request: string, env: Record<string, string> = {}) => {
  const r = await proc.run(["sh", probeScriptPath("posix")], { env: { SSH_ORIGINAL_COMMAND: request, ...env } });
  return { code: r.code, stdout: r.stdout, stderr: r.stderr };
};

proves(["0002-machine-probe-contract FR-004"], "the POSIX script answers facts and version, refuses every other request with status 2 and nothing printed, and says osquery is missing with status 3", async (t) => {
  if (proc.which("sh") === undefined) return t.skip("no POSIX shell here");
  const facts = await sh("facts");
  assertEquals(facts.code, 0);
  assert(facts.stdout.startsWith("@probe\nversion=1\nat="), "facts start with the probe section");
  for (const section of ["@os", "@hardware", "@security", "@software", "@listening"]) assert(facts.stdout.includes(section), `has ${section}`);
  assertEquals((await sh("version")).stdout, "1\n");
  for (const bad of ["id", "facts; id", "facts && id", "$(id)", "sh", "cat /etc/shadow", "osquery"]) {
    const r = await sh(bad);
    assert(r.code === 2 || r.code === 3, `${JSON.stringify(bad)} ends with ${r.code}`);
    assertEquals(r.stdout, "", `${JSON.stringify(bad)} prints nothing`);
  }
  const noOsquery = await sh(encodeRequest({ kind: "osquery", sql: "SELECT 1" }), { PATH: "/usr/bin:/bin" });
  if (!(await proc.run(["sh", "-c", "command -v osqueryi"], { env: { PATH: "/usr/bin:/bin" } })).success) assertEquals([noOsquery.code, noOsquery.stdout], [3, ""]);
  assertEquals((await sh(`osquery ${btoa("DELETE FROM t")}`)).stdout, "");
  const ps1 = await probeScript("windows");
  for (const word of ["'^facts$'", "'^version$'", "'^osquery (\\S+)$'", "only SELECT", "one statement", "exit 2"]) assert(ps1.includes(word), `the PowerShell script has ${word}`);
  assert((await probeScript("posix")).startsWith("#!/bin/sh"));
});

proves(["0002-machine-probe-contract FR-004"], "the Windows script is run by PowerShell 7 with the same requests and refuses the same", async () => {
  const pwsh = await proc.run(["sh", "-c", "command -v pwsh"], {});
  if (!pwsh.success) return;
  const run = (request: string) => {
    const argv = probeCommand("windows", probeScriptPath("windows"), request);
    return proc.run([...argv], {});
  };
  assertEquals((await run("version")).stdout, "1\n");
  for (const bad of ["id", "facts; id", "facts && id", "$(id)", "sh", "cat /etc/shadow", "osquery"]) {
    const r = await run(bad);
    assert(r.code === 2 || r.code === 3, `${JSON.stringify(bad)} ends with ${r.code}`);
    assertEquals(r.stdout, "", `${JSON.stringify(bad)} prints nothing`);
  }
  assertEquals([...probeCommand("windows", "/p.ps1", "osquery QUJD")], ["pwsh", "-NoProfile", "-NonInteractive", "-File", "/p.ps1", "osquery", "QUJD"]);
  assertEquals([...probeCommand("posix", "/p.sh", "facts")], ["sh", "/p.sh", "facts"]);
  assertEquals([scriptKindOf("windows"), scriptKindOf("debian"), scriptKindOf("macos")], ["windows", "posix", "posix"]);
});

proves(["0002-machine-probe-contract FR-006"], "PSScriptAnalyzer finds nothing in the Windows script and PowerShell parses it", () => {
  const has = (args: string[]) => spawnSync("pwsh", ["-NoProfile", "-Command", ...args], { encoding: "utf8" }).status === 0;
  if (!has(["exit 0"])) return;
  const file = probeScriptPath("windows");
  const parse = spawnSync("pwsh", ["-NoProfile", "-Command", `$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${file}',[ref]$null,[ref]$e); $e.Count`], { encoding: "utf8" });
  assertEquals(parse.stdout.trim(), "0");
  if (!has(["if (Get-Module -ListAvailable PSScriptAnalyzer) { exit 0 } else { exit 1 }"])) return;
  const r = spawnSync("pwsh", ["-NoProfile", "-Command", `Invoke-ScriptAnalyzer -Path '${file}' | ForEach-Object { $_.RuleName + ' ' + $_.Line }`], { encoding: "utf8" });
  assertEquals(r.stdout.trim(), "");
});

proves(["0002-machine-probe-contract FR-006"], "the POSIX script run on the machine itself answers an osquery request given as words, as a forced command would give it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "probe-"));
  try {
    const fake = join(dir, "osqueryi");
    writeFileSync(fake, '#!/bin/sh\nprintf \'[{"echoed":"%s"}]\\n\' "$2"\n');
    chmodSync(fake, 0o755);
    const argv = probeCommand("posix", probeScriptPath("posix"), encodeRequest({ kind: "osquery", sql: "SELECT 1" }));
    const r = await proc.run(["sh", "-c", `PATH=${dir}:$PATH; exec "$@"`, "sh", ...argv], {});
    assertEquals(r.code, 0, r.stderr);
    assertEquals(r.stdout.trim(), '[{"echoed":"SELECT 1"}]');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
