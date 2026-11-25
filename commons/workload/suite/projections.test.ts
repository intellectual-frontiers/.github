/**
 * Tests of the projections of a workload (commons workload 0004-workload-projections FR-001 to FR-009): the index and the skill as Claude Code documents them, the checklist for a person, the implementation statements with the
 * runs, the rules from the effects, the same bytes each time, the conservative Codex dialect, every dialect from one source with the same autonomy, and the scenario.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Crosswalk } from "@intellectual-frontiers/grc/governance";
import { checklist, nodeLines, projectAll, rulesOf, scenario, skillMd, skillsIndex, statements, VERB_COMMAND } from "@intellectual-frontiers/workload/logical";
import { CONVERGE_SETTINGS, levelsOf as loopLevels, viewOf as loopView } from "@intellectual-frontiers/workload/forms/reconcile";
import { flatten, levelsOf, RESTORE_DRILL, viewOf } from "@intellectual-frontiers/workload/forms/runbook";
import { DIALECT_IMPLS } from "@intellectual-frontiers/workload/physical";
import { effect, runbook, store, verb } from "./kit.ts";

const V = viewOf(RESTORE_DRILL);
const project = (views = [V]) => projectAll(views, DIALECT_IMPLS);

const frontmatter = (text: string): readonly string[] => text.slice(4, text.indexOf("\n---\n", 4)).split("\n");

proves(["0004-workload-projections FR-001"], "the skill is a folder file that starts with frontmatter between --- lines, with name and description and the documented fields only, under 500 lines, and the index lists each workload", () => {
  const text = skillMd(V);
  assert(text.startsWith("---\n"));
  const front = frontmatter(text);
  const keys = front.map((l) => l.split(":")[0]);
  assertEquals(keys.slice(0, 2), ["name", "description"]);
  for (const k of keys) assert(["name", "description", "disable-model-invocation", "allowed-tools"].includes(k ?? ""), `${k} is a documented field`);
  assertEquals(front[0], "name: restore-drill");
  assert(JSON.parse((front[1] ?? "").slice("description: ".length)).length > 20, "the description is a quoted string");
  assert(text.split("\n").length < 500);
  assert(front.includes("disable-model-invocation: true"), "a runbook with a gate is started by a person");
  const index = skillsIndex([V]);
  assert(index.includes("| `restore-drill` |") && index.includes("(workload/restore-drill.md)"));
  const files = project();
  assert((files["claude-code"] ?? []).some((f) => f.path === ".claude/skills/restore-drill/SKILL.md"));
});

proves(["0004-workload-projections FR-002"], "the skill says its when, inputs, verbs by id, autonomy of each step, controls and evidence, and gives an agent no command built from a step", () => {
  const text = skillMd(V);
  for (const h of ["## When to use", "## Inputs", "## Verbs", "## Nodes and the autonomy derived for each", "## Controls", "## Evidence", "## Links"]) assert(text.includes(h), h);
  for (const l of nodeLines(V)) assert(text.includes(l), l);
  assert(text.includes("- `store.checkpoint` (@intellectual-frontiers/data)"));
  assert(text.includes("`urn:grc:nist-800-53:5.2.0:CP-9`"));
  assert(text.includes("digest: the digests of the restored store"));
  const commands = text.split("\n").filter((l) => l.includes("bun run"));
  assertEquals(commands.length, 1 + frontmatter(text).filter((l) => l.startsWith("allowed-tools")).length);
  for (const s of flatten(RESTORE_DRILL.steps)) assert(!commands.some((c) => c.includes(s.title)), s.title);
});

proves(["0004-workload-projections FR-003"], "the checklist marks what a person does and what an agent only proposes, in the order of the steps", () => {
  const text = checklist(V);
  const ids = [...text.matchAll(/^- \[ \] `([^`]+)`/gmu)].map((m) => m[1]);
  assertEquals(ids, flatten(RESTORE_DRILL.steps).map((s) => s.id));
  assert(text.includes("`approve-record`: gate, human-only") && text.includes("a person acts; approver synthetic-approver-01, never the author"));
  assert(text.includes("`summarize-drill`: judge, agent-proposes") && text.includes("the agent proposes, a person decides"));
  assert(text.includes("keep the digest as evidence"));
});

proves(["0004-workload-projections FR-004"], "a statement for each cited control names its steps, evidence and the runs by id, and what a crosswalk relates, and writes no OSCAL JSON", () => {
  const crosswalk: Crosswalk = { id: "synthetic-crosswalk", mappings: [{ from: "urn:grc:nist-800-53:5.2.0:CP-9", to: "urn:grc:nist-csf:2.0:PR.DS-11", relationship: "equal", strength: 8 }] } as unknown as Crosswalk;
  const text = statements([V], [{ workload: "restore-drill", run: "018f3a6e-7c00-7000-8123-456789abcdef" }], [crosswalk]);
  assert(text.includes("## `urn:grc:nist-800-53:5.2.0:CP-9`") && text.includes("## `urn:grc:soc2-tsc:2017:A1.3`") && text.includes("## `urn:grc:nist-csf:2.0:PR.DS-11`"));
  assert(text.includes("run `018f3a6e-7c00-7000-8123-456789abcdef` of `restore-drill`"));
  assert(text.includes("`urn:grc:nist-csf:2.0:PR.DS-11`: equal, strength 8"));
  assert(text.includes("node `verify-digests`") && text.includes("digest: the digests of the restored store"));
  assert(!text.trimStart().startsWith("{"));
  assert(statements([V]).includes("no run recorded yet"));
  assert(statements([viewOf(runbook([verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append"))]))]).includes("No control is cited"));
});

proves(["0004-workload-projections FR-005"], "the rules put a verb in allow, ask or deny by the strictest autonomy of its steps, and an effect that needs a person is never allowed", () => {
  const wipe = verb("wipe", "store.delete", effect("synthetic-vault-01", "durable", "destroy", false));
  const change = verb("change", "store.restore", effect("synthetic-db-01", "transactional", "mutate"), { store: store("synthetic-db-01"), from: store("synthetic-vault-01") });
  const read = verb("look", "store.digests", effect("synthetic-db-01", "transactional", "read"), { store: store("synthetic-db-01"), other: store("synthetic-vault-01") });
  const r = rulesOf([viewOf(runbook([read, change, wipe]))]);
  assertEquals(r.allow, [`Bash(${VERB_COMMAND} store.digests *)`]);
  assertEquals(r.ask, [`Bash(${VERB_COMMAND} store.restore *)`]);
  assertEquals(r.deny, [`Bash(${VERB_COMMAND} store.delete *)`]);
  const drill = rulesOf([V]);
  assert(drill.ask.some((x) => x.includes("work.record")), "a gate makes a verb a proposal");
  assert(drill.allow.some((x) => x.includes("store.checkpoint")));
  assertEquals(drill.deny, []);
  const file = project()["claude-code"]?.find((f) => f.path === ".claude/workload.settings.json");
  assertEquals(Object.keys(JSON.parse(file?.text ?? "{}").permissions), ["allow", "ask", "deny"]);
});

proves(["0004-workload-projections FR-006"], "the same runbooks give the same bytes, with no secret and no line built from a step's text", () => {
  const a = project();
  const b = project();
  assertEquals(a, b);
  const all = Object.values(a).flat().map((f) => f.text).join("\n");
  assert(!/(?:BEGIN [A-Z ]*PRIVATE KEY|ghp_|AKIA[0-9A-Z]{8})/u.test(all));
  assert(!/\$\(|`sh |bash -c|\| *sh/u.test(all));
  assert(all.split("\n").filter((l) => l.includes("bun run")).every((l) => l.includes("bun run workload verb")));
});

proves(["0004-workload-projections FR-007"], "the Codex dialect writes AGENTS.md text under the size Codex reads and no skill file, and where nothing could be verified nothing is claimed", () => {
  const files = project()["codex"] ?? [];
  assertEquals(files.map((f) => f.path), ["AGENTS.md"]);
  const text = files[0]?.text ?? "";
  assert(text.startsWith("<!-- workload:begin -->") && text.trimEnd().endsWith("<!-- workload:end -->"));
  assert(new TextEncoder().encode(text).length < 32 * 1024);
  assert(!files.some((f) => f.path.endsWith("SKILL.md")));
  assert(!Object.values(project()).flat().some((f) => f.path.endsWith(".json") && f.text.includes("component-definition")));
});

proves(["0004-workload-projections FR-008"], "every registered dialect is projected from the one runbook and says the same autonomy for each step", () => {
  const all = project();
  assertEquals(Object.keys(all).sort(), DIALECT_IMPLS.map((d) => d.info.id).sort());
  const expected = levelsOf(RESTORE_DRILL).map((l) => `${l.id}|${l.kind}|${l.autonomy}`);
  for (const [dialect, files] of Object.entries(all)) {
    const text = files.map((f) => f.text).join("\n");
    const seen = [...text.matchAll(/^- (?:\[ \] )?`([^`]+)`: ([a-z]+), (human-only|agent-[a-z-]+)/gmu)].map((m) => `${m[1]}|${m[2]}|${m[3]}`);
    assertEquals(seen.slice(0, expected.length), expected, dialect);
  }
});

proves(["0004-workload-projections FR-009"], "a runbook reads as a scenario whose Given is its requirements, whose When is its steps and whose Then is its checks, each citing what the steps cite", () => {
  const text = scenario(V);
  assert(text.startsWith("Scenario: Restore drill\n  Given the workbench requirement sqlite3 is met"));
  assert(text.includes("  When Claim the work order per 0005-workload-runs FR-001"));
  assert(text.includes("  Then The restored digests are the digests of the source".replace("The restored digests are the digests of the source", "the digests of the restored store are the digests of the source")) && text.includes("per 0006-workload-split FR-003"));
  const none = scenario(viewOf(runbook([verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append"))])));
  assert(none.includes("Given nothing is required"));
});

proves(["0004-workload-projections FR-010"], "every projection is made from the view of a workload and not from a form, so that a reconcile is projected by every dialect with the same autonomy for each node as a runbook, and an index lists both forms", () => {
  const loop = loopView(CONVERGE_SETTINGS);
  const both = project([V, loop]);
  assertEquals(Object.keys(both).sort(), DIALECT_IMPLS.map((d) => d.info.id).sort());
  const expected = loopLevels(CONVERGE_SETTINGS).map((l) => `${l.id}|${l.kind}|${l.autonomy}`);
  for (const [dialect, files] of Object.entries(project([loop]))) {
    const text = files.map((f) => f.text).join("\n");
    const seen = [...text.matchAll(/^- (?:\[ \] )?`([^`]+)`: ([a-z]+), (human-only|agent-[a-z-]+)/gmu)].map((m) => `${m[1]}|${m[2]}|${m[3]}`);
    assertEquals(seen.slice(0, expected.length), expected, dialect);
  }
  const index = skillsIndex([V, loop]);
  assert(index.includes("| `restore-drill` | runbook |") && index.includes("| `converge-settings` | reconcile |"));
  const skill = skillMd(loop);
  assert(skill.includes("Form: reconcile. Started by: a schedule, daily.") && skill.includes("level-triggered"));
  assert(checklist(loop).includes("approves the plan by its hash"));
  assert(statements([loop]).includes("the digest of the plan approved, recorded on the approval"));
  assert(statements([loop]).includes("`urn:grc:nist-800-53:5.2.0:CM-3`"));
  const rules = rulesOf([loop]);
  assert(rules.deny.some((r) => r.includes("state.apply")) && rules.allow.some((r) => r.includes("state.observe")));
  assert(scenario(loop).includes("Then the settings of the system are the settings that are wanted"));
});
