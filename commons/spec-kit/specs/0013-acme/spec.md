# Feature Specification: ACME certificates by DNS-01

**Spec ID:** 0013-acme
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A harness that serves HTTPS on a host of its own (`stolos` first) needs a certificate from Let's Encrypt, or any CA that speaks ACME (RFC 8555), without a web server answering HTTP-01 and without a program such as certbot or lego to install, pin and keep: a host behind a firewall, or a wildcard name, proves control of its names by DNS-01. IFC TypeScript's runtime (0005-typescript-runtime) gets the certificate itself, with `fetch` and Web Crypto alone: the account, the order, the TXT records at the DNS host (Cloudflare first, any other behind one small interface), the challenges, a certificate signing request built with the kernel's ASN.1 DER, and the certificate. It renews by reading the certificate's own validity. Nothing is added to the package's dependencies.

## The client (runtime)

- **FR-001**: `runtime/acme.ts` (exported by `runtime/mod.ts` as `acme`) MUST give `issue(o)`, which, given an ACME directory's URL, the names, a `DnsProvider` and optionally an account key, contacts, a wait for propagation and a `fetch`, gets a certificate: it reads the directory, gets the account (FR-003), places an order for the names, and for each authorization that is pending sets a TXT record at `_acme-challenge.<name>` (a wildcard's at its base name) whose value is the base64url SHA-256 of the key authorization (`token.thumbprint`, the thumbprint of RFC 7638); once every record is set it calls the wait for each, answers each `dns-01` challenge, polls each authorization until it is valid, sends the certificate signing request of FR-006 to the order's `finalize`, polls the order until it is valid, and downloads the certificate as `application/pem-certificate-chain`. Polling MUST wait the server's `Retry-After` where it gives one, else a wait that grows, within a total time. The result MUST be the certificate chain as PEM, the certificate's private key as PKCS #8 PEM, the account's private key as a JWK (to keep for the next run) and the certificate's `notAfter`. The module MUST name Let's Encrypt's production and staging directories (`LETS_ENCRYPT`, `LETS_ENCRYPT_STAGING`).
- **FR-002**: Every request but the directory and a new nonce MUST be a JWS in the flattened JSON serialization (`application/jose+json`) signed with ES256, whose protected header carries `alg`, the `nonce` and the `url`, and the account's public JWK until the account exists, its URL (`kid`) after. Each request MUST use a nonce not used before (the last `Replay-Nonce`, or one from `newNonce`), a POST-as-GET MUST send an empty payload, and a `badNonce` refusal MUST be sent again with the nonce it carries, up to five times.
- **FR-003**: Where no account key is given, an ES256 key MUST be made and its account made with the terms agreed and the contacts given; where a key is given, the account MUST be asked for with `onlyReturnExisting` and made only where the server says `accountDoesNotExist`. An account that is not `valid`, or a key that is not an ES256 private JWK, MUST be refused.
- **FR-004**: Every TXT record `issue` set MUST be removed before it returns, whether the certificate came or not. A record that cannot be removed MUST NOT lose a certificate that came: it MUST be a warning of the result, and part of the error where there is one.
- **FR-005**: Every expected failure (the directory unreachable or not ACME's, a refusal by the server, with its problem type and detail, an authorization that is not valid, the wait running out, the DNS provider throwing, the network failing, no names) MUST be a `Result` with one sentence, never an exception, and no sentence MUST carry a token or a private key.
- **FR-006**: The certificate signing request (PKCS #10) MUST be for a new ES256 key made for the certificate, with the first name as its common name (where it is at most 64 characters) and every name as a `dNSName` of a subject alternative name extension requested by `extensionRequest`, signed with ECDSA and SHA-256 (the raw signature Web Crypto gives written as DER), and built with the kernel's `der`.
- **FR-007**: `notAfterOf(pem)` MUST read the `notAfter` of the first certificate in PEM text (UTCTime and GeneralizedTime) with the kernel's `der`, or give nothing where it cannot; `needsRenewal(pem, now, days = 30)` MUST say whether the certificate ends within `days` of `now`, or has ended, or cannot be read.

## The DNS host

- **FR-008**: A `DnsProvider` MUST be two functions, `setTxt(name, value)` and `removeTxt(name, value)`, so that any DNS host can serve. `cloudflareDns({ token, zone, api? })` MUST give one over Cloudflare's API (v4, `https://api.cloudflare.com/client/v4` unless another is given): the zone's id found by its name once, a TXT record added with its content quoted and a short TTL, and removed by the id it was given or, for a record made elsewhere, by its name and content; the token sent only as `Authorization: Bearer`; a name outside the zone, a zone the token cannot see and a refusal by the API each an error that says which, with Cloudflare's own message and never the token.

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
