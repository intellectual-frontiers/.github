/**
 * Tests of the catalog and of evaluation (commons workbench 0004-workbench-catalog FR-001 to FR-005): the codes are closed and each has a fixer and a fix, a failure the catalog does not know is classified as unknown, a finding is a
 * hint before the day the contract says and an error after it except for a safety rule, and a requirement that is met gives nothing.
 *
 * @module
 */
import { CATALOG, CONCEPTS, explain, FIXERS, isCatalogCode, severityOf } from "@intellectual-frontiers/workbench/governance";
import { compareVersions, evaluate } from "@intellectual-frontiers/workbench/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { contract, facts, GIT, SQL_INSTALL, SQLITE, TOKEN } from "./kit.ts";

proves(["0004-workbench-catalog FR-001"], "every code of the catalog belongs to a concept, names who fixes it and one fix, and codes are made as E-WB-<CONCEPT>-<KIND>", () => {
  for (const e of Object.values(CATALOG)) {
    assert(CONCEPTS.includes(e.concept), e.code);
    assert(FIXERS.includes(e.fixer), e.code);
    assert(e.fix.length > 10 && e.what.length > 10 && e.title.length > 5, e.code);
    if (e.code !== "E-WB-UNKNOWN") assertEquals(e.code, `E-WB-${e.concept.toUpperCase()}-${e.kind.toUpperCase()}`);
  }
  assertEquals(new Set(Object.keys(CATALOG)).size, Object.keys(CATALOG).length);
  assertEquals(isCatalogCode("E-WB-WORKSHOP-MISSING-PROGRAM"), true);
  assertEquals(isCatalogCode("E-WB-NOPE"), false);
});

proves(["0004-workbench-catalog FR-002"], "a finding is a hint before the day the contract says, a warning or an error after it by who can fix it, and an error always where it is a safety rule", () => {
  const missing = explain("E-WB-WORKSHOP-MISSING-PROGRAM");
  const credential = explain("E-WB-WORKBENCH-MISSING-CREDENTIAL");
  assertEquals(severityOf(missing, false, "2026-12-31", "2027-01-01"), "hint");
  assertEquals(severityOf(missing, false, "2027-01-01", "2027-01-01"), "warn");
  assertEquals(severityOf(credential, false, "2027-01-01", "2027-01-01"), "error");
  assertEquals(severityOf(missing, true, "2026-01-01", "2027-01-01"), "error");
  assertEquals(severityOf(explain("E-WB-WORKBENCH-SECRET-EXPOSED"), false, "2026-01-01", "2027-01-01"), "error");
});

proves(["0004-workbench-catalog FR-003"], "a code that is none is explained as unknown and says to classify it, never as an error of the question", () => {
  const e = explain("E-SOMETHING-NEW");
  assertEquals(e.code, "E-WB-UNKNOWN");
  assert(e.fix.includes("add an entry, a check and a test"));
});

proves(["0004-workbench-catalog FR-004"], "each requirement not met gives one finding with its code, the fix filled in and who fixes it, and a met one gives none; a credential is met by its name or an alias, whose value is never in the facts", () => {
  const found = evaluate([GIT, TOKEN, SQLITE, SQL_INSTALL], facts(), "2026-12-01", contract.enforceFrom);
  assertEquals(found.map((f) => f.code), ["E-WB-WORKSHOP-MISSING-PROGRAM", "E-WB-WORKBENCH-MISSING-CREDENTIAL", "E-WB-WORKSHOP-MISSING-PROGRAM", "E-WB-WORKSPACE-INSTALL-MISSING"]);
  assertEquals(found[0]?.fix, "install git: apt-get install -y git");
  assertEquals(found[3]?.fix, "install the dependencies of synthetic/sql: bun install");
  assert(found.every((f) => f.severity === "hint"), "before the day, only hints");
  const met = evaluate([GIT, TOKEN, SQLITE, SQL_INSTALL], facts({ programs: { git: "2.43.0", sqlite3: "3.45.1" }, env: new Set(["SYNTHETIC_TOKEN"]), installed: new Set(["synthetic/sql"]) }), "2026-12-01", contract.enforceFrom);
  assertEquals(met, []);
  const old = evaluate([GIT], facts({ programs: { git: "1.9.9" } }), "2027-02-01", contract.enforceFrom);
  assertEquals(old.map((f) => [f.code, f.severity]), [["E-WB-WORKSHOP-WRONG-VERSION", "warn"]]);
});

proves(["0004-workbench-catalog FR-005"], "versions are compared by their numbers, so 26.13.1 is after 26.2.0 and a suffix does not matter", () => {
  assert(compareVersions("26.13.1", "26.2.0") > 0);
  assert(compareVersions("1.10.0", "1.9.9") > 0);
  assertEquals(compareVersions("2.43.0", "2.43"), 0);
  assertEquals(compareVersions("v3.45.1-ubuntu", "3.45.1"), 0);
  assert(compareVersions("1.4.3", "1.4.4") < 0);
});
