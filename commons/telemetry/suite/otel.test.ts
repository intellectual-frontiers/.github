/**
 * Tests of `src/otel.ts`: the attribute and body types admit only what OpenTelemetry allows, trace and span ids are made only from
 * valid bytes or text, `traceparent` and `tracestate` follow W3C Trace Context Level 2 (the specification's edge cases, and round trips
 * property-tested), the configuration of the `OTEL_*` variables with a warning and the default for each value that is not valid,
 * redaction of URLs, tokens, keys and command lines, the limits, and the samplers deciding alike in every process of a trace.
 *
 * @module
 */
import fc from "fast-check";
import {
  type AnyValue,
  type AttributeValue,
  commandShape,
  DEFAULT_LIMITS,
  DEFAULT_SAMPLER,
  extractContext,
  formatTraceparent,
  formatTracestate,
  isCredentialName,
  isSecretFieldName,
  limitAttributes,
  mergeAttributes,
  parseSpanId,
  parseTraceId,
  parseTraceparent,
  parseTracestate,
  ratioThreshold,
  redactAttributes,
  redactText,
  redactUrl,
  resolveConfig,
  SEVERITY,
  severityText,
  shouldSample,
  type SpanContext,
  spanIdFrom,
  traceIdFrom,
  type TraceId,
  traceStateDelete,
  traceStateGet,
  traceStateSet,
} from "../src/otel.ts";
import { toHex } from "@intellectual-frontiers/formats/hex";
import { type Equal, expectType } from "@intellectual-frontiers/core";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const MODEL = "0001-telemetry FR-001";
const IDS = "0001-telemetry FR-002";
const W3C = "0001-telemetry FR-003";
const CONFIG = "0001-telemetry FR-005";
const REDACT = "0001-telemetry FR-006";
const LIMITS = "0001-telemetry FR-007";
const SAMPLING = "0001-telemetry FR-008";
const LAWS = "0005-typescript-runtime FR-014";

function value<T, E>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: E }): T {
  if (r.kind === "err") throw new Error(`expected a success, found ${JSON.stringify(r.error)}`);
  return r.value;
}

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN = "00f067aa0ba902b7";

proves([MODEL, "0005-typescript-runtime FR-014"], "attribute values and bodies admit only the types OpenTelemetry allows", () => {
  const values: readonly AttributeValue[] = ["s", true, 1n, 1.5, Uint8Array.of(1), ["a"], [true], [1n], [1.5]];
  // @ts-expect-error a heterogeneous array is not an attribute value
  const mixed: AttributeValue = ["a", 1];
  // @ts-expect-error a map is not an attribute value
  const map: AttributeValue = { a: "b" };
  // @ts-expect-error null is not an attribute value
  const none: AttributeValue = null;
  // @ts-expect-error a date is not an attribute value
  const date: AttributeValue = new Date(0);
  const body: AnyValue = { a: ["x", 1, { b: true }], c: Uint8Array.of(2) };
  // @ts-expect-error undefined is not a body
  const missing: AnyValue = { a: undefined };
  expectType<Equal<(typeof SEVERITY)["INFO"], 9>>();
  assertEquals(SEVERITY, { TRACE: 1, DEBUG: 5, INFO: 9, WARN: 13, ERROR: 17, FATAL: 21 });
  assertEquals(
    [values.length, typeof mixed, typeof map, none, typeof date, typeof body, typeof missing],
    [9, "object", "object", null, "object", "object", "object"],
  );
  assertEquals([severityText(1), severityText(9), severityText(14), severityText(24)], ["TRACE", "INFO", "WARN2", "FATAL4"]);
});

proves([IDS], "trace and span ids are made from bytes or text, and all zeros are refused", () => {
  assertEquals(value(traceIdFrom(Uint8Array.from({ length: 16 }, (_, i) => i))), "000102030405060708090a0b0c0d0e0f");
  assertEquals(value(spanIdFrom(Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 1))), "0000000000000001");
  assertEquals(traceIdFrom(new Uint8Array(16)).kind, "err");
  assertEquals(spanIdFrom(new Uint8Array(8)).kind, "err");
  assertEquals(traceIdFrom(new Uint8Array(8)).kind, "err");
  assertEquals(parseTraceId(TRACE.toUpperCase()).kind, "err");
  assertEquals(parseSpanId(SPAN).kind, "ok");
  assertEquals(parseSpanId("0000000000000000").kind, "err");
  // @ts-expect-error a plain string is not a TraceId
  const plain: TraceId = TRACE;
  assertEquals(plain, TRACE);
});

proves([W3C], "traceparent version 00 is read exactly, and its edge cases refused", () => {
  const ctx = value(parseTraceparent(`00-${TRACE}-${SPAN}-01`));
  assertEquals<unknown>(ctx, { traceId: TRACE, spanId: SPAN, traceFlags: 1, traceState: [], isRemote: true });
  assertEquals(formatTraceparent(ctx), `00-${TRACE}-${SPAN}-01`);
  const refused = [
    `00-00000000000000000000000000000000-${SPAN}-01`,
    `00-${TRACE}-0000000000000000-01`,
    `00-${TRACE.toUpperCase()}-${SPAN}-01`,
    `00-${TRACE}-${SPAN}-0G`,
    `ff-${TRACE}-${SPAN}-01`,
    `00-${TRACE}-${SPAN}-01-extra`,
    `00-${TRACE}-${SPAN}-1`,
    `0-${TRACE}-${SPAN}-01`,
    `00_${TRACE}-${SPAN}-01`,
  ];
  for (const h of refused) assertEquals(parseTraceparent(h).kind, "err", h);
  assertEquals(value(parseTraceparent(`cc-${TRACE}-${SPAN}-03-what-the-future-holds`)).traceFlags, 3);
  assertEquals(parseTraceparent(`cc-${TRACE}-${SPAN}-01x`).kind, "err");
  assertEquals(value(parseTraceparent(`00-${TRACE}-${SPAN}-ff`)).traceFlags, 3);
  assertEquals(value(parseTraceparent(` 00-${TRACE}-${SPAN}-00 `)).traceFlags, 0);
});

proves([W3C], "tracestate keeps valid members, drops the others, at most 32, newest first", () => {
  assertEquals(parseTracestate("rojo=00f067aa0ba902b7, congo=t61rcWkgMzE ,,bad key=1,tenant@sys=v,UP=x,dup=1,dup=2"), [
    { key: "rojo", value: "00f067aa0ba902b7" },
    { key: "congo", value: "t61rcWkgMzE" },
    { key: "tenant@sys", value: "v" },
    { key: "dup", value: "1" },
  ]);
  const forty = Array.from({ length: 40 }, (_, i) => `k${i}=v${i}`).join(",");
  const kept = parseTracestate(forty);
  assertEquals(kept.length, 32);
  assertEquals(kept[31], { key: "k31", value: "v31" });
  assertEquals(parseTracestate("a=b=c,x= y,z=,w=ok"), [
    { key: "x", value: " y" },
    { key: "w", value: "ok" },
  ]);
  const s = value(traceStateSet(parseTracestate("a=1,b=2"), "b", "3"));
  assertEquals(formatTracestate(s), "b=3,a=1");
  assertEquals(traceStateGet(s, "a"), "1");
  assertEquals(formatTracestate(traceStateDelete(s, "b")), "a=1");
  assertEquals(traceStateSet(s, "B", "1").kind, "err");
  assertEquals(extractContext(`00-${TRACE}-${SPAN}-01`, "a=1")?.traceState, [{ key: "a", value: "1" }]);
  assertEquals(extractContext("garbage", "a=1"), undefined);
});

const lowerHex = (n: number): fc.Arbitrary<string> =>
  fc
    .uint8Array({ minLength: n, maxLength: n })
    .map((b) => toHex(b))
    .filter((h) => !/^0+$/.test(h));

const keyArb = fc.stringMatching(/^[a-z][a-z0-9_*/-]{0,20}(@[a-z][a-z0-9]{0,5})?$/);
const valueArb = fc.stringMatching(/^[!-+\--<>-~]([ !-+\--<>-~]{0,20}[!-+\--<>-~])?$/);

proves([W3C, LAWS], "traceparent and tracestate read back what they write (round trip)", () => {
  fc.assert(
    fc.property(lowerHex(16), lowerHex(8), fc.integer({ min: 0, max: 3 }), (t, s, flags) => {
      const ctx: SpanContext = {
        traceId: value(parseTraceId(t)),
        spanId: value(parseSpanId(s)),
        traceFlags: flags,
        traceState: [],
        isRemote: true,
      };
      assertEquals(value(parseTraceparent(formatTraceparent(ctx))), ctx);
    }),
  );
  fc.assert(
    fc.property(
      fc.uniqueArray(fc.record({ key: keyArb, value: valueArb }, { noNullPrototype: true }), { selector: (m) => m.key, maxLength: 32 }),
      (members) => {
        assertEquals(parseTracestate(formatTracestate(members)), members);
      },
    ),
  );
});

proves([CONFIG], "the configuration comes from the OTEL_ variables, with their defaults", () => {
  const { config, warnings } = resolveConfig({});
  assertEquals(warnings, []);
  assertEquals(config.disabled, false);
  assertEquals(config.exporters.traces, { enabled: true, endpoint: undefined, headers: {}, timeoutMs: 10000 });
  assertEquals(config.sampler, DEFAULT_SAMPLER);
  assertEquals(config.spanBatch, { scheduleDelayMs: 5000, exportTimeoutMs: 30000, maxQueueSize: 2048, maxExportBatchSize: 512 });
  assertEquals(config.logBatch.scheduleDelayMs, 1000);
  assertEquals(config.limits, DEFAULT_LIMITS);
  assertEquals([config.metricExportIntervalMs, config.logLevel], [60000, "info"]);

  const full = resolveConfig({
    OTEL_SDK_DISABLED: "TRUE",
    OTEL_SERVICE_NAME: "build",
    OTEL_RESOURCE_ATTRIBUTES: "team=a%2Cb, service.name=other,deployment.environment=ci",
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector.example.com:4318/",
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "https://logs.example.com/ingest",
    OTEL_EXPORTER_OTLP_HEADERS: "authorization=Bearer%20abc,x-team=a",
    OTEL_EXPORTER_OTLP_METRICS_HEADERS: "x-only=metrics",
    OTEL_EXPORTER_OTLP_TIMEOUT: "2000",
    OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: "500",
    OTEL_TRACES_SAMPLER: "parentbased_traceidratio",
    OTEL_TRACES_SAMPLER_ARG: "0.25",
    OTEL_BSP_MAX_QUEUE_SIZE: "100",
    OTEL_BLRP_SCHEDULE_DELAY: "10",
    OTEL_METRIC_EXPORT_INTERVAL: "1000",
    OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT: "64",
    OTEL_ATTRIBUTE_COUNT_LIMIT: "8",
    OTEL_SPAN_EVENT_COUNT_LIMIT: "4",
    OTEL_SPAN_LINK_COUNT_LIMIT: "2",
    OTEL_LOG_LEVEL: "DEBUG",
    OTEL_BUN: "true",
  });
  assertEquals(full.warnings, []);
  const c = full.config;
  assertEquals(c.disabled, true);
  assertEquals(c.resource, { team: "a,b", "service.name": "build", "deployment.environment": "ci" });
  assertEquals(c.exporters.traces, {
    enabled: false,
    endpoint: "http://collector.example.com:4318/v1/traces",
    headers: { authorization: "Bearer abc", "x-team": "a" },
    timeoutMs: 500,
  });
  assertEquals(c.exporters.logs.endpoint, "https://logs.example.com/ingest");
  assertEquals(c.exporters.metrics.headers, { "x-only": "metrics" });
  assertEquals(c.exporters.metrics.timeoutMs, 2000);
  assertEquals(c.sampler, { kind: "parentbased", root: { kind: "traceidratio", ratio: 0.25 } });
  assertEquals(c.spanBatch.maxQueueSize, 100);
  assertEquals(c.spanBatch.maxExportBatchSize, 100);
  assertEquals(c.logBatch.scheduleDelayMs, 10);
  assertEquals(c.limits, { attributeValueLength: 64, attributeCount: 8, eventCount: 4, linkCount: 2 });
  assertEquals([c.metricExportIntervalMs, c.logLevel], [1000, "debug"]);
  assertEquals(
    resolveConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://h:4318" }).config.exporters.metrics.endpoint,
    "http://h:4318/v1/metrics",
  );
});

proves([CONFIG], "a value that is not valid is a warning and its default; a protocol but http/json disables the export", () => {
  const grpc = resolveConfig({ OTEL_EXPORTER_OTLP_PROTOCOL: "grpc" });
  assertEquals(grpc.warnings.length, 3);
  assertEquals(
    [grpc.config.exporters.traces.enabled, grpc.config.exporters.logs.enabled, grpc.config.exporters.metrics.enabled],
    [false, false, false],
  );
  const one = resolveConfig({ OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "http/protobuf" });
  assertEquals([one.config.exporters.traces.enabled, one.config.exporters.logs.enabled], [true, false]);
  assertEquals(one.warnings, [
    "OTEL_EXPORTER_OTLP_LOGS_PROTOCOL=http/protobuf is not supported (only http/json is); logs are not exported",
  ]);

  const ratio = resolveConfig({ OTEL_TRACES_SAMPLER: "traceidratio", OTEL_TRACES_SAMPLER_ARG: "2" });
  assertEquals(ratio.config.sampler, { kind: "traceidratio", ratio: 1 });
  assertEquals(ratio.warnings, ["OTEL_TRACES_SAMPLER_ARG=2 is not a ratio from 0 to 1; 1 is used"]);

  const bad = resolveConfig({
    OTEL_SDK_DISABLED: "yes",
    OTEL_RESOURCE_ATTRIBUTES: "a=1,broken",
    OTEL_EXPORTER_OTLP_ENDPOINT: "not a url",
    OTEL_EXPORTER_OTLP_TIMEOUT: "-5",
    OTEL_TRACES_SAMPLER: "jaeger_remote",
    OTEL_BSP_MAX_EXPORT_BATCH_SIZE: "5000",
    OTEL_ATTRIBUTE_COUNT_LIMIT: "many",
    OTEL_LOG_LEVEL: "loud",
    OTEL_TRACES_EXPORTER: "zipkin",
    OTEL_EXPORTER_OTLP_HEADERS: "a=%E0%A4%A",
  });
  assertEquals(bad.warnings.length, 10);
  assertEquals(bad.config.disabled, false);
  assertEquals(bad.config.resource, {});
  assertEquals(bad.config.exporters.metrics, { enabled: true, endpoint: undefined, headers: {}, timeoutMs: 10000 });
  assertEquals(bad.config.exporters.traces.enabled, false);
  assertEquals(bad.config.sampler, DEFAULT_SAMPLER);
  assertEquals(bad.config.spanBatch.maxExportBatchSize, 2048);
  assertEquals([bad.config.limits.attributeCount, bad.config.logLevel], [128, "info"]);
  assertEquals(resolveConfig({ OTEL_METRICS_EXPORTER: "none", OTEL_SERVICE_NAME: "" }).config.exporters.metrics.enabled, false);
  assertEquals(resolveConfig({ OTEL_SERVICE_NAME: "" }).config.resource, {});
});

proves([REDACT], "URLs lose their user information and the values of credential parameters", () => {
  assertEquals(redactUrl("https://user:pw@host/x?token=abc&page=2"), "https://REDACTED:REDACTED@host/x?token=REDACTED&page=2");
  assertEquals(redactUrl("https://user@host/"), "https://REDACTED@host/");
  assertEquals(
    redactUrl("https://h/p?X-Amz-Signature=s&X-Amz-Credential=c&sig=1&api_key=k&code=7&q=a+b&password#frag?token=x"),
    "https://h/p?X-Amz-Signature=REDACTED&X-Amz-Credential=REDACTED&sig=REDACTED&api_key=REDACTED&code=REDACTED&q=a+b&password#frag?token=x",
  );
  assertEquals(redactUrl("https://example.com/a/b?page=1&sort=asc"), "https://example.com/a/b?page=1&sort=asc");
  assertEquals(redactUrl("not a url"), "not a url");
  assertEquals(
    [isCredentialName("client_secret"), isCredentialName("monkey"), isCredentialName("page"), isCredentialName("session_id")],
    [true, true, false, true],
  );
});

proves([REDACT], "bearer and basic credentials, private keys and token shapes are replaced in text", () => {
  const basic = btoa("user:secret");
  const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nabc\n-----END RSA PRIVATE KEY-----";
  const text = `curl -H "Authorization: Bearer abc.def-ghi_123" -H "Authorization: Basic ${basic}" https://u:p@h/?token=t\n${pem}\nBasic usage is fine.`;
  assertEquals(
    redactText(text),
    `curl -H "Authorization: Bearer REDACTED" -H "Authorization: Basic REDACTED" https://REDACTED:REDACTED@h/?token=REDACTED\nREDACTED\nBasic usage is fine.`,
  );
  assertEquals(redactText("-----BEGIN PRIVATE KEY-----\ncut short"), "REDACTED");
  assertEquals(redactText(`token ghp_${"a".repeat(36)} here`), "token REDACTED here");
  assertEquals(
    redactAttributes({ password: "p", "url.full": "https://h/?code=1", note: ["Bearer abcdefghij", "plain"], n: 1n }, ["password"]),
    { "url.full": "https://h/?code=REDACTED", note: ["Bearer REDACTED", "plain"], n: 1n },
  );
});

proves([REDACT], "name=value pairs whose name is a secret's lose their values, in prose, JSON, YAML and environment files", () => {
  assertEquals(redactText("password: hunter22 and api_token:abc123"), "password: REDACTED and api_token:REDACTED");
  assertEquals(
    redactText('{"client_secret":"abc def","refresh_token": "r1", "page": 2}'),
    '{"client_secret":"REDACTED","refresh_token": "REDACTED", "page": 2}',
  );
  assertEquals(
    redactText("GITHUB_OAUTH_TOKEN=gho_x\nAWS_SECRET_ACCESS_KEY=wJalr/K7\nAWS_REGION=us-east-1"),
    "GITHUB_OAUTH_TOKEN=REDACTED\nAWS_SECRET_ACCESS_KEY=REDACTED\nAWS_REGION=us-east-1",
  );
  assertEquals(redactText("token='a b c'; appPassword=xyz123, other=1"), "token='REDACTED'; appPassword=REDACTED, other=1");
  assertEquals(redactText("password:\n  next line"), "password:\n  next line");
  for (const kept of ["max_tokens=1024", "token_type: bearer", "status code=200", "key: value", "tokens: 12", "secretName=prod"]) {
    assertEquals(redactText(kept), kept);
  }
  assertEquals(
    [
      isSecretFieldName("X-Amz-Signature"),
      isSecretFieldName("clientSecret"),
      isSecretFieldName("AWS_ACCESS_KEY_ID"),
      isSecretFieldName("passphrase"),
    ],
    [true, true, false, true],
  );
});

proves([REDACT], "an Authorization header keeps its scheme and loses its credential, whatever the scheme", () => {
  assertEquals(redactText(`Authorization: token ghp_${"b".repeat(36)}`), "Authorization: token REDACTED");
  assertEquals(
    redactText(
      "authorization=AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=host;x-amz-date, Signature=5d672d79",
    ),
    "authorization=AWS4-HMAC-SHA256 REDACTED, SignedHeaders=host;x-amz-date, Signature=REDACTED",
  );
  assertEquals(redactText('{"Proxy-Authorization": "Basic dXNlcjpwYXNz"}'), '{"Proxy-Authorization": "Basic REDACTED"}');
  assertEquals(redactText("Authorization: abcdef"), "Authorization: REDACTED");
});

proves([REDACT], "the token formats providers announce, and crypt hashes, are replaced wherever they stand", () => {
  const tokens = [
    `ghs_${"A".repeat(36)}`,
    `github_pat_${"a1_".repeat(20)}`,
    `glpat-${"x".repeat(20)}`,
    `xoxb-${"1234567890-".repeat(2)}abc`,
    `xapp-1-${"A1".repeat(10)}`,
    `ya29.${"a0Af".repeat(10)}`,
    `1//${"0g".repeat(20)}`,
    `GOCSPX-${"k".repeat(28)}`,
    `AIza${"S".repeat(35)}`,
    `cfut_${"c".repeat(40)}`,
    `cfat_${"d".repeat(40)}`,
    `sk-ant-api03-${"e".repeat(40)}`,
    `sk-proj-${"f".repeat(40)}`,
    `sk_live_${"g".repeat(24)}`,
    `rk_test_${"h".repeat(24)}`,
    `npm_${"i".repeat(36)}`,
    `dop_v1_${"0a".repeat(32)}`,
    `dckr_pat_${"j".repeat(27)}`,
    `hf_${"k".repeat(34)}`,
    `lin_api_${"l".repeat(40)}`,
    `ATATT3x${"m".repeat(40)}`,
    `ATBB${"n".repeat(28)}`,
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl",
    "$6$rounds=5000$saltsalt$abcdefghijklmnop",
    "$y$j9T$abcdefgh$ijklmnopqrstuvwx",
    "$2b$12$abcdefghijklmnopqrstuv",
  ];
  for (const t of tokens) assertEquals(redactText(`failed with ${t} (retry)`), "failed with REDACTED (retry)", t);
  for (const kept of ["risk-assessment-of-the-whole-estate-today", "task_live_documentation_here_and_now", "the $6 fee", "1/2 done"]) {
    assertEquals(redactText(kept), kept);
  }
});

proves([REDACT], "the exact secrets a caller names are replaced first, longest first, and one too short to mean anything is kept", () => {
  assertEquals(redactText("sent with s3cr3t-value and s3cr3t", ["s3cr3t", "s3cr3t-value"]), "sent with REDACTED and REDACTED");
  assertEquals(redactText("a is a letter", ["a", ""]), "a is a letter");
  // lower case, so that no secret can be made of the upper-case REDACTED that replaces it
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z0-9]{8,24}$/), fc.string(), fc.string(), (secret, before, after) => {
      assert(!redactText(`${before}${secret}${after}`, [secret]).includes(secret));
    }),
  );
});

proves([REDACT], "a command line keeps the program and its option names alone", () => {
  assertEquals(commandShape(["git", "clone", "--depth", "1", "https://u:p@example.com/r.git"]), ["git", "--depth"]);
  assertEquals(commandShape(["/usr/bin/curl", "--header=Authorization: x", "-sSL", "-u", "user:pw", "--", "--not-an-option"]), [
    "curl",
    "--header",
    "-s",
    "-u",
  ]);
  assertEquals(commandShape(["C:\\Tools\\mysql.exe", "-pSECRET", "-1", "-"]), ["mysql.exe", "-p"]);
  assertEquals(commandShape([]), []);
});

proves([LIMITS], "values are cut to the length limit and attributes beyond the count dropped and counted", () => {
  const limits = { attributeValueLength: 3, attributeCount: 2 };
  assertEquals(limitAttributes({ a: "abcdef", b: ["xyzw", "q"], c: 1n }, limits), {
    attributes: { a: "abc", b: ["xyz", "q"] },
    dropped: 1,
  });
  assertEquals(mergeAttributes({ a: "x", b: true }, { a: "longer", c: 2.5 }, limits), { attributes: { a: "lon", b: true }, dropped: 1 });
  assertEquals(limitAttributes({ e: "😀😀😀😀" }, limits).attributes, { e: "😀😀😀" });
  assertEquals(limitAttributes({ bytes: Uint8Array.of(1, 2, 3, 4) }, limits).attributes, { bytes: Uint8Array.of(1, 2, 3, 4) });
});

proves([SAMPLING, LAWS], "samplers decide by the trace id and the parent alone", () => {
  const t = (hex: string): TraceId => value(parseTraceId(hex));
  const low = t("ffffffffffffffffff00000000000001");
  const high = t("000000000000000000ffffffffffffff");
  const half = { kind: "traceidratio", ratio: 0.5 } as const;
  assertEquals([shouldSample(half, low, undefined), shouldSample(half, high, undefined)], [false, true]);
  assertEquals(ratioThreshold(0.5), 2n ** 55n);
  assertEquals([ratioThreshold(0), ratioThreshold(1)], [2n ** 56n, 0n]);
  const parent = (flags: number): SpanContext => ({
    traceId: low,
    spanId: value(parseSpanId(SPAN)),
    traceFlags: flags,
    traceState: [],
    isRemote: true,
  });
  assertEquals(shouldSample({ kind: "always_off" }, low, parent(1)), false);
  assertEquals(shouldSample({ kind: "always_on" }, low, parent(0)), true);
  assertEquals(shouldSample({ kind: "parentbased", root: { kind: "always_on" } }, low, parent(0)), false);
  assertEquals(shouldSample({ kind: "parentbased", root: { kind: "always_off" } }, low, parent(1)), true);
  assertEquals(shouldSample({ kind: "parentbased", root: { kind: "always_off" } }, low, undefined), false);
  fc.assert(
    fc.property(lowerHex(16), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (hex, a, b) => {
      const id = t(hex);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      // The same id decides the same everywhere, and a trace kept at a ratio is kept at every higher one.
      assertEquals(
        shouldSample({ kind: "traceidratio", ratio: lo }, id, undefined),
        shouldSample({ kind: "traceidratio", ratio: lo }, id, undefined),
      );
      if (shouldSample({ kind: "traceidratio", ratio: lo }, id, undefined))
        assert(shouldSample({ kind: "traceidratio", ratio: hi }, id, undefined));
    }),
  );
  const ids = Array.from({ length: 2000 }, (_, i) =>
    t(`${"1".repeat(18)}${((BigInt(i) * 2n ** 56n) / 2000n).toString(16).padStart(14, "0")}`),
  );
  const kept = ids.filter((id) => shouldSample({ kind: "traceidratio", ratio: 0.25 }, id, undefined)).length;
  assert(kept > 400 && kept < 600, `about a quarter kept, found ${kept}`);
});
