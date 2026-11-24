/**
 * Tests of the governance of AnyfsCli (commons anyfs-cli 0002-anyfs-cli-governance FR-001 to FR-006): the table of verbs is complete and its facts do not contradict each other by the rules of Headless, the tiers
 * are two, every problem code is explained, and a word of a command line is read as a place by a grammar that never looks at the disk.
 *
 * @module
 */
import { defineAction } from "@intellectual-frontiers/headless/governance";
import { actionProblems } from "@intellectual-frontiers/headless/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CATALOGUE, LOCAL_ONLY_VERBS, isProblemCode, LADDER, parseLocation, parseMountName, PROBLEM_CODES, TIER_IDS, TIERS, tierOf, VERB_IDS, VERBS, verbIds } from "../src/governance/mod.ts";

proves(["0002-anyfs-cli-governance FR-001"], "every verb has one entry and every entry one verb", () => {
  assertEquals([...verbIds()].sort(), Object.keys(VERBS).sort());
  assertEquals(new Set(VERB_IDS).size, VERB_IDS.length);
  for (const id of VERB_IDS) assertEquals(VERBS[id].id, id);
});

proves(["0002-anyfs-cli-governance FR-002"], "the facts of no verb contradict each other by the rules of Headless, and a verb that changes anything comes through local and mcp only, but a server of files only through local", () => {
  for (const id of VERB_IDS) {
    const f = VERBS[id];
    const facts = defineAction({ id, summary: f.summary, kind: f.kind, effect: f.effect, idempotent: f.idempotent, dryRun: f.dryRun, tier: TIERS[f.tier], humanOnly: [] });
    assertEquals(actionProblems(facts), [], id);
    if (f.effect !== "read") assertEquals([...f.channels], LOCAL_ONLY_VERBS.includes(id) ? ["local"] : ["local", "mcp"], id);
    if (f.effect === "destructive") assert(f.confirmation !== "none", `${id} is confirmed`);
  }
});

proves(["0002-anyfs-cli-governance FR-003"], "the tiers are reader and writer, the default is writer, and a verb of the reader tier only reads", () => {
  assertEquals([...TIER_IDS], ["reader", "writer"]);
  assertEquals(LADDER.default, TIERS.writer);
  assertEquals(tierOf("reader"), TIERS.reader);
  assertEquals(tierOf("operator"), undefined);
  for (const id of VERB_IDS) if (VERBS[id].tier === "reader") assertEquals(VERBS[id].effect, "read", id);
});

proves(["0002-anyfs-cli-governance FR-004"], "every problem code has a four-part explanation and isProblemCode accepts them and nothing else", () => {
  assertEquals(new Set(PROBLEM_CODES).size, PROBLEM_CODES.length);
  assertEquals(Object.keys(CATALOGUE).sort(), [...PROBLEM_CODES].sort());
  for (const c of PROBLEM_CODES) {
    assert(isProblemCode(c));
    const e = CATALOGUE[c];
    assert(e.title !== "" && e.what !== "" && e.why !== "" && e.fix !== "", c);
  }
  assertEquals(isProblemCode("E-NOPE"), false);
});

proves(["0002-anyfs-cli-governance FR-005"], "a mount name is a word of two to thirty-two characters and never the name of a kind of place", () => {
  assertEquals(parseMountName("fleet").kind, "ok");
  assertEquals(parseMountName("s3-backup").kind, "ok");
  for (const bad of ["file", "ssh", "memory", "Fleet", "f", "1fleet", "fleet_x", "a".repeat(33)]) assertEquals(parseMountName(bad).kind, "err", bad);
});

proves(["0002-anyfs-cli-governance FR-006"], "a word is a drive path, an address, a mount or a plain path, and name: of no mount is an error and never a file", () => {
  const mounts = new Set(["fleet"]);
  const at = (t: string) => parseLocation(t, mounts);
  const mount = at("fleet:/machines/a.json");
  assert(mount.kind === "ok" && mount.value.kind === "mount" && mount.value.path === "/machines/a.json");
  const root = at("fleet:");
  assert(root.kind === "ok" && root.value.kind === "mount" && root.value.path === "/");
  const ssh = at("ssh://alpha.example.org/srv/fleet");
  assert(ssh.kind === "ok" && ssh.value.kind === "place" && ssh.value.path === "/srv/fleet");
  const mem = at("memory:scratch");
  assert(mem.kind === "ok" && mem.value.kind === "place" && mem.value.path === "/");
  for (const plain of ["./x", "x", "/abs/y", "a/b:c", "C:\\temp\\x"]) {
    const l = at(plain);
    assert(l.kind === "ok" && l.value.kind === "local", plain);
  }
  const unknown = at("other:/a");
  assert(unknown.kind === "err" && unknown.error.code === "E-MOUNT-UNKNOWN");
  assertEquals(at("").kind, "err");
});
