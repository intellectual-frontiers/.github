# Feature Specification: Telemetry reach

**Spec ID:** 0003-telemetry-reach
**Status:** Draft
**Owner:** if
**Domain:** telemetry

**Input:** A device that is offline for an hour must not lose what it measured, a batch must say who made it and that it was not changed, and the way it travels (a token over HTTPS, mutual TLS, or an SSH forward to the controller's loopback) must not change what it carries. This specification extends Telemetry with a durable export queue behind a port, a signed envelope, the contracts of the client and of the endpoint of OTLP over an SSH forward, a pinned table of semantic conventions with a policy for the ones that are still `Development`, optional protobuf for later, and our own small exporter on Bun for an asset of level 3. It is governed by commons 0041-telemetry-and-reach, and each requirement names the row of its `reuse-audit.md` it relies on. **Every requirement that asks for code is Deferred until after the owner's acceptance run of the command line.**

## Layout

- **FR-001**: Telemetry MUST declare the field `kanon` of its manifest (commons 0033-kanon FR-010) before any requirement below lands, with the pure entries (`otel`, `otlp`, `signals`, `render`, and the new `semconv`, `envelope`, `queue`) as governance and logical units and `host` as the physical unit, and its `verify` MUST run the shared checker; Telemetry MUST NOT import `anyfs`, `grc` or `headless` (they import it), and MUST define a structural port wherever it needs what they hold. Relies on audit rows: A6, A7, A13.

## The durable queue

- **FR-002**: Telemetry MUST define the port `SegmentQueue` (governance, no import of any store): `enqueue(bytes, meta)` giving a `Result` of a `SegmentId` or a `QueueProblem`; `peek(limit)` giving the oldest segments in order; `ack(id)` which succeeds where the segment is already gone; and `stats()` giving the count, the bytes and the age of the oldest; the implementation over a store is anyfs 0011-anyfs-queue. Relies on audit rows: A6.
- **FR-003**: `queueExporter(queue, policy)` MUST be an `Exporter` (`signals.ts`) that encodes each export request as OTLP JSON (`otlp.ts`), enqueues it before it answers success to the processor, and answers failure only where the queue refused it; and `drain(queue, send, policy)` MUST send the oldest segment first, `ack` it only after a 2xx or a partial success that names what was rejected, keep it on 429, 502, 503 and 504 (honouring `Retry-After` as `otlpExporter` does) and on a network failure, and give up on a segment only by the policy of FR-004. Relies on audit rows: A4, A2.
- **FR-004**: The policy `QueuePolicy` MUST be a typed value (`maxBytes`, `maxAgeMs`, `onFull` of `drop-oldest` or `refuse-new`) with a default that drops the oldest and never drops silently: each drop MUST be counted and MUST be reported by a declared signal of ours (`if.telemetry.dropped`, with the signal kind as an attribute) in the next batch that is sent. Relies on audit rows: A4, A6.
- **FR-005**: Redaction (0001-telemetry FR-006) MUST be applied before a batch is enqueued, so that nothing a redaction would remove is at rest in a queue; the queue MUST hold only encoded batches and envelopes, never a credential. Relies on audit rows: A1.
- **FR-006**: The journal (0001-telemetry FR-016) MUST remain a record of what was exported and MUST NOT be read as a queue; both MAY be on at once. Relies on audit rows: A5.
- **FR-007**: A receiver MUST be idempotent over what drain may send twice: a segment is delivered at least once, so the receiver MUST drop a batch whose pair of device and sequence number it has already taken (FR-009). Relies on audit rows: A6, A8.

## The signed envelope

- **FR-008**: Telemetry MUST define the payload type `application/vnd.ifc.telemetry+json` and the statement of an in-toto Statement v1 (`crypto/dsse` `statement`, `STATEMENT_TYPE`) that binds, as its subject, the SHA-256 of the encoded batch, and as its predicate the device id, the signal, the sequence number, the time and the count of signals; the envelope MUST be made through the structural port `EnvelopeSigner` (the shape of `grc` `Signer`: `sign(payloadType, payload, keys)` and `verify(envelope, payloadType, keys)`), so that Telemetry imports no signer. Relies on audit rows: A7, A8.
- **FR-009**: The sequence number of a device MUST grow by one for each batch it makes, MUST be kept with the queue so that it survives a restart, and MUST NOT be reused after a restart or a loss of the queue (a new epoch, a random `epoch` field of the predicate, MUST start a new count). Relies on audit rows: A6, A8.
- **FR-010**: Signing MUST be by the SSHSIG signer of `grc` in the namespace of grc 0017-grc-sshsig-namespace (`ifc-telemetry`), with the key of the device account; verification MUST be the pure verification of `grc` and MUST NOT need `ssh-keygen` on the receiver. The set of trusted keys MUST be given by the caller (the enrolled devices of ssh-server). The exporter MUST NOT introduce a signature format of its own. Relies on audit rows: A7, E7.
- **FR-011**: A receiver policy MUST be `signatures: "required" | "optional"` for each path: it MUST be `required` for a batch that arrives from our exporter by an SSH forward, and MAY be `optional` where a token or a client certificate has already named the sender; a batch of a site relay (whose Collector cannot sign an envelope) MUST be authenticated by a bearer token that the receiver binds to the relay's identity, and MUST NOT be given an `if.asset.id` by its sender; a batch with a signature that does not verify, a payload type that is not this one, or a digest that does not match MUST be refused with a `google.rpc.Status` JSON error that names no key and no payload. Relies on audit rows: A11, A12.

## The endpoint and the forward

- **FR-012**: `otlpReceiver` MUST take an optional `authenticate: (request) => Result<DeviceIdentity, Refusal>` and `identityOfEnvelope`, MUST answer 401 where a policy asks for one and none is given, MUST set the resource attribute `if.asset.id` from the device identity it authenticated (the key that signed the envelope) and overwrite any value the sender wrote, MUST set `if.relay.id` and leave the device keys of a relay's batch (`host.mac`, `host.id`, `host.name`, `host.ip`) as the relay wrote them, unresolved until estate resolves them (integrations 0010-integrations-network-observers), MUST accept `application/vnd.ifc.telemetry+json` beside `application/json`, and MUST hand the sinks the identity beside the batches; 415 for protobuf MUST remain until FR-019. Relies on audit rows: A11.
- **FR-013**: The client of OTLP over an SSH forward MUST be the exporter with the endpoint `http://127.0.0.1:<local port>` and a typed state of the forward (`up`, `down` or `reconnecting`) given by the caller; `down` MUST make an export fail so that it waits in the queue; the exporter MUST NOT open the forward itself in the library entry (a supervisor does, or the program of FR-018), MUST NOT send to an address that is not loopback on this path, and MUST NOT put a credential in a header (the identity is the SSH key and the signature). The argv of the forward is headless 0016-headless-ssh-forward. Relies on audit rows: A13.
- **FR-014**: The endpoint of the forward at the controller MUST be the receiver of FR-012 bound to `127.0.0.1` and one port; `serve` (net) MUST be used as it is, and TLS MUST NOT be asked on a loopback path. Relies on audit rows: A11, H1.
- **FR-015**: Over HTTPS the exporter MUST send a bearer token (`OTEL_EXPORTER_OTLP_HEADERS`, as today, resolved from a credential reference by the caller and never kept in a config file) or, where `net` has it (net 0002-net-client-certificate), a client certificate named by `OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE` and `OTEL_EXPORTER_OTLP_CLIENT_KEY`, which `resolveConfig` MUST read and MUST report as a warning where the runtime cannot use them (UNVERIFIED on Bun and Node 26). Relies on audit rows: A12.

## Semantic conventions

- **FR-016**: Telemetry MUST hold the semantic conventions it uses as one table of data, `SEMCONV`, with an explicit `version` (the exact version of the conventions it was read from), and for each entry the name, the kind (`attribute`, `metric` or `resource`), the type, the unit, the instrument of a metric, the `stability` of the convention (`stable`, `development` or `deprecated`) and a `note`; the version MUST be a field that a test reads, and an entry MUST NOT be added without it. The first entries are the host and system names the mapper of machine-probe 0009-machine-probe-signals uses (`host.id`, `host.name`, `host.arch`, `host.mac`, `host.ip`, `os.type`, `os.version`, `service.name`, `system.uptime`, `system.cpu.load_average.1m`, `.5m`, `.15m`, `system.cpu.time`, `system.memory.usage`, `system.memory.utilization`, `system.filesystem.usage`, `system.filesystem.utilization`, `system.network.io`), each marked UNVERIFIED until read against the version. Relies on audit rows: A10, D5.
- **FR-017**: The names of ours MUST be in the same table under the namespace `if.` (`if.asset.id`, `if.level`, `if.relay.id`, `if.telemetry.dropped`, `if.host.updates.pending`), each marked `ours` so that none can be mistaken for a convention. The policy for `development` conventions MUST be: a signal declaration that names one MUST say so (`uses: "development"`), `signalsCatalog`-like listing MUST name every such use, a change of the table's version MUST be one commit that lists the renames, and a device MUST send the names of the version it was built with while the receiver MAY map a renamed name by a table of renames from one version to the next; a convention that is not in the table MUST be a finding and MUST NOT be sent as if it were one. Relies on audit rows: A10.

## Protobuf (optional, later)

- **FR-018**: Where protobuf is built, `otlp` MAY gain a binary encoding and decoding of the same typed model, the content type `application/x-protobuf`, on the wire reader and writer of the module `protobuf` of Formats (formats 0002-formats-mime-and-protobuf, UNBUILT, optional); until then the receiver MUST refuse it with 415 and the exporter MUST send JSON. JSON MUST remain the default and the interchange of the tests. Relies on audit rows: A9.
- **FR-019**: A pure test MUST show that what is encoded as protobuf and decoded gives the same batch as JSON does (deferred with FR-018). Relies on audit rows: A9.

## Our small exporter (level 3)

- **FR-020**: Telemetry's host MUST give `runExporter(config, deps)`, the program of an asset of level 3: it asks the probe (through `send`), maps the facts and the osQuery rows to signals (machine-probe 0009-machine-probe-signals), makes the batches, signs, enqueues and drains; the clock, the random source, the queue, `send`, the signer and the forward state MUST be given as `deps` (so that a test is exact); it MUST need no Collector, and it MUST run on Bun and on Node 26 on Linux, macOS and Windows. Relies on audit rows: A3, A4, D5.
- **FR-021**: The command `exporter` (`run`, `once`, `status`) MUST be a surface made from one command definition (headless 0001-headless-layers FR-009) that only collects the typed config, calls `runExporter` and renders its typed result; its exit status MUST be 0 where it ran, 1 where a signal could not be queued, 2 for a configuration it refused. Relies on audit rows: A14.
- **FR-022**: The exporter MUST send its own health as declared signals (the length and age of the queue, the last successful drain, the forward state) so that a relay or an asset that is silent is told from one that is well. Relies on audit rows: A4, A6.
- **FR-023**: A receiver MUST take `limits` (`limits.ts`): the largest body it reads (413 past it, by the declared length and by the length read) and a token bucket per source (the asset or the relay it identified, `anonymous` otherwise) with a burst and a rate; a batch over the bucket MUST be answered 429 with `Retry-After` and the code `E-TELEM-RATE-LIMITED`, and MUST NOT be taken, handed to a sink or marked seen, so that a limit never drops a batch already accepted and the sender, whose queue treats 429 as a retry, sends it again. An answer that did not need the body (401, 415, 429) MUST be given after the body is read and dropped, up to 64 KiB, and the connection closed after it where there is more or where the body was refused by its declared size (413): a body left unread on a connection that is kept alive makes the next request on it wait. Relies on audit rows: A11.
- **FR-024**: Retention MUST be a typed policy (`retention.ts`) of days per kind (`raw` 30 and `summary` 395 by default, a summary kept at least as long as the raw signals it sums), `expired` MUST say whether a record is past its period, and a sweep MUST say what it removed and reduced as a `SweepRecord` so that it can be recorded; the sweep is the caller's and the chain of evidence is never given to it. Relies on audit rows: A6.
- **FR-025**: Syslog MUST be read as typed log records (`syslog.ts`): RFC 5424 and RFC 3164 lines into facility, severity, host, application, message and time, a line that is neither kept whole at `INFO` with `syslog.parsed` false, the severity mapped to OpenTelemetry's, and the lines of one host as one log batch whose device key is `host.name` as the line said it. Our own small relay (`host/relay.ts`) MUST take syslog over TCP only, send the lines as OTLP JSON logs to the receiver with the bearer token of the relay and never log the token, keep what it could not send (a 5xx, a 429, a 401 or a 403, or no answer) in memory up to a cap, dropping the oldest and counting them, and send it on the next flush. Relies on audit rows: F1, A11.

## Acceptance scenarios

1. **Given** a receiver that answers 503 for an hour, **When** the exporter makes batches and the receiver comes back, **Then** every batch arrives once in the order made, per FR-003 and FR-007.
2. **Given** a full queue under `drop-oldest`, **When** a batch is queued, **Then** the oldest segment goes, the drop is counted and the next batch carries `if.telemetry.dropped`, per FR-004.
3. **Given** an envelope whose batch was changed after signing, **When** it is verified, **Then** it is refused by the digest, per FR-008 and FR-011.
4. **Given** a batch on the forwarded path with `if.asset.id` of another asset, **When** the receiver takes it, **Then** the value is the authenticated asset's, per FR-012.
5. **Given** the forward is `down`, **When** the exporter exports, **Then** the batch waits in the queue and the process does not fail, per FR-013.
6. **Given** a signal name that is not in `SEMCONV`, **When** the signals are listed, **Then** it is a finding, per FR-017.
7. **Given** fixed clock and random bytes, **When** `runExporter` runs over a recorded probe, **Then** the batches and their sequence numbers are exactly those expected, per FR-020.

## Out of scope

- The Collector of a site (linux-services 0003-linux-services-otel) and what it receives.
- Traces from a device: this version makes metrics and logs.
- gRPC: not carried (0001-telemetry FR-005).

## Edge cases

- A restart with a queue holding segments: they are sent first, in order, per FR-003 and FR-009.
- The clock of a device that is wrong: the envelope carries the time the device says, and the receiver records its own receive time beside it; a skew over a limit is a finding, per FR-008.
- A queue lost with the disk: a new epoch starts, per FR-009.

## Assumptions

- The key of the device account is an Ed25519 key that `ssh-keygen -Y sign` can use (grc 0014-grc-sshsig).

## Open questions

- None here; OQ-1 to OQ-3 of commons 0041-telemetry-and-reach.

## UNVERIFIED

- The OpenTelemetry semantic conventions are partly `Development`; the names above were not read against a pinned version. A client certificate with `fetch` on Bun and on Node 26. That `ssh-keygen` is present on every level 3 asset.

## Key entities

- **SegmentQueue** - the port of a durable queue.
- **QueuePolicy** - the cap by bytes and age and what to do when full.
- **Telemetry envelope** - a DSSE envelope of an in-toto statement that binds the digest of a batch to a device and a sequence number.
- **SEMCONV** - the pinned table of conventions, with its version.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
