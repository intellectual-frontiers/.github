/**
 * Tests of the state of a machine (commons machine-probe 0005-machine-probe-state FR-001 to FR-004): the state of a real probe's output without any time, the same text for the same state, the same text for a machine observed again with other
 * counters, and the structured difference of two states. Every name is made up.
 *
 * @module
 */
import { readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { diffStates, parseProbe, readState, stateOf, stateText, toObserved, type MachineState } from "../src/logical/mod.ts";

const FACTS = readTextFileSync(resolve(dirname(fromFileUrl(import.meta.url)), "fixtures", "facts-ubuntu-2404.txt"));

function state(text: string): MachineState {
  const o = toObserved(parseProbe(text));
  if (o.kind === "err") throw new Error(o.error);
  return stateOf(o.value);
}

proves(["0005-machine-probe-state FR-001"], "the state of a real probe's output holds the records and the findings and no time, version, counter or policy about the age", () => {
  const s = state(FACTS);
  assertEquals(s.format, "machine-state/1");
  assertEquals(s.policies, { "disk-encryption": "fail", firewall: "fail", "auto-updates": "fail", "updates-waiting": "pass", "supported-os": "pass", "few-admins": "pass", osquery: "warn" });
  assertEquals(Object.keys(s.records).sort(), ["hardware", "listening", "os", "security", "software"]);
  const text = stateText(s);
  for (const word of ["2026-11", "\"at\"", "probe", "memoryMB", "diskUsedPct", "pendingUpdates", "observed\""]) assert(!text.includes(word), `no ${word}`);
});

proves(["0005-machine-probe-state FR-002"], "the text has its keys in order, two spaces and a line break, is the same whatever the order the keys were made in, and is read back; a text that is not a state is refused", () => {
  const s = state(FACTS);
  const text = stateText(s);
  assert(text.endsWith("}\n") && text.startsWith('{\n  "format": "machine-state/1",\n  "policies": {'), text.slice(0, 80));
  const shuffled: MachineState = { policies: Object.fromEntries(Object.entries(s.policies).reverse()), records: Object.fromEntries(Object.entries(s.records).reverse()), format: s.format };
  assertEquals(stateText(shuffled), text);
  assertEquals(readState(text), { kind: "ok", value: s });
  for (const bad of ["", "not json", "{}", '{"format":"x"}', "[]", "null"]) assertEquals(readState(bad).kind, "err", JSON.stringify(bad));
  const notJson = readState("not json");
  assert(notJson.kind === "err" && notJson.error === "the text is not JSON");
});

proves(["0005-machine-probe-state FR-003"], "a machine observed again an hour later with other counters gives the same text, and a change of a setting gives another", () => {
  const first = stateText(state(FACTS));
  const later = FACTS.replace("at=2026-11-21T04:11:58Z", "at=2026-11-21T05:11:58Z").replace("disk_used_pct=71", "disk_used_pct=73").replace("memory_mb=16087", "memory_mb=15900").replace("pending_updates=0", "pending_updates=4");
  assertEquals(stateText(state(later)), first);
  assert(stateText(state(FACTS.replace("firewall=off", "firewall=on"))) !== first);
  assert(stateText(state(FACTS.replace("admins=ubuntu", "admins=ubuntu amy"))) !== first);
});

proves(["0005-machine-probe-state FR-004"], "a state is equal to itself, a difference names each path with both values and each policy that moved, and the time alone is no difference", () => {
  const a = state(FACTS);
  assertEquals(diffStates(a, a), { equal: true, records: { added: [], removed: [], changed: [] }, policies: [] });
  assert(diffStates(a, state(FACTS.replace("at=2026-11-21T04:11:58Z", "at=2027-01-01T00:00:00Z"))).equal, "the time alone");
  const b = state(FACTS.replace("firewall=off", "firewall=on").replace("admins=ubuntu", "admins=ubuntu amy"));
  const d = diffStates(a, b);
  assertEquals(d.equal, false);
  assertEquals(d.records.changed.map((c) => [c.key, c.path, c.declared, c.observed]), [
    ["security", "admins", ["ubuntu"], ["amy", "ubuntu"]],
    ["security", "firewall", "off", "on"],
  ].map((r) => r) as never);
  assertEquals(d.policies, [{ id: "firewall", from: "fail", to: "pass" }]);
  const gone = diffStates(a, { ...a, policies: { ...a.policies, antivirus: "pass" } });
  assertEquals(gone.policies, [{ id: "antivirus", from: null, to: "pass" }]);
  assertEquals(diffStates(a, { ...a, records: { ...a.records, extra: { x: 1 } } }).records.added, ["extra"]);
});
