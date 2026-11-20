/**
 * Tests of `kernel/test-report.ts`: a test case as its span and log record, the installation record and the refusal of a person, the
 * lines of `IFC_TEST_RECORD` and the cancelled test that never ended, the exit rule and the lists, the record read back through the OTLP
 * decoders, each rendering (TAP 14, JUnit XML, CTRF, SARIF, OSCAL, the completion report), counts that agree and bytes that repeat over
 * generated runs, and the evidence: the statement, the ledger entries and the verification of a record.
 *
 * @module
 */
import fc from "fast-check";
import { signStatement } from "@intellectual-frontiers/crypto/dsse";
import { appendEntry, type LedgerEntry } from "../../kernel/evidence.ts";
import { type Instant, instantOf } from "../../kernel/grc.ts";
import { parseSpanId, parseTraceId, type SpanId, type TraceId } from "../../kernel/otel.ts";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import {
  assembleRecord,
  completionHtml,
  completionMarkdown,
  ctrfJson,
  judge,
  junitXml,
  oscalAssessmentResults,
  parseRequirementList,
  parseReviewList,
  readRecord,
  recordText,
  runEntry,
  type RunTest,
  sarif,
  signatureEntry,
  signaturesOf,
  tap14,
  TEST_RESULT_PREDICATE,
  testResultStatement,
  type TestRun,
  verifyEvidence,
} from "../../kernel/test-report.ts";
import {
  closeOrphans,
  cut,
  decodeLines,
  type Installation,
  installationFromEnv,
  installationResource,
  isPersonAttribute,
  type Outcome,
  recordLine,
  type RunnerOutcome,
  type TestCase,
  testCaseLog,
  testCaseSpan,
  testId,
  testStartLog,
} from "../../kernel/test-record.ts";
import { attribute, children, descendants, readXml } from "@intellectual-frontiers/formats/xml";
import { assert, assertEquals, assertStringIncludes, proves } from "../../runtime/test.ts";

const FR = (n: string): `0008-test-evidence FR-${string}` => `0008-test-evidence FR-${n}`;

function must<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }): T {
  if (r.kind === "err")
    throw new Error(`expected ok: ${JSON.stringify(r.error, (_k, v: unknown) => (typeof v === "bigint" ? String(v) : v))}`);
  return r.value;
}

const TRACE: TraceId = must(parseTraceId("4bf92f3577b34da6a3ce929d0e0e4736"));
const RUN_SPAN: SpanId = must(parseSpanId("00f067aa0ba902b7"));
const spanOf = (i: number): SpanId => must(parseSpanId((i + 1).toString(16).padStart(16, "0")));
const at = (s: string): Instant => instantOf(s) ?? fail(s);
function fail(s: string): never {
  throw new Error(s);
}

const NODE: Installation = { runtime: "node", runtimeVersion: "26.0.0", os: "linux", arch: "amd64", role: "ci" };
const runtimeOf = (name: string): Installation => ({ ...NODE, runtime: name });

const T0 = 1_790_000_000_000_000_000n;

function testCase(i: number, outcome: Outcome, more: Partial<TestCase> = {}): TestCase {
  return {
    id: `id${i}`,
    file: "tests/a.test.ts",
    name: `case ${i}`,
    requirements: [FR("001")],
    risk: "not-high",
    start: T0 + BigInt(i) * 1_000_000n,
    end: T0 + BigInt(i) * 1_000_000n + 2_500_000n,
    outcome,
    attempt: 1,
    ...more,
  };
}

/** A record of some tests on some runtimes, assembled as a run assembles one, and read back. */
function runOf(
  cases: readonly { readonly runtime: string; readonly test: TestCase }[],
  options: {
    readonly runners?: readonly RunnerOutcome[];
    readonly required?: readonly string[];
    readonly reviews?: readonly { requirement: string; reason: string }[];
  } = {},
): { readonly run: TestRun; readonly text: string } {
  const traces = cases.map((c, i) => ({
    resource: installationResource(runtimeOf(c.runtime)),
    scope: { name: "ifc-test", version: "1" },
    spans: [testCaseSpan(c.test, { traceId: TRACE, spanId: spanOf(i), parentSpanId: RUN_SPAN })],
  }));
  const runtimes = [...new Set(cases.map((c) => c.runtime))];
  const assembled = must(
    assembleRecord({
      traceId: TRACE,
      spanId: RUN_SPAN,
      start: T0,
      end: T0 + 9_000_000_000n,
      runner: NODE,
      signals: { traces, logs: [] },
      runners: options.runners ?? runtimes.map((runtime) => ({ kind: "exited" as const, runtime, code: 0 })),
      required: options.required ?? [],
      ...(options.reviews === undefined ? {} : { reviews: options.reviews }),
    }),
  );
  const text = recordText(assembled.record);
  return { run: must(readRecord(text)), text };
}

// ---------------------------------------------------------------------------------------------------------------------------- capture

proves([FR("001")], "a test's id is the SHA-256 of its file, a NUL and its name; a text is cut to 4096 characters", async () => {
  assertEquals(await testId("tests/a.test.ts", "one"), await sha256("tests/a.test.ts\0one"));
  assert((await testId("a", "bc")) !== (await testId("ab", "c")));
  assertEquals(cut("x".repeat(5000)).length, 4096);
  assertEquals(cut("short"), "short");
  const pair = `${"x".repeat(4095)}\u{1F600}`;
  assertEquals(cut(pair).length, 4095);
});

proves(
  [FR("002")],
  "a test is a test span and a log record with the test.* conventions, the ifc.test.* attributes and the run as parent",
  () => {
    const c = testCase(1, "fail", { message: "m", expected: "1", actual: "2", attempt: 2, risk: "high" });
    const ctx = { traceId: TRACE, spanId: spanOf(1), parentSpanId: RUN_SPAN };
    const s = testCaseSpan(c, ctx);
    assertEquals(s.name, "test");
    assertEquals(s.parentSpanId, RUN_SPAN);
    assertEquals(s.context.traceId, TRACE);
    assertEquals(s.attributes["test.case.name"], "case 1");
    assertEquals(s.attributes["test.case.result.status"], "fail");
    assertEquals(s.attributes["test.suite.name"], "tests/a.test.ts");
    assertEquals(s.attributes["ifc.test.requirements"], [FR("001")]);
    assertEquals(s.attributes["ifc.test.risk"], "high");
    assertEquals(s.attributes["ifc.test.attempt"], 2n);
    assertEquals(s.attributes["ifc.test.expected"], "1");
    assertEquals(s.status, { kind: "error", message: "m" });
    const l = testCaseLog(c, ctx);
    assertEquals(l.attributes, s.attributes);
    assertEquals(l.spanId, spanOf(1));
    assertEquals(l.severityText, "ERROR");
    assertEquals(testCaseSpan(testCase(2, "pass"), ctx).attributes["test.case.result.status"], "pass");
    const skipped = testCaseSpan(testCase(3, "skip", { reason: "windows has no file modes" }), ctx);
    assertEquals(skipped.attributes["test.case.result.status"], undefined);
    assertEquals(skipped.attributes["ifc.test.outcome"], "skip");
    assertEquals(skipped.attributes["ifc.test.reason"], "windows has no file modes");
  },
);

proves([FR("003")], "the installation record: runtime, system, revision, digests and role; a person's address is refused as a role", () => {
  const self = { runtime: "bun", runtimeVersion: "1.4.4", os: "linux", arch: "x86_64" };
  const sha = "a".repeat(64);
  const ci = installationFromEnv(self, { CI: "true", GITHUB_SHA: "abc123", IFC_TEST_LOCKFILE_SHA256: sha, IFC_TEST_PINS_SHA256: "nope" });
  assertEquals(ci.installation, {
    runtime: "bun",
    runtimeVersion: "1.4.4",
    os: "linux",
    arch: "amd64",
    revision: "abc123",
    lockfileSha256: sha,
    role: "ci",
  });
  assertEquals(ci.warnings.length, 1);
  const dev = installationFromEnv(self, { IFC_TEST_ROLE: "alice@example.com" });
  assertEquals(dev.installation.role, "developer");
  assertStringIncludes(dev.warnings[0] ?? "", "IFC_TEST_ROLE");
  assertEquals(installationFromEnv(self, { IFC_TEST_ROLE: "qa-lead" }).installation.role, "qa-lead");
  const attrs = installationResource(ci.installation).attributes;
  assertEquals(attrs["vcs.ref.head.revision"], "abc123");
  assertEquals(attrs["ifc.test.lockfile.sha256"], sha);
  assert(Object.keys(attrs).every((k) => !isPersonAttribute(k)));
  for (const k of ["user.name", "user.email", "enduser.id", "host.name"]) assert(isPersonAttribute(k), k);
  // A record whose resource names a person is refused when it is read.
  const { text } = runOf([{ runtime: "node", test: testCase(1, "pass") }]);
  const bad = text.replace('"key":"os.type"', '"key":"host.name"');
  const r = readRecord(bad);
  assert(r.kind === "err" && r.error.kind === "person");
});

proves(
  [FR("004")],
  "IFC_TEST_RECORD lines decode back; a cut-short last line is left out; a test that started and never ended is cancelled",
  () => {
    const resource = installationResource(NODE);
    const c = testCase(1, "pass");
    const ctx = { traceId: TRACE, spanId: spanOf(1), parentSpanId: RUN_SPAN };
    const started = testStartLog(testCase(2, "pass"), { ...ctx, spanId: spanOf(2) });
    const text = [
      recordLine(resource, { records: [testStartLog(c, ctx)] }),
      recordLine(resource, { spans: [testCaseSpan(c, ctx)] }),
      recordLine(resource, { records: [testCaseLog(c, ctx)] }),
      recordLine(resource, { records: [started] }),
      '{"resourceSpans":[{"reso',
    ].join("\n");
    const lines = must(decodeLines(text));
    assertEquals(lines.warnings.length, 1);
    assertEquals(lines.traces.flatMap((b) => b.spans).length, 1);
    assert(decodeLines(`{"x\n${recordLine(resource, { spans: [] })}`).kind === "err");
    const closed = closeOrphans(lines, T0 + 5_000_000_000n);
    const spans = closed.traces.flatMap((b) => b.spans);
    assertEquals(spans.length, 2);
    const cancelled = spans.find((s) => s.context.spanId === spanOf(2));
    assertEquals(cancelled?.attributes["ifc.test.outcome"], "cancelled");
    assertEquals(cancelled?.parentSpanId, RUN_SPAN);
    assertEquals(cancelled?.endTime, T0 + 5_000_000_000n);
    assertEquals(closeOrphans(closed, T0), closed);
  },
);

// ---------------------------------------------------------------------------------------------------------------------------- the run

proves(
  [FR("006")],
  "the exit rule: a failed or cancelled test, a runner that failed or is missing, or an unproven requirement fails the run",
  () => {
    const t = (o: Outcome, requirements: readonly string[] = [FR("001")]): RunTest => ({
      ...testCase(1, o, { requirements }),
      runtime: "node",
      spanId: "1",
    });
    const ok0: RunnerOutcome[] = [{ kind: "exited", runtime: "node", code: 0 }];
    assertEquals(judge({ tests: [t("pass")], runners: ok0, required: [FR("001")], reviews: [] }), {
      status: "success",
      failures: [],
      unproven: [],
    });
    assertEquals(judge({ tests: [t("fail")], runners: ok0, required: [], reviews: [] }).failures, ["1 test failed"]);
    assertEquals(judge({ tests: [t("cancelled")], runners: ok0, required: [], reviews: [] }).failures, ["1 test was cancelled"]);
    assertEquals(
      judge({ tests: [t("pass")], runners: [{ kind: "exited", runtime: "bun", code: 1 }], required: [], reviews: [] }).status,
      "failure",
    );
    assertEquals(judge({ tests: [], runners: [{ kind: "missing", runtime: "bun" }], required: [], reviews: [] }).failures, [
      "bun is not installed",
    ]);
    const unproven = judge({
      tests: [t("pass"), t("skip", [FR("003")])],
      runners: ok0,
      required: [FR("001"), FR("002"), FR("003")],
      reviews: [],
    });
    assertEquals(unproven.unproven, [FR("002"), FR("003")]);
    assertEquals(unproven.status, "failure");
    const reviewedOne = judge({
      tests: [t("pass")],
      runners: ok0,
      required: [FR("001"), FR("002")],
      reviews: [{ requirement: FR("002"), reason: "read" }],
    });
    assertEquals(reviewedOne.status, "success");
    // The run's span says which, by test.suite.run.status and ifc.test.unproven.
    const { run } = runOf([{ runtime: "node", test: testCase(1, "pass") }], { required: [FR("001"), FR("009")] });
    assertEquals(run.status, "failure");
    assertEquals(run.unproven, [FR("009")]);
    // The lists.
    const tsv = `# comment\nrequirement\tmechanism\tby\tnote\n${FR("001")}\tcheck\tx\ty\n${FR("002")}\treview\tx\ty\n0005-typescript-runtime FR-001\tcheck\tx\ty\n`;
    assertEquals(parseRequirementList(tsv), [FR("001"), "0005-typescript-runtime FR-001"]);
    assertEquals(parseRequirementList(tsv, "0008-test-evidence"), [FR("001")]);
    assertEquals(parseRequirementList(`${FR("001")}\n\n${FR("002")}\r\n${FR("001")}\n`), [FR("001"), FR("002")]);
    assertEquals(parseReviewList(`${FR("014")}\tCI runs it\n# no\nlonely line\n`), [{ requirement: FR("014"), reason: "CI runs it" }]);
  },
);

proves(
  [FR("005"), FR("007")],
  "a run's record is one OTLP JSON document read back through the decoders: its run span, installations and tests",
  () => {
    const { run, text } = runOf([
      { runtime: "node", test: testCase(1, "pass") },
      { runtime: "bun", test: testCase(2, "fail", { message: "boom" }) },
    ]);
    const doc: unknown = JSON.parse(text);
    assert(typeof doc === "object" && doc !== null && "resourceSpans" in doc && "resourceLogs" in doc);
    assert(text.endsWith("}\n"));
    assertEquals(run.traceId, TRACE);
    assertEquals(run.spanId, RUN_SPAN);
    assertEquals(
      run.tests.map((t) => [t.runtime, t.outcome]),
      [
        ["bun", "fail"],
        ["node", "pass"],
      ],
    );
    assertEquals(
      run.installations.map((i) => i.runtime),
      ["bun", "node"],
    );
    assertEquals(run.runner.role, "ci");
    assertEquals(run.status, "failure");
    assertEquals(run.counts, { tests: 2, passed: 1, failed: 1, skipped: 0, todo: 0, cancelled: 0 });
    assert(readRecord('{"resourceSpans":[]}').kind === "err");
    assert(readRecord("not json").kind === "err");
  },
);

// ---------------------------------------------------------------------------------------------------------------------------- reports

const SAMPLE = runOf(
  [
    { runtime: "node", test: testCase(1, "pass", { risk: "high", requirements: [FR("013")] }) },
    {
      runtime: "node",
      test: testCase(2, "fail", {
        message: "values differ",
        expected: "1",
        actual: "Bearer REDACTED",
        requirements: [FR("001"), FR("002")],
      }),
    },
    { runtime: "node", test: testCase(3, "skip", { reason: "windows has no file modes", file: "tests/b.test.ts" }) },
    { runtime: "node", test: testCase(4, "todo", { reason: "later", file: "tests/b.test.ts" }) },
    {
      runtime: "node",
      test: testCase(5, "cancelled", { reason: "its process ended before the test did", file: "tests/b.test.ts", requirements: [] }),
    },
  ],
  { required: [FR("001"), FR("004")], reviews: [{ requirement: FR("014"), reason: "CI runs it" }] },
).run;

proves(
  [FR("008")],
  "TAP 14: a plan, a subtest per file, ok and not ok numbered, SKIP and TODO with their reasons, a YAML block for a failure",
  () => {
    const tap = tap14(SAMPLE);
    assert(tap.startsWith("TAP version 14\n1..2\n# Subtest: tests/a.test.ts [node]\n    1..2\n"));
    assertStringIncludes(tap, "    ok 1 - case 3 # SKIP windows has no file modes\n");
    assertStringIncludes(tap, "    not ok 2 - case 4 # TODO later\n");
    assertStringIncludes(tap, "    not ok 2 - case 2\n      ---\n      outcome: fail\n      message: values differ\n");
    assertStringIncludes(tap, "      actual: Bearer REDACTED\n");
    assertStringIncludes(tap, "      requirements:\n        - 0008-test-evidence FR-001\n");
    assertStringIncludes(tap, "not ok 1 - tests/a.test.ts [node]\n");
    assertStringIncludes(tap, "# tests 5\n# pass 1\n# fail 1\n# skip 1\n# todo 1\n# cancelled 1\n");
  },
);

proves(
  [FR("008")],
  "JUnit XML: a testsuite per file and runtime, testcases with classname and seconds, failure, error, skipped and requirement properties",
  () => {
    const root = must(readXml(junitXml(SAMPLE)));
    assertEquals(root.name, "testsuites");
    assertEquals(
      [attribute(root, "tests"), attribute(root, "failures"), attribute(root, "errors"), attribute(root, "skipped")],
      ["5", "1", "1", "2"],
    );
    const suites = children(root, "testsuite");
    assertEquals(
      suites.map((s) => attribute(s, "name")),
      ["tests/a.test.ts [node]", "tests/b.test.ts [node]"],
    );
    const cases = descendants(root, "testcase");
    assertEquals(attribute(cases[0], "classname"), "tests/a.test.ts");
    assertEquals(attribute(cases[0], "time"), "0.002");
    assertEquals(descendants(root, "failure").length, 1);
    assertEquals(descendants(root, "error").length, 1);
    assertEquals(
      descendants(root, "skipped").map((s) => attribute(s, "message")),
      ["windows has no file modes", "TODO: later"],
    );
    const props = descendants(cases[1] ?? root, "property")
      .filter((p) => attribute(p, "name") === "requirement")
      .map((p) => attribute(p, "value"));
    assertEquals(props, [FR("001"), FR("002")]);
    assert(!junitXml(SAMPLE).includes("hostname"));
  },
);

proves([FR("008")], "CTRF: results.tool, summary and tests, with requirements and risk under extra", () => {
  const doc: unknown = JSON.parse(ctrfJson(SAMPLE));
  assert(typeof doc === "object" && doc !== null && "results" in doc);
  const results = doc.results;
  assert(typeof results === "object" && results !== null && "summary" in results && "tests" in results && "tool" in results);
  assertEquals(results.tool, { name: "ifc test" });
  assertEquals(results.summary, {
    tests: 5,
    passed: 1,
    failed: 1,
    skipped: 1,
    pending: 1,
    other: 1,
    start: 1_790_000_000_000,
    stop: 1_790_000_009_000,
  });
  assert(Array.isArray(results.tests));
  const first: unknown = results.tests[0];
  assert(typeof first === "object" && first !== null && "extra" in first && "status" in first);
  assertEquals(first.status, "passed");
  assertEquals(first.extra, { id: "id1", requirements: [FR("013")], risk: "high", outcome: "pass", runtime: "node" });
});

proves([FR("008")], "SARIF 2.1.0: each failed or cancelled test a result at its file, its requirement the rule", () => {
  const doc: unknown = JSON.parse(sarif(SAMPLE));
  assert(typeof doc === "object" && doc !== null && "version" in doc && "runs" in doc && Array.isArray(doc.runs));
  assertEquals(doc.version, "2.1.0");
  const run: unknown = doc.runs[0];
  assert(typeof run === "object" && run !== null && "results" in run && Array.isArray(run.results) && "tool" in run);
  assertEquals(run.results.length, 2);
  const text = sarif(SAMPLE);
  assertStringIncludes(text, `"ruleId": "${FR("001")}"`);
  assertStringIncludes(text, `"ruleId": "ifc.test.no-requirement"`);
  assertStringIncludes(text, `"uri": "tests/b.test.ts"`);
});

proves([FR("008")], "OSCAL 1.2.3 assessment results: one observation per test and one finding per requirement", async () => {
  const text = await oscalAssessmentResults(SAMPLE);
  assertEquals(text, await oscalAssessmentResults(SAMPLE));
  const doc: unknown = JSON.parse(text);
  assert(typeof doc === "object" && doc !== null && "assessment-results" in doc);
  const ar = doc["assessment-results"];
  assert(typeof ar === "object" && ar !== null && "results" in ar && Array.isArray(ar.results) && "metadata" in ar);
  assertStringIncludes(JSON.stringify(ar.metadata), '"oscal-version":"1.2.3"');
  const result: unknown = ar.results[0];
  assert(typeof result === "object" && result !== null && "observations" in result && "findings" in result);
  assert(Array.isArray(result.observations) && Array.isArray(result.findings));
  assertEquals(result.observations.length, SAMPLE.counts.tests);
  // One finding per requirement, and one for each test that proves none (here the cancelled one).
  assertEquals(result.findings.length, SAMPLE.requirements.length + SAMPLE.tests.filter((t) => t.requirements.length === 0).length);
  assertStringIncludes(text, '"target-id": "req-0008-test-evidence-fr-001"');
});

proves(
  [FR("009"), FR("013")],
  "the completion report: summary, installation, trace matrix, incidents, high-risk review needed, conclusion and signatures",
  () => {
    const md = completionMarkdown(SAMPLE, { digest: "d".repeat(64) });
    for (const h of [
      "## Summary",
      "## Installation record",
      "## Requirement trace matrix",
      "## Incidents",
      "## High-risk requirements",
      "## Conclusion",
      "## Signatures",
    ]) {
      assertStringIncludes(md, `\n${h}\n`);
    }
    assertStringIncludes(md, `| ${FR("014")} | no | not-high | reviewed: CI runs it | - |`);
    assertStringIncludes(md, `| ${FR("004")} | yes | not-high | unproven | - |`);
    assertStringIncludes(md, "| skip | case 3 | tests/b.test.ts | node | windows has no file modes |");
    assertStringIncludes(md, `| ${FR("013")} | proven | needed |`);
    assertStringIncludes(md, "None in the ledger for this record.");
    const signed = completionMarkdown(SAMPLE, {
      signatures: [{ seq: 2, meaning: "reviewed", role: "qa-lead", at: "2026-01-01T00:00:00.000Z", envelope: "e".repeat(64) }],
    });
    assertStringIncludes(signed, `| ${FR("013")} | proven | yes |`);
    assertStringIncludes(signed, "| reviewed | qa-lead |");
    const html = completionHtml(SAMPLE);
    assert(html.startsWith("<!doctype html>"));
    assertStringIncludes(html, "<h2>Requirement trace matrix</h2>");
    assert(!/<(?:script|link|img)\b|\bsrc=|\bhref=/.test(html), "the page needs nothing outside itself");
  },
);

// ---------------------------------------------------------------------------------------------------------------------------- counts (FR-010)

const outcomeArb = fc.constantFrom<Outcome>("pass", "fail", "skip", "todo", "cancelled");
const caseArb = fc.record(
  {
    runtime: fc.constantFrom("node", "bun"),
    file: fc.constantFrom("tests/a.test.ts", "tests/b#c.test.ts", "tests/d.test.ts"),
    name: fc.string({ minLength: 1, maxLength: 12 }),
    outcome: outcomeArb,
    requirements: fc.subarray([FR("001"), FR("002"), FR("003")]),
    high: fc.boolean(),
    ms: fc.nat({ max: 5000 }),
    reason: fc.option(fc.string({ maxLength: 10 }), { nil: undefined }),
  },
  { noNullPrototype: true },
);

function countLines(text: string, re: RegExp): number {
  return text.split("\n").filter((l) => re.test(l)).length;
}

proves([FR("010")], "every rendering's counts are the model's, and rendering a record twice gives the same bytes (generated runs)", () => {
  fc.assert(
    fc.property(fc.array(caseArb, { maxLength: 12 }), (cases) => {
      const { run, text } = runOf(
        cases.map((c, i) => ({
          runtime: c.runtime,
          test: testCase(i, c.outcome, {
            file: c.file,
            name: c.name,
            requirements: c.requirements,
            risk: c.high ? "high" : "not-high",
            end: T0 + BigInt(i) * 1_000_000n + BigInt(c.ms) * 1_000_000n,
            ...(c.reason === undefined ? {} : { reason: c.reason }),
          }),
        })),
      );
      const again = must(readRecord(text));
      const c = run.counts;
      assertEquals(c.tests, cases.length);
      assertEquals(c.passed + c.failed + c.skipped + c.todo + c.cancelled, c.tests);
      // TAP
      const tap = tap14(run);
      assertEquals(tap, tap14(again));
      assertEquals(countLines(tap, /^ {4}ok \d+ - .* # SKIP/), c.skipped);
      assertEquals(countLines(tap, /^ {4}not ok \d+ - .* # TODO/), c.todo);
      assertEquals(countLines(tap, /^ {4}(?:not )?ok \d+ - /), c.tests);
      assertEquals(countLines(tap, /^ {6}outcome: fail$/), c.failed);
      assertEquals(countLines(tap, /^ {6}outcome: cancelled$/), c.cancelled);
      // JUnit
      const junit = junitXml(run);
      assertEquals(junit, junitXml(again));
      const root = must(readXml(junit));
      assertEquals(Number(attribute(root, "tests")), c.tests);
      assertEquals(descendants(root, "testcase").length, c.tests);
      assertEquals(descendants(root, "failure").length, c.failed);
      assertEquals(descendants(root, "error").length, c.cancelled);
      assertEquals(descendants(root, "skipped").length, c.skipped + c.todo);
      // CTRF
      const ctrf = ctrfJson(run);
      assertEquals(ctrf, ctrfJson(again));
      const summary: unknown = JSON.parse(ctrf);
      assert(typeof summary === "object" && summary !== null && "results" in summary);
      assertStringIncludes(
        JSON.stringify(summary.results),
        `"summary":{"tests":${c.tests},"passed":${c.passed},"failed":${c.failed},"skipped":${c.skipped},"pending":${c.todo},"other":${c.cancelled},`,
      );
      // SARIF
      const s = sarif(run);
      assertEquals(s, sarif(again));
      assertEquals(countLines(s, /^ {10}"ruleId": /), c.failed + c.cancelled);
      // Completion report
      const md = completionMarkdown(run);
      assertEquals(md, completionMarkdown(again));
      assertStringIncludes(md, `| ${c.tests} | ${c.passed} | ${c.failed} | ${c.skipped} | ${c.todo} | ${c.cancelled} |`);
      assertEquals(completionHtml(run), completionHtml(again));
      assertStringIncludes(
        completionHtml(run),
        `<td>${c.tests}</td><td>${c.passed}</td><td>${c.failed}</td><td>${c.skipped}</td><td>${c.todo}</td><td>${c.cancelled}</td>`,
      );
    }),
    { numRuns: 60 },
  );
});

// ---------------------------------------------------------------------------------------------------------------------------- evidence

async function ledgerOf(records: Parameters<typeof appendEntry>[1][]): Promise<readonly LedgerEntry[]> {
  let l: readonly LedgerEntry[] = [];
  for (const r of records) l = must(await appendEntry(l, r));
  return l;
}

proves(
  [FR("011")],
  "the in-toto Test Result statement of a run, and the ledger entries of a run and of a signature with its meaning and role",
  async () => {
    const digest = await sha256("record");
    const s = testResultStatement(SAMPLE, { name: "x.otlp.json", digest });
    assertEquals(s._type, "https://in-toto.io/Statement/v1");
    assertEquals(s.predicateType, TEST_RESULT_PREDICATE);
    assertEquals(s.subject, [{ name: "x.otlp.json", digest: { sha256: digest } }]);
    assertEquals(s.predicate.result, "FAILED");
    assertEquals(s.predicate.passedTests, ["node tests/a.test.ts: case 1"]);
    assertEquals(s.predicate.warnedTests.length, 2);
    assertEquals(s.predicate.failedTests.length, 2);
    const passed = runOf([{ runtime: "node", test: testCase(1, "pass") }]).run;
    assertEquals(testResultStatement(passed, { name: "y", digest }).predicate.result, "PASSED");
    const warned = runOf([
      { runtime: "node", test: testCase(1, "pass") },
      { runtime: "node", test: testCase(2, "skip") },
    ]).run;
    assertEquals(testResultStatement(warned, { name: "y", digest }).predicate.result, "WARNED");
    const envDigest = await sha256("envelope");
    const ledger = await ledgerOf([
      runEntry(SAMPLE.traceId, digest, at("2026-01-01T00:00:00Z")),
      signatureEntry("executed", "ci", digest, envDigest, at("2026-01-01T00:00:01Z")),
      signatureEntry("reviewed", "qa-lead", await sha256("other"), envDigest, at("2026-01-01T00:00:02Z")),
    ]);
    assertEquals(ledger[0]?.kind, "test-run");
    assertEquals(ledger[0]?.evidence, digest);
    assertEquals(signaturesOf(ledger, digest), [
      { seq: 2, meaning: "executed", role: "ci", at: "2026-01-01T00:00:01.000Z", envelope: envDigest },
    ]);
  },
);

proves(
  [FR("012"), FR("013")],
  "verification: the digest in the ledger, the chain whole, each envelope verified and naming it, and a review where required",
  async () => {
    const digest = await sha256("record");
    const keys = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
    const other = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
    const envelope = must(await signStatement(testResultStatement(SAMPLE, { name: "x", digest }), [{ key: keys.privateKey }]));
    const elsewhere = must(
      await signStatement(testResultStatement(SAMPLE, { name: "x", digest: await sha256("other") }), [{ key: keys.privateKey }]),
    );
    const envDigest = await sha256(JSON.stringify(envelope));
    const ledger = await ledgerOf([runEntry(SAMPLE.traceId, digest, at("2026-01-01T00:00:00Z"))]);
    const okNow = must(await verifyEvidence({ recordDigest: digest, ledger }));
    assertEquals(okNow.seq, 1);
    const kinds = async (input: Parameters<typeof verifyEvidence>[0]): Promise<readonly string[]> => {
      const r = await verifyEvidence(input);
      return r.kind === "ok" ? [] : r.error.map((p) => p.kind);
    };
    assertEquals(await kinds({ recordDigest: await sha256("recorc"), ledger }), ["not-in-ledger"]);
    const broken = ledger.map((e) => ({ ...e, at: at("2027-01-01T00:00:00Z") }));
    assertEquals(await kinds({ recordDigest: digest, ledger: broken }), ["ledger-broken"]);
    const env = { name: "e.dsse.json", envelope, digest: envDigest };
    assertEquals(await kinds({ recordDigest: digest, ledger, envelopes: [env], keys: [{ key: keys.publicKey }] }), []);
    assertEquals(await kinds({ recordDigest: digest, ledger, envelopes: [env] }), ["no-key"]);
    assertEquals(await kinds({ recordDigest: digest, ledger, envelopes: [env], keys: [{ key: other.publicKey }] }), ["envelope"]);
    assertEquals(
      await kinds({ recordDigest: digest, ledger, envelopes: [{ ...env, envelope: elsewhere }], keys: [{ key: keys.publicKey }] }),
      ["envelope-subject"],
    );
    assertEquals(await kinds({ recordDigest: digest, ledger, requireReview: true }), ["review-missing"]);
    const executed = await ledgerOf([
      runEntry(SAMPLE.traceId, digest, at("2026-01-01T00:00:00Z")),
      signatureEntry("executed", "ci", digest, envDigest, at("2026-01-01T00:00:01Z")),
    ]);
    assertEquals(await kinds({ recordDigest: digest, ledger: executed, requireReview: true }), ["review-missing"]);
    const reviewed = await ledgerOf([
      runEntry(SAMPLE.traceId, digest, at("2026-01-01T00:00:00Z")),
      signatureEntry("reviewed", "qa-lead", digest, envDigest, at("2026-01-01T00:00:01Z")),
    ]);
    assertEquals(await kinds({ recordDigest: digest, ledger: reviewed, requireReview: true }), []);
    assertEquals(
      await kinds({ recordDigest: digest, ledger: reviewed, requireReview: true, envelopes: [env], keys: [{ key: keys.publicKey }] }),
      [],
    );
    assertEquals(
      await kinds({
        recordDigest: digest,
        ledger: reviewed,
        requireReview: true,
        envelopes: [{ ...env, digest: await sha256("x") }],
        keys: [{ key: keys.publicKey }],
      }),
      ["review-missing"],
    );
  },
);
