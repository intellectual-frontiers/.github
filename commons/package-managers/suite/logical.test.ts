/**
 * Tests of the logical layer of the kit (commons package-managers 0003-package-managers-logical FR-001 to FR-007): the argument vector of a command, the exact version as each way of writing it,
 * the names that are refused, the form that asks nothing, the environment and the rights, the jobs a requirement asks, the plan file and the reading of a version. Every name is made up.
 *
 * @module
 */
import { defineRequirement, type Requirement } from "@intellectual-frontiers/archon/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { CommandSpec, Versioning } from "../src/governance/mod.ts";
import { commandArgv, jobOf, planFileText, planLines, sameVersion, versionIn, type PackageJob } from "../src/logical/mod.ts";
import { ADMIN, FAKE, commandsOf } from "./fixtures.ts";

const spec = (more: Partial<CommandSpec> = {}): CommandSpec => ({ manager: "manager-x", executable: "x", needsAdministrator: false, template: "x install {packages}", verified: false, ...more });
const argv = (s: CommandSpec, packages: readonly string[], version?: string, v: Versioning = { kind: "joined", joiner: "=" }, shape = {}) => {
  const r = commandArgv(s, { packages, version }, v, shape);
  return r.kind === "ok" ? r.value.argv : `refused: ${r.error}`;
};

proves(["0003-package-managers-logical FR-001"], "the names go where the template says, each as one argument, and a template that cannot be filled is refused", () => {
  assertEquals(argv(spec({ template: "apt-get install -y {packages}" }), ["git", "curl"]), ["apt-get", "install", "-y", "git", "curl"]);
  assertEquals(argv(spec({ template: "x info {package}" }), ["git"]), ["x", "info", "git"]);
  assert(String(argv(spec({ template: "x info {package}" }), ["git", "curl"])).includes("one package at a time"));
  assert(String(argv(spec({ template: "x install" }), ["git"])).includes("0 places"));
  assert(String(argv(spec({ template: "x install {packages} {packages}" }), ["git"])).includes("2 places"));
  assert(String(argv(spec({ template: "x install {packages} {other}" }), ["git"])).includes("does not fill"));
  assert(String(argv(spec(), [])).includes("no package"));
});

proves(["0003-package-managers-logical FR-002"], "an exact version is written as the manager writes it, for the first package, and refused where it cannot be", () => {
  assertEquals(argv(spec(), ["git", "curl"], "2.43.0", { kind: "joined", joiner: "=" }), ["x", "install", "git=2.43.0", "curl"]);
  assertEquals(argv(spec(), ["jq"], "1.7.1", { kind: "joined", joiner: "@" }), ["x", "install", "jq@1.7.1"]);
  const flags: Versioning = { kind: "flags", packageFlags: ["--id"], exactFlags: ["--exact"], versionFlag: "--version" };
  assertEquals(argv(spec(), ["Pkg.Id"], "1.2.3", flags), ["x", "install", "--id", "Pkg.Id", "--exact", "--version", "1.2.3"]);
  assertEquals(argv(spec(), ["Pkg.Id"], undefined, flags), ["x", "install", "--id", "Pkg.Id", "--exact"]);
  assert(String(argv(spec(), ["a", "b"], "1.2.3", flags)).includes("for one package"));
  assert(String(argv(spec(), ["a"], "1.2.3", { kind: "none", reason: "it installs the latest" })).includes("it installs the latest"));
  assertEquals(argv(spec(), ["a", "b"], undefined, { kind: "none", reason: "x" }), ["x", "install", "a", "b"]);
});

proves(["0003-package-managers-logical FR-003"], "a name or a version that is not safe is refused, naming it", () => {
  assert(String(argv(spec(), ["-rf"])).includes('"-rf"'));
  assert(String(argv(spec(), ["a;b"])).includes("not a package name"));
  assert(String(argv(spec(), ["git"], "1 2")).includes('"1 2"'));
  assert(String(argv(spec(), ["git"], "-1")).includes("not a version"));
});

proves(["0003-package-managers-logical FR-004"], "the form that asks nothing is used, the environment comes as env, and the rights are raised only for a manager that needs them", () => {
  const s = spec({ template: "x install {packages}", nonInteractive: "x install -y {packages}", environment: "X_QUIET=1", needsAdministrator: true });
  assertEquals(argv(s, ["git"], undefined, undefined, { elevate: ["sudo", "-n"] }), ["sudo", "-n", "env", "X_QUIET=1", "x", "install", "-y", "git"]);
  assertEquals(argv(s, ["git"], undefined, undefined, { interactive: true }), ["env", "X_QUIET=1", "x", "install", "git"]);
  assertEquals(argv(s, ["git"]), ["env", "X_QUIET=1", "x", "install", "-y", "git"], "no program that raises the rights is put where none is given");
  assertEquals(argv(spec({ needsAdministrator: false }), ["git"], undefined, undefined, { elevate: ["sudo", "-n"] }), ["x", "install", "git"], "a manager that needs no rights is never raised");
});

function requirement(desired: Record<string, unknown>, kind = "tool"): Requirement {
  const r = defineRequirement({ id: "tool.jq", summary: "jq", why: ["x"], subject: { by: "all" }, kind, desired: desired as never, change: "additive" });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

proves(["0003-package-managers-logical FR-005"], "a job is only for a tool requirement of this dialect, this manager and a source of packages", () => {
  const base = { tool: "jq", program: "jq", version: "1.7.1", alsoNamed: ["jqx"], versionArgs: ["--version"], dialect: "fakepm", source: { kind: "package", manager: "manager-fakepm", packages: ["jq", "libjq"] } };
  const job = jobOf(FAKE, requirement(base));
  assertEquals(job, { requirement: "tool.jq", tool: "jq", program: "jq", alsoNamed: ["jqx"], versionArgs: ["--version"], version: "1.7.1", packages: ["jq", "libjq"] });
  assertEquals(jobOf(FAKE, requirement({ ...base, dialect: "other" })), undefined);
  assertEquals(jobOf(FAKE, requirement({ ...base, source: { kind: "package", manager: "manager-other", packages: ["jq"] } })), undefined);
  assertEquals(jobOf(FAKE, requirement({ ...base, source: { kind: "download", pin: "jq" } })), undefined);
  assertEquals(jobOf(FAKE, requirement({ ...base, source: { kind: "package", manager: "manager-fakepm", packages: [] } })), undefined);
  assertEquals(jobOf(FAKE, requirement({ x: 1 }, "file")), undefined);
  assertEquals(jobOf(FAKE, requirement({ ...base, version: null }))?.version, null);
});

proves(["0003-package-managers-logical FR-006"], "the plan file says it is generated, names the commands in a fixed order, and every reason a command cannot be made is given", () => {
  const jobs: PackageJob[] = [
    { requirement: "tool.jq", tool: "jq", program: "jq", alsoNamed: [], versionArgs: [], version: "1.7.1", packages: ["jq"] },
    { requirement: "tool.git", tool: "git", program: "git", alsoNamed: [], versionArgs: [], version: null, packages: ["git"] },
  ];
  const lines = planLines(FAKE, commandsOf(), jobs, {});
  assert(lines.kind === "ok");
  assertEquals(lines.value.map((l) => [l.tool, l.install, l.check, l.admin, l.verified]), [
    ["jq", ["fakepm", "install", "jq@1.7.1"], ["fakepm-has", "jq"], false, false],
    ["git", ["fakepm", "install", "git"], ["fakepm-has", "git"], false, false],
  ]);
  const text = planFileText(FAKE, lines.value);
  assert(text.includes("GENERATED by archon") && text.endsWith("\n"));
  assertEquals(text, planFileText(FAKE, lines.value), "the same lines give the same text");
  assertEquals(Object.keys(JSON.parse(text)), ["_generated", "format", "dialect", "manager", "tools"]);
  const admin = planLines(ADMIN, commandsOf(), jobs.slice(0, 1), { elevate: ["sudo", "-n"] });
  assert(admin.kind === "ok" && admin.value[0]?.check === null && admin.value[0].admin && admin.value[0].install[0] === "sudo");
  const bad = planLines(FAKE, commandsOf(), [{ ...jobs[0]!, packages: ["-x"] }, { ...jobs[1]!, packages: ["a;b"] }], {});
  assert(bad.kind === "err" && bad.error.length === 2, JSON.stringify(bad));
  const refused = planLines({ ...FAKE, manager: ADMIN.manager, missingExit: undefined, versioning: { kind: "none", reason: "latest only" } }, commandsOf(), [jobs[0]!], {});
  assert(refused.kind === "err" && refused.error[0]?.includes("latest only") === true);
});

proves(["0003-package-managers-logical FR-007"], "a version is read without its epoch, and an installed version is the one asked for or it followed by a revision, never a prefix of another number", () => {
  assertEquals(versionIn("1:2.43.0-1ubuntu7"), "2.43.0-1ubuntu7");
  assertEquals(versionIn("git version 2.43.0"), "2.43.0");
  assertEquals(versionIn("jq-1.7.1\n"), "1.7.1");
  assertEquals(versionIn("nothing here"), undefined);
  assert(sameVersion("2.43.0", "2.43.0") && sameVersion("2.43.0-1ubuntu7", "2.43.0") && sameVersion("2.43.0+dfsg", "2.43.0") && sameVersion("2.43.0~rc1", "2.43.0"));
  assertEquals(sameVersion("2.43.0", "2.4"), false);
  assertEquals(sameVersion("2.4", "2.43.0"), false);
});
