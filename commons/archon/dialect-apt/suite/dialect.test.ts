/**
 * Tests of the dialect of apt (commons archon-dialect-apt 0002-apt-dialect FR-001 to FR-004): its data, the dialect the kit makes from made-up commands of the manager (the commands the ontology states are the
 * ontology's, not copied here), how an exact version is written, and which controls of a fleet it is chosen for by Toolchain. Every name is made up.
 *
 * @module
 */
import { buildOrder, planOrder } from "@intellectual-frontiers/archon/logical";
import { parseSubjectName } from "@intellectual-frontiers/archon/governance";
import { readPlanFile, type CommandSource } from "@intellectual-frontiers/package-managers";
import { defineCatalog, defineTool, requirementsFor, resolveTools } from "@intellectual-frontiers/toolchain";
import { err, ok } from "@intellectual-frontiers/core";
import { commandOf, exactVersionOf, parseManagerId } from "@intellectual-frontiers/ontology/supply-chain/commands";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { apt, DIALECT_ID, SPEC, TOOL_DIALECT } from "../src/dialect.ts";

const commands: CommandSource = (manager, op) =>
  manager !== SPEC.manager
    ? err(`${manager} is not this manager`)
    : ok(op === "Install" ? { manager, executable: "apt-get", environment: "DEBIAN_FRONTEND=noninteractive", needsAdministrator: true, template: "apt-get install -y {packages}", verified: false } : { manager, executable: "q", needsAdministrator: false, template: op === "QueryInstalled" ? "dpkg-query -W -f=${Status} {package}" : "dpkg-query -W -f=${Version} {package}", verified: false });

function requirementsOf(version: string | undefined) {
  const tool = defineTool({
    name: "git",
    summary: "Git.",
    pin: "rolling",
    program: "git",
    versionArgs: ["--version"],
    phases: ["core"],
    scope: SPEC.guarantees.scopes[0] ?? "user",
    bindings: [{ kind: "package", manager: SPEC.manager, packages: ["git"], ...(version === undefined ? {} : { version }) }],
  });
  assert(tool.kind === "ok", JSON.stringify(tool));
  const catalog = defineCatalog([tool.value]);
  assert(catalog.kind === "ok");
  return catalog.value;
}

proves(["0002-apt-dialect FR-001"], "the data says what apt guarantees", () => {
  assertEquals(DIALECT_ID, "apt");
  assertEquals(String(SPEC.manager), "manager-apt");
  const g = SPEC.guarantees;
  assertEquals([g.pin, g.integrity, g.scopes, g.platforms, g.binds, g.sourceBuild], ["exact", "signature", ["system"], ["linux-x64", "linux-arm64"], "package", false]);
  assertEquals(SPEC.missingExit, 1);
  assertEquals(String(TOOL_DIALECT.id), "apt");
  assertEquals(String(TOOL_DIALECT.manager), "manager-apt");
});

proves(["0002-apt-dialect FR-002", "0002-apt-dialect FR-003"], "the dialect of the kit is made from the data, and an exact version is written as the manager writes it", async () => {
  const dialect = apt(commands, { elevate: ["sudo", "-n"] });
  assertEquals(String(dialect.id), "apt");
  assertEquals(dialect.guarantees.kinds.map(String), ["tool"]);
  const name = parseSubjectName("build-01.example.test");
  assert(name.kind === "ok");
  const render = async (version: string | undefined) => {
    const catalog = requirementsOf(version);
    const resolution = resolveTools(catalog, ["git"], [TOOL_DIALECT], { lookup: () => err("no pins here") }, { platform: SPEC.guarantees.platforms[0] ?? "linux-x64", preference: [TOOL_DIALECT.id], integrity: "rolling", systemCopy: "never", sourceBuild: "approved" });
    assert(resolution.kind === "ok", JSON.stringify(resolution));
    const reqs = requirementsFor(resolution.value, { by: "all" });
    assert(reqs.kind === "ok");
    const order = buildOrder({ subject: { name: name.value, class: "workstation" }, assurance: "regulated", layers: [{ layer: "baseline", requirements: reqs.value }] });
    assert(order.kind === "ok");
    return dialect.render(order.value, planOrder(order.value, new Map()));
  };
  const rendered = await render("2.43.0");
  assert(rendered.kind === 'ok');
  if (rendered.kind === "ok") {
    const file = readPlanFile(rendered.value.files.get(`apt/plan.json`) ?? "");
    assert(file.kind === "ok");
    assertEquals(file.value.lines[0]?.install, ["sudo", "-n", "env", "DEBIAN_FRONTEND=noninteractive", "apt-get", "install", "-y", "git=2.43.0"]);
  }
  
});

proves(["0002-apt-dialect FR-004"], "Toolchain chooses the dialect only for the controls whose demands its guarantees meet", () => {
  const catalog = requirementsOf(undefined);
  const at = (integrity: "rolling" | "release-line" | "exact-hashed", sourceBuild?: "approved") =>
    resolveTools(catalog, ["git"], [TOOL_DIALECT], { lookup: () => err("no pins here") }, { platform: SPEC.guarantees.platforms[0] ?? "linux-x64", preference: [TOOL_DIALECT.id], integrity, systemCopy: "never", ...(sourceBuild === undefined ? {} : { sourceBuild }) });
  const expected: Record<string, string> = {"rolling": "ok", "release-line": "ok", "exact-hashed": "integrity"};
  for (const [control, how] of Object.entries(expected)) {
    const c = control as "rolling" | "release-line" | "exact-hashed";
    const plain = at(c);
    const approved = at(c, "approved");
    if (how === "ok") assert(plain.kind === "ok" && approved.kind === "ok", control);
    else if (how === "build") assert(plain.kind === "err" && approved.kind === "ok", control);
    else {
      assert(plain.kind === "err" && approved.kind === "err", control);
      const reasons = approved.error[0]?.kind === "unexpressed" ? approved.error[0].reasons.map((r) => r.reason).join(" ") : "";
      assert(how === "pin" ? reasons.includes("pins") : reasons.includes("hash"), reasons);
    }
  }
});

proves(["0002-apt-dialect FR-001", "0002-apt-dialect FR-003"], "against the real ontology: the way it writes a version and the status of its check agree with what the ontology states", () => {
  const id = parseManagerId("apt");
  assert(id.kind === "ok");
  const exact = exactVersionOf(id.value);
  assert(exact.kind === "ok");
  const words = exact.value.template;
  const joiner = SPEC.versioning.kind === "joined" ? SPEC.versioning.joiner : "?";
  assert(words.includes(`{package}${joiner}{version}`), words.join(" "));
  const installed = commandOf(id.value, "QueryInstalled");
  assertEquals(installed.kind === "ok" ? installed.value.missingExitStatus : undefined, SPEC.missingExit, "the status that means missing is the ontology's, or neither states one");
  assertEquals(String(SPEC.manager), `manager-${id.value}`);
});
