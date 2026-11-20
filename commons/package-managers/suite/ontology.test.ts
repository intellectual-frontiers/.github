/**
 * Tests of the commands of the packaging ontology as the source of the kit (commons package-managers 0004-package-managers-dialect FR-008), with the real ontology: the commands of apt, Homebrew,
 * WinGet and mise are the ontology's, with their environment, rights and whether they were tried, a command it does not state is its reason, and the argument vectors the kit makes from them are
 * the ones a person would run.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { commandArgv } from "../src/logical/mod.ts";
import { commandsFromOntology } from "../src/physical/mod.ts";

const source = commandsFromOntology();

proves(["0004-package-managers-dialect FR-008"], "the commands are the ontology's, a command it does not state is its reason, and the vectors made from them are the ones a person runs", () => {
  const apt = source("manager-apt", "Install");
  assert(apt.kind === "ok");
  assertEquals([apt.value.manager, apt.value.executable, apt.value.environment, apt.value.needsAdministrator, apt.value.verified], ["manager-apt", "apt-get", "DEBIAN_FRONTEND=noninteractive", true, true]);
  assert(apt.value.template.includes("{packages}") && apt.value.nonInteractive?.includes("-y") === true);
  const made = commandArgv(apt.value, { packages: ["git", "curl"] }, { kind: "joined", joiner: "=" }, { elevate: ["sudo", "-n"] });
  assert(made.kind === "ok");
  assertEquals(made.value.argv.slice(0, 5), ["sudo", "-n", "env", "DEBIAN_FRONTEND=noninteractive", "apt-get"]);
  assertEquals(made.value.argv.slice(-2), ["git", "curl"]);
  for (const m of ["manager-apt", "manager-brew", "manager-winget", "manager-mise"]) {
    for (const op of ["Install", "QueryVersion"] as const) {
      const r = source(m, op);
      assert(r.kind === "ok", `${m} ${op}`);
      assertEquals(r.value.manager, m);
      assert(!/[;|&<>`'"\\]/.test(r.value.template), `${m} ${op} has a word a shell would read`);
    }
  }
  const noRefresh = source("manager-winget", "Refresh");
  assert(noRefresh.kind === "err" && noRefresh.error.length > 0);
  const unknown = source("manager-nosuch", "Install");
  assert(unknown.kind === "err");
});
