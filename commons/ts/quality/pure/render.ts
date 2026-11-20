/**
 * The renderings of a quality record on demand (commons 0021-ifqs FR-005, FR-006, FR-012, FR-013, FR-015): JUnit XML, CTRF, SARIF and TAP
 * over the cases of a `QualityRecord`, and the three documents of ISO/IEC/IEEE 29119-3 (the test completion report, the test status
 * report and a test incident report for each failure, cancellation and `not_run`). None is kept as evidence; each is a function of the
 * record (and of the grade given) alone, with no clock, so rendering twice gives the same bytes.
 *
 * @remarks
 * What 0008-test-evidence already renders is reused: the TAP of the cases that ran is `tap14`, the time helpers are its. What it cannot
 * hold, a case that did not run, is added: its count wherever the counts of passed and failed are (FR-005), CTRF's status `other`
 * (FR-014), a JUnit `skipped` of type `not_run`, a SARIF result at level `warning`. Every rendering that shows evidence shows its grade
 * (FR-006).
 *
 * @example
 * ```ts
 * import { ctrfDocument } from "./render.ts";
 * // const q = readQuality(text);
 * // if (q.kind === "ok") console.log(ctrfDocument(q.value, "E4"));
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { isoTime, seconds, tap14 } from "../../kernel/test-report.ts";
import { el, type XmlChild, type XmlElement, writeXml } from "../../kernel/xml.ts";
import { DOCUMENTS, type Grade, showGrade } from "./names.ts";
import { ctrfStatus, ctrfTest, type QualityCase, type QualityRecord } from "./record.ts";

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const oneLine = (s: string): string => s.replace(/[\r\n]+/g, " ");

/** The counts as one line, with the count of `not_run` beside passed and failed (FR-005). */
export function countsLine(q: QualityRecord): string {
  const c = q.counts;
  return `${c.tests} ran: ${c.passed} passed, ${c.failed} failed, ${c.skipped} skipped, ${c.todo} todo, ${c.cancelled} cancelled; ${c.notRun} not_run`;
}

// ---------------------------------------------------------------------------------------------------------------------------- CTRF

/** The run as a CTRF document (FR-013): the case bodies as they are in the record, `not_run` as status `other` (FR-014), the grade shown. */
export function ctrfDocument(q: QualityRecord, grade: Grade = q.grade): string {
  const c = q.counts;
  const doc = {
    reportFormat: "CTRF",
    specVersion: "0.0.0",
    results: {
      tool: { name: "ifc quality" },
      summary: {
        tests: c.tests + c.notRun,
        passed: c.passed,
        failed: c.failed,
        skipped: c.skipped,
        pending: c.todo,
        other: c.cancelled + c.notRun,
        start: Number(q.run.start / 1_000_000n),
        stop: Number(q.run.end / 1_000_000n),
      },
      tests: q.cases.map(ctrfTest),
      environment: {
        osPlatform: q.run.runner.os,
        ...(q.run.runner.revision === undefined ? {} : { commit: q.run.runner.revision }),
        extra: { traceId: q.traceId, status: q.run.status, grade, gradeWords: showGrade(grade) },
      },
      extra: {
        notRun: c.notRun,
        cancelled: c.cancelled,
        todo: c.todo,
        unproven: [...q.run.unproven],
        failures: [...q.run.failures],
        grade,
      },
    },
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

// ---------------------------------------------------------------------------------------------------------------------------- JUnit

const prop = (name: string, value: string): XmlElement =>
  el(
    "property",
    [],
    [
      ["name", name],
      ["value", value],
    ],
  );

function groups(
  cases: readonly QualityCase[],
): readonly { readonly file: string; readonly runtime: string; readonly cases: readonly QualityCase[] }[] {
  const out = new Map<string, { file: string; runtime: string; cases: QualityCase[] }>();
  for (const c of cases) {
    const k = JSON.stringify([c.runtime, c.file]);
    const g = out.get(k) ?? { file: c.file, runtime: c.runtime, cases: [] };
    g.cases.push(c);
    out.set(k, g);
  }
  return [...out.values()];
}

function failureText(c: QualityCase): string {
  return [
    c.message,
    c.expected === undefined ? undefined : `expected: ${c.expected}`,
    c.actual === undefined ? undefined : `actual: ${c.actual}`,
    c.reason,
  ]
    .filter((x): x is string => x !== undefined)
    .join("\n");
}

function junitCase(c: QualityCase): XmlElement {
  const props = el("properties", [
    ...c.requirements.map((r) => prop("requirement", r)),
    prop("risk", c.risk),
    prop("id", c.id),
    prop("outcome", c.outcome),
    prop("grade", c.grade),
    ...(c.characteristic === undefined ? [] : [prop("characteristic", c.characteristic)]),
    ...(c.rule === undefined ? [] : [prop("rule", c.rule)]),
    ...(c.line === undefined ? [] : [prop("line", String(c.line))]),
  ]);
  const body: XmlChild[] = [props];
  switch (c.outcome) {
    case "pass":
      break;
    case "fail":
      body.push(
        el(
          "failure",
          [failureText(c)],
          [
            ["message", oneLine(c.message ?? "failed")],
            ["type", "AssertionError"],
          ],
        ),
      );
      break;
    case "cancelled":
      body.push(
        el(
          "error",
          [failureText(c)],
          [
            ["message", oneLine(c.reason ?? "cancelled")],
            ["type", "cancelled"],
          ],
        ),
      );
      break;
    case "skip":
      body.push(el("skipped", [], [["message", oneLine(c.reason ?? "skipped")]]));
      break;
    case "todo":
      body.push(el("skipped", [], [["message", `TODO${c.reason === undefined ? "" : `: ${oneLine(c.reason)}`}`]]));
      break;
    case "not_run":
      body.push(
        el(
          "skipped",
          [],
          [
            ["message", oneLine(c.reason ?? "not run")],
            ["type", "not_run"],
          ],
        ),
      );
      break;
    default:
      return absurd(c.outcome);
  }
  return el("testcase", body, [
    ["name", c.name],
    ["classname", c.file],
    ["file", c.file],
    ["time", seconds(c.start, c.end)],
  ]);
}

/**
 * The run as JUnit XML: a `testsuite` per file and runtime, a `testcase` per case with its grade among its properties, `failure`,
 * `error` (cancelled) or `skipped` (skip, todo and, with `type="not_run"` and its reason, a case that did not run). JUnit has no word for
 * `not_run`, so the count is a property of the run (`ifc.not_run`) beside the grade.
 */
export function junit(q: QualityRecord, grade: Grade = q.grade): string {
  const suites = groups(q.cases).map((g) => {
    const failures = g.cases.filter((c) => c.outcome === "fail").length;
    const errors = g.cases.filter((c) => c.outcome === "cancelled").length;
    const skipped = g.cases.filter((c) => c.outcome === "skip" || c.outcome === "todo" || c.outcome === "not_run").length;
    return el("testsuite", g.cases.map(junitCase), [
      ["name", `${g.file} [${g.runtime}]`],
      ["tests", String(g.cases.length)],
      ["failures", String(failures)],
      ["errors", String(errors)],
      ["skipped", String(skipped)],
    ]);
  });
  const c = q.counts;
  return writeXml(
    el(
      "testsuites",
      [
        el("properties", [
          prop("ifc.not_run", String(c.notRun)),
          prop("ifc.quality.grade", grade),
          prop("ifc.quality.grade.words", showGrade(grade)),
        ]),
        ...suites,
      ],
      [
        ["name", `ifc quality ${q.traceId}`],
        ["tests", String(c.tests + c.notRun)],
        ["failures", String(c.failed)],
        ["errors", String(c.cancelled)],
        ["skipped", String(c.skipped + c.todo + c.notRun)],
        ["time", seconds(q.run.start, q.run.end)],
      ],
    ),
  );
}

// ---------------------------------------------------------------------------------------------------------------------------- SARIF

/** The rule of a failed case that proves no requirement and belongs to no rule of a check. */
export const NO_RULE = "ifc.test.no-requirement";

function ruleOf(c: QualityCase): string {
  return c.rule ?? c.requirements[0] ?? NO_RULE;
}

/**
 * The run as SARIF 2.1.0: each failed or cancelled case an `error` result and each case that did not run a `warning`, at its file and, where
 * it has one, its line, with its rule (a check's rule id, else its first requirement) (FR-015); the counts, `not_run` included, and the grade
 * as the run's properties.
 */
export function sarif(q: QualityRecord, grade: Grade = q.grade): string {
  const shown = q.cases.filter((c) => c.outcome === "fail" || c.outcome === "cancelled" || c.outcome === "not_run");
  const rules = [...new Set(shown.map(ruleOf))].sort(byText);
  const doc = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ifc quality",
            rules: rules.map((id) => ({
              id,
              shortDescription: { text: id === NO_RULE ? "A case that proves no requirement" : `Rule or requirement ${id}` },
            })),
          },
        },
        invocations: [{ executionSuccessful: q.run.status === "success" }],
        results: shown.map((c) => ({
          ruleId: ruleOf(c),
          ruleIndex: rules.indexOf(ruleOf(c)),
          level: c.outcome === "not_run" ? "warning" : "error",
          message: {
            text: oneLine(
              c.outcome === "not_run"
                ? `${c.name}: not run (${c.reason ?? "no reason given"})`
                : `${c.name}: ${c.outcome === "cancelled" ? `cancelled (${c.reason ?? "it did not end"})` : (c.message ?? "failed")}`,
            ),
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: c.file, uriBaseId: "%SRCROOT%" },
                ...(c.line === undefined ? {} : { region: { startLine: c.line } }),
              },
            },
          ],
          partialFingerprints: { "ifcTestId/v1": c.id },
          properties: { requirements: [...c.requirements], outcome: c.outcome, grade: c.grade, status: ctrfStatus(c.outcome) },
        })),
        properties: {
          traceId: q.traceId,
          status: q.run.status,
          ...q.counts,
          grade,
          gradeWords: showGrade(grade),
          unproven: [...q.run.unproven],
        },
      },
    ],
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

// ---------------------------------------------------------------------------------------------------------------------------- TAP

/**
 * The run as TAP version 14: `tap14` of 0008-test-evidence for the cases that ran, then, as comments, the count of `not_run` beside the
 * others, each case that did not run with its reason, and the grade.
 */
export function tap(q: QualityRecord, grade: Grade = q.grade): string {
  let out = tap14(q.run);
  out += `# not_run ${q.counts.notRun}\n`;
  for (const c of q.cases.filter((x) => x.outcome === "not_run"))
    out += `# not_run ${oneLine(c.name)}: ${oneLine(c.reason ?? "no reason given")}\n`;
  out += `# grade ${showGrade(grade)}\n`;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------- 29119-3 documents (FR-012)

function table(head: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.map((c) => c.replaceAll("|", "\\|")).join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...rows.map(line)].join("\n");
}

function provedCount(q: QualityRecord): number {
  return q.run.requirements.filter((r) => r.state === "proven").length;
}

/**
 * The test completion report of ISO/IEC/IEEE 29119-3 for a run (FR-012), as Markdown: the summary with the counts and the count of
 * `not_run`, the requirements proved with the grade beside the count (FR-006), and the cases that did not pass.
 */
export function completionReport(q: QualityRecord, grade: Grade = q.grade): string {
  const c = q.counts;
  const lines = [
    `# ${DOCUMENTS.completion}`,
    "",
    `Run ${q.traceId}, from ${isoTime(q.run.start)} to ${isoTime(q.run.end)}: **${q.run.status}**.`,
    "",
    `Evidence grade: **${showGrade(grade)}**.`,
    "",
    table(
      ["ran", "passed", "failed", "skipped", "todo", "cancelled", "not_run"],
      [[c.tests, c.passed, c.failed, c.skipped, c.todo, c.cancelled, c.notRun].map(String)],
    ),
    "",
    `Requirements proved: ${provedCount(q)} at grade ${grade}.`,
    "",
    table(
      ["requirement", "state", "grade"],
      q.run.requirements.map((r) => [r.id, r.state, r.state === "proven" ? grade : "E0"]),
    ),
  ];
  const open = q.cases.filter((x) => x.outcome === "fail" || x.outcome === "cancelled" || x.outcome === "not_run");
  if (open.length > 0) {
    lines.push(
      "",
      "## Not passed",
      "",
      table(
        ["case", "outcome", "reason"],
        open.map((x) => [x.name, x.outcome, oneLine(x.reason ?? x.message ?? "")]),
      ),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** The test status report of ISO/IEC/IEEE 29119-3 for a run in progress or ended (FR-012): where it stands, in a few lines. */
export function statusReport(q: QualityRecord, grade: Grade = q.grade): string {
  return (
    `# ${DOCUMENTS.status}\n\n` +
    `Run ${q.traceId}: ${countsLine(q)}.\n\nEvidence grade: ${showGrade(grade)}. ` +
    `${q.run.unproven.length} requirement${q.run.unproven.length === 1 ? "" : "s"} of the list unproven.\n`
  );
}

/** A test incident report of ISO/IEC/IEEE 29119-3 for one case that failed, was cancelled or did not run (FR-012). */
export type IncidentReport = { readonly case: string; readonly text: string };

/** The test incident reports of a run, one for each failure, cancellation and `not_run` (FR-012). */
export function incidentReports(q: QualityRecord, grade: Grade = q.grade): readonly IncidentReport[] {
  return q.cases
    .filter((c) => c.outcome === "fail" || c.outcome === "cancelled" || c.outcome === "not_run")
    .map((c) => ({
      case: c.name,
      text:
        `# ${DOCUMENTS.incident}\n\n` +
        `Case: ${c.name}\n\nFile: ${c.file}${c.line === undefined ? "" : `:${c.line}`}\n\nOutcome: ${c.outcome}\n\n` +
        `Requirements: ${c.requirements.length === 0 ? "none" : c.requirements.join(", ")}\n\n` +
        `Reason: ${oneLine(c.reason ?? c.message ?? "none given")}\n\nRun: ${q.traceId}; evidence grade ${showGrade(grade)}.\n`,
    }));
}

/** The reports a `render` can write. */
export type RenderFormat = "junit" | "ctrf" | "sarif" | "tap" | "completion" | "status" | "incident";

/** Every format `render` knows, in the order it lists them. */
export const RENDER_FORMATS: readonly RenderFormat[] = ["junit", "ctrf", "sarif", "tap", "completion", "status", "incident"];

/** Whether a text is a format. */
export function isRenderFormat(text: string): text is RenderFormat {
  return (RENDER_FORMATS as readonly string[]).includes(text);
}

/** A record rendered as one format (the incident reports joined, each beginning with its title). */
export function render(q: QualityRecord, format: RenderFormat, grade: Grade = q.grade): string {
  switch (format) {
    case "junit":
      return junit(q, grade);
    case "ctrf":
      return ctrfDocument(q, grade);
    case "sarif":
      return sarif(q, grade);
    case "tap":
      return tap(q, grade);
    case "completion":
      return completionReport(q, grade);
    case "status":
      return statusReport(q, grade);
    case "incident":
      return incidentReports(q, grade)
        .map((r) => r.text)
        .join("\n");
    default:
      return absurd(format);
  }
}
