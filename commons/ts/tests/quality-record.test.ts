/**
 * The canonical record of a run and what is rendered from it (commons 0021-ifqs FR-005, FR-012 to FR-015, FR-020, FR-021): a run
 * assembled as 0008-test-evidence assembles it is made canonical (the body of each case's log record a CTRF test object, `not_run` with its
 * reason, the grade of each case, the chain attribute on every resource), read back through the decoders, redacted, and rendered as
 * JUnit XML, CTRF, SARIF, TAP and the documents of ISO/IEC/IEEE 29119-3. Pure: nothing here runs `git`.
 *
 * @module
 */
import { decodeLogs } from "@intellectual-frontiers/telemetry/otlp";
import { GENESIS } from "@intellectual-frontiers/grc/evidence";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { OUTCOMES } from "@intellectual-frontiers/test/record";
import { readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, relative, resolve, toPosix } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves, recorded, test } from "@intellectual-frontiers/test";
import { evidenceGrades, testOutcomes } from "@intellectual-frontiers/ontology/ifqs";
import { GRADES, QUALITY_OUTCOMES, CHARACTERISTICS, DOCUMENTS, ATTR, gradeRank, higherGrade, showGrade } from "../quality/pure/names.ts";
import { canonicalize, checkRun, qualityCounts, readQuality } from "../quality/pure/record.ts";
import {
  completionReport,
  ctrfDocument,
  incidentReports,
  junit,
  render,
  RENDER_FORMATS,
  sarif,
  statusReport,
  tap,
} from "../quality/pure/render.ts";
import { assembledRun, at, installation, list, noon, parsed, spanOf, traceOf } from "./quality-fixtures.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const ROOT = resolve(HERE, "..");

/** A run with one of each outcome, two requirements proved, one failing, one listed and left unproven. */
async function sampleRun(): Promise<unknown> {
  return assembledRun(
    1,
    [
      { name: "adds", requirements: ["0021-ifqs FR-013"], characteristic: "functional suitability" },
      { name: "fails", outcome: "fail", message: "expected 1, got 2", requirements: ["0021-ifqs FR-014"] },
      { name: "skips", outcome: "skip", reason: "no network" },
      { name: "todo", outcome: "todo", reason: "not written yet" },
      { name: "cancels", outcome: "cancelled", reason: "its process ended" },
    ],
    { required: ["0021-ifqs FR-013", "0021-ifqs FR-014", "0021-ifqs FR-005"] },
  );
}

test("the outcome and grade words are those of the ifqs ontology", () => {
  assertEquals(
    Object.values(testOutcomes).map((o) => o.values.outcomeWord),
    [...QUALITY_OUTCOMES],
  );
  assertEquals([...QUALITY_OUTCOMES], [...OUTCOMES, "not_run"]);
  assertEquals(Object.keys(evidenceGrades), [...GRADES]);
  assertEquals(
    Object.values(evidenceGrades).map((g) => g.values.gradeRank),
    GRADES.map(gradeRank),
  );
  assertEquals(higherGrade("E2", "E4"), "E4");
  assertEquals(showGrade("E4"), "E4 attested");
});

proves(
  ["0021-ifqs FR-013"],
  "the body of a case's log record is a CTRF test object, and the file reads back as the record of 0008",
  async () => {
    const c = await canonicalize({ record: await sampleRun(), previous: GENESIS });
    assert(c.kind === "ok");
    const logs = decodeLogs(JSON.parse(c.value.text));
    assert(logs.kind === "ok");
    const cases = logs.value.flatMap((b) => b.records.filter((r) => r.eventName === "ifc.test.case"));
    assertEquals(cases.length, 5);
    for (const r of cases) {
      const body = Object.fromEntries(Object.entries(r.body ?? {}));
      assertEquals(typeof body["name"], "string");
      assert(["passed", "failed", "skipped", "pending", "other"].includes(String(body["status"])), String(body["status"]));
      assertEquals(typeof body["duration"], "number");
    }
    const q = readQuality(c.value.text);
    assert(q.kind === "ok");
    assertEquals(q.value.run.counts.tests, 5);
    assertEquals(q.value.run.counts.failed, 1);
    assertEquals(
      q.value.cases.map((x) => x.outcome),
      ["pass", "cancelled", "fail", "skip", "todo"],
    );
    assertEquals(q.value.cases[0]?.characteristic, "functional suitability");
  },
);

proves(["0021-ifqs FR-013"], "a rendering is made on demand from the record and is the same bytes each time", async () => {
  const c = await canonicalize({ record: await sampleRun(), previous: GENESIS });
  assert(c.kind === "ok");
  const q = c.value.record;
  for (const f of RENDER_FORMATS) assertEquals(render(q, f), render(q, f), f);
  assertEquals(RENDER_FORMATS.length, 7);
  assertStringIncludes(junit(q), "<testsuites");
  const ctrf = parsed(ctrfDocument(q));
  assertEquals(at(ctrf, "reportFormat"), "CTRF");
  assertEquals(list(at(ctrf, "results", "tests")).length, 5);
});

proves(
  ["0021-ifqs FR-014", "0021-ifqs FR-005"],
  "a case that did not run is recorded not_run with its reason, rendered as CTRF other, counted beside passed and failed, and its requirement is unproven",
  async () => {
    const c = await canonicalize({
      record: await sampleRun(),
      previous: GENESIS,
      notRun: [{ requirements: ["0021-ifqs FR-005"], name: "0021-ifqs FR-005", reason: "the network was not reachable" }],
    });
    assert(c.kind === "ok");
    const q = c.value.record;
    assertEquals(q.counts.notRun, 1);
    const n = q.cases.find((x) => x.outcome === "not_run");
    assertEquals(n?.reason, "the network was not reachable");
    assertEquals(n?.grade, "E0");
    // the requirement whose only proof is not_run is unproven (0008-test-evidence FR-006)
    const req = q.run.requirements.find((r) => r.id === "0021-ifqs FR-005");
    assertEquals(req?.state, "unproven");
    assert(q.run.unproven.includes("0021-ifqs FR-005"));
    // CTRF: status other, and the count is in the summary
    const ctrf = parsed(ctrfDocument(q));
    const body = list(at(ctrf, "results", "tests")).find((t) => at(t, "name") === "0021-ifqs FR-005");
    assertEquals(at(body, "status"), "other");
    assertEquals(at(body, "extra", "outcome"), "not_run");
    assertEquals(at(ctrf, "results", "extra", "notRun"), 1);
    assertEquals(at(ctrf, "results", "summary", "other"), 2);
    // every rendering carries the count of not_run
    assertStringIncludes(tap(q), "# not_run 1");
    assertStringIncludes(tap(q), "the network was not reachable");
    assertStringIncludes(junit(q), 'name="ifc.not_run"');
    assertStringIncludes(junit(q), 'type="not_run"');
    assertEquals(at(parsed(sarif(q)), "runs", 0, "properties", "notRun"), 1);
    assertStringIncludes(completionReport(q), "not_run");
    assertStringIncludes(statusReport(q), "1 not_run");
    // not counted as passed: the counts of what ran are untouched
    assertEquals(q.counts.passed, 1);
    assertEquals(qualityCounts(q.cases).notRun, 1);
  },
);

proves(["0021-ifqs FR-005"], "a case that did not run and gives no reason is refused when the record is read", async () => {
  const c = await canonicalize({
    record: await sampleRun(),
    previous: GENESIS,
    notRun: [{ requirements: [], name: "silent", reason: "x" }],
  });
  assert(c.kind === "ok");
  const doc = parsed(c.value.text);
  const text = JSON.stringify(doc).replace(
    '"key":"ifc.test.reason","value":{"stringValue":"x"}',
    '"key":"ifc.test.unused","value":{"stringValue":"x"}',
  );
  assert(text !== JSON.stringify(doc), "the reason was removed from the document");
  const r = readQuality(text);
  assert(r.kind === "err");
  assertStringIncludes(JSON.stringify(r.error), "gives no reason");
});

proves(["0021-ifqs FR-012"], "a test names its characteristic and a report bears the document names of ISO/IEC/IEEE 29119-3", async () => {
  const c = await canonicalize({ record: await sampleRun(), previous: GENESIS });
  assert(c.kind === "ok");
  const q = c.value.record;
  assert(CHARACTERISTICS.includes(q.cases[0]?.characteristic ?? ""));
  assertStringIncludes(c.value.text, ATTR.characteristic);
  assertStringIncludes(JSON.stringify(JSON.parse(ctrfDocument(q))), "functional suitability");
  assertStringIncludes(completionReport(q), `# ${DOCUMENTS.completion}`);
  assertStringIncludes(statusReport(q), `# ${DOCUMENTS.status}`);
  const incidents = incidentReports(q);
  // the failure and the cancellation each have a test incident report
  assertEquals(
    incidents.map((i) => i.case),
    ["cancels", "fails"],
  );
  for (const i of incidents) assertStringIncludes(i.text, `# ${DOCUMENTS.incident}`);
});

test("every rendering that shows evidence shows its grade", async () => {
  const c = await canonicalize({ record: await sampleRun(), previous: GENESIS });
  assert(c.kind === "ok");
  const q = c.value.record;
  assertEquals(q.grade, "E3");
  for (const f of RENDER_FORMATS) assertStringIncludes(render(q, f, "E4"), f === "incident" ? "E4 attested" : "E4", f);
  assertStringIncludes(completionReport(q, "E4"), "Requirements proved: 1 at grade E4");
  // a case that proved nothing is E0
  assertEquals(q.cases.find((x) => x.outcome === "skip")?.grade, "E0");
  assertEquals(q.cases.find((x) => x.outcome === "pass")?.grade, "E3");
});

proves(
  ["0021-ifqs FR-015"],
  "a check leaves its rules as cases and its findings as failed cases with rule id, file and line, rendered as SARIF results",
  async () => {
    const c = await checkRun({
      tool: "mizan",
      traceId: traceOf(7),
      spanId: spanOf(7000),
      caseIds: [spanOf(7001), spanOf(7002), spanOf(7003)],
      start: noon(0),
      end: noon(1),
      runner: installation(),
      requirements: ["0003-mizan FR-005"],
      rules: [
        { id: "mizan/clean-rule", findings: [] },
        {
          id: "mizan/authority-citation",
          findings: [
            { file: "commons/spec-kit/specs/0001-x/spec.md", line: 12, message: "FR-003 cites no authority" },
            { file: "commons/spec-kit/specs/0002-y/spec.md", line: 40, message: "FR-009 cites no authority" },
          ],
        },
        { id: "changes/strict-closing", findings: [], notRun: "the host is plain Git and cannot be asked for the issue" },
      ],
    });
    assert(c.kind === "ok");
    const q = c.value.record;
    assertEquals(q.counts.passed, 1);
    assertEquals(q.counts.failed, 2);
    assertEquals(q.counts.notRun, 1);
    const failed = q.cases.filter((x) => x.outcome === "fail");
    assertEquals(
      failed.map((x) => [x.rule, x.file, x.line]),
      [
        ["mizan/authority-citation", "commons/spec-kit/specs/0001-x/spec.md", 12],
        ["mizan/authority-citation", "commons/spec-kit/specs/0002-y/spec.md", 40],
      ],
    );
    const results = list(at(parsed(sarif(q)), "runs", 0, "results"));
    assertEquals(results.length, 3);
    assertEquals(at(results, 0, "ruleId"), "mizan/authority-citation");
    assertEquals(at(results, 0, "level"), "error");
    assertEquals(at(results, 0, "locations", 0, "physicalLocation", "region", "startLine"), 12);
    assertEquals(at(results, 0, "locations", 0, "physicalLocation", "artifactLocation", "uri"), "commons/spec-kit/specs/0001-x/spec.md");
    // a rule that could not run is a warning, never a pass
    const skipped = results.find((r) => at(r, "ruleId") === "changes/strict-closing");
    assertEquals(at(skipped, "level"), "warning");
    assertStringIncludes(String(at(skipped, "message", "text")), "plain Git");
  },
);

proves(
  ["0021-ifqs FR-020"],
  "a record is redacted of secrets and e-mail addresses before it is kept, and one that names a person is refused",
  async () => {
    const record = await assembledRun(2, [
      {
        name: "leaks",
        outcome: "fail",
        message: "mail ada@example.com with Bearer abcdefghijklmnop12345 and token=hunter2hunter2",
        requirements: ["0021-ifqs FR-020"],
      },
    ]);
    const c = await canonicalize({ record, previous: GENESIS });
    assert(c.kind === "ok");
    assert(!c.value.text.includes("ada@example.com"), "the address is gone");
    assert(!c.value.text.includes("abcdefghijklmnop12345"), "the bearer token is gone");
    assert(!c.value.text.includes("hunter2hunter2"), "the secret is gone");
    assertStringIncludes(c.value.text, "REDACTED");
    const person = JSON.stringify(record).replace('"service.name"', '"user.email"');
    const refused = await canonicalize({ record: person, previous: GENESIS });
    assert(refused.kind === "err");
    assertEquals(refused.error.kind, "person");
  },
);

proves(
  ["0021-ifqs FR-017"],
  "every resource of a file carries the digest of the file before it, and 64 zeros where it is the first",
  async () => {
    const first = await canonicalize({ record: await assembledRun(3, [{ name: "a" }]), previous: GENESIS });
    assert(first.kind === "ok");
    assertEquals(first.value.record.previous, GENESIS);
    const digest = await sha256(first.value.text);
    const second = await canonicalize({ record: await assembledRun(4, [{ name: "a" }]), previous: digest });
    assert(second.kind === "ok");
    assertEquals(second.value.record.previous, digest);
    const doc = parsed(second.value.text);
    const resources = [...list(at(doc, "resourceSpans")), ...list(at(doc, "resourceLogs"))].map((r) =>
      at(
        list(at(r, "resource", "attributes")).find((a) => at(a, "key") === ATTR.previous),
        "value",
        "stringValue",
      ),
    );
    assert(resources.length >= 2);
    for (const r of resources) assertEquals(r, digest);
  },
);

/** The one module outside the quality folder that it may import: the harness declaration (0020-ifccm FR-010), pure and itself importing only the kernel (0021-ifqs FR-011, FR-046). */
const DECLARATION_MODULE = "mizan/changes/declaration.ts";

test("the quality folder's pure layer imports only the kernel and itself, and its host layer only the kernel, the runtime and the quality folder", () => {
  const list = (folder: string): string[] => {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readDirNames(dir)) {
        const p = join(dir, name);
        if (name.endsWith(".ts")) out.push(p);
        else if (!name.includes(".")) walk(p);
      }
    };
    walk(join(ROOT, folder));
    return out;
  };
  const imports = (file: string): string[] =>
    [...readTextFileSync(file).matchAll(/^\s*(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']/gm)].map((m) => m[1] ?? "");
  const bad: string[] = [];
  for (const f of list("quality/pure")) {
    for (const s of imports(f)) {
      const target = toPosix(relative(ROOT, resolve(dirname(f), s)));
      if (s.startsWith("node:") || !(target.startsWith("kernel/") || target.startsWith("quality/pure/") || target === DECLARATION_MODULE))
        bad.push(`${f}: ${s}`);
    }
  }
  for (const f of list("quality/host")) {
    for (const s of imports(f)) {
      const target = toPosix(relative(ROOT, resolve(dirname(f), s)));
      if (s.startsWith("node:")) continue;
      if (!["kernel/", "runtime/", "quality/"].some((p) => target.startsWith(p)) && target !== DECLARATION_MODULE) bad.push(`${f}: ${s}`);
    }
  }
  assertEquals(bad, []);
});

import { readDirSync } from "@intellectual-frontiers/system/fs";
function readDirNames(dir: string): string[] {
  return readDirSync(dir).map((e) => e.name);
}

const CHARACTERISTIC_TEST = "the runtime records the characteristic a test names";
proves(["0021-ifqs FR-012"], CHARACTERISTIC_TEST, () => assertEquals(1, 1), { characteristic: "security" });
proves(["0021-ifqs FR-012"], "the characteristic is on the test's record (ifc.test.characteristic) and is one of ISO/IEC 25010's", () => {
  const r = recorded.find((t) => t.name.endsWith(CHARACTERISTIC_TEST));
  assertEquals(r?.characteristic, "security");
  assert(CHARACTERISTICS.includes(r?.characteristic ?? ""));
});
