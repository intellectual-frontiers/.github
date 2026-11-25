/**
 * Tests of the policy pack (commons machine-probe 0004-machine-probe-policies FR-001 to FR-004): the ten policies and their controls, the verdicts for the observation of a real Ubuntu machine and for made-up ones, the policies that do not
 * apply, and the use of the results by an estate (judged, and checked for the invariants of the Operational Truth Ontology). Every name is made up.
 *
 * @module
 */
import { readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { checkInvariants, judgePolicy } from "@intellectual-frontiers/estate/logical";
import { evaluate, parseProbe, POLICIES, supportedOs, toObserved, type Observed } from "../src/logical/mod.ts";

const FACTS = readTextFileSync(resolve(dirname(fromFileUrl(import.meta.url)), "fixtures", "facts-ubuntu-2404.txt"));
const NOW = "2026-11-22T00:00:00Z";

function observed(text: string = FACTS): Observed {
  const o = toObserved(parseProbe(text));
  if (o.kind === "err") throw new Error(o.error);
  return o.value;
}

const by = (o: Observed, now = NOW) => Object.fromEntries(evaluate(o, now).map((r) => [r.id, r]));

proves(["0004-machine-probe-policies FR-001"], "the pack holds the ten policies in order, each with a title and at least one control", () => {
  assertEquals(POLICIES.map((p) => p.id), ["observed", "disk-encryption", "firewall", "auto-updates", "updates-waiting", "supported-os", "ssh-keys-only", "antivirus", "few-admins", "osquery"]);
  for (const p of POLICIES) assert(p.title.length > 5 && p.controls.length > 0 && p.controls.every((c) => /^[A-Z]{2}-\d{1,2}$/.test(c)), `${p.id} has a title and SP 800-53 controls`);
});

proves(["0004-machine-probe-policies FR-002", "0004-machine-probe-policies FR-003"], "a real Ubuntu observation fails the settings that are off, passes what holds, gives no result for a policy that does not apply, and each result says how to make it pass", () => {
  const r = by(observed());
  assertEquals(Object.keys(r), ["observed", "disk-encryption", "firewall", "auto-updates", "updates-waiting", "supported-os", "few-admins", "osquery"], "no antivirus and no ssh setting were observed");
  assertEquals([r["disk-encryption"]?.status, r["firewall"]?.status, r["auto-updates"]?.status], ["fail", "fail", "fail"]);
  assertEquals([r["observed"]?.status, r["updates-waiting"]?.status, r["supported-os"]?.status, r["few-admins"]?.status, r["osquery"]?.status], ["pass", "pass", "pass", "pass", "warn"]);
  assert(r["firewall"]?.fix.includes("ufw") === true && r["disk-encryption"]?.fix.includes("LUKS") === true);
  assertEquals(r["disk-encryption"]?.controls, ["SC-28"]);
  assertEquals(r["observed"]?.status && by(observed(), "2026-12-05T00:00:00Z")["observed"]?.status, "fail", "an observation older than seven days fails");
});

proves(["0004-machine-probe-policies FR-003"], "on, off, manual and unknown, the thresholds, and the systems the maker supports are judged as specified", () => {
  const base = "@probe\nat=2026-11-21T00:00:00Z\nversion=1\n";
  const of = (extra: string) => by(observed(`${base}${extra}`));
  assertEquals(of("@security\ndisk_encryption=on\nfirewall=on\nauto_updates=on\n")["disk-encryption"]?.status, "pass");
  assertEquals(of("@security\nauto_updates=manual\n")["auto-updates"]?.status, "warn");
  assertEquals(of("@security\n")["disk-encryption"]?.status, "unknown");
  assertEquals(of("@software\npending_updates=21\n")["updates-waiting"]?.status, "warn");
  assertEquals(of("@software\npending_updates=20\n")["updates-waiting"]?.status, "pass");
  assertEquals(of("@security\nadmins=a b c d\n")["few-admins"]?.status, "warn");
  assertEquals(of("@security\nadmins=\n")["few-admins"]?.status, "unknown");
  assertEquals(of("@security\nssh_password_auth=yes\n")["ssh-keys-only"]?.status, "warn");
  assertEquals(of("@security\nssh_password_auth=no\n")["ssh-keys-only"]?.status, "pass");
  assertEquals(of("@security\nantivirus=off\n")["antivirus"]?.status, "fail");
  assertEquals(of("@software\nosquery=5.12.1\n")["osquery"]?.status, "pass");
  const sys = (family: string, version: string) => supportedOs(observed(`${base}@os\nfamily=${family}\nversion=${version}\n`));
  assertEquals([sys("ubuntu", "24.04"), sys("ubuntu", "20.04"), sys("debian", "11"), sys("macos", "13"), sys("windows", "22631"), sys("windows", "26100"), sys("arch", "rolling"), sys("templeos", "5")], [true, false, false, false, false, true, true, undefined]);
  assertEquals(of("@os\nfamily=templeos\nversion=5\n")["supported-os"]?.status, "unknown");
});

proves(["0004-machine-probe-policies FR-004"], "the results are policy outcomes an estate judges, a machine never observed is waiting, an accepted failure is accepted, and no result lacks a control", () => {
  const results = evaluate(observed(), NOW);
  const firewall = results.find((r) => r.id === "firewall");
  assert(firewall !== undefined);
  assertEquals(judgePolicy({ result: firewall, observed: false, accepted: [], now: NOW }).status, "waiting");
  assertEquals(judgePolicy({ result: firewall, observed: true, accepted: [], now: NOW }).status, "fail");
  assertEquals(judgePolicy({ result: firewall, observed: true, accepted: [{ policy: "firewall", reason: "the router is the firewall", by: "an owner", until: "2027-01-01" }], now: NOW }).status, "accepted");
  assertEquals(checkInvariants({ assets: [], observations: [], results: results.map((r) => ({ asset: "synthetic-server-02", id: r.id, status: r.status, controls: r.controls })) }), []);
});
