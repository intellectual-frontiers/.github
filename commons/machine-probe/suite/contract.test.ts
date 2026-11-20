/**
 * Tests of the contract of the probe (commons machine-probe 0002-machine-probe-contract FR-001 to FR-004): the three requests and the refusals, the key line that restricts a key, the command line of the ssh client, and the POSIX script
 * run for real with the requests a restricted key would send. Every name is made up.
 *
 * @module
 */
import * as proc from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { target } from "@intellectual-frontiers/headless/logical";
import { sshExecutor } from "@intellectual-frontiers/headless/targets/ssh";
import { encodeRequest, parseRequest, PROBE_PATH } from "../src/governance/mod.ts";
import { posixScriptPath, probeKeyLine, probeScript, sendVia } from "../src/physical/mod.ts";

const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl";

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

proves(["0002-machine-probe-contract FR-002"], "the key line forces the probe and restricts the key, may be limited to addresses, and a text that is not one public key line is refused", () => {
  assertEquals(probeKeyLine(`${KEY} probe@fleet`), { kind: "ok", value: `restrict,command="${PROBE_PATH}" ${KEY} probe@fleet` });
  assertEquals(probeKeyLine(KEY, ["10.0.0.0/8"]), { kind: "ok", value: `restrict,from="10.0.0.0/8",command="${PROBE_PATH}" ${KEY}` });
  for (const bad of ["", "not a key", `${KEY}\nssh-ed25519 AAAA`, "-----BEGIN OPENSSH PRIVATE KEY-----", "command=\"x\" ssh-ed25519 AAAAC3Nza"]) assertEquals(probeKeyLine(bad).kind, "err", JSON.stringify(bad));
  assertEquals(probeKeyLine(KEY, ['a",command="x']).kind, "err", "an address pattern that is not one");
});

proves(["0002-machine-probe-contract FR-003"], "a request is sent as the last argument of the ssh target's batch call that checks the host key against the repository's file, and a request that is not one of the three is not sent", async () => {
  const t = target({ id: "sparta", class: "server", address: "sparta.example", user: "probe", port: 2222, credential: "probe" });
  assert(t.kind === "ok");
  const calls: string[][] = [];
  const run = async (argv: readonly string[]) => (calls.push([...argv]), { code: 0, success: true, signal: null, stdout: new TextEncoder().encode("1\n"), stderr: new Uint8Array() });
  const ex = sshExecutor(t.value, [t.value], { knownHostsRepository: "/repo/known_hosts", knownHostsUser: "/home/a/.ssh/known_hosts", identityFor: () => "/keys/probe" }, run);
  const send = sendVia(ex);
  assertEquals((await send("version")).stdout, "1\n");
  const a = calls[0] ?? [];
  for (const o of ["-T", "BatchMode=yes", "IdentitiesOnly=yes", "StrictHostKeyChecking=yes", "UserKnownHostsFile=/repo/known_hosts /home/a/.ssh/known_hosts", "PasswordAuthentication=no"]) assert(a.includes(o), `has ${o}`);
  assert(!a.includes("StrictHostKeyChecking=no"));
  assertEquals(a.slice(-2), ["probe@sparta.example", "version"]);
  await send(encodeRequest({ kind: "osquery", sql: "SELECT 1" }));
  assertEquals(calls[1]?.at(-1), `osquery ${btoa("SELECT 1")}`);
  for (const bad of ["id", "facts; id", "osquery !!!"]) {
    const r = await send(bad);
    assertEquals(r.code, 2, JSON.stringify(bad));
  }
  assertEquals(calls.length, 2, "nothing else was sent");
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
