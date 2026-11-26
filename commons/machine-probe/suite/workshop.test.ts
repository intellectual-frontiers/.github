// Spec: 0008-machine-probe-agent-workspace FR-001
/**
 * Tests of the probe of a workshop (commons machine-probe 0008-machine-probe-agent-workspace FR-001 to FR-005): the section `@agent` as the probe wrote it on a real Omarchy 4.5.0 machine, as it reads, the rules as data, the pack for
 * a workshop, `supported-os` of an Omarchy machine, and the real script run on this machine with a variable that looks like a secret. Every name is made up.
 *
 * @module
 */
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { checkInvariants } from "@intellectual-frontiers/estate/logical";
import { defineAsset } from "@intellectual-frontiers/estate/governance";
import { workshopRules, compareDotted, evaluate, evaluateWorkshop, evaluateRules, observedState, OPERATORS, parseProbe, toObserved, type Observed, type ProbeRule } from "../src/logical/mod.ts";
import { probeScriptPath } from "../src/physical/mod.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const OMARCHY = readTextFileSync(resolve(HERE, "fixtures", "facts-omarchy-4.5.0.txt"));
const NOW = "2026-11-22T20:00:00Z";

function observed(text: string): Observed {
  const o = toObserved(parseProbe(text));
  if (o.kind === "err") throw new Error(o.error);
  return o.value;
}

proves(["0008-machine-probe-agent-workspace FR-001"], "the section @agent of the real Omarchy probe is read as the agent facts, a machine with none has none, and the observed state carries the names and no value", () => {
  const o = observed(OMARCHY);
  assert(o.agent !== undefined);
  assertEquals(o.agent.harnesses, ["herdr"], "herdr is a program of /usr/bin; claude and codex are mise shims and are not found");
  assertEquals([o.agent.uid, o.agent.virt, o.agent.isolation], [1000, "qemu", "vm"]);
  assertEquals(o.agent.ambientSecretNames, []);
  const state = observedState(o)["agent"];
  assertEquals(state, { harnesses: ["herdr"], "ambient-secret-names": [], uid: 1000, isolation: "vm" });
  const plain = observed("@probe\nat=2026-11-21T00:00:00Z\nversion=1\n@os\nfamily=ubuntu\nversion=24.04\n");
  assertEquals(plain.agent, undefined);
  assertEquals(observedState(plain)["agent"], undefined);
  const full = observed("@probe\nat=2026-11-21T00:00:00Z\nversion=1\n@agent\nharnesses=herdr codex claude-code\nambient-secret-names=GH_TOKEN AWS_SECRET\nuid=1000\nvirt=docker\nisolation=container\n");
  assertEquals(full.agent, { harnesses: ["claude-code", "codex", "herdr"], ambientSecretNames: ["AWS_SECRET", "GH_TOKEN"], uid: 1000, virt: "docker", isolation: "container" });
  assertEquals(observedState(full)["agent"], { harnesses: ["claude-code", "codex", "herdr"], "ambient-secret-names": ["AWS_SECRET", "GH_TOKEN"], uid: 1000, isolation: "container" });
});

const rule = (over: Partial<ProbeRule>): ProbeRule => ({ id: "r", title: "A rule", controls: ["AC-6"], reads: { section: "agent", key: "k" }, operator: "equals", value: "x", miss: "fail", ifMissing: "unknown", fix: "fix it", ...over });
const verdict = (r: ProbeRule, out: string): string | undefined => evaluateRules([r], parseProbe(out))[0]?.status;

proves(["0008-machine-probe-agent-workspace FR-002"], "each operator is judged, a miss is the rule's fail or warn, a key not given is what the rule says, and dotted numbers are compared as numbers", () => {
  assertEquals(OPERATORS, ["equals", "not-equals", "absent", "le", "ge"]);
  assertEquals([verdict(rule({}), "@agent\nk=x\n"), verdict(rule({}), "@agent\nk=y\n"), verdict(rule({ miss: "warn" }), "@agent\nk=y\n")], ["pass", "fail", "warn"]);
  assertEquals([verdict(rule({ operator: "not-equals", value: "0" }), "@agent\nk=1000\n"), verdict(rule({ operator: "not-equals", value: "0" }), "@agent\nk=0\n")], ["pass", "fail"]);
  assertEquals([verdict(rule({ operator: "absent" }), "@agent\nk=\n"), verdict(rule({ operator: "absent" }), "@other\nk=1\n"), verdict(rule({ operator: "absent" }), "@agent\nk=A B\n")], ["pass", "pass", "fail"]);
  assertEquals([verdict(rule({ operator: "ge", value: "0.5.7" }), "@agent\nk=0.5.10\n"), verdict(rule({ operator: "ge", value: "0.5.7" }), "@agent\nk=0.5.7\n"), verdict(rule({ operator: "ge", value: "0.5.7" }), "@agent\nk=0.4.9\n"), verdict(rule({ operator: "ge", value: "0.5.7" }), "@agent\nk=dev\n")], ["pass", "pass", "fail", "unknown"]);
  assertEquals([verdict(rule({ operator: "le", value: "600" }), "@agent\nk=0600\n"), verdict(rule({ operator: "le", value: "600" }), "@agent\nk=0644\n")], ["pass", "fail"]);
  for (const [ifMissing, want] of [["unknown", "unknown"], ["pass", "pass"], ["miss", "fail"]] as const) assertEquals(verdict(rule({ ifMissing }), "@probe\nat=1\n"), want, ifMissing);
  assertEquals(compareDotted("1.2", "1.2.0"), 0);
  assertEquals([compareDotted("1.10", "1.9"), compareDotted("a", "1")], [1, undefined]);
  const r = evaluateRules([rule({})], parseProbe("@agent\nk=y\n"))[0];
  assert(r !== undefined && r.id === "r" && r.title === "A rule" && r.controls[0] === "AC-6" && r.fix === "fix it" && r.detail === "agent k: y");
});

const DECLARED = { harnesses: ["herdr", "claude-code"], isolation: "vm" } as const;

proves(["0008-machine-probe-agent-workspace FR-003", "0008-machine-probe-agent-workspace FR-004"], "the pack judges the real Omarchy observation rule by rule, a workspace set right passes them all, and supported-os of Omarchy is pass", () => {
  const rules = workshopRules(DECLARED);
  assertEquals(rules.map((r) => r.id), ["agent-no-ambient-secrets", "agent-not-root", "agent-harness-known", "agent-isolation-as-declared"]);
  for (const r of rules) assert(r.controls.length > 0 && r.controls.every((c) => /^[A-Z]{2}-\d{1,2}$/.test(c)) && r.title.length > 5 && r.fix.length > 5, r.id);
  const real = evaluateWorkshop(parseProbe(OMARCHY), observed(OMARCHY), DECLARED, NOW);
  const by = Object.fromEntries(real.map((r) => [r.id, r.status]));
  assertEquals(by, {
    "agent-no-ambient-secrets": "pass",
    "agent-not-root": "pass",
    "agent-harness-known": "warn",
    "agent-isolation-as-declared": "pass",
    ...(by["ssh-keys-only"] === undefined ? {} : { "ssh-keys-only": by["ssh-keys-only"] }),
  });
  assertEquals(Object.fromEntries(evaluate(observed(OMARCHY), NOW).map((r) => [r.id, r.status]))["supported-os"], "pass");
  const good = "@probe\nat=2026-11-22T19:59:00Z\nversion=1\n@os\nfamily=omarchy (arch)\nversion=4.5.0\n@security\nssh_password_auth=no\n@agent\nharnesses=claude-code herdr\nambient-secret-names=\nuid=1000\nvirt=kvm\nisolation=vm\n";
  const fine = evaluateWorkshop(parseProbe(good), observed(good), DECLARED, NOW);
  assertEquals(fine.map((r) => r.status), ["pass", "pass", "pass", "pass", "pass"]);
  const bad = good.replace("uid=1000", "uid=0").replace("ambient-secret-names=", "ambient-secret-names=GH_TOKEN").replace("isolation=vm", "isolation=physical");
  assertEquals(evaluateWorkshop(parseProbe(bad), observed(bad), DECLARED, NOW).map((r) => r.status), ["fail", "fail", "pass", "warn", "pass"]);
  // an estate judges them and finds every result traceable
  const box = defineAsset({ id: "agentbox", kind: "workshop", state: "adopted", origin: "paired", owners: { observe: "synth", verify: "synth" } });
  assert(box.kind === "ok");
  assertEquals(checkInvariants({ assets: [box.value], observations: [], results: real.map((r) => ({ asset: "agentbox", id: r.id, status: r.status, controls: r.controls })) }), []);
  const supported = (family: string, version: string) => evaluate(observed(`@probe\nat=2026-11-21T00:00:00Z\nversion=1\n@os\nfamily=${family}\nversion=${version}\n`), NOW).find((r) => r.id === "supported-os")?.status;
  assertEquals([supported("omarchy (arch)", "4.5.0"), supported("manjaro (arch)", "24.0"), supported("arch", "rolling"), supported("templeos", "5")], ["pass", "pass", "pass", "unknown"]);
});

proves(["0008-machine-probe-agent-workspace FR-001", "0008-machine-probe-agent-workspace FR-005"], "the real script on this machine gives the section and the name of a variable that looks like a secret and never its value, and changes nothing", async (t) => {
  if (proc.which("sh") === undefined) return t.skip("no POSIX shell here");
  const value = "zq-not-a-real-value-91827";
  const run = (env: Record<string, string>) => proc.run(["sh", probeScriptPath("posix")], { env: { SSH_ORIGINAL_COMMAND: "facts", PATH: "/usr/bin:/bin:/usr/sbin:/sbin", HOME: "/nonexistent-home", ...env } });
  const bin = mkdtempSync(join(tmpdir(), "probe-bin-"));
  writeFileSync(join(bin, "codex"), "#!/bin/sh\n");
  chmodSync(join(bin, "codex"), 0o755);
  const r = await run({ PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`, PROBE_TEST_API_TOKEN: value, PROBE_TEST_TOKEN_FILE: "/tmp/x", PROBE_TEST_MAX_TOKENS: "9", PROBE_TEST_PLAIN: "visible" });
  assertEquals(r.code, 0);
  assert(!r.stdout.includes(value) && !r.stderr.includes(value), "the value is never given");
  assert(!r.stdout.includes("PROBE_TEST_PLAIN") && !r.stdout.includes("PROBE_TEST_TOKEN_FILE") && !r.stdout.includes("PROBE_TEST_MAX_TOKENS"), "a variable that does not look like a secret, a path and a count are not named");
  const o = observed(r.stdout);
  assert(o.agent !== undefined && o.agent.harnesses.includes("codex") && o.agent.ambientSecretNames.includes("PROBE_TEST_API_TOKEN") && o.agent.uid !== undefined);
  const quiet = await proc.run(["sh", "-c", `cd "$(mktemp -d)" && HOME=/nonexistent-home SSH_ORIGINAL_COMMAND=facts PATH=/usr/bin:/bin sh ${probeScriptPath("posix")} >/dev/null; ls -A | wc -l`]);
  assertEquals(quiet.stdout.trim(), "0", "the probe wrote no file");
});
