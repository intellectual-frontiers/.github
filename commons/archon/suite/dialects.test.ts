/**
 * Tests of the port of the dialects (commons archon 0004-archon-dialects FR-001 to FR-006): a dialect made here as a value of the port (the port is the whole of what Archon knows of a tool,
 * so the dialects with real tools are tested in their own packages), what it expresses of a requirement, the matrix, the plan of steps for the executor of headless and the digest of what
 * is rendered. Everything is made up.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { planHash } from "@intellectual-frontiers/headless/logical";
import {
  GENERATED_MARK,
  buildOrder,
  defineRequirement,
  executionPlanOf,
  expressibility,
  isGenerated,
  matrixOf,
  matrixTotals,
  parseDialectId,
  parseKindId,
  parseSubjectName,
  planOf as planOfOrder,
  renderHeader,
  renderedOf,
  unexpressedOf,
  type Dialect,
  type Guarantees,
  type JsonValue,
  type Observed,
  type Plan,
  type Requirement,
  type RequirementId,
  type RequirementInput,
  argvStepsOf,
  stepFindings,
} from "../src/mod.ts";

function req(id: string, more: Partial<RequirementInput> = {}): Requirement {
  const r = defineRequirement({ id, summary: `${id}.`, why: ["a made-up reason"], subject: { by: "all" }, kind: "package", desired: { name: id }, change: "additive", ...more });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

/** A value as plain data, so that branded texts compare with the texts they are. */
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

function kinds(...ids: string[]) {
  return ids.map((id) => {
    const k = parseKindId(id);
    if (k.kind === "err") throw new Error(k.error);
    return k.value;
  });
}

function dialect(name: string, g: Partial<Guarantees> = {}): Dialect {
  const id = parseDialectId(name);
  if (id.kind === "err") throw new Error(id.error);
  return {
    id: id.value,
    tool: { name, version: "1.0.0" },
    guarantees: { kinds: kinds("package", "service"), subjects: ["machine"], plan: "faithful", idempotence: "proven", destroy: false, ...g },
    render: async (_order, _plan) => {
      const files = new Map([["main.txt", `${renderHeader("text")}\nnothing\n`]]);
      return renderedOf(files);
    },
    steps: (plan, rendered) => [{ covers: plan.entries.filter((e) => e.action !== "none").map((e) => e.id), summary: "apply", apply: ["tool", "apply", `.archon/${rendered.digest}/main.txt`], check: ["tool", "check", `.archon/${rendered.digest}/main.txt`] }],
  };
}

function planOf(requirements: readonly Requirement[], observed: Observed = new Map()): Plan {
  const n = parseSubjectName("web-01.example.test");
  if (n.kind === "err") throw new Error(n.error);
  const o = buildOrder({ subject: { name: n.value, class: "machine" }, assurance: "solo", layers: [{ layer: "baseline", requirements }] });
  if (o.kind === "err") throw new Error(JSON.stringify(o.error));
  return planOfOrder(o.value, observed);
}

proves(["0004-archon-dialects FR-001", "0004-archon-dialects FR-002"], "a dialect is a value of the port with its tool and its guarantees as data, and renders and gives steps", async () => {
  const d = dialect("tool-a");
  assertEquals([d.id, d.tool.name, d.tool.version], ["tool-a", "tool-a", "1.0.0"]);
  assertEquals(Object.keys(d.guarantees).sort(), ["destroy", "idempotence", "kinds", "plan", "subjects"]);
  const plan = planOf([req("a.pkg")]);
  const order = buildOrder({ subject: plan.subject, assurance: "solo", layers: [{ layer: "baseline", requirements: [req("a.pkg")] }] });
  assert(order.kind === "ok");
  const rendered = await d.render(order.value, plan);
  assert(rendered.kind === "ok");
  assertEquals(d.steps(plan, rendered.value).length, 1);
});

proves(["0004-archon-dialects FR-003"], "what a dialect expresses of a requirement: the kind, the subject, the change class, the plan and the verification", () => {
  const d = dialect("tool-b");
  const find = (e: ReturnType<typeof expressibility>, a: string) => e.find((x) => x.annotation === a);
  const ok1 = expressibility(req("b.pkg"), d);
  assertEquals(find(ok1, "kind")?.state, "expressed");
  assertEquals(find(ok1, "subject")?.state, "expressed");
  const destructive = expressibility(req("b.gone", { ensure: "absent", change: "destructive", rollback: "restore-from-backup", desired: null }), d);
  const change = find(destructive, "change");
  assert(change?.state === "unexpressed" && change.reason.includes("cannot destroy"));
  assertEquals(find(expressibility(req("b.gone", { ensure: "absent", change: "destructive", rollback: "restore-from-backup", desired: null }), dialect("tool-c", { destroy: true })), "change")?.state, "expressed");
  const blind = dialect("tool-d", { plan: "none" });
  const plan = find(expressibility(req("b.pkg"), blind), "plan");
  assert(plan?.state === "unexpressed" && plan.reason.includes("faithful"));
  assertEquals(find(expressibility(req("b.pkg", { plan: "best-effort" }), dialect("tool-e", { plan: "partial" })), "plan")?.state, "expressed");
  const other = find(expressibility(req("b.dns", { kind: "dns-record", subject: { by: "all" }, desired: { name: "www" } }), d), "kind");
  assertEquals(other?.state, "unexpressed");
  assertEquals(find(expressibility(req("b.q", { verify: { by: "osquery", query: "select 1" } }), d), "verify")?.state, "carried");
  assertEquals(find(expressibility(req("b.pkg"), blind), "verify")?.state, "unexpressed");
  assertEquals(find(expressibility(req("b.none", { verify: { by: "none", reason: "not observable" } }), blind), "verify")?.state, "expressed");
  assertEquals(expressibility(req("b.pkg"), dialect("tool-f", { kinds: [] })).find((x) => x.annotation === "kind")?.state, "unexpressed");
});

proves(["0004-archon-dialects FR-004"], "the matrix has a row for each requirement and a cell for each dialect, the totals add up, and the unexpressed are named", () => {
  const requirements = [req("m.pkg"), req("m.gone", { ensure: "absent", change: "destructive", rollback: "reversible", desired: null })];
  const dialects = [dialect("tool-g"), dialect("tool-h", { destroy: true })];
  const m = matrixOf(requirements, dialects);
  assertEquals(plain(m.dialects), ["tool-g", "tool-h"]);
  assertEquals(m.rows.map((r) => r.cells.length), [2, 2]);
  const t = matrixTotals(m);
  assertEquals(t.expressed + t.carried + t.unexpressed, 2 * 2 * 5);
  assertEquals(unexpressedOf(m).map((u) => `${u.requirement} ${u.dialect} ${u.annotation}`), ["m.gone tool-g change"]);
});

proves(["0004-archon-dialects FR-005"], "the plan of steps names the digest, refuses a destructive step with no check, and is nothing where nothing changes", async () => {
  const plan = planOf([req("x.pkg")]);
  const d = dialect("tool-i");
  const files = await renderedOf(new Map([["main.txt", `${renderHeader("text")}\nx\n`]]));
  assert(files.kind === "ok");
  const exec = executionPlanOf(plan, files.value, d.steps(plan, files.value));
  assert(exec.kind === "ok" && exec.value !== undefined);
  assertEquals(exec.value.steps.length, 1);
  assertEquals(exec.value.steps[0]?.effect, "mutate");
  assert(planHash(exec.value).length > 0);

  const other = await renderedOf(new Map([["main.txt", `${renderHeader("text")}\ny\n`]]));
  assert(other.kind === "ok");
  const exec2 = executionPlanOf(plan, other.value, d.steps(plan, files.value));
  assert(exec2.kind === "err" && exec2.error.some((p) => p.kind === "digest-not-named"));

  const goneRequirement = req("x.gone", { ensure: "absent", change: "destructive", rollback: "restore-from-backup", desired: null });
  const gone = planOf([goneRequirement], new Map<RequirementId, JsonValue>([[goneRequirement.id, { name: "present" }]]));
  const noCheck = executionPlanOf(gone, files.value, [{ covers: [goneRequirement.id], summary: "remove", apply: ["tool", "remove", files.value.digest], check: undefined }]);
  assert(noCheck.kind === "err" && noCheck.error.some((p) => p.kind === "executor" && p.message.includes("check")));

  const same = planOf([]);
  assertEquals(executionPlanOf(same, files.value, []), ok(undefined));
  const unknown = executionPlanOf(plan, files.value, [{ covers: [req("x.unknown").id], summary: "x", apply: ["tool", files.value.digest], check: undefined }]);
  assert(unknown.kind === "err" && unknown.error.some((p) => p.kind === "unknown-entry"));
});

proves(["0004-archon-dialects FR-006"], "rendered files say they are generated, and their digest does not depend on the order they were made in", async () => {
  assert(renderHeader("yaml").includes(GENERATED_MARK));
  assert(renderHeader("json").startsWith('"_generated"'));
  assert(isGenerated(`${renderHeader("yaml")}\n- hosts: all\n`));
  assert(!isGenerated("- hosts: all\n"));
  const a = new Map([["a.yml", `${renderHeader("yaml")}\na\n`], ["b.yml", `${renderHeader("yaml")}\nb\n`]]);
  const b = new Map([["b.yml", `${renderHeader("yaml")}\nb\n`], ["a.yml", `${renderHeader("yaml")}\na\n`]]);
  const ra = await renderedOf(a);
  const rb = await renderedOf(b);
  assert(ra.kind === "ok" && rb.kind === "ok");
  assertEquals(ra.value.digest, rb.value.digest);
  const c = await renderedOf(new Map([["a.yml", `${renderHeader("yaml")}\nCHANGED\n`], ["b.yml", `${renderHeader("yaml")}\nb\n`]]));
  assert(c.kind === "ok" && c.value.digest !== ra.value.digest);
  assertEquals((await renderedOf(new Map([["x.yml", "no mark"]]))).kind, "err");
  assertEquals((await renderedOf(new Map([["../x.yml", `${renderHeader("yaml")}\n`]]))).kind, "err");
});

proves(["0004-archon-dialects FR-007", "0006-archon-on-workload FR-009"], "a step of a dialect is two ArgvSteps of core: words, who runs it and the exit codes expected, and a shell string is found", () => {
  const step = { covers: [], summary: "install", apply: ["apt-get", "install", "-y", "git"], check: ["apt-get", "install", "-s", "git"], changedExit: 2, as: "root" as const };
  assertEquals(argvStepsOf(step), { apply: { argv: ["apt-get", "install", "-y", "git"], as: "root", expect: [0] }, check: { argv: ["apt-get", "install", "-s", "git"], as: "root", expect: [0, 2] } });
  assertEquals(argvStepsOf({ covers: [], summary: "install", apply: ["apt-get", "install", "-y", "git"], check: undefined }), { apply: { argv: ["apt-get", "install", "-y", "git"], as: "user", expect: [0] } });
  assertEquals(stepFindings(step), []);
  assertEquals(stepFindings({ ...step, apply: ["sh", "-c", "apt-get install -y git"] }).length, 1);
  assertEquals(stepFindings({ ...step, check: ["powershell", "-Command", "x"] }).length, 1);
});
