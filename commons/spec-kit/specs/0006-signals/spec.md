# Feature Specification: Signals

**Spec ID:** 0006-signals
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** IFC TypeScript (0005-typescript-runtime) made OpenTelemetry-native: traces, logs and metrics as OpenTelemetry defines them, written in the kernel from the specification itself (no `@opentelemetry/*` package, no runtime's built-in telemetry), sent over OTLP/HTTP with JSON, and the terminal treated as one more consumer of the same signals. What a person reads in a terminal is a rendering of signals that were also recorded or exported, never a separate `console.log`, so that what a run showed and what it recorded cannot disagree. `erga` (its specification 249) and `stolos` (its specifications 049 and 092) each need it; this specification gives them one implementation that runs on Bun, Node and in a browser.

## The data model (kernel)

- **FR-001**: The signals MUST take the OpenTelemetry data model from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-001), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-002**: The signals MUST take trace and span ids from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-002), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-003**: The signals MUST take W3C Trace Context from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-003), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-004**: The signals MUST take OTLP/HTTP JSON from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-004), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-005**: The signals MUST take the configuration from the OpenTelemetry environment variables from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-005), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-006**: The signals MUST take the redaction of what leaves the process from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-006), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-007**: The signals MUST take the limits of an attribute, an event and a link from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-007), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-008**: The signals MUST take the samplers from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-008), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## Typed signals (kernel)

- **FR-009**: The signals MUST take typed signals from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-009), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-010**: The signals MUST take spans that end by their Result from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-010), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-011**: The signals MUST take the clock, the random bytes and the parent of a signal from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-011), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-012**: The signals MUST take the processors of a pipeline from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-012), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-013**: The signals MUST take the aggregation of metrics from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-013), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## The host (runtime)

- **FR-014**: The signals MUST take the OTLP/HTTP JSON exporter from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-014), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-015**: The signals MUST take the probe and the wait at exit from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-015), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-016**: The signals MUST take the journal from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-016), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-017**: The signals MUST take the current span across await from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-017), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-018**: The signals MUST take the runtime's own signals from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-018), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-019**: The signals MUST take the OTLP/HTTP JSON receiver from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-019), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-020**: The signals MUST take the conformance with the OpenTelemetry Collector from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-020), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## The console (kernel and runtime)

- **FR-021**: The signals MUST take the renderer of the console from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-021), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-022**: The kernel MUST take the palette of colour roles and marks from the library `terminal` (`@intellectual-frontiers/terminal`, terminal 0001-terminal FR-003), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-023**: The signals MUST take the cutting of a line to the terminal's width from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-022), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-024**: The signals MUST take the said-once warning of a failed export from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-023), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-025**: The kernel MUST take the terminal emulator for snapshot tests from the library `terminal` (`@intellectual-frontiers/terminal`, terminal 0001-terminal FR-005), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-026**: The signals MUST take the console as the one writer for a person from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-024), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-027**: The signals MUST take what a person reads and when it alarms from the library `telemetry` (`@intellectual-frontiers/telemetry`, telemetry FR-025), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## Out of scope

- OTLP over gRPC or protobuf: JSON over HTTP is what a collector accepts and what the kernel can write with no dependency; protobuf may follow if a collector without JSON must be served.
- Profiles, exemplars and exponential histograms.
- What `erga` and `stolos` declare as their signals: each harness's own registry, made with `defineSignals`.

## Edge cases

- `traceparent: 00-00000000000000000000000000000000-00f067aa0ba902b7-01`: refused (a trace id of zeros), and a new trace started, per FR-002 and FR-003.
- `traceparent` with upper-case hexadecimal: refused, per FR-003.
- `tracestate` with 40 members: the first 32 kept, per FR-003.
- An integer attribute of 2^63 - 1: written as the string `"9223372036854775807"`, never rounded, per FR-001 and FR-004.
- A JSON number `1` where OTLP has a 64-bit integer: read as `1n`, per FR-004.
- `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`: a warning, and nothing exported, per FR-005.
- `OTEL_TRACES_SAMPLER_ARG=2`: a warning, and the ratio 1, per FR-005.
- `OTEL_RESOURCE_ATTRIBUTES=team=a%2Cb`: the value `a,b`, per FR-005.
- `https://user:pw@host/x?token=abc&page=2`: written `https://REDACTED:REDACTED@host/x?token=REDACTED&page=2`, per FR-006.
- `password: hunter22`, `{"client_secret":"abc def"}`, `AWS_SECRET_ACCESS_KEY=...` and `Authorization: token ghp_...` in a log line or a mail: each value written `REDACTED`, its name kept, per FR-006.
- `max_tokens=1024`, `token_type: bearer` and `status code=200`: kept, as their names do not end in a credential's, per FR-006.
- `cfut_` followed by forty characters (a Cloudflare user API token) in an error message: `REDACTED`, per FR-006.
- A journal of 30 days whose `<path>.2` was last written 31 days ago: removed when the journal starts, and its newer files kept, per FR-016.
- `git clone --depth 1 https://...` run by `proc.run`: the span says `git` and `--depth`, nothing else, per FR-006 and FR-018.
- An attribute declared as an integer given a string: does not compile, per FR-009.
- A function that returns `err("not found")`: its span ends `error` with `not found`, per FR-010.
- A collector that answers 503 with `Retry-After: 1` once: the request is sent again, per FR-014.
- A collector that never answers: the command's exit status is its own, the wait at exit is at most a second, and one dim line says the signals were not sent, per FR-014, FR-015 and FR-024.
- A batch queue that is full: the new span is dropped and counted, never blocking the caller, per FR-012.
- A child process run with `TRACEPARENT` set: its spans are children of the span that ran it, per FR-017 and FR-018.
- A line holding `✅ 测试` at a width of 6: cut after `测`, per FR-023.
- Output piped to a file: no escape sequence in it, per FR-021 and FR-026.
- A protobuf body sent to the receiver: 415, per FR-019.

## Assumptions

- The OTLP/JSON encoding and the environment variables are stable in the OpenTelemetry specification; the semantic conventions used (`process.*`, `http.*`, `url.*`, `server.*`, `exception.*`) are the stable ones, and where a convention is still in development its name is used as it stands.
- An OpenTelemetry Collector of the contrib distribution has a file exporter and an OTLP/HTTP receiver that accepts JSON.

## Open questions

- **OQ-1**: Whether to add protobuf once a collector without JSON must be reached.
- **OQ-2**: Whether the browser needs an exporter of its own (`navigator.sendBeacon`) or the `fetch` one is enough.

## Key entities

- **Signal** - a span, a log record or a metric, as OpenTelemetry defines it.
- **Signal kind** - a declared kind of signal with its attributes and its presentation role.
- **Pipeline** - the processors every signal of a process goes to.
- **Rendering** - what the console writes, made from signals by a pure reducer.
- **Journal** - the file of export requests a run wrote.

## Success criteria

- **SC-001**: A harness built on IFC TypeScript sends its traces, logs and metrics to any OpenTelemetry Collector with no package and no runtime flag.
- **SC-002**: Every line a harness shows a person is found, as a signal, in its journal or its collector.
- **SC-003**: The same run gives the same trace on Bun and Node.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
