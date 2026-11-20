# Feature Specification: Telemetry

**Spec ID:** 0001-telemetry
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** OpenTelemetry made native to TypeScript, in a package of its own: traces, logs and metrics as OpenTelemetry defines them, written from the specification itself (no `@opentelemetry/*` package, no runtime's built-in telemetry), sent over OTLP/HTTP with JSON, and the terminal treated as one more consumer of the same signals. What a person reads in a terminal is a rendering of signals that were also recorded or exported, never a separate `console.log`, so that what a run showed can be found in what it recorded. The package has a pure entry (the model, the encoding, the signals and the renderer) and a host (the exporter, the journal, the installed pipeline and the console); it depends on Core, Formats, Terminal and System, and it is the library of what 0006-signals specified inside IFC TypeScript.

## The data model

- **FR-001**: `otel` MUST give the OpenTelemetry data model as types: a resource and an instrumentation scope with attributes; a span (trace id, span id, parent span id, trace state, name, kind `internal | server | client | producer | consumer`, start and end time in nanoseconds since the epoch as `bigint`, attributes, events, links, status `unset | ok | error` with a description for an error, and the counts of what was dropped); a log record (time, observed time, severity number 1 to 24 and its text, a body, attributes, trace and span id); and metrics (sum, gauge and histogram data points with their temporality). An attribute value MUST be a string, a boolean, an integer (`bigint`), a double (`number`), bytes, or a homogeneous array of one of those; a body MAY also be a map. No value of another type MUST be representable.
- **FR-002**: A trace id (32) and a span id (16 lower-case hexadecimal digits) MUST be brands, made only by a validating function or from bytes a caller gives (`traceIdFrom(random(16))`), so that the kernel has no source of randomness of its own; an id of all zeros MUST be refused, as W3C Trace Context requires.
- **FR-003**: Telemetry MUST read and write W3C Trace Context (Level 2) `traceparent` and `tracestate`: version `00` exactly (lower-case hexadecimal, the lengths, ids not all zeros, the `sampled` flag), version `ff` refused, a later version read by its first four fields; `tracestate` of at most 32 members with keys and values of the grammar, a member that breaks it dropped rather than the header, written newest member first.
- **FR-004**: Telemetry MUST encode an export request of traces, logs or metrics as OTLP/HTTP JSON as the OTLP specification defines it (camel-case field names, trace and span ids as hexadecimal, 64-bit integers as decimal strings, enumerations as integers, bytes as base64, resource and scope grouping) and decode such a request back to the same values, with the failure as a `Result` naming the path. Decoding MUST accept a 64-bit integer as a JSON number or a string, and MUST ignore a field it does not know. Encoding then decoding MUST give back what was encoded.
- **FR-005**: Telemetry MUST resolve the configuration from the OpenTelemetry environment variables alone, given as a record (the kernel reads no environment): `OTEL_SDK_DISABLED`, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` (percent-decoded), `OTEL_EXPORTER_OTLP_ENDPOINT` (with `/v1/traces`, `/v1/logs` and `/v1/metrics` appended) and its per-signal forms (used as given), `OTEL_EXPORTER_OTLP_HEADERS` and per-signal headers, `OTEL_EXPORTER_OTLP_TIMEOUT`, `OTEL_EXPORTER_OTLP_PROTOCOL` (`http/json`; any other protocol is a warning and no export), `OTEL_TRACES_SAMPLER` and its argument, `OTEL_BSP_*`, `OTEL_BLRP_*`, `OTEL_METRIC_EXPORT_INTERVAL`, `OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT`, `OTEL_ATTRIBUTE_COUNT_LIMIT`, `OTEL_SPAN_EVENT_COUNT_LIMIT`, `OTEL_SPAN_LINK_COUNT_LIMIT` and `OTEL_LOG_LEVEL`. A value that is not valid MUST be a warning in the result and its default used, as the OpenTelemetry specification asks; no vendor's variable (`OTEL_BUN`) MUST be read.
- **FR-006**: Before any signal leaves the process it MUST be redacted: an attribute declared secret MUST never be written; the user information of a URL and the value of a query parameter whose name says it is a credential (`token`, `key`, `secret`, `password`, `signature`, `code`, and the like) MUST be replaced by `REDACTED`; a bearer token, a basic credential and a private key block found in a value MUST be replaced; and a process's arguments MUST be kept as the program and its option names alone, never their values. Text MUST be redacted by one function, the same for signals and for a message a harness sends (a mail, a notification), so that what may not be exported may not be mailed either: besides the above it MUST replace the value of a `name=value` or `name: value` pair, quoted or bare, in prose, JSON, YAML or an environment file, whose name ends in `token`, `secret`, `password`, `passwd`, `passphrase`, `apikey`, `accesskey`, `secretkey`, `privatekey`, `credential` or `signature` (case, `-`, `_` and `.` ignored), the credential of an `Authorization` header with any scheme, the token formats that announce themselves (GitHub, GitLab, Slack, Google, Cloudflare, Anthropic, OpenAI, Stripe, npm, DigitalOcean, Docker, Hugging Face, Linear, Atlassian, JSON Web Tokens) and crypt password hashes (`$6$`, `$y$`, `$2b$`), and every exact secret of four characters or more that its caller names (the credential in use).
- **FR-007**: The limits of FR-005 MUST be applied as the OpenTelemetry specification applies them: a string longer than the value limit cut to it, an attribute, event or link beyond the count dropped and counted in the span's dropped counts.
- **FR-008**: Telemetry MUST sample by the samplers OpenTelemetry names (`always_on`, `always_off`, `traceidratio` decided by the trace id alone, and `parentbased_*` following the parent's `sampled` flag), so that every process of a trace samples it alike.

## Typed signals

- **FR-009**: `signals` MUST give `defineSignals`, a registry where each kind of signal is declared once with what it is (a span, a log event, or a counter, up-down counter, gauge or histogram), its attributes and their types, a log event's severity, a metric's unit, and its presentation role (`step`, `detail`, `progress`, `result`, `hint`, `warning`, `error`, or `none`). Emitting a kind that is not declared, or an attribute of the wrong type or a missing required attribute, MUST NOT compile.
- **FR-010**: `span(kind, attributes, fn)` MUST start a span as the child of the current one, run `fn` with a handle (attributes, events, child spans), and end it with the status its `Result` gives: `ok` for `Ok`, `error` with the error's description for `Err`; a function that throws MUST end its span with an `exception` event (`exception.type`, `exception.message`, `exception.stacktrace`) and `error`, and the exception MUST be thrown on. A span MUST end exactly once, and a span that is never ended MUST be ended as `error` by `shutdown`.
- **FR-011**: The tracer, logger and meter MUST take their clock, their source of random bytes and their parent context from the caller, so that a test of a span tree is exact (the same ids, times and order every run).
- **FR-012**: A pipeline MUST hand every finished span, every log record and every metric collection to each of its processors in the order they were made: an in-memory processor (for tests and the renderer), a simple processor and a batch processor (at most `maxQueueSize` waiting, sent in batches of `maxExportBatchSize` at `scheduleDelay`, what does not fit dropped and counted). `forceFlush` and `shutdown` MUST resolve within the time they are given, whatever an exporter does.
- **FR-013**: Metrics MUST be aggregated as OpenTelemetry defines them, with cumulative temporality: a counter that refuses a negative increment, an up-down counter, a gauge keeping the last value, and a histogram with OpenTelemetry's default explicit bucket bounds or bounds the kind declares, keeping count, sum, minimum and maximum; one series for each distinct set of attributes.

## The host

- **FR-014**: `host/otel` MUST export over OTLP/HTTP JSON with `fetch`: `POST` to the endpoint with `content-type: application/json` and the configured headers, a retry on 429, 502, 503 and 504 after the server's `Retry-After` or a growing wait, within the export timeout, a partial success read and counted. An export MUST never throw to its caller nor fail the command that made the signals, and a failure MUST become one warning signal, said once per run.
- **FR-015**: Where no endpoint is configured the runtime MUST probe `http://localhost:4318` for at most 150 milliseconds before the first export and export nothing when nothing answers; at exit the runtime MUST wait at most one second for what is left to be sent, then give up and say so.
- **FR-016**: Telemetry's host MUST keep a journal when asked: every export request also written as one line of OTLP JSON to a file, which is rotated when it passes its size limit, keeping a given number of older files, and, where a maximum age is given, a journal file last written longer ago than that removed when the journal starts and at each rotation, so that a journal keeps, say, 30 days; a journal is what a run recorded even with no collector.
- **FR-017**: The current span MUST be carried implicitly across `await` by `AsyncLocalStorage` (`node:async_hooks`), and a process MUST take its parent from the `TRACEPARENT` and `TRACESTATE` environment variables when they are set, as the OpenTelemetry specification for environment carriers defines.
- **FR-018**: The runtime's own modules (`system`, the HTTP client and `serve`) MUST make signals: `proc.run` a `client` span for each program run (`process.executable.name`, the option names of FR-006, `process.exit.code`) that gives the program `TRACEPARENT` and `TRACESTATE`; the HTTP client a `client` span (`http.request.method`, `url.full` redacted, `server.address`, `http.response.status_code`) that sends `traceparent`; and `serve` a `server` span whose parent is the request's `traceparent`. These MUST be no-ops when no pipeline is installed.
- **FR-019**: Telemetry's host MUST give an OTLP/HTTP JSON receiver over `serve` (`/v1/traces`, `/v1/logs`, `/v1/metrics`): a request decoded by FR-004 handed to a sink, 415 for any content type but JSON, 400 with the path for a request that does not decode, and the success body OTLP defines.
- **FR-020**: CI MUST send the suite's OTLP to a pinned OpenTelemetry Collector (its version and SHA-256 in commons' pins) whose file exporter writes what it received, and the test MUST find every span, log record and metric sent, with the same ids, attributes and values.

## The console

- **FR-021**: `render` MUST be a pure reducer from a state, a signal and the time to a new state and the frames to write, in five modes: `attended` (a live region of the spans in progress, nested by parent, redrawn in place), `plain` (lines appended, no escape sequence, for a log or a pipe), `quiet` (only warnings, errors and results), `silent` (nothing) and `json` (one OTLP JSON log record per line). Only a signal whose kind has a presentation role other than `none` MUST be shown.
- **FR-022**: A line MUST be cut to the terminal's width by display width (a wide character or emoji counts two columns, an escape sequence none), never wrapped inside the live region; a span in progress MUST show its elapsed time, and its progress where it has one.
- **FR-023**: Where an export failed or no collector answered, the console MUST say so once, dimmed, at the end of the run, and nowhere else.
- **FR-024**: `host/console` MUST be the only code of IFC TypeScript that writes for a person to standard output or standard error: it subscribes to the pipeline, chooses the mode from the terminal and the environment (`attended` at a terminal, `plain` otherwise, `json` where asked), writes the frames, and on an uncaught exception or unhandled rejection records an error log record with the exception, renders it, flushes, and exits with status 1.
- **FR-025**: What a person reads MUST say whether anything is wrong, and only then alarm: ❌ (failed) and ⚠️ (warning) are problems; ⏳ (pending) is something not set up yet, expected until someone does it; ⚡ (action) is a step that is the person's to take (send a change, back up, approve), with the command, where nothing is wrong. A pending or an action is never counted as a warning or a failure, never fails a run, and a signal kind declares it with the roles `pending` and `action`, which the renderer marks ⏳ and ⚡. Every command line of Intellectual Frontiers closes a run the same way: the problems under "Needs attention", the actions under "Your move", the pending under "Not set up yet", in that order.

## The package

- **FR-026**: Telemetry MUST depend on Core, Formats, Terminal and System alone, MUST have a pure entry that names no host global and reads no environment (`otel`, `otlp`, `signals`, `render`) and a host entry that holds the exporter, the pipeline and the console, and MUST be published as compiled modules with their declarations as `@intellectual-frontiers/telemetry` (commons 0032-lifting-libraries FR-005, FR-013), importable by Node 26 and by Bun from `node_modules`, with `@types/node` as a peer.

## Acceptance scenarios

1. **Given** a `traceparent` with a trace id of zeros, **When** it is read, **Then** it is refused and a new trace is started, per FR-002 and FR-003.
2. **Given** a span whose function returns `err("not found")`, **When** it ends, **Then** its status is `error` with `not found`, per FR-010.
3. **Given** a collector that answers 503 with `Retry-After: 1` once, **When** a batch is exported, **Then** the request is sent again and nothing throws, per FR-014.
4. **Given** a span tree from a fixed clock and fixed random bytes, **When** it is exported as OTLP JSON and read back, **Then** every span, log record and metric is found with the same ids and values, per FR-004 and FR-020.
5. **Given** output piped to a file, **When** the console writes, **Then** there is no escape sequence in it, per FR-021 and FR-024.
6. **Given** the packed package installed under `node_modules`, **When** Node 26 and Bun import each entry, **Then** both give the same decoded request, per FR-026.

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
- A collector that never answers: the command's exit status is its own, the wait at exit is at most a second, and one dim line says the signals were not sent, per FR-014, FR-015 and FR-023.
- A batch queue that is full: the new span is dropped and counted, never blocking the caller, per FR-012.
- A child process run with `TRACEPARENT` set: its spans are children of the span that ran it, per FR-017 and FR-018.
- A line holding `✅ 测试` at a width of 6: cut after `测`, per FR-022.
- Output piped to a file: no escape sequence in it, per FR-021 and FR-023.
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
