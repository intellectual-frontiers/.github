/**
 * Tests of the observation (commons machine-probe 0003-machine-probe-observation FR-001 to FR-004): the output of a real probe on Ubuntu (captured, in `suite/fixtures`) read into a typed observation, the keyed records an estate
 * compares, and asking a probe through a fake way of running the command that is unreachable, refuses or prints what is not facts. Every name is made up.
 *
 * @module
 */
import { readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { observedState, parseProbe, toObserved } from "../src/logical/mod.ts";
import { observe, query, type Send } from "../src/physical/mod.ts";

const FACTS = readTextFileSync(resolve(dirname(fromFileUrl(import.meta.url)), "fixtures", "facts-ubuntu-2404.txt"));

proves(["0003-machine-probe-observation FR-001"], "sections and key=value lines are read, a carriage return is dropped, blank lines and lines before a section are skipped, and a value keeps what follows the first =", () => {
  const p = parseProbe("stray=1\r\n\r\n@os\r\nfamily=ubuntu\r\nname=Ubuntu = 24.04\r\n@empty\r\n");
  assertEquals(p, { os: { family: "ubuntu", name: "Ubuntu = 24.04" }, empty: {} });
  const real = parseProbe(FACTS);
  assertEquals(Object.keys(real), ["probe", "os", "hardware", "security", "software", "listening"]);
  assertEquals(real["os"]?.["family"], "ubuntu");
});

proves(["0003-machine-probe-observation FR-002"], "the output of a real probe is a typed observation with unknown for what the probe did not give, and a probe that gave no time is refused", () => {
  const o = toObserved(parseProbe(FACTS));
  assert(o.kind === "ok");
  assertEquals([o.value.os.family, o.value.os.version, o.value.os.arch, o.value.probe, o.value.at], ["ubuntu", "24.04", "x86_64", "1", "2026-11-21T04:11:58Z"]);
  assertEquals([o.value.hardware.cpus, o.value.software.manager, o.value.software.packages], [4, "apt", 92]);
  assertEquals([o.value.security.diskEncryption, o.value.security.firewall, o.value.security.autoUpdates], ["off", "off", "off"]);
  assertEquals(o.value.os.model, undefined, "an empty model is left out");
  assertEquals(o.value.security.sshPasswordAuth, undefined);
  const sparse = toObserved(parseProbe("@probe\nat=2026-12-01T00:00:00Z\n@security\nadadmins=x\nadmins=zed amy\n@listening\nports=443 22 80\n"));
  assert(sparse.kind === "ok");
  assertEquals([sparse.value.security.diskEncryption, sparse.value.security.admins, sparse.value.listening], ["unknown", ["amy", "zed"], [22, 80, 443]]);
  assertEquals(toObserved(parseProbe("@os\nfamily=ubuntu\n")).kind, "err");
  assertEquals(toObserved(parseProbe("@probe\nat=yesterday\n")).kind, "err");
});

proves(["0003-machine-probe-observation FR-003"], "the keyed records hold no time, no probe version and no counter, so two observations of a machine that did not change are equal", () => {
  const a = toObserved(parseProbe(FACTS));
  const b = toObserved(parseProbe(FACTS.replace("at=2026-11-21T04:11:58Z", "at=2026-11-22T04:11:58Z").replace("disk_used_pct=71", "disk_used_pct=72").replace("memory_mb=16087", "memory_mb=16000").replace("pending_updates=0", "pending_updates=3")));
  assert(a.kind === "ok" && b.kind === "ok");
  assertEquals(observedState(a.value), observedState(b.value));
  const text = JSON.stringify(observedState(a.value));
  for (const word of ["2026", "pendingUpdates", "memoryMB", "diskUsedPct", "\"probe\""]) assert(!text.includes(word), `no ${word}`);
  const changed = toObserved(parseProbe(FACTS.replace("firewall=off", "firewall=on")));
  assert(changed.kind === "ok");
  assert(JSON.stringify(observedState(changed.value)) !== text);
});

const reply = (code: number, stdout = "", stderr = ""): Send => async () => ({ code, stdout, stderr });

proves(["0003-machine-probe-observation FR-004"], "an observation is given only where the probe answered; unreachable, refused and unreadable say so, and a query that is not one SELECT is refused before anything is sent", async () => {
  const ok = await observe(reply(0, FACTS));
  assert(ok.kind === "ok" && ok.value.os.family === "ubuntu");
  const sent: string[] = [];
  await observe(async (r) => (sent.push(r), { code: 0, stdout: FACTS, stderr: "" }));
  assertEquals(sent, ["facts"]);
  const unreachable = await observe(reply(255, "", "ssh: connect to host synthetic-server-03 port 22: Connection refused\n"));
  assert(unreachable.kind === "err" && unreachable.error.kind === "unreachable" && unreachable.error.message.includes("Connection refused"));
  const thrown = await observe(async () => { throw new Error("no ssh client"); });
  assert(thrown.kind === "err" && thrown.error.kind === "unreachable");
  const refused = await observe(reply(2, "", "only SELECT\n"));
  assert(refused.kind === "err" && refused.error.kind === "refused" && refused.error.message === "only SELECT");
  const junk = await observe(reply(0, "hello"));
  assert(junk.kind === "err" && junk.error.kind === "unreadable");

  const rows = await query(reply(0, JSON.stringify([{ name: "root", uid: 0 }, { name: "amy", uid: 1000 }])), "SELECT name, uid FROM users");
  assertEquals(rows, { kind: "ok", value: [{ name: "root", uid: "0" }, { name: "amy", uid: "1000" }] });
  let called = false;
  const refusedQuery = await query(async () => { called = true; return { code: 0, stdout: "[]", stderr: "" }; }, "DELETE FROM users");
  assert(refusedQuery.kind === "err" && refusedQuery.error.kind === "refused" && !called, "nothing was sent");
  assertEquals((await query(reply(0, "{}"), "SELECT 1")).kind, "err");
  assertEquals((await query(reply(0, "not json"), "SELECT 1")).kind, "err");
  const noOsquery = await query(reply(3, "", "osquery is not installed here\n"), "SELECT 1");
  assert(noOsquery.kind === "err" && noOsquery.error.kind === "refused");
});
