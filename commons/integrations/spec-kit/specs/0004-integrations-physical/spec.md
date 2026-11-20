# Feature Specification: Integrations physical adapters

**Spec ID:** 0004-integrations-physical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The physical layer is the edge where effects live: the read port of a system over Net's transport with the read-only guard, backoff on 429 and 503, paging by link or cursor and signing; the digest of what was fetched; and the transports of exchange (HTTPS, the token request of OAuth2 backend services in the manner of SMART, MLLP framing). SNMPv3 and UniFi pinned TLS are Planned adapters of the network class; SFTP, AS2 and AS4 are Planned transports.

## Observation over HTTP

- **FR-001**: The HTTP read port MUST be made on Net's transport as `withBackoff(readOnly(transport, tokenEndpoints))` (signed first where a SigV4 auth is given), so that any request that is not a safe method, or a POST to a declared token endpoint, is refused without being sent.
- **FR-002**: The read port MUST page by the `Link` header or by a cursor in the body, MUST map a status to a typed failure (`denied` for 401 and 403, `not-found`, `rate-limited`, `server`, `decode`, `network`), and a failure MUST name the path and never the query, a header or a body.
- **FR-003**: `sha256Of` MUST give the SHA-256 of a text as the library's digest, so that a copy of a connector can be verified against its pin.

## Transports of exchange

- **FR-004**: The HTTPS transport MUST POST the document with a bearer secret and give a status of 400 or more as `rejected` with the status only; what a partner answers is a payload and MUST NOT be in a failure.
- **FR-005**: The token request of backend services MUST sign an assertion through a port (the key never leaves it), post the client credentials form (`grant_type`, `client_assertion_type`, `client_assertion`, `scope`) and read `access_token` into a secret, and a refusal, a bad status or a malformed answer MUST be a typed failure.
- **FR-006**: MLLP framing MUST wrap a message in the start block, the end block and a carriage return and read it back, and MUST refuse a text that is not one whole frame.

## Acceptance scenarios

1. **Given** a read port and a request to `DELETE`, **When** it is sent, **Then** it is refused and the transport has seen nothing, per FR-001.
2. **Given** a 429 answer then a 200, **When** a read is made, **Then** it is retried and succeeds, per FR-001.

## Out of scope

- Planned: SNMPv3 (authPriv, GET and GETNEXT only) and UniFi pinned TLS adapters of the network class; SFTP, AS2, AS4 and a socket MLLP listener.

## Edge cases

- A URL with a token in its query that fails: the failure names the path only, per FR-002.

## Assumptions

- Net owns retries, paging and signing; this layer composes them.

## Open questions

- None.

## Key entities

- **Read port** - the logical port made on a transport.

## Success criteria

- **SC-001**: Nothing of observation can write to a system, and no failure says a credential or a payload.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
