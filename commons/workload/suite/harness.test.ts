/**
 * Tests of the harness and its policy (commons workload 0007-workload-harness FR-001 to FR-006): a workload names no harness and a harness is one registered dialect, the policy is data decoded at the boundary, the choice resolves
 * in one order, a dialect that cannot carry the workload is refused with the code and what it lacks and never replaced, and every dialect says the same autonomy.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { authored, createDialectRegistry, decodePolicy, DIALECTS, dialectId, type DialectInfo, type HarnessPolicy } from "@intellectual-frontiers/workload/governance";
import { type DialectImpl, projectAll, registerDialect, resolveDialect, type WorkloadView } from "@intellectual-frontiers/workload/logical";
import { chooseDialect as chooseLoopDialect, CONVERGE_SETTINGS, requirementsOf as loopRequirements, suitable as loopSuitable } from "@intellectual-frontiers/workload/forms/reconcile";
import { chooseDialect, levelsOf, requirementsOf, RESTORE_DRILL, type Runbook, suitable, viewOf } from "@intellectual-frontiers/workload/forms/runbook";
import { DIALECT_IMPLS } from "@intellectual-frontiers/workload/physical";
import { effect, must, runbook, verb } from "./kit.ts";

const d = (t: string) => authored(dialectId(t));
const POLICY: HarnessPolicy = { default: d("codex"), perWorkload: { "restore-drill": d("claude-code") }, perForm: { reconcile: d("human") }, perOperator: { "synthetic-person-01": d("human") } };

const MINIMAL: DialectInfo = { id: d("minimal-harness"), holder: "agent", title: "A minimal harness", expresses: ["program", "network", "git", "install"], skillFiles: false };
const WITH_MINIMAL = must(createDialectRegistry([...DIALECTS.list(), MINIMAL]));

proves(["0007-workload-harness FR-001"], "a workload names no harness, and a new harness is one registered dialect that changes no workload", () => {
  const text = JSON.stringify(RESTORE_DRILL);
  for (const h of DIALECTS.list()) if (h.id !== "human") assert(!text.includes(h.id), h.id);
  assertEquals(DIALECTS.list().map((x) => x.id), ["claude-code", "codex", "human"]);
  const before = JSON.stringify(RESTORE_DRILL);
  const mine: DialectImpl = { info: MINIMAL, render: (views) => views.map((v) => ({ path: `minimal/${v.id}.txt`, text: `${v.id}\n` })) };
  const added = must(registerDialect(DIALECT_IMPLS, mine, WITH_MINIMAL));
  assertEquals(Object.keys(projectAll([viewOf(RESTORE_DRILL)], added)).sort(), ["claude-code", "codex", "human", "minimal-harness"]);
  assertEquals(JSON.stringify(RESTORE_DRILL), before);
  assertEquals(registerDialect(DIALECT_IMPLS, mine).kind, "err");
  assertEquals(registerDialect(added, mine, WITH_MINIMAL).kind, "err");
  assertEquals(createDialectRegistry([MINIMAL, MINIMAL]).kind, "err");
});

proves(["0007-workload-harness FR-002"], "a policy is typed data decoded at the boundary into the type or every reason it is not one", () => {
  const ok = decodePolicy({ default: "codex", perWorkload: { "restore-drill": "claude-code" }, perForm: { runbook: "human" }, perOperator: {} });
  assert(ok.kind === "ok" && ok.value.default === "codex" && ok.value.perWorkload["restore-drill"] === "claude-code" && ok.value.perForm["runbook"] === "human");
  const minimal = decodePolicy({ default: "human" });
  assert(minimal.kind === "ok" && Object.keys(minimal.value.perWorkload).length === 0 && Object.keys(minimal.value.perForm).length === 0);
  const unknown = decodePolicy({ default: "codex", perOperator: { "synthetic-person-01": "mystery" } });
  assert(unknown.kind === "err" && unknown.error[0]?.includes("mystery is not registered"));
  assertEquals(decodePolicy({}).kind, "err");
  assertEquals(decodePolicy("claude-code").kind, "err");
  assertEquals(decodePolicy({ default: "codex", perWorkload: { a: 3 } }).kind, "err");
  assertEquals(decodePolicy({ default: "codex", perForm: { campaign: "human" } }).kind, "err");
  assertEquals(decodePolicy({ default: "codex", perForm: { graph: "human" } }).kind, "ok");
  assertEquals(decodePolicy({ default: "mystery" }, WITH_MINIMAL).kind, "err");
  assertEquals(decodePolicy({ default: "minimal-harness" }, WITH_MINIMAL).kind, "ok");
});

proves(["0007-workload-harness FR-003"], "the choice is the explicit one, then the operator's, the workload's, the form's and the fleet's default", () => {
  const req = { workload: "restore-drill", form: "runbook", operator: "synthetic-person-01" } as const;
  assertEquals(resolveDialect(POLICY, { ...req, explicit: d("codex") }), { dialect: "codex", from: "explicit" });
  assertEquals(resolveDialect(POLICY, req), { dialect: "human", from: "operator" });
  assertEquals(resolveDialect(POLICY, { workload: "restore-drill", form: "runbook" }), { dialect: "claude-code", from: "workload" });
  assertEquals(resolveDialect(POLICY, { workload: "another-workload", form: "reconcile" }), { dialect: "human", from: "form" });
  assertEquals(resolveDialect(POLICY, { workload: "another-workload", form: "runbook" }), { dialect: "codex", from: "default" });
  assertEquals(resolveDialect(POLICY, { workload: "another-workload" }), { dialect: "codex", from: "default" });
});

proves(["0007-workload-harness FR-004"], "a dialect that cannot carry the workload is refused with the code, a person to fix it and what it lacks, and the run is never moved", () => {
  const needsToken: Runbook = runbook([verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: "o" } })], { needs: [{ id: "token", kind: "credential", concept: "workbench", task: "run", safety: false, summary: "a token name", name: "SYNTHETIC_TOKEN" }] });
  const refused = suitable(needsToken, MINIMAL.id, WITH_MINIMAL);
  assert(refused.kind === "err");
  assertEquals(refused.error.code, "E-WL-HARNESS-UNSUITABLE");
  assertEquals(refused.error.fixer, "person");
  assert(refused.error.fix.includes("token") && refused.error.message.includes("minimal-harness"));
  assertEquals(suitable(needsToken, d("claude-code"), WITH_MINIMAL).kind, "ok");
  const policy: HarnessPolicy = { default: d("claude-code"), perWorkload: {}, perForm: {}, perOperator: { "synthetic-person-01": MINIMAL.id } };
  const chosen = chooseDialect(policy, { operator: "synthetic-person-01" }, needsToken, WITH_MINIMAL);
  assert(chosen.kind === "err" && chosen.error.code === "E-WL-HARNESS-UNSUITABLE", "the operator's choice is refused, not replaced by the default");
  const withGate = suitable(RESTORE_DRILL, d("codex"));
  assertEquals(withGate.kind, "ok");
  const agentsOnly = must(createDialectRegistry(DIALECTS.list().filter((x) => x.holder === "agent")));
  const noPerson = suitable(RESTORE_DRILL, d("codex"), agentsOnly);
  assert(noPerson.kind === "err" && noPerson.error.message.includes("needs a person"));
  assert(requirementsOf(RESTORE_DRILL).some((r) => r.kind === "authority"));
});

proves(["0007-workload-harness FR-005"], "every dialect, including one added, is projected from the one workload and says the same autonomy for each node", () => {
  const mine: DialectImpl = { info: MINIMAL, render: (views) => views.map((v) => ({ path: `minimal/${v.id}.txt`, text: `${v.nodes.map((n) => `- \`${n.id}\`: ${n.kind}, ${n.autonomy}`).join("\n")}\n` })) };
  const impls = must(registerDialect(DIALECT_IMPLS, mine, WITH_MINIMAL));
  const all = projectAll([viewOf(RESTORE_DRILL)], impls);
  const expected = levelsOf(RESTORE_DRILL).map((l) => `${l.id}|${l.kind}|${l.autonomy}`);
  for (const [dialect, files] of Object.entries(all)) {
    const text = files.map((f) => f.text).join("\n");
    const seen = [...text.matchAll(/^- (?:\[ \] )?`([^`]+)`: ([a-z]+), (human-only|agent-[a-z-]+)/gmu)].map((m) => `${m[1]}|${m[2]}|${m[3]}`);
    assertEquals(seen.slice(0, expected.length), expected, dialect);
  }
  assertEquals(levelsOf(RESTORE_DRILL).map((l) => l.autonomy), levelsOf(RESTORE_DRILL).map((l) => l.autonomy));
});

proves(["0007-workload-harness FR-006"], "the projection of a dialect is the same bytes for the same runbook, and the conservative dialects write only what could be verified", () => {
  const view: WorkloadView = viewOf(RESTORE_DRILL);
  for (const impl of DIALECT_IMPLS) assertEquals(impl.render([view]), impl.render([view]));
  const codex = DIALECT_IMPLS.find((i) => i.info.id === "codex");
  assert(codex !== undefined && codex.info.skillFiles === false && codex.render([view]).every((f) => !f.path.endsWith("SKILL.md")));
  const claude = DIALECT_IMPLS.find((i) => i.info.id === "claude-code");
  assert(claude !== undefined && claude.info.skillFiles === true);
});

proves(["0007-workload-harness FR-004"], "a reconcile is held to the same rule as a runbook: its approval is an authority a person must carry, and the policy chooses by its form", () => {
  assert(loopRequirements(CONVERGE_SETTINGS).some((r) => r.kind === "authority" && r.id === "person-approve-plan"));
  assertEquals(loopSuitable(CONVERGE_SETTINGS, d("codex")).kind, "ok");
  const agentsOnly = must(createDialectRegistry(DIALECTS.list().filter((x) => x.holder === "agent")));
  const noPerson = loopSuitable(CONVERGE_SETTINGS, d("codex"), agentsOnly);
  assert(noPerson.kind === "err" && noPerson.error.code === "E-WL-HARNESS-UNSUITABLE" && noPerson.error.message.includes("needs a person"));
  const byForm = chooseLoopDialect(POLICY, {}, CONVERGE_SETTINGS);
  assert(byForm.kind === "ok" && byForm.value.dialect === "human" && byForm.value.from === "form");
  const byWorkload = chooseDialect(POLICY, {}, RESTORE_DRILL);
  assert(byWorkload.kind === "ok" && byWorkload.value.dialect === "claude-code" && byWorkload.value.from === "workload");
});

proves(["0007-workload-harness FR-007"], "a registered dialect receives the options of the projection, and an invalid verb command is refused before any dialect renders", () => {
  const seen: (string | undefined)[] = [];
  const mine: DialectImpl = { info: MINIMAL, render: (views, options) => { seen.push(options?.verbCommand); return views.map((v) => ({ path: `minimal/${v.id}.txt`, text: `${v.id}\n` })); } };
  const impls = must(registerDialect(DIALECT_IMPLS, mine, WITH_MINIMAL));
  projectAll([viewOf(RESTORE_DRILL)], impls, { verbCommand: "synth verb" });
  assertEquals(seen, ["synth verb"]);
  let thrown: unknown;
  try { projectAll([viewOf(RESTORE_DRILL)], impls, { verbCommand: "a; b" }); } catch (e) { thrown = e; }
  assert(thrown instanceof Error && thrown.message.startsWith("E-WL-HARNESS-COMMAND-INVALID"));
  assertEquals(seen.length, 1, "no dialect rendered");
});
