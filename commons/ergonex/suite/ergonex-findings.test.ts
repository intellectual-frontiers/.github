/**
 * Tests of the findings and the policy of the workspace (commons 0002-workspace-model FR-032, FR-033, FR-035): a finding has a rule, a severity, a message, what it is about and the day it was first
 * seen, and is written as a SARIF 2.1.0 log whose results have the level of the severity in the ontology; a tool outside the catalog is informational for 90 days and a warning after, counted from
 * the day first seen and never restarted; an unsigned commit is an error where a regulated domain is named and a warning elsewhere. Pure: the day is an argument.
 *
 * @module
 */
import fc from "fast-check";
import { severities } from "./vocabulary.ts";
import {
  dayNumber,
  daysBetween,
  exitStatusOf,
  type Finding,
  firstSeenOf,
  sarifLevel,
  SEVERITIES,
  type Severity,
  toSarif,
  UNAPPROVED_GRACE_DAYS,
  unapprovedSeverity,
  worst,
} from "../src/findings.ts";
import { hookFailsWhenUnableToCheck, hostAllowed, policyOf, unsignedCommitSeverity } from "../src/policy.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const finding = (severity: Severity, ruleId = "ergonex/x", subject = "github.com/o/r"): Finding => ({
  ruleId,
  severity,
  message: `${severity} message`,
  subject,
  firstSeen: "2026-11-01",
});

proves(["0002-workspace-model FR-035"], "the severities and their SARIF levels are the ontology's", () => {
  assertEquals([...SEVERITIES].sort(), Object.keys(severities).sort());
  for (const s of SEVERITIES) assertEquals(sarifLevel(s), severities[s].values.sarifLevel, s);
  assertEquals(SEVERITIES.map(sarifLevel), ["note", "warning", "error"]);
});

proves(
  ["0002-workspace-model FR-035"],
  "findings are written as a SARIF 2.1.0 log whose results have the level of the severity, and carry the day first seen",
  () => {
    const log = toSarif([
      finding("Informational", "ergonex/a"),
      finding("Warning", "ergonex/b", "tool"),
      finding("Error", "ergonex/a", "C:\\ws\\x"),
    ]);
    assertEquals(log.version, "2.1.0");
    assert(log.$schema.includes("sarif-2.1.0"));
    const run = log.runs[0];
    assertEquals(run.tool.driver.name, "ergonex");
    assertEquals(run.tool.driver.rules, [{ id: "ergonex/a" }, { id: "ergonex/b" }]);
    assertEquals(
      run.results.map((r) => [r.ruleId, r.level, r.locations[0]?.logicalLocations[0]?.name, r.properties.firstSeen]),
      [
        ["ergonex/a", "note", "github.com/o/r", "2026-11-01"],
        ["ergonex/b", "warning", "tool", "2026-11-01"],
        ["ergonex/a", "error", "C:\\ws\\x", "2026-11-01"],
      ],
    );
    // it is JSON and nothing else, and an empty list is a log with no result
    assertEquals(JSON.parse(JSON.stringify(log)), log);
    assertEquals(toSarif([], "ergonex doctor").runs[0].results, []);
    assertEquals(toSarif([], "ergonex doctor").runs[0].tool.driver.name, "ergonex doctor");
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...SEVERITIES), { maxLength: 8 }), (sevs) => {
        const l = toSarif(sevs.map((s) => finding(s)));
        assertEquals(
          l.runs[0].results.map((r) => r.level),
          sevs.map(sarifLevel),
        );
      }),
    );
  },
);

proves(
  ["0002-workspace-model FR-035"],
  "the exit status of a run is Findings for a warning or an error and Ok for none or informational only",
  () => {
    assertEquals(worst([]), undefined);
    assertEquals(worst([finding("Informational"), finding("Error"), finding("Warning")]), "Error");
    assertEquals(exitStatusOf([]), "Ok");
    assertEquals(exitStatusOf([finding("Informational")]), "Ok");
    assertEquals(exitStatusOf([finding("Informational"), finding("Warning")]), "Findings");
    assertEquals(exitStatusOf([finding("Error")]), "Findings");
  },
);

proves(
  ["0002-workspace-model FR-033"],
  "a tool outside the catalog is informational for 90 days and a warning after: 89 days ago informational, 91 days ago a warning",
  () => {
    const today = "2026-11-17";
    const ago = (n: number): string => new Date(Date.UTC(2026, 10, 17) - n * 86_400_000).toISOString().slice(0, 10);
    assertEquals(UNAPPROVED_GRACE_DAYS, 90);
    assertEquals(unapprovedSeverity(ago(0), today), "Informational");
    assertEquals(unapprovedSeverity(ago(89), today), "Informational");
    assertEquals(unapprovedSeverity(ago(90), today), "Informational");
    assertEquals(unapprovedSeverity(ago(91), today), "Warning");
    assertEquals(unapprovedSeverity(ago(400), today), "Warning");
    // the grace is the policy's, and a clock that is wrong does not fail a run
    assertEquals(unapprovedSeverity(ago(31), today, 30), "Warning");
    assertEquals(unapprovedSeverity("2027-01-01", today), "Informational");
    assertEquals(unapprovedSeverity("garbage", today), "Informational");
    // across a year and a leap day
    assertEquals(daysBetween("2024-02-28", "2024-03-01"), {
      kind: "ok",
      value: 2,
    });
    assertEquals(daysBetween("2025-12-31", "2026-01-01"), {
      kind: "ok",
      value: 1,
    });
    assertEquals(daysBetween("2026-02-30", "2026-03-01").kind, "err");
    assertEquals(dayNumber("1970-01-02"), 1);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2000 }), (n) => {
        assertEquals(unapprovedSeverity(ago(n), today), n > 90 ? "Warning" : "Informational");
      }),
    );
  },
);

proves(["0002-workspace-model FR-033"], "the day first seen is never restarted by a later run", () => {
  const record = { "tool:ripgrep": "2026-08-01" };
  assertEquals(firstSeenOf(record, "tool:ripgrep", "2026-11-17"), "2026-08-01");
  assertEquals(firstSeenOf(record, "tool:fd", "2026-11-17"), "2026-11-17");
  // a record that holds no real day is replaced, and a key that is a member of Object is not found in a record that lacks it
  assertEquals(firstSeenOf({ "tool:x": "not a day" }, "tool:x", "2026-11-17"), "2026-11-17");
  assertEquals(firstSeenOf({}, "constructor", "2026-11-17"), "2026-11-17");
  assertEquals(firstSeenOf({}, "__proto__", "2026-11-17"), "2026-11-17");
});

proves(
  ["0002-workspace-model FR-032"],
  "an unsigned commit is an error where a regulated domain is named, a warning elsewhere, and nothing where it is signed and verified",
  () => {
    const regulated = policyOf({ regulatedDomain: ["MedicalDevices"] });
    const plain = policyOf({});
    assertEquals(unsignedCommitSeverity(regulated, false), "Error");
    assertEquals(unsignedCommitSeverity(plain, false), "Warning");
    assertEquals(unsignedCommitSeverity(regulated, true), undefined);
    assertEquals(unsignedCommitSeverity(plain, true), undefined);
    // a regulated domain requires signed commits, whatever else the manifest says
    assertEquals(
      policyOf({
        regulatedDomain: ["MedicalDevices"],
        requiresSignedCommits: false,
      }).requiresSignedCommits,
      true,
    );
    assertEquals(plain.requiresSignedCommits, false);
    assertEquals(policyOf({ requiresSignedCommits: true }).requiresSignedCommits, true);
    // the hooks fail where they cannot check, only where a domain is named (0003-host FR-015)
    assertEquals(hookFailsWhenUnableToCheck(regulated), true);
    assertEquals(hookFailsWhenUnableToCheck(plain), false);
    assertEquals(plain.unapprovedGraceDays, 90);
    assertEquals(hostAllowed(plain, "anything.example"), true);
    assertEquals(hostAllowed(policyOf({ allowedGitHost: ["GitHub.com"] }), "github.com"), true);
    assertEquals(hostAllowed(policyOf({ allowedGitHost: ["github.com"] }), "gitlab.com"), false);
  },
);
