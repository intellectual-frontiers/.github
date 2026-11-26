# Feature Specification: Formats MIME and protobuf (optional, later)

**Spec ID:** 0002-formats-mime-and-protobuf
**Status:** Draft
**Owner:** if
**Domain:** formats

**Input:** Formats has no message format: there is no MIME, no RFC 5322 and no protobuf wire format in commons. Two optional features of commons 0041-telemetry-and-reach need them later: the store-and-forward of the signed envelope by mail, and the binary encoding of OTLP. Neither is needed by any level and neither is built before the owner decides it. This specification states them so that their place is held. It is governed by commons 0041-telemetry-and-reach (audit rows A9 and H3). **Every requirement here is Deferred and OPTIONAL.**

## Requirements

- **FR-001**: Formats MAY gain a module `mime` that writes and reads one message in the form of RFC 5322 with the headers `From`, `To`, `Date`, `Message-ID` and `Subject`, a body in `text/plain` and one attachment of a media type given by the caller encoded in base64 (RFC 2045) with lines of at most 76 characters, as pure functions that return a `Result`, with a decoder that refuses a header with a line break in a value and a message over a size limit; it MUST NOT send anything. Relies on audit rows: H3.
- **FR-002**: The payload of a message that carries telemetry MUST be the signed envelope of telemetry 0003-telemetry-reach FR-008 as the attachment, with the media type `application/vnd.ifc.telemetry+json`, and the message MUST carry no other copy of the signals in its body. Relies on audit rows: H3, A8.
- **FR-003**: Formats MAY gain a module `protobuf` that reads and writes the wire format (varint, 64-bit, length-delimited and 32-bit fields) as pure functions over bytes returning a `Result`, with limits on the depth and the size of a message, and no code generation; the OTLP mapping is telemetry 0003-telemetry-reach FR-018. Relies on audit rows: A9.
- **FR-004**: A module of this specification MUST NOT be exported before it is built and tested, and until then the module list of Formats MUST be as it is. Relies on audit rows: A9, H3.

## Acceptance scenarios

1. **Given** a built `mime`, **When** a message with an attachment is written and read back, **Then** the attachment's bytes and media type are equal, per FR-001 and FR-002.
2. **Given** a value with a line break, **When** a header is written, **Then** it is refused, per FR-001.
3. **Given** a built `protobuf`, **When** a message is written and read, **Then** the fields are equal, per FR-003.

## Out of scope

- Reading mail, MIME multipart trees beyond one attachment, and S/MIME.

## Edge cases

- A body over the limit: refused, per FR-001.

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Message** - an RFC 5322 message with one attachment.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
