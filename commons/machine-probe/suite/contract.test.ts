/**
 * Tests of the contract of the probe (commons machine-probe 0002-machine-probe-contract FR-001 to FR-004): the three requests and the refusals, the key line that restricts a key, the command line of the ssh client, and the POSIX script
 * run for real with the requests a restricted key would send. Every name is made up.
 *
 * @module
 */
import * as proc from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { encodeRequest, keyLine, parseRequest, PROBE_PATH, sshArgv, type ProbeTarget } from "../src/governance/mod.ts";
import { posixScriptPath, probeScript } from "../src/physical/mod.ts";

const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl";
const TARGET: ProbeTarget = { user: "probe", host: "sparta.example", port: 2222, identityFile: "/keys/probe", knownHostsFile: "/repo/known_hosts" };

proves(["0002-machine-probe-contract FR-001"], "only facts, version and one osquery SELECT are accepted, every other request is refused with its reason, and an encoded request is read back", () => {
  assertEquals(parseRequest("facts"), { kind: "ok", value: { kind: "facts" } });
  assertEquals(parseRequest("version"), { kind: "ok", value: { kind: "version" } });
  const q = parseRequest(encodeRequest({ kind: "osquery", sql: "SELECT name FROM users; " }));
  assertEquals(q, { kind: "ok", value: { kind: "osquery", sql: "SELECT name FROM users" } });
  assertEquals(parseRequest(encodeRequest({ kind: "osquery", sql: "with t as (select 1) select * from t" })).kind, "ok");
  for (const bad of ["id", "facts; id", "FACTS", "", "osquery", "osquery !!!"]) assertEquals(parseRequest(bad).kind, "err", JSON.stringify(bad));
  const del = parseRequest(encodeRequest({ kind: "osquery", sql: "DELETE FROM users" }));
  assert(del.kind === "err" && del.error === "only SELECT");
  const two = parseRequest(encodeRequest({ kind: "osquery", sql: "SELECT 1; SELECT 2" }));
  assert(two.kind === "err" && two.error === "one statement");
  const unknown = parseRequest("id");
  assert(unknown.kind === "err" && unknown.error.includes("facts, version, osquery"));
});

proves(["0002-machine-probe-contract FR-002"], "the key line forces the probe and restricts the key, and a key or a comment that could add an option or a line is refused", () => {
  const line = keyLine(KEY, "probe@fleet");
  assert(line.kind === "ok");
  assertEquals(line.value, `command="${PROBE_PATH}",restrict ${KEY} probe@fleet`);
  assert(keyLine(`${KEY} ignored comment`, "probe@fleet").kind === "ok", "the comment of the key itself is dropped");
  for (const bad of ["", "not a key", `${KEY}\nssh-ed25519 AAAA`, "ssh-ed25519", "command=\"x\" ssh-ed25519 AAAAC3Nza"]) assertEquals(keyLine(bad, "probe@fleet").kind, "err", JSON.stringify(bad));
  for (const bad of ["probe fleet", "a\nb", "x\"y", ""]) assertEquals(keyLine(KEY, bad).kind, "err", JSON.stringify(bad));
});

proves(["0002-machine-probe-contract FR-003"], "the ssh command line uses the key alone, checks the host key against the file given, asks for no terminal or forwarding or password, and ends with the request", () => {
  const argv = sshArgv(TARGET, { kind: "facts" });
  assert(argv.kind === "ok");
  const a = argv.value;
  for (const o of ["-T", "-a", "-x", "BatchMode=yes", "IdentitiesOnly=yes", "StrictHostKeyChecking=yes", "UserKnownHostsFile=/repo/known_hosts", "PasswordAuthentication=no"]) assert(a.includes(o), `has ${o}`);
  assertEquals(a.slice(a.indexOf("-i"), a.indexOf("-i") + 2), ["-i", "/keys/probe"]);
  assertEquals(a.slice(-2), ["probe@sparta.example", "facts"]);
  assert(!a.includes("StrictHostKeyChecking=no") && !a.includes("-A"));
  assertEquals(a.slice(a.indexOf("-p"), a.indexOf("-p") + 2), ["-p", "2222"]);
  const { port: _port, ...noPort } = TARGET;
  assert(!sshArgv(noPort, { kind: "version" }).kind.includes("err") && !(sshArgv(noPort, { kind: "version" }) as { value: readonly string[] }).value.includes("-p"), "no port, no -p");
  assertEquals(sshArgv({ ...TARGET, host: "fe80::1" }, { kind: "facts" }).kind, "ok", "an address of IPv6");
  for (const bad of [{ user: "a b" }, { host: "x;y" }, { port: 0 }, { port: 70000 }, { user: "-oProxyCommand" }, { user: "-v" }, { host: "-oProxyCommand" }]) assertEquals(sshArgv({ ...TARGET, ...bad }, { kind: "facts" }).kind, "err", JSON.stringify(bad));
});

const sh = async (request: string, env: Record<string, string> = {}) => {
  const r = await proc.run(["sh", posixScriptPath()], { env: { SSH_ORIGINAL_COMMAND: request, ...env } });
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
