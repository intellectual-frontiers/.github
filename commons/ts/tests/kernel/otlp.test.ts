/**
 * Tests of `kernel/otlp.ts`: an export request written as the OTLP specification's JSON (field names, hexadecimal ids, 64-bit integers as
 * decimal strings, enumerations as integers, bytes as base64, grouping by resource and scope), read back to the same traces, logs and
 * metrics through JSON text (property-tested), 64-bit integers read from numbers or strings, unknown fields ignored, a failure naming its
 * path, and the export responses.
 *
 * @module
 */
import fc from "fast-check";
import { formatDecodeError } from "../../kernel/decode.ts";
import {
  type AnyValue,
  type Attributes,
  type AttributeValue,
  type HistogramPoint,
  type LogRecord,
  type Metric,
  type NumberPoint,
  parseSpanId,
  parseTraceId,
  type Resource,
  type Scope,
  type SeverityNumber,
  type SpanData,
  type SpanEvent,
  type SpanId,
  type SpanKind,
  type SpanLink,
  type SpanStatus,
  type TraceId,
  type TraceState,
} from "../../kernel/otel.ts";
import {
  countSignals,
  decodeLogs,
  decodeMetrics,
  decodeResponse,
  decodeTraces,
  encodeLogs,
  encodeMetrics,
  encodeResponse,
  encodeTraces,
  type LogBatch,
  type MetricBatch,
  type TraceBatch,
} from "../../kernel/otlp.ts";
import { toHex } from "../../kernel/sha256.ts";
import { assertEquals, proves } from "../../runtime/test.ts";

const FR = "0006-signals FR-004";
const MODEL = "0006-signals FR-001";
const LAWS = "0005-typescript-runtime FR-014";

function value<T, E>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: E }): T {
  if (r.kind === "err") throw new Error(`expected a success, found ${JSON.stringify(r.error)}`);
  return r.value;
}

/** Through JSON text and back, as a request travels. */
const wire = (json: unknown): unknown => JSON.parse(JSON.stringify(json));

const TRACE = value(parseTraceId("4bf92f3577b34da6a3ce929d0e0e4736"));
const SPAN = value(parseSpanId("00f067aa0ba902b7"));
const PARENT = value(parseSpanId("53995c3f42cd8ad8"));

// --- arbitraries -------------------------------------------------------------------------------------------------------------------

const nonZeroHex = (n: number): fc.Arbitrary<string> =>
  fc
    .uint8Array({ minLength: n, maxLength: n })
    .map((b) => toHex(b))
    .filter((h) => !/^0+$/.test(h));
const traceIdArb: fc.Arbitrary<TraceId> = nonZeroHex(16).map((h) => value(parseTraceId(h)));
const spanIdArb: fc.Arbitrary<SpanId> = nonZeroHex(8).map((h) => value(parseSpanId(h)));
const int64 = fc.bigInt({ min: -(2n ** 63n), max: 2n ** 63n - 1n });
const uint64 = fc.bigInt({ min: 0n, max: 2n ** 64n - 1n });
const double = fc.double().filter((d) => !Object.is(d, -0));
const count = fc.nat({ max: 1000 });
const optional = <K extends string, T>(key: K, arb: fc.Arbitrary<T>): fc.Arbitrary<{ readonly [P in K]?: T }> =>
  fc
    .option(arb, { nil: undefined })
    .map((v): { readonly [P in K]?: T } => (v === undefined ? {} : ({ [key]: v } as { readonly [P in K]: T })));

const attributeValue: fc.Arbitrary<AttributeValue> = fc.oneof(
  fc.string(),
  fc.boolean(),
  int64,
  double,
  fc.uint8Array({ maxLength: 8 }),
  fc.array(fc.string(), { maxLength: 3 }),
  fc.array(fc.boolean(), { minLength: 1, maxLength: 3 }),
  fc.array(int64, { minLength: 1, maxLength: 3 }),
  fc.array(double, { minLength: 1, maxLength: 3 }),
);
const attributes: fc.Arbitrary<Attributes> = fc.dictionary(fc.string({ maxLength: 8 }), attributeValue, {
  maxKeys: 4,
  noNullPrototype: true,
});

const { anyValue } = fc.letrec<{ anyValue: AnyValue }>((tie) => ({
  anyValue: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    attributeValue,
    fc.array(tie("anyValue"), { maxLength: 3 }),
    fc.dictionary(fc.string({ maxLength: 6 }), tie("anyValue"), { maxKeys: 3, noNullPrototype: true }),
  ),
}));

const traceState: fc.Arbitrary<TraceState> = fc.uniqueArray(
  fc.record(
    { key: fc.stringMatching(/^[a-z][a-z0-9_*/-]{0,8}$/), value: fc.stringMatching(/^[!-+\--<>-~]{1,8}$/) },
    { noNullPrototype: true },
  ),
  { selector: (m) => m.key, maxLength: 3 },
);

const status: fc.Arbitrary<SpanStatus> = fc.oneof(
  fc.constant({ kind: "unset" } as const),
  fc.constant({ kind: "ok" } as const),
  fc.string().map((message) => ({ kind: "error", message }) as const),
);

const event: fc.Arbitrary<SpanEvent> = fc.record(
  { name: fc.string(), time: uint64, attributes, droppedAttributesCount: count },
  { noNullPrototype: true },
);

const link: fc.Arbitrary<SpanLink> = fc.record(
  {
    traceId: traceIdArb,
    spanId: spanIdArb,
    traceState,
    traceFlags: fc.integer({ min: 0, max: 255 }),
    attributes,
    droppedAttributesCount: count,
  },
  { noNullPrototype: true },
);

const span: fc.Arbitrary<SpanData> = fc
  .tuple(
    fc.record(
      {
        name: fc.string(),
        context: fc.record(
          {
            traceId: traceIdArb,
            spanId: spanIdArb,
            traceFlags: fc.integer({ min: 0, max: 255 }),
            traceState,
            isRemote: fc.constant(false),
          },
          { noNullPrototype: true },
        ),
        kind: fc.constantFrom<SpanKind>("internal", "server", "client", "producer", "consumer"),
        startTime: uint64,
        endTime: uint64,
        attributes,
        events: fc.array(event, { maxLength: 2 }),
        links: fc.array(link, { maxLength: 2 }),
        status,
        droppedAttributesCount: count,
        droppedEventsCount: count,
        droppedLinksCount: count,
      },
      { noNullPrototype: true },
    ),
    optional("parentSpanId", spanIdArb),
  )
  .map(([s, p]) => ({ ...s, ...p }));

const severity = fc.integer({ min: 1, max: 24 }).map((n) => n as SeverityNumber);

const record: fc.Arbitrary<LogRecord> = fc
  .tuple(
    fc.record(
      {
        time: uint64,
        observedTime: uint64,
        severityNumber: severity,
        severityText: fc.string(),
        attributes,
        droppedAttributesCount: count,
      },
      { noNullPrototype: true },
    ),
    optional("body", anyValue),
    optional("eventName", fc.string()),
    optional("traceId", traceIdArb),
    optional("spanId", spanIdArb),
    optional("traceFlags", fc.integer({ min: 0, max: 255 })),
  )
  .map(([r, ...rest]) => Object.assign({}, r, ...rest) as LogRecord);

const numberPoint: fc.Arbitrary<NumberPoint> = fc.record(
  { attributes, startTime: uint64, time: uint64, value: fc.oneof(int64, double) },
  { noNullPrototype: true },
);

const histogramPoint: fc.Arbitrary<HistogramPoint> = fc
  .tuple(
    fc.array(double, { maxLength: 4 }),
    fc.record({ attributes, startTime: uint64, time: uint64, count: count }, { noNullPrototype: true }),
    optional("sum", double),
    optional("min", double),
    optional("max", double),
  )
  .chain(([bounds, base, ...rest]) =>
    fc
      .array(count, { minLength: bounds.length + 1, maxLength: bounds.length + 1 })
      .map((bucketCounts) => Object.assign({}, base, ...rest, { bounds, bucketCounts }) as HistogramPoint),
  );

const temporality = fc.constantFrom("delta" as const, "cumulative" as const);
const metric: fc.Arbitrary<Metric> = fc.record(
  {
    name: fc.string(),
    description: fc.string(),
    unit: fc.string(),
    data: fc.oneof(
      fc.record(
        { kind: fc.constant("sum" as const), temporality, monotonic: fc.boolean(), points: fc.array(numberPoint, { maxLength: 2 }) },
        { noNullPrototype: true },
      ),
      fc.record({ kind: fc.constant("gauge" as const), points: fc.array(numberPoint, { maxLength: 2 }) }, { noNullPrototype: true }),
      fc.record(
        { kind: fc.constant("histogram" as const), temporality, points: fc.array(histogramPoint, { maxLength: 2 }) },
        { noNullPrototype: true },
      ),
    ),
  },
  { noNullPrototype: true },
);

const scope: fc.Arbitrary<Scope> = fc
  .tuple(fc.string(), optional("version", fc.string()), optional("attributes", attributes))
  .map(([name, ...rest]) => Object.assign({ name }, ...rest) as Scope);

/** Batches whose resources differ (an index attribute), so that encoding groups none of them together. */
function batches<T>(
  items: fc.Arbitrary<T>,
): fc.Arbitrary<readonly { readonly resource: Resource; readonly scope: Scope; readonly items: readonly T[] }[]> {
  return fc
    .array(fc.record({ attributes, scope, items: fc.array(items, { maxLength: 3 }) }, { noNullPrototype: true }), { maxLength: 3 })
    .map((bs) =>
      bs.map((b, i) => ({ resource: { attributes: { ...b.attributes, "batch.index": BigInt(i) } }, scope: b.scope, items: b.items })),
    );
}

// --- tests ------------------------------------------------------------------------------------------------------------------------

proves([FR, LAWS], "traces encoded as OTLP/JSON and sent as text decode to what was encoded (round trip)", () => {
  fc.assert(
    fc.property(batches(span), (bs) => {
      const traces: TraceBatch[] = bs.map((b) => ({ resource: b.resource, scope: b.scope, spans: b.items }));
      assertEquals(value(decodeTraces(wire(encodeTraces(traces)))), traces);
    }),
    { numRuns: 200 },
  );
});

proves([FR, LAWS], "logs encoded as OTLP/JSON and sent as text decode to what was encoded (round trip)", () => {
  fc.assert(
    fc.property(batches(record), (bs) => {
      const logs: LogBatch[] = bs.map((b) => ({ resource: b.resource, scope: b.scope, records: b.items }));
      assertEquals(value(decodeLogs(wire(encodeLogs(logs)))), logs);
    }),
    { numRuns: 200 },
  );
});

proves([FR, LAWS], "metrics encoded as OTLP/JSON and sent as text decode to what was encoded (round trip)", () => {
  fc.assert(
    fc.property(batches(metric), (bs) => {
      const metrics: MetricBatch[] = bs.map((b) => ({ resource: b.resource, scope: b.scope, metrics: b.items }));
      assertEquals(value(decodeMetrics(wire(encodeMetrics(metrics)))), metrics);
    }),
    { numRuns: 200 },
  );
});

const resource: Resource = { attributes: { "service.name": "build" } };

const oneSpan: SpanData = {
  name: "build.step",
  context: { traceId: TRACE, spanId: SPAN, traceFlags: 1, traceState: [{ key: "rojo", value: "1" }], isRemote: false },
  parentSpanId: PARENT,
  kind: "client",
  startTime: 1_700_000_000_000_000_000n,
  endTime: 1_700_000_000_500_000_000n,
  attributes: { big: 2n ** 63n - 1n, ratio: 0.5, raw: Uint8Array.of(0xfb, 0xff), tags: ["a", "b"] },
  events: [],
  links: [],
  status: { kind: "error", message: "not found" },
  droppedAttributesCount: 0,
  droppedEventsCount: 2,
  droppedLinksCount: 0,
};

proves(
  [FR, MODEL],
  "a span is written with camel-case fields, hexadecimal ids, int64 as decimal strings, enums as integers, bytes as base64",
  () => {
    assertEquals(encodeTraces([{ resource, scope: { name: "ifc", version: "1.0.0" }, spans: [oneSpan] }]), {
      resourceSpans: [
        {
          resource: { attributes: [{ key: "service.name", value: { stringValue: "build" } }] },
          scopeSpans: [
            {
              scope: { name: "ifc", version: "1.0.0" },
              spans: [
                {
                  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
                  spanId: "00f067aa0ba902b7",
                  traceState: "rojo=1",
                  parentSpanId: "53995c3f42cd8ad8",
                  flags: 1,
                  name: "build.step",
                  kind: 3,
                  startTimeUnixNano: "1700000000000000000",
                  endTimeUnixNano: "1700000000500000000",
                  attributes: [
                    { key: "big", value: { intValue: "9223372036854775807" } },
                    { key: "ratio", value: { doubleValue: 0.5 } },
                    { key: "raw", value: { bytesValue: "+/8=" } },
                    { key: "tags", value: { arrayValue: { values: [{ stringValue: "a" }, { stringValue: "b" }] } } },
                  ],
                  events: [],
                  droppedEventsCount: 2,
                  links: [],
                  status: { code: 2, message: "not found" },
                },
              ],
            },
          ],
        },
      ],
    });
  },
);

proves([FR], "batches of the same resource and scope are grouped together", () => {
  const scope: Scope = { name: "ifc" };
  const other: Scope = { name: "other" };
  const request = encodeTraces([
    { resource, scope, spans: [oneSpan] },
    { resource: { attributes: { "service.name": "else" } }, scope, spans: [oneSpan] },
    { resource: { attributes: { "service.name": "build" } }, scope: other, spans: [] },
    { resource, scope: { name: "ifc" }, spans: [oneSpan] },
  ]);
  const decoded = value(decodeTraces(wire(request)));
  assertEquals(
    decoded.map((b) => [b.resource.attributes["service.name"], b.scope.name, b.spans.length]),
    [
      ["build", "ifc", 2],
      ["build", "other", 0],
      ["else", "ifc", 1],
    ],
  );
  assertEquals(countSignals(decoded), 3);
});

proves([FR], "64-bit integers are read from numbers or strings, enumerations from numbers or names, unknown fields ignored", () => {
  const request = {
    future: { anything: true },
    resourceSpans: [
      {
        resource: { attributes: [{ key: "n", value: { intValue: 1 } }], droppedAttributesCount: 0, entityRefs: [] },
        schemaUrl: "https://opentelemetry.io/schemas/1.30.0",
        scopeSpans: [
          {
            scope: { name: "s" },
            spans: [
              {
                traceId: "4BF92F3577B34DA6A3CE929D0E0E4736",
                spanId: "00f067aa0ba902b7",
                parentSpanId: "",
                name: "x",
                kind: "SPAN_KIND_SERVER",
                startTimeUnixNano: 5,
                endTimeUnixNano: "6",
                status: { code: "STATUS_CODE_OK", message: "ignored for ok" },
                somethingNew: 1,
              },
            ],
          },
        ],
      },
    ],
  };
  const [batch] = value(decodeTraces(request));
  assertEquals(batch?.resource, { attributes: { n: 1n } });
  assertEquals(batch?.spans, [
    {
      name: "x",
      context: { traceId: TRACE, spanId: SPAN, traceFlags: 0, traceState: [], isRemote: false },
      kind: "server",
      startTime: 5n,
      endTime: 6n,
      attributes: {},
      events: [],
      links: [],
      status: { kind: "ok" },
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
    },
  ]);
  assertEquals(value(decodeTraces({})), []);
  assertEquals(
    value(
      decodeMetrics({ resourceMetrics: [{ scopeMetrics: [{ metrics: [{ name: "m", gauge: { dataPoints: [{ asDouble: "NaN" }] } }] }] }] }),
    )[0]?.metrics[0]?.data,
    { kind: "gauge", points: [{ attributes: {}, startTime: 0n, time: 0n, value: NaN }] },
  );
});

proves([FR], "what does not decode is refused with the path of the field", () => {
  const at = (r: { readonly kind: "ok" } | { readonly kind: "err"; readonly error: Parameters<typeof formatDecodeError>[0] }): string =>
    r.kind === "err" ? formatDecodeError(r.error) : "decoded";
  const span = (fields: Record<string, unknown>): unknown => ({
    resourceSpans: [{ scopeSpans: [{ spans: [{ traceId: TRACE, spanId: SPAN, ...fields }] }] }],
  });
  assertEquals(
    at(decodeTraces(span({ traceId: "00000000000000000000000000000000" }))),
    `$.resourceSpans[0].scopeSpans[0].spans[0].traceId: expected a trace id (32 hexadecimal digits, not all zeros), found the string "00000000000000000000000000000000"`,
  );
  assertEquals(
    at(decodeTraces(span({ startTimeUnixNano: 1.5 }))),
    "$.resourceSpans[0].scopeSpans[0].spans[0].startTimeUnixNano: expected a 64-bit integer (a number or a decimal string), found number 1.5",
  );
  assertEquals(
    at(decodeTraces(span({ attributes: [{ key: "k", value: { arrayValue: { values: [{ stringValue: "a" }, { intValue: "1" }] } } }] }))),
    "$.resourceSpans[0].scopeSpans[0].spans[0].attributes[0].value: expected an attribute value (a primitive or a homogeneous array of primitives), found an object",
  );
  assertEquals(at(decodeTraces(span({ kind: 9 }))).startsWith("$.resourceSpans[0].scopeSpans[0].spans[0].kind: expected one of"), true);
  assertEquals(at(decodeTraces({ resourceSpans: {} })), "$.resourceSpans: expected an array, found an object");
  assertEquals(at(decodeTraces(null)), "$: expected an object, found null");
  assertEquals(
    at(decodeLogs({ resourceLogs: [{ scopeLogs: [{ logRecords: [{ severityNumber: 0 }] }] }] })),
    "$.resourceLogs[0].scopeLogs[0].logRecords[0].severityNumber: expected a severity number from 1 to 24, found number 0",
  );
  assertEquals(
    at(
      decodeMetrics({
        resourceMetrics: [
          { scopeMetrics: [{ metrics: [{ name: "m", histogram: { dataPoints: [{ explicitBounds: [1], bucketCounts: ["1"] }] } }] }] },
        ],
      }),
    ),
    "$.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram.dataPoints[0].bucketCounts: expected 2 bucket counts, found number 1",
  );
  assertEquals(
    at(decodeMetrics({ resourceMetrics: [{ scopeMetrics: [{ metrics: [{ name: "m", summary: {} }] }] }] })),
    "$.resourceMetrics[0].scopeMetrics[0].metrics[0].sum: expected a sum, a gauge or a histogram, found nothing",
  );
});

proves([FR], "export responses carry a partial success with its rejected count and message", () => {
  assertEquals(encodeResponse("traces", { rejected: 0, errorMessage: "" }), {});
  assertEquals(encodeResponse("logs", { rejected: 2, errorMessage: "too old" }), {
    partialSuccess: { rejectedLogRecords: "2", errorMessage: "too old" },
  });
  assertEquals(value(decodeResponse("metrics", { partialSuccess: { rejectedDataPoints: 3 } })), { rejected: 3, errorMessage: "" });
  assertEquals(value(decodeResponse("traces", {})), { rejected: 0, errorMessage: "" });
  assertEquals(value(decodeResponse("traces", { partialSuccess: {} })), { rejected: 0, errorMessage: "" });
  for (const signal of ["traces", "logs", "metrics"] as const) {
    const r = { rejected: 7, errorMessage: "why" };
    assertEquals(value(decodeResponse(signal, wire(encodeResponse(signal, r)))), r);
  }
  assertEquals(decodeResponse("traces", { partialSuccess: { rejectedSpans: "-1" } }).kind, "err");
});
