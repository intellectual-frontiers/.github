/**
 * Tests of the dialect made from a manager's data (commons package-managers 0004-package-managers-dialect FR-001 to FR-006): its guarantees as data, the plan file rendered from Archon's order and plan
 * with only its own tools, the steps with their check where the missing status is known, the runner under a limit of time (with real programs that hang and that start others), and the observation
 * of what is installed through a made-up manager that is a real program. Every name is made up.
 *
 * @module
 */
import { buildOrder, planOf as planOfOrder } from "@intellectual-frontiers/archon/logical";
import { executionPlanOf, isGenerated } from "@intellectual-frontiers/archon/dialect";
import { defineRequirement, parseSubjectName, type JsonValue, type Requirement, type RequirementId } from "@intellectual-frontiers/archon/governance";
import { defineCatalog, defineTool, meetsIntegrity, requirementsFor, resolveTools } from "@intellectual-frontiers/toolchain";
import * as fs from "@intellectual-frontiers/system/fs";
import * as path from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { managerDialect, observeRequirements, runWithin, toolDialectOf } from "../src/physical/mod.ts";
import { ADMIN, FAKE, commandsOf } from "./fixtures.ts";
import { readPlanFile, type ManagerSpec } from "../src/logical/mod.ts";
import { program } from "../src/physical/mod.ts";

const posix = proc.build.os !== "windows";

function toolRequirements(spec: ManagerSpec, tools: readonly { name: string; version?: string; packages?: readonly string[] }[]): readonly Requirement[] {
  const defined = tools.map((t) => {
    const r = defineTool({
      name: t.name,
      summary: `${t.name}.`,
      pin: "release-line",
      program: t.name,
      versionArgs: ["--version"],
      phases: ["core"],
      scope: spec.guarantees.scopes[0] ?? "user",
      bindings: [{ kind: "package", manager: spec.manager, packages: t.packages ?? [t.name], ...(t.version === undefined ? {} : { version: t.version }) }],
    });
    assert(r.kind === "ok", JSON.stringify(r));
    return r.value;
  });
  const catalog = defineCatalog(defined);
  assert(catalog.kind === "ok");
  const d = toolDialectOf(spec);
  const resolution = resolveTools(catalog.value, tools.map((t) => t.name), [d], { lookup: () => ({ kind: "err", error: "no pins here" }) }, { platform: "linux-x64", preference: [d.id], integrity: "release-line", systemCopy: "never" });
  assert(resolution.kind === "ok", JSON.stringify(resolution.kind === "err" ? resolution.error : ""));
  const reqs = requirementsFor(resolution.value, { by: "all" });
  assert(reqs.kind === "ok");
  return reqs.value;
}

function orderOf(requirements: readonly Requirement[]) {
  const name = parseSubjectName("build-01.example.test");
  assert(name.kind === "ok");
  const order = buildOrder({ subject: { name: name.value, class: "workstation" }, assurance: "regulated", layers: [{ layer: "baseline", requirements }] });
  assert(order.kind === "ok");
  return order.value;
}

proves(["0004-package-managers-dialect FR-001"], "the guarantees are data: the kind tool, a partial plan where a check can be made and none where it cannot, and the guarantees of the manager for Toolchain", () => {
  const d = managerDialect(FAKE, commandsOf());
  assertEquals(String(d.id), "fakepm");
  assertEquals([d.guarantees.plan, d.guarantees.idempotence, d.guarantees.destroy, d.guarantees.subjects], ["partial", "unproven", false, ["machine", "workstation"]]);
  assertEquals(d.guarantees.kinds.map(String), ["tool"]);
  assertEquals(managerDialect(ADMIN, commandsOf()).guarantees.plan, "none");
  const t = toolDialectOf(FAKE);
  assertEquals([String(t.id), String(t.manager), t.guarantees.pin, t.guarantees.binds], ["fakepm", "manager-fakepm", "exact", "package"]);
  assertEquals(meetsIntegrity("exact-hashed", t.guarantees), []);
  assert(meetsIntegrity("exact-hashed", toolDialectOf(ADMIN).guarantees).length > 0, "a manager that checks by signature and pins a release line does not meet exact-hashed");
});

proves(["0004-package-managers-dialect FR-002"], "the plan file is rendered with only this dialect's tools, says it is generated, and every reason a command cannot be made is given", async () => {
  const mine = toolRequirements(FAKE, [{ name: "jq", version: "1.7.1" }, { name: "git" }]);
  const foreign = defineRequirement({ id: "tool.other", summary: "o", why: ["x"], subject: { by: "all" }, kind: "tool", desired: { dialect: "homebrew", tool: "other", program: "other", source: { kind: "package", manager: "manager-brew", packages: ["other"] } }, change: "additive" });
  assert(foreign.kind === "ok");
  const order = orderOf([...mine, foreign.value]);
  const plan = planOfOrder(order, new Map());
  const rendered = await managerDialect(FAKE, commandsOf()).render(order, plan);
  assert(rendered.kind === "ok");
  const text = rendered.value.files.get("fakepm/plan.json") ?? "";
  assert(isGenerated(text));
  assertEquals((JSON.parse(text).tools as { tool: string }[]).map((t) => t.tool), ["git", "jq"], "the tools are in the order of Archon");
  assertEquals(/-----BEGIN|password|token/i.test(text), false);
  const bad = orderOf(toolRequirements(FAKE, [{ name: "a", packages: ["-x"] }, { name: "b", packages: ["c;d"] }]));
  const refused = await managerDialect(FAKE, commandsOf()).render(bad, planOfOrder(bad, new Map()));
  assert(refused.kind === "err" && refused.error.length === 2, JSON.stringify(refused));
});

proves(["0004-package-managers-dialect FR-003"], "one step runs the program of the kit on the plan file that names the digest, and a plan that changes nothing has none", async () => {
  const reqs = toolRequirements(FAKE, [{ name: "jq", version: "1.7.1" }, { name: "git" }]);
  const order = orderOf(reqs);
  const plan = planOfOrder(order, new Map());
  const dialect = managerDialect(FAKE, commandsOf());
  const rendered = await dialect.render(order, plan);
  assert(rendered.kind === "ok");
  const steps = dialect.steps(plan, rendered.value);
  assertEquals(steps.length, 1);
  const step = steps[0];
  assert(step !== undefined);
  assertEquals(step.covers.map(String), ["tool.git", "tool.jq"]);
  assertEquals([step.apply[2], step.check?.[2], step.changedExit], ["apply", "check", 2]);
  assert(step.apply[3]?.endsWith(`/${rendered.value.digest}/fakepm/plan.json`) === true && step.check?.[3] === step.apply[3]);
  const exec = executionPlanOf(plan, rendered.value, steps);
  assert(exec.kind === "ok" && exec.value !== undefined && exec.value.steps.length === 1);
  const adminReqs = toolRequirements(ADMIN, [{ name: "git" }]);
  const adminOrder = orderOf(adminReqs);
  const adminPlan = planOfOrder(adminOrder, new Map());
  const admin = managerDialect(ADMIN, commandsOf());
  const adminRendered = await admin.render(adminOrder, adminPlan);
  assert(adminRendered.kind === "ok");
  assertEquals(admin.steps(adminPlan, adminRendered.value).length, 1, "a manager with no known status still has its step: the program says it cannot ask first");
  const r0 = reqs[0];
  const r1 = reqs[1];
  assert(r0 !== undefined && r1 !== undefined);
  const none = planOfOrder(order, new Map<RequirementId, JsonValue>([[r0.id, r0.desired], [r1.id, r1.desired]]));
  assertEquals(dialect.steps(none, rendered.value), []);
});

proves(["0004-package-managers-dialect FR-004"], "the runner answers with the status and the output, and with nothing for a program that is not there, that hangs, or that starts another that keeps its output", async () => {
  if (!posix) return;
  await fs.withTempDir(async (dir) => {
    const script = async (name: string, body: string): Promise<string> => {
      const f = path.join(dir, name);
      await fs.writeTextFile(f, `#!/bin/sh\n${body}\n`);
      await fs.chmod(f, 0o755);
      return f;
    };
    const run = runWithin(1000);
    assertEquals(await run([await script("ok", 'echo "said $1"; exit 3'), "x"]), { status: 3, stdout: "said x\n" });
    assertEquals(await run([path.join(dir, "no-such-program")]), undefined);
    const started = Date.now();
    assertEquals(await runWithin(500)([await script("hangs", "sleep 30 &\nwait")]), undefined);
    assertEquals(await runWithin(500)([await script("child", "sleep 30 &\necho started")]), undefined);
    assert(Date.now() - started < 5000, "the answers came at the limit and never waited for the children");
  });
});

proves(["0004-package-managers-dialect FR-005"], "Archon is given the desired state for a tool at the version asked, a differing state for another version, and nothing for an absent tool or an answer with no version", async () => {
  if (!posix) return;
  await fs.withTempDir(async (dir) => {
    const f = path.join(dir, "ver");
    await fs.writeTextFile(f, '#!/bin/sh\ncase "$1" in\n jq) echo "jq-1.7.1";;\n old) echo "1.6";;\n gone) exit 1;;\n blank) echo hello;;\n any) echo "2.0.0";;\nesac\n');
    await fs.chmod(f, 0o755);
    const reqs = toolRequirements(FAKE, [{ name: "jq", version: "1.7.1" }, { name: "old", version: "1.7.1" }, { name: "gone", version: "1.7.1" }, { name: "blank", version: "1.7.1" }, { name: "any" }]);
    const seen = await observeRequirements(FAKE, commandsOf({ QueryVersion: f }), reqs, { run: runWithin(3000) });
    const by = (n: string) => seen.get(`tool.${n}` as RequirementId);
    const jq = reqs.find((r) => r.id === ("tool.jq" as RequirementId));
    assert(jq !== undefined);
    assertEquals(by("jq"), jq.desired);
    const old = by("old") as { version: string; installedFrom: string };
    assertEquals([old.version, old.installedFrom], ["1.6", "manager"]);
    assertEquals([by("gone"), by("blank")], [undefined, undefined]);
    assertEquals(by("any"), reqs.find((r) => r.id === ("tool.any" as RequirementId))?.desired, "any version counts where none is asked");
    assertEquals((await observeRequirements(FAKE, commandsOf({ QueryVersion: path.join(dir, "missing") }), reqs, { run: runWithin(1000) })).size, 0);
  });
});

proves(["0004-package-managers-dialect FR-006"], "the program that raises the rights comes from the options and is put before only the commands of a manager that needs rights", async () => {
  const order = orderOf(toolRequirements(ADMIN, [{ name: "git", version: "2.43.0" }]));
  const plan = planOfOrder(order, new Map());
  const withSudo = managerDialect(ADMIN, commandsOf(), { elevate: ["sudo", "-n"] });
  const r1 = await withSudo.render(order, plan);
  assert(r1.kind === "ok");
  const planOf = (r: typeof r1.value) => readPlanFile(r.files.get("adminpm/plan.json") ?? "");
  const p1 = planOf(r1.value);
  assert(p1.kind === "ok");
  assertEquals(p1.value.lines[0]?.install, ["sudo", "-n", "env", "ADMINPM_QUIET=1", "adminpm", "install", "-y", "git=2.43.0"]);
  const without = managerDialect(ADMIN, commandsOf());
  const r2 = await without.render(order, plan);
  assert(r2.kind === "ok");
  const p2 = planOf(r2.value);
  assert(p2.kind === "ok");
  assertEquals(p2.value.lines[0]?.install, ["env", "ADMINPM_QUIET=1", "adminpm", "install", "-y", "git=2.43.0"]);
  const plain = managerDialect(FAKE, commandsOf(), { elevate: ["sudo", "-n"] });
  const fakeOrder = orderOf(toolRequirements(FAKE, [{ name: "git" }]));
  const fakePlan = planOfOrder(fakeOrder, new Map());
  const r3 = await plain.render(fakeOrder, fakePlan);
  assert(r3.kind === "ok");
  const p3 = readPlanFile(r3.value.files.get("fakepm/plan.json") ?? "");
  assert(p3.kind === "ok");
  assertEquals(p3.value.lines[0]?.install, ["fakepm", "install", "git"], "a manager that needs no rights is never raised");
});

proves(["0004-package-managers-dialect FR-007"], "the program runs only a plan file's commands: check changes nothing and ends with 2, apply installs what is missing, a second apply changes nothing, and failures name the tool, the step and the next action", async () => {
  if (!posix) return;
  await fs.withTempDir(async (dir) => {
    const script = async (name: string, body: string): Promise<string> => {
      const f = path.join(dir, name);
      await fs.writeTextFile(f, `#!/bin/sh\n${body}\n`);
      await fs.chmod(f, 0o755);
      return f;
    };
    const state = path.join(dir, "installed");
    await fs.mkdir(state);
    const has = await script("has", `[ -e "${state}/$1" ] && exit 0\nexit 3`);
    const put = await script("put", `n="\${2%%@*}"\ncase "$n" in\n broken) echo "no space left"; exit 9;;\nesac\ntouch "${state}/$n"`);
    const odd = await script("odd", "exit 7");
    const reqs = toolRequirements(FAKE, [{ name: "git" }, { name: "jq", version: "1.7.1" }]);
    const order = orderOf(reqs);
    const plan = planOfOrder(order, new Map());
    const commands = commandsOf({ Install: put, QueryInstalled: has });
    const rendered = await managerDialect(FAKE, commands).render(order, plan);
    assert(rendered.kind === "ok");
    const file = path.join(dir, "plan.json");
    await fs.writeTextFile(file, rendered.value.files.get("fakepm/plan.json") ?? "");
    const out: string[] = [];
    const io = { out: (l: string) => void out.push(l), ask: runWithin(3000), install: runWithin(3000) };
    assertEquals(await program(["check", file], io), 2);
    assert(out.some((l) => l.startsWith("⚡ git: would install git")) && out.some((l) => l.startsWith("⚡ jq 1.7.1: would install jq with")), out.join("\n"));
    assertEquals(await fs.listFiles(state), [], "check changed nothing");
    out.length = 0;
    assertEquals(await program(["apply", file], io), 0, out.join("\n"));
    assertEquals((await fs.listFiles(state)).sort(), ["git", "jq"]);
    out.length = 0;
    assertEquals(await program(["apply", file], io), 0);
    assert(out.every((l) => l.includes("nothing to do")), out.join("\n"));
    assertEquals(await program(["check", file], io), 0);

    const broken = orderOf(toolRequirements(FAKE, [{ name: "broken" }]));
    const brokenRendered = await managerDialect(FAKE, commands).render(broken, planOfOrder(broken, new Map()));
    assert(brokenRendered.kind === "ok");
    await fs.writeTextFile(file, brokenRendered.value.files.get("fakepm/plan.json") ?? "");
    out.length = 0;
    assertEquals(await program(["apply", file], io), 1);
    assert(out.some((l) => l.startsWith("❌ broken: install:") && l.includes("status 9") && l.includes("no space left") && l.includes("Next:")), out.join("\n"));
    const oddRendered = await managerDialect(FAKE, commandsOf({ Install: put, QueryInstalled: odd })).render(broken, planOfOrder(broken, new Map()));
    assert(oddRendered.kind === "ok");
    await fs.writeTextFile(file, oddRendered.value.files.get("fakepm/plan.json") ?? "");
    out.length = 0;
    assertEquals(await program(["check", file], io), 1);
    assert(out.some((l) => l.startsWith("❌ broken: check:") && l.includes("status 7")), out.join("\n"));

    const noCheck = orderOf(toolRequirements(ADMIN, [{ name: "git" }]));
    const noCheckRendered = await managerDialect(ADMIN, commandsOf({ Install: put })).render(noCheck, planOfOrder(noCheck, new Map()));
    assert(noCheckRendered.kind === "ok");
    await fs.writeTextFile(file, (noCheckRendered.value.files.get("adminpm/plan.json") ?? "").replace('"env",', "").replace('"ADMINPM_QUIET=1",', "").replace(/"sudo",?/, ""));
    out.length = 0;
    assertEquals(await program(["check", file], io), 2);
    assert(out.some((l) => l.includes("it cannot be asked first")), out.join("\n"));

    await fs.writeTextFile(file, "{}");
    out.length = 0;
    assertEquals(await program(["apply", file], io), 1);
    assert(out.some((l) => l.includes("is not a plan of this program")));
    assertEquals(await program(["apply", path.join(dir, "none.json")], io), 1);
    assertEquals(await program(["apply"], io), 64);
  });
});
