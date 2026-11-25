/**
 * Tests of the dialects and of the projections (commons workbench 0006-workbench-dialects FR-001 to FR-006): three dialects, the matrix of requirement by dialect with no dropped cell, the rule that an agent's need for a person is a
 * gate that the human dialect expresses, projections that are the same bytes for the same contract and carry only the base, a runbook for a person and the files for each harness.
 *
 * @module
 */
import { dialect as claude, render as renderClaude } from "@intellectual-frontiers/workbench/dialects/claude-code";
import { dialect as codex, render as renderCodex } from "@intellectual-frontiers/workbench/dialects/codex";
import { dialect as human, render as renderHuman } from "@intellectual-frontiers/workbench/dialects/human";
import { agentsBlock, AGENTS_MARKS, ciStep, containerfile, type Dialect, matrixFindings, matrixMarkdown, matrixOf, setupScript, spliceBlock } from "@intellectual-frontiers/workbench/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { contract } from "./kit.ts";

const ALL = [...contract.base, ...contract.contributions.flatMap((c) => c.requirements)];
const DIALECTS: readonly Dialect[] = [claude, codex, human];

proves(["0006-workbench-dialects FR-001"], "there are three dialects, two for agents and one for a person", () => {
  assertEquals(DIALECTS.map((d) => [d.name, d.holder]), [["claude-code", "agent"], ["codex", "agent"], ["human", "human"]]);
});

proves(["0006-workbench-dialects FR-002"], "the matrix has a cell for every requirement and dialect and a cell nobody answers is dropped", () => {
  const m = matrixOf(ALL, contract, DIALECTS);
  assertEquals(m.rows.length, ALL.length);
  assertEquals(matrixFindings(m, DIALECTS), []);
  assert(matrixMarkdown(m).includes("| tag-release |"));
  const forgetful: Dialect = { name: "forgetful", holder: "agent", express: (r, c) => (r.kind === "authority" ? undefined : claude.express(r, c)) };
  const dropped = matrixFindings(matrixOf(ALL, contract, [...DIALECTS, forgetful]), [...DIALECTS, forgetful]);
  assertEquals(dropped.map((f) => [f.kind, f.requirement, f.dialect]), [["dropped", "tag-release", "forgetful"]]);
});

proves(["0006-workbench-dialects FR-003"], "a requirement an agent dialect leaves to a person must be a gate the human dialect expresses", () => {
  const tag = ALL.find((r) => r.id === "tag-release");
  assert(tag !== undefined);
  assertEquals(claude.express(tag, contract)?.kind, "unexpressed");
  assertEquals(human.express(tag, contract)?.kind, "expressed");
  const deaf: Dialect = { name: "deaf", holder: "human", express: () => ({ kind: "unexpressed", reason: "not done", needsPerson: false }) };
  const set = [claude, codex, deaf];
  const found = matrixFindings(matrixOf(ALL, contract, set), set);
  assertEquals(found.map((f) => [f.kind, f.requirement, f.dialect]), [["no-person", "tag-release", "claude-code"], ["no-person", "tag-release", "codex"]]);
});

proves(["0006-workbench-dialects FR-004"], "the setup script, Containerfile, pipeline step and AGENTS block are the same bytes for the same contract, carry only the base and hold no value", () => {
  const script = setupScript(contract);
  assertEquals(script, setupScript(contract));
  assert(script.includes("command -v git >/dev/null 2>&1 || apt-get install -y git"));
  assert(!script.includes("sqlite3") && !script.includes("ssh-keygen"), "what only a unit needs is not in the base");
  assert(containerfile(contract).startsWith("# Generated") && containerfile(contract).includes("RUN apt-get install -y git"));
  assert(ciStep().includes('ready --for "$WORKBENCH_TASK" --ensure --ci'));
  const block = agentsBlock(contract);
  assert(block.startsWith(AGENTS_MARKS.begin) && block.trimEnd().endsWith(AGENTS_MARKS.end));
  assert(block.includes("Until 2027-01-01 every finding but a safety rule is a hint"));
  assert(!`${script}${block}`.includes("ghp_"));
  const spliced = spliceBlock(`# Mine\n\n${block}\nafter\n`, block.replace("hint", "hint!"));
  assert(spliced.startsWith("# Mine") && spliced.includes("after") && spliced.split(AGENTS_MARKS.begin).length === 2);
  assertEquals(spliceBlock("# Mine\n", block).includes(AGENTS_MARKS.begin), true);
});

proves(["0006-workbench-dialects FR-004"], "the commands the projections name are the contract's own command", () => {
  const own = { ...contract, command: "bun run workbench" };
  assert(agentsBlock(own).includes("`bun run workbench ready --for TASK --ensure`"));
  assert(setupScript(own).includes("bun run workbench ready --for TASK --ensure"));
  assert(ciStep(own.command).includes("bun run workbench ready"));
  assert(renderHuman(own)[0]?.text.includes("`bun run workbench ready`") === true);
  assertEquals(JSON.parse(renderClaude(own)[0]?.text ?? "{}").hooks.SessionStart[0].hooks[0].command, "bun run workbench ready");
  assert(agentsBlock(contract).includes("`workbench ready`"));
});

proves(["0006-workbench-dialects FR-005"], "the runbook of a person has a checklist, the stages with their levels, and for each gate its approver and the record of an approval", () => {
  const [file] = renderHuman(contract);
  assertEquals(file?.path, "RUNBOOK.md");
  const text = file?.text ?? "";
  for (const part of ["- [ ] Git is installed", "**regulated-change**: agent-proposes; gates: accept-finding", "### release-tag", "Approver: **releaser**, never the author", "approved: <the hash of what you reviewed>", "git worktree add"]) assert(text.includes(part), part);
  assertEquals(renderHuman(contract)[0]?.text, text);
});

proves(["0006-workbench-dialects FR-006"], "Claude Code gets a SessionStart hook and a deny rule for each command of a gate, Codex gets the AGENTS block, each the same bytes each time", () => {
  const files = renderClaude(contract);
  const settings = JSON.parse(files.find((f) => f.path === ".claude/settings.json")?.text ?? "{}") as { hooks: { SessionStart: { hooks: { command: string }[] }[] }; permissions: { deny: string[] } };
  assertEquals(settings.hooks.SessionStart[0]?.hooks[0]?.command, "workbench ready");
  assertEquals(settings.permissions.deny, ["Bash(agora quality accept:*)", "Bash(git push --tags:*)", "Bash(git tag:*)"]);
  assertEquals(renderClaude(contract), files);
  assert(files.some((f) => f.path === "CLAUDE.md" && f.text.includes("AGENTS.md")));
  const [agents] = renderCodex(contract, "# Existing\n");
  assert(agents?.text.startsWith("# Existing") && agents.text.includes(AGENTS_MARKS.begin));
});
