/**
 * Tests of the signals of a pack run in `runtime/grc.ts` (commons 0007-grc FR-019): with a telemetry made from a fixed clock and fixed
 * random bytes, the exact span tree (a `grc.pack` span and one `grc.control` span under it for each control and subject, `error` where a
 * check fails or errs), their attributes, and one log record per finding in its check's span, with the severity its severity maps to and a
 * body that decodes, through OTLP JSON and back, as the finding's OCSF Compliance Finding (class 2003). The assessment is `runPack`'s for
 * random packs, subjects and waivers; with no telemetry installed nothing is said, and with a pipeline installed its signals go there.
 *
 * @module
 */
import fc from "fast-check";
import {
  defineControl,
  defineWaiver,
  definePack,
  duration,
  type Finding,
  instantOf,
  type Instant,
  type Role,
  roleOf,
  runPack,
  type Severity,
  SEVERITIES,
  STATUSES,
  type Status,
  verdict,
  type Waiver,
} from "../../kernel/grc.ts";
import { complianceFinding } from "../../kernel/ocsf.ts";
import { SEVERITY, type SpanData } from "../../kernel/otel.ts";
import { decodeLogs, encodeLogs } from "../../kernel/otlp.ts";
import { createTelemetry, memoryProcessor } from "../../kernel/signals.ts";
import { FINDING_SEVERITY, fromAnyValue, GRC_SCOPE, GRC_SIGNALS, installedGrcTelemetry, runPackObserved } from "../../runtime/grc.ts";
import { createPipeline, install, installed, uninstall } from "../../runtime/otel.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const FR = "0007-grc FR-019";

const instant = (text: string): Instant => {
  const i = instantOf(text);
  if (i === undefined) throw new Error(`not an instant: ${text}`);
  return i;
};

const role = (text: string): Role => {
  const r = roleOf(text);
  if (r === undefined) throw new Error(`not a role: ${text}`);
  return r;
};

const AT = instant("2026-05-01T12:00:00Z");
const product = { name: "Example Checker", vendor_name: "Example", version: "1.0.0" };
const resource = { attributes: { "service.name": "grc" } };

/** A GRC telemetry whose clock counts from 1000 ns and whose n-th call for random bytes gives bytes all equal to n. */
function fixture() {
  let t = 1000n;
  let call = 0;
  const memory = memoryProcessor();
  const telemetry = createTelemetry({
    registry: GRC_SIGNALS,
    resource,
    scope: GRC_SCOPE,
    clock: () => t++,
    random: (n) => new Uint8Array(n).fill(++call),
    processors: [memory],
  });
  return { memory, telemetry };
}

type Host = { readonly name: string; readonly encrypted: boolean };

const pack = definePack<Host>({
  id: "hosts",
  title: "Host baseline",
  subjectKind: "host",
  subjectId: (h) => h.name,
  controls: [
    defineControl<Host>({
      id: "enc-1",
      title: "Disks are encrypted",
      implements: [{ catalog: "example", id: "SC-28" }],
      severity: "high",
      cadence: duration("P1D"),
      remediation: "Turn on disk encryption.",
      check: (h) => verdict(h.encrypted ? "pass" : "fail"),
    }),
    defineControl<Host>({
      id: "own-1",
      title: "Hosts have an owner",
      implements: [],
      severity: "medium",
      cadence: duration("P7D"),
      check: (h) => {
        if (h.name === "b") throw new Error("the inventory is unreachable");
        return verdict("pass");
      },
    }),
    defineControl<Host>({
      id: "inv-1",
      title: "Hosts are inventoried",
      implements: [{ catalog: "example", id: "CM-8" }],
      severity: "low",
      cadence: duration("P30D"),
      check: () => verdict("warn", { detail: "the inventory is a week old" }),
    }),
    defineControl<Host>({
      id: "log-1",
      title: "Hosts send their logs",
      implements: [],
      severity: "critical",
      cadence: duration("P1D"),
      check: () => [],
    }),
  ],
});

const hosts: readonly Host[] = [
  { name: "a", encrypted: false },
  { name: "b", encrypted: true },
];

const waiver = (id: string, control: string, subjects: readonly string[]): Waiver => {
  const w = defineWaiver({
    id,
    control,
    subjects,
    reason: "a replacement is on order",
    approvedBy: role("security-lead"),
    grantedAt: instant("2026-04-01T00:00:00Z"),
    expiresAt: instant("2026-06-01T00:00:00Z"),
  });
  if (w.kind === "err") throw new Error("the waiver does not define");
  return w.value;
};

const byTime = (a: SpanData, b: SpanData): number => (a.startTime < b.startTime ? -1 : 1);

proves(
  [FR],
  "a run is one grc.pack span with a grc.control span under it for each check, in runPack's order, error where it fails",
  async () => {
    const { memory, telemetry } = fixture();
    const assessment = await runPackObserved(pack, hosts, { at: AT }, { telemetry, product, waivers: [waiver("W-2", "inv-1", ["b"])] });
    const spans = [...memory.spans].sort(byTime);
    const [root, ...checks] = spans;
    assert(root !== undefined);
    assertEquals(root.name, "grc.pack");
    assertEquals(root.parentSpanId, undefined);
    assertEquals(root.attributes, {
      "grc.pack.id": "hosts",
      "grc.pack.controls": 4n,
      "grc.pack.subjects": 2n,
      "grc.pack.findings": 8n,
      "grc.outcome": "error",
      "grc.findings.not-applicable": 2n,
      "grc.findings.pass": 2n,
      "grc.findings.accepted": 1n,
      "grc.findings.warn": 1n,
      "grc.findings.gap": 0n,
      "grc.findings.fail": 1n,
      "grc.findings.error": 1n,
    });
    assertEquals(root.status, { kind: "error", message: "hosts: 2 of 8 findings fail or error" });
    // The pack span ends last: every check span ends inside it.
    assertEquals(memory.spans[memory.spans.length - 1]?.name, "grc.pack");
    const expected: readonly (readonly [string, string, Status, string, SpanData["status"]])[] = [
      ["enc-1", "a", "fail", "fail", { kind: "error", message: "enc-1 fail for host a" }],
      ["enc-1", "b", "pass", "pass", { kind: "ok" }],
      ["own-1", "a", "pass", "pass", { kind: "ok" }],
      ["own-1", "b", "error", "error", { kind: "error", message: "own-1 error for host b" }],
      ["inv-1", "a", "warn", "warn", { kind: "ok" }],
      ["inv-1", "b", "warn", "accepted", { kind: "ok" }],
      ["log-1", "a", "not-applicable", "not-applicable", { kind: "ok" }],
      ["log-1", "b", "not-applicable", "not-applicable", { kind: "ok" }],
    ];
    assertEquals(
      checks.map((s) => [s.name, s.parentSpanId, s.context.traceId, s.attributes, s.status]),
      expected.map(([control, subject, status, outcome, spanStatus]) => [
        "grc.control",
        root.context.spanId,
        root.context.traceId,
        {
          "grc.pack.id": "hosts",
          "grc.control.id": control,
          "grc.subject.kind": "host",
          "grc.subject.id": subject,
          "grc.status": status,
          "grc.outcome": outcome,
          "grc.findings": 1n,
        },
        spanStatus,
      ]),
    );
    assertEquals(
      assessment.findings.map((f) => [f.control.id, f.subject.id, f.outcome]),
      expected.map(([c, s, , o]) => [c, s, o]),
    );
  },
);

proves([FR], "each finding is a log record in its check's span, its severity from the finding's, its body its OCSF document", async () => {
  const { memory, telemetry } = fixture();
  const assessment = await runPackObserved(pack, hosts, { at: AT }, { telemetry, product, waivers: [waiver("W-2", "inv-1", ["b"])] });
  const checks = memory.spans.filter((s) => s.name === "grc.control");
  assertEquals(memory.logs.length, assessment.findings.length);
  // Through OTLP JSON and back, as a collector would receive them.
  const decoded = decodeLogs(JSON.parse(JSON.stringify(encodeLogs([{ resource, scope: GRC_SCOPE, records: memory.logs }]))));
  assert(decoded.kind === "ok");
  const records = decoded.value[0]?.records ?? [];
  assertEquals(records.length, assessment.findings.length);
  const severityOf: Readonly<Record<string, readonly [number, string]>> = {
    "enc-1": [SEVERITY.ERROR, "ERROR"],
    "own-1": [SEVERITY.WARN, "WARN"],
    "inv-1": [SEVERITY.INFO, "INFO"],
    "log-1": [SEVERITY.FATAL, "FATAL"],
  };
  for (const [i, f] of assessment.findings.entries()) {
    const r = records[i];
    const span = checks.find((s) => s.attributes["grc.control.id"] === f.control.id && s.attributes["grc.subject.id"] === f.subject.id);
    assert(r !== undefined && span !== undefined);
    assertEquals(r.eventName, "grc.finding");
    assertEquals([r.severityNumber, r.severityText], severityOf[f.control.id]);
    assertEquals([r.traceId, r.spanId], [span.context.traceId, span.context.spanId]);
    assertEquals(r.attributes, {
      "grc.pack.id": "hosts",
      "grc.control.id": f.control.id,
      "grc.subject.kind": "host",
      "grc.subject.id": f.subject.id,
      "grc.status": f.status,
      "grc.outcome": f.outcome,
      "grc.severity": f.severity,
      ...(f.waiver === undefined ? {} : { "grc.waiver.id": f.waiver }),
    });
    assert(r.body !== undefined);
    const body = fromAnyValue(r.body);
    assertEquals(body, complianceFinding(f, { product }));
    assert(typeof body === "object" && body !== null && "class_uid" in body && body.class_uid === 2003);
  }
  // An integer of the document is an OTLP intValue, not a double.
  const wire = JSON.stringify(encodeLogs([{ resource, scope: GRC_SCOPE, records: memory.logs.slice(0, 1) }]));
  assert(wire.includes(`{"key":"class_uid","value":{"intValue":"2003"}}`));
});

proves([FR], "the record severity of each finding severity: info and low INFO, medium WARN, high ERROR, critical FATAL", async () => {
  const expected: Readonly<Record<Severity, readonly [number, string]>> = {
    info: [SEVERITY.INFO, "INFO"],
    low: [SEVERITY.INFO, "INFO"],
    medium: [SEVERITY.WARN, "WARN"],
    high: [SEVERITY.ERROR, "ERROR"],
    critical: [SEVERITY.FATAL, "FATAL"],
  };
  assertEquals(
    SEVERITIES.map((s) => FINDING_SEVERITY[s]),
    SEVERITIES.map((s) => expected[s][0]),
  );
  // One log kind for every finding, declared INFO; each record carries its finding's severity.
  const logKinds = Object.entries(GRC_SIGNALS.kinds).filter(([, d]) => d.signal === "log");
  assertEquals(
    logKinds.map(([k, d]) => [k, d.signal === "log" ? d.severity : 0]),
    [["grc.finding", SEVERITY.INFO]],
  );
  const bySeverity = definePack<string>({
    id: "severities",
    title: "One control of each severity",
    subjectKind: "thing",
    subjectId: (s) => s,
    controls: SEVERITIES.map((severity) =>
      defineControl<string>({
        id: `sev-${severity}`,
        title: severity,
        implements: [],
        severity,
        cadence: duration("P1D"),
        check: () => verdict("fail"),
      }),
    ),
  });
  const { memory, telemetry } = fixture();
  await runPackObserved(bySeverity, ["x"], { at: AT }, { telemetry, product });
  assertEquals(
    memory.logs.map((r) => [r.eventName, r.attributes["grc.severity"], r.severityNumber, r.severityText]),
    SEVERITIES.map((s) => ["grc.finding", s, ...expected[s]]),
  );
});

type Cell = { readonly status: Status | "throw" | "none"; readonly severity: Severity };

const cell: fc.Arbitrary<Cell> = fc.record(
  { status: fc.constantFrom<Status | "throw" | "none">(...STATUSES, "throw", "none"), severity: fc.constantFrom(...SEVERITIES) },
  { noNullPrototype: true },
);

proves([FR], "the assessment is runPack's for any pack, subjects and waivers, observed or not", async () => {
  assertEquals(installed(), undefined);
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 4 }),
      fc.uniqueArray(fc.constantFrom<string>("a", "b", "c", "web-1", "web-2"), { maxLength: 4 }),
      fc.array(fc.array(cell, { minLength: 4, maxLength: 4 }), { minLength: 4, maxLength: 4 }),
      fc.array(fc.tuple(fc.integer({ min: 0, max: 3 }), fc.constantFrom("a", "web-*", "c")), { maxLength: 3 }),
      async (n, names, grid, ws) => {
        const p = definePack<string>({
          id: "random",
          title: "Random",
          subjectKind: "thing",
          subjectId: (s) => s,
          controls: grid.slice(0, n).map((row, c) =>
            defineControl<string>({
              id: `c-${c}`,
              title: `Control ${c}`,
              implements: [{ catalog: "example", id: `X-${c}` }],
              severity: "medium",
              cadence: duration("P1D"),
              check: (s) => {
                const x = row[names.indexOf(s) % row.length] ?? { status: "none", severity: "info" };
                if (x.status === "throw") throw new Error(`no ${s}`);
                return x.status === "none" ? [] : verdict(x.status, { severity: x.severity });
              },
            }),
          ),
        });
        const waivers = ws.map(([c, s], i) => waiver(`W-${i}`, `c-${c}`, [s]));
        const expected = await runPack(p, names, { at: AT }, { waivers });
        const { memory, telemetry } = fixture();
        assertEquals(await runPackObserved(p, names, { at: AT }, { telemetry, product, waivers }), expected);
        assertEquals(memory.spans.length, 1 + n * names.length);
        assertEquals(memory.logs.length, expected.findings.length);
        const findings: readonly Finding[] = expected.findings;
        assertEquals(
          memory.logs.map((r) => (r.body === undefined ? undefined : fromAnyValue(r.body))),
          findings.map((f) => complianceFinding(f, { product })),
        );
        // With no telemetry given and none installed, the run is runPack's and says nothing.
        assertEquals(await runPackObserved(p, names, { at: AT }, { product, waivers }), expected);
      },
    ),
    { numRuns: 60 },
  );
});

proves([FR], "with a pipeline installed and no telemetry given, the run's signals go to the pipeline under the GRC scope", async () => {
  let t = 1n;
  const memory = memoryProcessor();
  const pipeline = createPipeline({ resource, processors: [memory], clock: () => t++, random: (n) => new Uint8Array(n).fill(9) });
  install(pipeline);
  try {
    const telemetry = installedGrcTelemetry();
    assert(telemetry !== undefined);
    assert(installedGrcTelemetry() === telemetry, "one GRC telemetry for each pipeline");
    const a = await runPackObserved(pack, hosts, { at: AT }, { product });
    assertEquals(a, await runPack(pack, hosts, { at: AT }));
    assertEquals(memory.spans.length, 1 + pack.controls.length * hosts.length);
    assertEquals(memory.logs.length, a.findings.length);
    assert(memory.entries.every((e) => e.source.scope.name === GRC_SCOPE.name));
  } finally {
    uninstall();
    await pipeline.shutdown(100);
  }
  assertEquals(installedGrcTelemetry(), undefined);
});
