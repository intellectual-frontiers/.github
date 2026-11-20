# Feature Specification: ACME certificates by DNS-01

**Spec ID:** 0013-acme
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A harness that serves HTTPS on a host of its own (`stolos` first) needs a certificate from Let's Encrypt, or any CA that speaks ACME (RFC 8555), without a web server answering HTTP-01 and without a program such as certbot or lego to install, pin and keep: a host behind a firewall, or a wildcard name, proves control of its names by DNS-01. IFC TypeScript's runtime (0005-typescript-runtime) gets the certificate itself, with `fetch` and Web Crypto alone: the account, the order, the TXT records at the DNS host (Cloudflare first, any other behind one small interface), the challenges, a certificate signing request built with the kernel's ASN.1 DER, and the certificate. It renews by reading the certificate's own validity. Nothing is added to the package's dependencies.

## The client (runtime)

- **FR-001**: The ACME client MUST take the issue of a certificate from the library `net` (`@intellectual-frontiers/net`, net 0001-net FR-008), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-002**: The ACME client MUST take the signed requests from the library `net` (`@intellectual-frontiers/net`, net 0001-net FR-009), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-003**: The ACME client MUST take the account from the library `net` (`@intellectual-frontiers/net`, net 0001-net FR-010), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-004**: The ACME client MUST take the removal of the TXT records from the library `net` (`@intellectual-frontiers/net`, net 0001-net FR-011), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-005**: The ACME client MUST take the failures as Results from the library `net` (`@intellectual-frontiers/net`, net 0001-net FR-012), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-006**: The ACME client MUST take the certificate signing request from the library `net` (`@intellectual-frontiers/net`, net 0001-net FR-013), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-007**: The ACME client MUST take the validity of a certificate from the library `net` (`@intellectual-frontiers/net`, net 0001-net FR-014), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## The DNS host

- **FR-008**: The ACME client MUST take the DNS host from the library `net` (`@intellectual-frontiers/net`, net 0001-net FR-015), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## Out of scope

- HTTP-01 and TLS-ALPN-01, External Account Binding, revocation, key rollover, account deactivation and ACME Renewal Information (RFC 9773): commons may add them when a harness needs one.
- Keys other than ES256 for the account or the certificate.
- Where a certificate and its keys are kept, and when a harness runs `issue`: the harness's (`stolos`), with the secret store it already has.
- Waiting for a record to be seen by the DNS: the caller's `propagationWait`, which can ask the zone's own servers with `runtime/dns.ts`.

## Edge cases

- Names `example.org` and `*.example.org`: two TXT records at `_acme-challenge.example.org`, each with its own value, both removed, per FR-001 and FR-004.
- An account key given that the server does not know: asked for with `onlyReturnExisting`, then made, per FR-003.
- A server that answers the first `newOrder` with `badNonce`: the order is sent again with the new nonce, and the certificate comes, per FR-002.
- A server that always answers `badNonce`: an error naming `badNonce` after five retries, per FR-002 and FR-005.
- A challenge whose record the CA does not find: the error says the authorization is invalid, and the record is removed, per FR-004 and FR-005.
- The DNS provider throws on the second name: an error with its message, and the first name's record removed, per FR-004 and FR-005.
- A certificate came, and the DNS host was down for the removal: the certificate with one warning, per FR-004.
- An authorization that stays pending: an error when the total wait runs out, per FR-001 and FR-005.
- A certificate that ends in 29 days: `needsRenewal` is true; in 31 days, false, per FR-007.
- Text with no certificate in it: `notAfterOf` gives nothing, and `needsRenewal` is true, per FR-007.
- `setTxt("_acme-challenge.example.com", ...)` on a provider for the zone `example.org`: an error naming both, per FR-008.

## Assumptions

- The CA follows RFC 8555 as Let's Encrypt does: `Replay-Nonce` on every response, `Location` for accounts and orders, problem documents of type `urn:ietf:params:acme:error:*`.
- Web Crypto's ECDSA on P-256, its JWK, SPKI and PKCS #8 forms are in every runtime IFC TypeScript runs on.
- A harness keeps the account key as a secret and gives it back to the next run; a lost key costs a new account and nothing else.
- Tests use a fake CA and a fake Cloudflare and reach neither the real ones.

## Open questions

- **OQ-1**: Whether to read ACME Renewal Information (RFC 9773) where the CA offers it, instead of a fixed number of days.
- **OQ-2**: Which DNS host after Cloudflare a harness needs (Route 53, through the kernel's `sigv4`, is the likely one).

## Key entities

- **Account key** - the ES256 key that signs every request; its JWK is what a harness keeps.
- **Order** - the names asked for, their authorizations and, once finalized, the certificate.
- **Authorization** - the proof of one name, by its `dns-01` challenge.
- **DNS provider** - where TXT records are set and removed.

## Success criteria

- **SC-001**: A harness gets and renews a Let's Encrypt certificate for a name and its wildcard with no program but its own.
- **SC-002**: No TXT record of a challenge is left at the DNS host after a run.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Confidential: no sensitive fact written as a literal
