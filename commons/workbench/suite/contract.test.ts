/**
 * Tests of the contract (commons workbench 0003-workbench-contract FR-001 to FR-005): requirements of six kinds with validated names, contributions with test needs, a contract refused with every reason, the four autonomy
 * levels and what an agent may do at each, and a credential that is only ever a name.
 *
 * @module
 */
import { ACTIONS, agentMay, AUTONOMY, decodeContribution, defineContract, PERSON_ONLY, REQUIREMENT_KINDS } from "@intellectual-frontiers/workbench/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { contract, contractInput, GIT, TOKEN } from "./kit.ts";

const refused = (c: Parameters<typeof defineContract>[0]): readonly string[] => {
  const r = defineContract(c);
  return r.kind === "err" ? r.error : [];
};

proves(["0003-workbench-contract FR-001"], "there are six kinds of requirement and a name that is not a name is refused where it is made", () => {
  assertEquals([...REQUIREMENT_KINDS], ["program", "credential", "network", "git", "install", "authority"]);
  assertEquals(contract.base.map((r) => r.kind), ["program", "credential", "authority"]);
  assert(refused({ ...contractInput, base: [{ ...GIT, name: "Not A Program" }] }).some((p) => p.includes("not a program name")));
  assert(refused({ ...contractInput, base: [{ ...GIT, id: "Bad Id" }] }).some((p) => p.includes("not an id")));
  assert(refused({ ...contractInput, base: [{ ...GIT, install: ["sh", "-c", "curl x | sh"] }] }).some((p) => p.includes("no shell")));
});

proves(["0003-workbench-contract FR-002"], "a contribution is a unit with its requirements and the test globs that need some of them, and a test need for nothing is refused", () => {
  assertEquals(contract.contributions.map((c) => c.unit), ["synthetic-sql", "synthetic-evidence", "synthetic-plain"]);
  const bad = { ...contractInput, contributions: [{ unit: "u", requirements: [], tests: [{ glob: "suite/*.ts", needs: ["nothing-here"] }] }] };
  assert(refused(bad).some((p) => p.includes("needs nothing-here, which is no requirement")));
  assert(refused({ ...contractInput, contributions: [...contractInput.contributions, contractInput.contributions[0] ?? { unit: "x", requirements: [] }] }).some((p) => p.includes("contributes twice")));
});

proves(["0003-workbench-contract FR-003"], "a contract is refused with every reason: an id twice, a stage with no gate, a gate approved by an agent, an authority with no gate and a date that is no day", () => {
  const reasons = refused({
    ...contractInput,
    enforceFrom: "soon",
    base: [GIT, { ...GIT, minimum: "9.9.9" }, { ...contractInput.base[2]!, id: "x-authority", kind: "authority", gate: "none-such" } as never],
    gates: [{ id: "agent-gate", summary: "s", approver: "contributor", commands: [] }],
    stages: [{ id: "s", level: "agent-proposes", gates: ["missing-gate"] }],
  });
  for (const part of ["not a day", "git is used twice, and says something different each time", "must be held by a person", "names the gate missing-gate, which is none", "names the gate none-such"]) assert(reasons.some((p) => p.includes(part)), part);
  assertEquals(defineContract(contractInput).kind, "ok");
  assertEquals(defineContract({ ...contractInput, base: [...contractInput.base, GIT] }).kind, "ok", "the same thing said again is not a clash");
});

proves(["0003-workbench-contract FR-004"], "an agent does less at each level and never approves or tags, whatever the level", () => {
  assertEquals([...AUTONOMY], ["human-only", "agent-proposes", "agent-acts-human-reviews", "agent-autonomous"]);
  for (const level of AUTONOMY) for (const a of PERSON_ONLY) assertEquals(agentMay(level, a), false, `${level} ${a}`);
  assertEquals(ACTIONS.filter((a) => agentMay("human-only", a)), []);
  assertEquals(agentMay("agent-proposes", "propose"), true);
  assertEquals(agentMay("agent-proposes", "commit"), false);
  assertEquals(agentMay("agent-acts-human-reviews", "commit"), true);
  assertEquals(agentMay("agent-acts-human-reviews", "publish"), false);
  assertEquals(agentMay("agent-autonomous", "publish"), true);
});

proves(["0003-workbench-contract FR-005"], "a credential is the name of an environment variable and a value written in its place is refused without being repeated", () => {
  const value = "ghp_" + "a".repeat(30);
  const reasons = refused({ ...contractInput, base: [{ ...TOKEN, name: value }] });
  assert(reasons.some((p) => p.includes("NAME of an environment variable")));
  assert(!reasons.join(" ").includes(value), "the value is not repeated");
  assert(refused({ ...contractInput, base: [{ ...TOKEN, aliases: ["lower_case"] }] }).length > 0);
});

proves(["0003-workbench-contract FR-006"], "a manifest's workbench field becomes a contribution with the defaults of its kind, and a field that is not a contribution is refused with the unit named", () => {
  const made = decodeContribution("synthetic-sql", {
    requirements: [
      { kind: "program", id: "sqlite3", name: "sqlite3", task: "test", summary: "sqlite3 runs the SQLite tests", install: ["apt-get", "install", "-y", "sqlite3"] },
      { kind: "install", id: "sql-install", folder: "synthetic/sql", task: "test", summary: "The dependencies are installed" },
    ],
    tests: [{ glob: "suite/*sqlite*.test.ts", needs: ["sqlite3"] }],
  });
  assert(made.kind === "ok");
  assertEquals(made.value.requirements.map((r) => [r.id, r.concept, r.task, r.safety]), [["sqlite3", "workshop", "test", false], ["sql-install", "workspace", "test", false]]);
  assertEquals(made.value.tests, [{ glob: "suite/*sqlite*.test.ts", needs: ["sqlite3"] }]);
  assertEquals(defineContract({ ...contractInput, contributions: [made.value] }).kind, "ok");
  const bad = decodeContribution("synthetic-x", { requirements: [{ kind: "tool", id: "x" }, 7], tests: [{ glob: "a" }] });
  assert(bad.kind === "err" && bad.error.every((p) => p.startsWith("synthetic-x:")) && bad.error.length === 3);
  assertEquals(decodeContribution("synthetic-y", "nope").kind, "err");
  assertEquals(decodeContribution("synthetic-z", {}).kind, "ok");
});
