/**
 * Tests of composition and of `ready` (commons workbench 0005-workbench-resolution FR-001 to FR-006): a task needs the base and the contributions of the units it is about and no more, a requirement only some tests need is there
 * only where such a test is selected, nothing is obtained unless asked, what is obtained is only what an agent may fix and by the argument vector given, and the probe reads names and never values.
 *
 * @module
 */
import { compose, globMatches } from "@intellectual-frontiers/workbench/logical";
import { probe, ready } from "@intellectual-frontiers/workbench/physical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { contract, GIT, SQLITE, TOKEN } from "./kit.ts";

const ids = (rs: readonly { readonly id: string }[]): readonly string[] => rs.map((r) => r.id);

proves(["0005-workbench-resolution FR-001"], "a task needs the base and the contributions of the units it is about, and a unit that is not selected contributes nothing", () => {
  assertEquals(ids(compose(contract, "any")), ["git", "registry-token"]);
  assertEquals(ids(compose(contract, "test", { units: ["synthetic-plain"] })), ["git", "registry-token"]);
  assertEquals(ids(compose(contract, "test", { units: ["synthetic-sql"] })), ["git", "registry-token", "sql-install", "sqlite3"]);
  assertEquals(ids(compose(contract, "release")), ["git", "registry-token", "tag-release"]);
  assertEquals(ids(compose(contract, "test", { units: ["nothing-here"] })), ["git", "registry-token"]);
});

proves(["0005-workbench-resolution FR-002"], "a requirement that only some tests need is part of the task only where one of those tests is selected", () => {
  assertEquals(ids(compose(contract, "test", { units: ["synthetic-evidence"], files: ["suite/other.test.ts"] })), ["git", "registry-token"]);
  assertEquals(ids(compose(contract, "test", { units: ["synthetic-evidence"], files: ["suite/keys.test.ts"] })), ["git", "registry-token", "ssh-keygen"]);
  assertEquals(ids(compose(contract, "test", { units: ["synthetic-sql"], files: ["suite/sqlite-store.test.ts"] })), ["git", "registry-token", "sql-install", "sqlite3"]);
  assertEquals(ids(compose(contract, "test", { units: ["synthetic-sql"], files: ["suite/other.test.ts"] })), ["git", "registry-token", "sql-install"]);
  assertEquals(globMatches("suite/*sqlite*.test.ts", "suite/a/sqlite.test.ts"), false);
  assertEquals(globMatches("**/*.test.ts", "suite/a/sqlite.test.ts"), true);
});

proves(["0005-workbench-resolution FR-003"], "every unit is selected only by asking for all of them, which is what the cold start of CI does", () => {
  assertEquals(ids(compose(contract, "test", { units: "all" })), ["git", "registry-token", "sql-install", "sqlite3", "ssh-keygen"]);
});

const NOW = "2026-12-01";

proves(["0005-workbench-resolution FR-004"], "ready without a selection checks the base alone, with one the base and the units' contributions, obtains nothing unless asked and fails only on an error", async () => {
  const env = {} as Record<string, string | undefined>;
  const base = await ready({ contract, task: "any", selection: { units: [] }, root: "/nonexistent-root", env, today: NOW, ensure: false });
  assertEquals(ids(base.requirements), ["git", "registry-token"]);
  assertEquals(base.findings.some((f) => f.requirement === "registry-token"), true);
  assertEquals(base.obtained, []);
  assertEquals(base.exit, 0, "before the day every finding is a hint");
  const later = await ready({ contract, task: "any", selection: { units: [] }, root: "/nonexistent-root", env, today: "2027-02-01", ensure: false });
  assertEquals(later.exit, 1, "after the day a missing credential is an error");
});

proves(["0005-workbench-resolution FR-005"], "with ensure it runs only the argument vector of what an agent may fix, never for a credential, then looks again", async () => {
  const ran: (readonly string[])[] = [];
  const contractWithMissing = { ...contract, base: [...contract.base, { ...SQLITE, id: "synthetic-missing", name: "workbench-no-such-program-xyz", install: ["synthetic-installer", "xyz"], task: "any" as const }] };
  const r = await ready({ contract: contractWithMissing, task: "any", selection: { units: [] }, root: "/tmp", env: {}, today: NOW, ensure: true, run: (argv) => { ran.push(argv); return Promise.resolve({ success: true }); } });
  assertEquals(ran, [["synthetic-installer", "xyz"]]);
  assertEquals(r.obtained.map((o) => o.requirement), ["synthetic-missing"]);
  assert(r.findings.some((f) => f.code === "E-WB-WORKBENCH-MISSING-CREDENTIAL"), "a credential is still missing: it is a person's");
  const none = await ready({ contract: contractWithMissing, task: "any", selection: { units: [] }, root: "/tmp", env: {}, today: NOW, ensure: false, run: () => { throw new Error("must not run"); } });
  assertEquals(none.obtained, []);
});

proves(["0005-workbench-resolution FR-006"], "the probe reads the version of a program that is there, finds one that is not absent, and holds the names set in the environment and never their values", async () => {
  const facts = await probe([{ ...GIT, name: "sh", probe: ["sh", "-c", "echo 3.2.1"] }, { ...GIT, id: "nope", name: "workbench-no-such-program-xyz" }, TOKEN], { root: "/tmp", env: { NODE_AUTH_TOKEN: "ghp_the_value_is_never_kept", EMPTY: "", OTHER: undefined } });
  assertEquals(facts.programs["sh"], "3.2.1");
  assertEquals(facts.programs["workbench-no-such-program-xyz"], undefined);
  assertEquals([...facts.env], ["NODE_AUTH_TOKEN"]);
  assert(!JSON.stringify([...facts.env, facts.programs]).includes("the_value"), "no value is in the facts");
});
