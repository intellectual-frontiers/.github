/**
 * Tests of the table-driven adapter of the operating system package managers (commons package-managers 0005-package-managers-adapter FR-001 to FR-005): one row for each key, the rows agree with the ontology,
 * the steps of each manager are words of core (the commands are the ontology's own, read through its reader), no step is a shell string, and a key or a command that cannot be made is refused. Names are made up.
 *
 * @module
 */
import { argvFindings } from "@intellectual-frontiers/core";
import { defineRequirement, type JsonValue, type Requirement } from "@intellectual-frontiers/archon/governance";
import { commandOf, exactVersionOf, parseManagerId } from "@intellectual-frontiers/ontology/supply-chain/commands";
import { meetsIntegrity } from "@intellectual-frontiers/toolchain/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { commandsFromOntology, installSteps, MANAGER_KEYS, packageDialect, PACKAGE_MANAGERS, specOf, toolDialectOfKey } from "../src/mod.ts";

const commands = commandsFromOntology();

function tool(key: string, name: string, version?: string): Requirement {
  const desired: JsonValue = { dialect: key, tool: "synthetic-tool-01", program: "synthetic-tool", source: { kind: "package", manager: `manager-${key}`, packages: [name] }, ...(version === undefined ? {} : { version }) };
  const r = defineRequirement({ id: `tool.synthetic-${key}`, summary: "a made-up tool.", why: ["a made-up reason"], subject: { by: "all" }, kind: "tool", desired, change: "additive" });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

proves(["0005-package-managers-adapter FR-001"], "the table has one row for each of the nine keys and a key outside it is refused naming them", () => {
  assertEquals([...MANAGER_KEYS], ["apt", "dnf", "yum", "zypper", "apk", "pacman", "brew", "winget", "mise"]);
  assertEquals(Object.keys(PACKAGE_MANAGERS), [...MANAGER_KEYS]);
  for (const k of MANAGER_KEYS) {
    const row = PACKAGE_MANAGERS[k];
    assertEquals(row.id, k);
    assertEquals(String(row.manager), `manager-${k}`);
    const spec = specOf(k);
    assert(spec.kind === "ok" && spec.value === row);
    const dialect = toolDialectOfKey(k);
    assert(dialect.kind === "ok" && String(dialect.value.id) === k && dialect.value.guarantees === row.guarantees);
  }
  const refused = specOf("emerge");
  assert(refused.kind === "err" && MANAGER_KEYS.every((k) => refused.error.includes(k)));
  assertEquals(PACKAGE_MANAGERS.apt.guarantees, { pin: "exact", integrity: "signature", scopes: ["system"], platforms: ["linux-x64", "linux-arm64"], binds: "package", sourceBuild: false });
  assertEquals(PACKAGE_MANAGERS.winget.guarantees.integrity, "hash");
  assertEquals(PACKAGE_MANAGERS.brew.guarantees.pin, "rolling");
  assertEquals(PACKAGE_MANAGERS.mise.versioning, { kind: "joined", joiner: "@" });
});

proves(["0005-package-managers-adapter FR-002"], "against the real ontology: the way each row writes a version and the status of a missing package agree with what the ontology states", () => {
  for (const k of MANAGER_KEYS) {
    const id = parseManagerId(k);
    assert(id.kind === "ok", k);
    const row = PACKAGE_MANAGERS[k];
    const exact = exactVersionOf(id.value);
    if (exact.kind === "ok" && row.versioning.kind === "joined") assert(exact.value.template.some((w) => w === `{package}${row.versioning.kind === "joined" ? row.versioning.joiner : "?"}{version}`), `${k}: ${exact.value.template.join(" ")}`);
    const installed = commandOf(id.value, "QueryInstalled");
    if (installed.kind === "ok" && installed.value.missingExitStatus !== undefined) assertEquals(row.missingExit, installed.value.missingExitStatus, k);
    if (installed.kind === "err") assertEquals(row.missingExit, undefined, `${k} states no query, so no status is known`);
  }
});

const EXPECTED: Readonly<Record<string, { readonly name: string; readonly version?: string; readonly install: readonly string[]; readonly as: "user" | "root"; readonly check?: readonly string[] }>> = {
  apt: { name: "git", version: "2.43.0", install: ["env", "DEBIAN_FRONTEND=noninteractive", "apt-get", "install", "-y", "git=2.43.0"], as: "root" },
  dnf: { name: "git", version: "2.43.0", install: ["dnf", "install", "-y", "git-2.43.0"], as: "root", check: ["rpm", "-q", "git"] },
  yum: { name: "git", version: "2.43.0", install: ["yum", "install", "-y", "git-2.43.0"], as: "root" },
  zypper: { name: "git", version: "2.43.0", install: ["zypper", "--non-interactive", "install", "git=2.43.0"], as: "root" },
  apk: { name: "git", version: "2.43.0", install: ["apk", "add", "--no-cache", "git=2.43.0"], as: "root", check: ["apk", "info", "-e", "git"] },
  pacman: { name: "git", install: ["pacman", "-S", "--needed", "--noconfirm", "git"], as: "root", check: ["pacman", "-Qi", "git"] },
  brew: { name: "git", install: ["brew", "install", "git"], as: "user", check: ["brew", "list", "--formula", "git"] },
  winget: { name: "Git.Git", version: "2.43.0", install: ["winget", "install", "--accept-package-agreements", "--accept-source-agreements", "--id", "Git.Git", "--exact", "--version", "2.43.0"], as: "user" },
  mise: { name: "git", version: "2.43.0", install: ["mise", "install", "git@2.43.0"], as: "user" },
};

proves(["0005-package-managers-adapter FR-003", "0005-package-managers-adapter FR-005"], "each manager gives its install and check as words of core with the identity it needs, and no step is a shell string", () => {
  for (const k of MANAGER_KEYS) {
    const want = EXPECTED[k];
    assert(want !== undefined, k);
    const steps = installSteps(PACKAGE_MANAGERS[k], commands, [tool(k, want.name, want.version)]);
    assert(steps.kind === "ok", `${k}: ${steps.kind === "err" ? steps.error.join("; ") : ""}`);
    assertEquals(steps.value.length, 1);
    const s = steps.value[0];
    assert(s !== undefined);
    assertEquals([...s.install.argv], [...want.install], k);
    assertEquals(s.install.as, want.as, k);
    assertEquals(s.install.expect, [0]);
    assertEquals(s.check === undefined ? undefined : [...s.check.argv], want.check === undefined ? undefined : [...want.check], k);
    if (s.check !== undefined) assertEquals(s.check.expect, [0, PACKAGE_MANAGERS[k].missingExit ?? -1], k);
    assertEquals(argvFindings(s.install), [], k);
    if (s.check !== undefined) assertEquals(argvFindings(s.check), [], k);
    assert(!s.install.argv.some((w) => w === "sudo" || w === "doas"), `${k}: the identity is as, not a program in the words`);
  }
});

proves(["0005-package-managers-adapter FR-003"], "a version for a manager that cannot install one, and a name that is unsafe in a command, are refused with the reason", () => {
  const pinned = installSteps(PACKAGE_MANAGERS.pacman, commands, [tool("pacman", "git", "2.43.0")]);
  assert(pinned.kind === "err" && pinned.error.join(" ").includes("cannot install an exact version"), JSON.stringify(pinned));
  const unsafe = installSteps(PACKAGE_MANAGERS.apt, commands, [tool("apt", "-oops")]);
  assert(unsafe.kind === "err");
  assertEquals(installSteps(PACKAGE_MANAGERS.apt, commands, [tool("dnf", "git")]), { kind: "ok", value: [] }, "a tool of another manager is not this manager's");
});

proves(["0005-package-managers-adapter FR-004"], "the dialect of a manager is made by its key, and a key outside the table is refused", () => {
  for (const k of MANAGER_KEYS) {
    const d = packageDialect(k, commands, {});
    assert(d.kind === "ok" && String(d.value.id) === k, k);
  }
  assertEquals(packageDialect("emerge", commands, {}).kind, "err");
});

proves(["0005-package-managers-adapter FR-001"], "the controls of a fleet choose a manager by what its row guarantees: rolling asks nothing, exact-hashed asks an exact pin and a hash", () => {
  const met = (control: "rolling" | "release-line" | "exact-hashed") => MANAGER_KEYS.filter((k) => meetsIntegrity(control, PACKAGE_MANAGERS[k].guarantees).length === 0);
  assertEquals(met("rolling"), [...MANAGER_KEYS]);
  assertEquals(met("release-line"), ["apt", "dnf", "yum", "zypper", "apk", "winget", "mise"]);
  assertEquals(met("exact-hashed"), ["winget"]);
});
