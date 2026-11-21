# Feature Specification: Scanners: the built-in TLS and header check

**Spec ID:** 0003-scanners-tls
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The check that needs no binary: one TLS handshake and one HEAD request, judged into findings.

## Requirements

- **FR-001**: The headers of one answer MUST give findings for: an address not served over TLS; no strict transport security (over TLS); no content security policy; no `nosniff`; no protection against framing (neither `X-Frame-Options` nor `frame-ancestors`); no referrer policy; a `Server` or `X-Powered-By` header that says its version; and, for each cookie, no `Secure` flag (over TLS) or no `HttpOnly` flag; a page that sets all of it MUST give none.
- **FR-002**: One handshake MUST give findings for a protocol older than TLS 1.2 (high), a certificate that has expired (high) or ends within 30 days (medium), a certificate that is not trusted or is not for the name (medium); a good one MUST give none.
- **FR-003**: The probe MUST send one HEAD request with no body, no credential and no cookie, close the connection after the headers, give the cookies' names and flags and never their values, and give the handshake's protocol, cipher and certificate; a target that does not answer within the time MUST be an error and not a finding.

## Acceptance scenarios

1. **Given** a server that sends no security headers, **When** it is probed, **Then** the findings name each, per FR-001 and FR-003.
2. **Given** a cookie `session=abc; Secure`, **When** the answer is read, **Then** its value is nowhere in the result, per FR-003.

## Out of scope

- Any technique beyond one handshake and one request: those are other scanners.

## Edge cases

- A target, a tool or an answer that is not as required is refused, never run or kept, per the requirements above (FR-001).

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Scanner**, **Pin**, **Run record**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
