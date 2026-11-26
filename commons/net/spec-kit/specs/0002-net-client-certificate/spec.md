# Feature Specification: Net client certificate and SMTP later

**Spec ID:** 0002-net-client-certificate
**Status:** Draft
**Owner:** if
**Domain:** net

**Input:** OTLP over HTTPS can be authenticated by a token, which works today, or by a client certificate (mutual TLS), which Net cannot do: `connectTls` and `listenTls` take no client certificate and `serve` has no TLS. Store and forward by SMTP is optional and later, and nothing of SMTP exists in commons. This specification adds the client certificate and states, as optional and later, the SMTP submission client. It is governed by commons 0041-telemetry-and-reach (audit rows A12, H1, H3). **Every requirement that asks for code is Deferred until after the owner's acceptance run of the command line.**

## Client certificate

- **FR-001**: `ConnectTlsOptions` MUST gain `clientCert` and `clientKey` (PEM text, both or neither), and `connectTls` MUST present them; a key without a certificate, or the reverse, MUST be a typed error, and the key MUST NOT appear in any error, log or span. Relies on audit rows: A12.
- **FR-002**: `ListenTlsOptions` MUST gain `clientCa` (PEM roots) and `requestClientCert` of `none`, `request` or `require`, and a `Conn` of a listener MUST say the verified subject of the client's certificate where there is one. Relies on audit rows: A12.
- **FR-003**: `ServeOptions` MUST gain an optional `tls` of the cert, the key and the client options of FR-002, so that `serve` can answer HTTPS and say the verified subject to the handler in `ServeInfo`; without it `serve` MUST behave as it does. Relies on audit rows: A12, A11.
- **FR-004**: `liveTransport` (the HTTP client) MUST accept the client certificate and key for the origins it is given, and MUST refuse to send them to any other origin. Relies on audit rows: A12.
- **FR-005**: The behaviour on Bun and on Node 26 MUST be the same or each difference MUST be a typed `unsupported` error naming the runtime (UNVERIFIED for `fetch` with a client certificate on both). Relies on audit rows: A12.

## SMTP (optional, later)

- **FR-006**: Where SMTP is built, `net/smtp` MAY be a client of submission (RFC 6409 on port 587 with STARTTLS, or implicit TLS on 465) over `connect` and `connectTls`, authenticating with a credential given by the caller, sending one message made by formats 0002-formats-mime-and-protobuf and giving a typed result (`accepted`, `rejected` with the code and the first line of the reply, `temporary`), with the limits of size and time of a connection; it MUST NOT be built before the owner decides it, MUST NOT be needed by any level of commons 0041-telemetry-and-reach, and MUST NOT receive mail. Relies on audit rows: H3, F2.
- **FR-007**: A UDP listener MUST NOT be made in Net for this work: the datagram protocols (syslog, SNMP traps, NetFlow) are received by the Collector of a site relay (linux-services 0003-linux-services-otel). Relies on audit rows: H1.

## Acceptance scenarios

1. **Given** a certificate with no key, **When** `connectTls` is asked, **Then** it is a typed error, per FR-001.
2. **Given** a listener that requires a client certificate, **When** a client without one connects, **Then** the handshake fails and no handler runs, per FR-002.
3. **Given** a handler of `serve` with `tls`, **When** a client with a certificate calls, **Then** the handler sees its subject, per FR-003.
4. **Given** a certificate given for one origin, **When** a request goes to another, **Then** it is refused, per FR-004.

## Out of scope

- Issuing certificates: the ACME module and the controller's own authority are other specifications.

## Edge cases

- A certificate that has expired: the handshake fails with the reason of the runtime, per FR-001.

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Client certificate** - the certificate and key a client presents to be known.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
