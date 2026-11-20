# Feature Specification: Net

**Spec ID:** 0001-net
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The network as one typed library, in a package of its own: a download that fails now and works in a minute, an HTTP server over the web's `Request` and `Response`, typed HTTP clients with a live or a recorded transport, TCP and TLS, DNS records and the certificate of a name by ACME's DNS-01 challenge, on `fetch`, `node:` builtins and Web Crypto alone, with no package of the network added. It depends on Core, Formats, Crypto, System and Telemetry (which traces its requests and its server), runs the same on Bun and on Node 26, and is the library of what 0005-typescript-practice and 0013-acme specified inside IFC TypeScript.

## Downloads

- **FR-001**: `net` MUST download over `fetch`: classify a failure (DNS, connection, broken, timeout, TLS, certificate, an HTTP status), retry only where another try can help, waiting longer each time up to a cap or as long as the server's `Retry-After` asks (no longer than the cap), say and keep every retry, resume a `.part` file with `Range`, and keep a file only where its SHA-256 is the one expected.

## The server

- **FR-002**: `serve` MUST serve HTTP on `node:http` with a handler from a web `Request` to a web `Response`: streamed bodies both ways, every `set-cookie` kept, `HEAD` without a body, a handler that throws answered by `onError` (500 by default), a client that goes away aborting `request.signal`, `127.0.0.1` unless another address is asked for, `AddrInUse` where the port is taken, and a shutdown by call or by abort signal.

## HTTP clients

- **FR-003**: `http-client` MUST give typed HTTP clients a transport, live over `fetch` or recorded (answering by method and URL, and naming a request it has no exchange for), that refuses a request carrying a credential before it is sent unless made to allow credentials; a read-only guard; backoff on 429 and 503 that waits as long as `Retry-After` asks, up to a cap; a JSON read decoded at the boundary whose failures are typed (refused, network, denied for 401 and 403, another status, a decode) and are said without any header or body; every item of a list paged by `Link` or by a cursor; and the JSON5 text a recorded exchange is kept in, read back as the same exchange.
- **FR-004**: The read-only guard of FR-003 MUST take, besides the token endpoints, a predicate over a whole `POST` request (method, URL, headers and body) that says it only reads (a GraphQL query, a search, a JSON API's `Describe` and `Get` actions), and MUST let through only those; `PUT`, `PATCH` and `DELETE`, and every other `POST`, MUST still be refused without being sent.
- **FR-005**: The HTTP clients MUST be able to sign each request of a transport by crypto's AWS Signature Version 4 (`withSigV4`, crypto 0001-crypto FR-004), with the time read when the request is sent; a request it signed carries a credential, so the live transport MUST still refuse it unless made to allow credentials (FR-003).

## TCP and DNS

- **FR-006**: `tcp` MUST listen for and make TCP connections, plain and over TLS: a listener on an address (port 0 for a free one) that gives its address and its connections as an async iterable and closes by call, abort signal or `using`; a connection with its local and remote addresses, a web `ReadableStream` and `WritableStream`, and `close`; a TLS listener from a certificate and key in PEM, and a TLS connection that checks the server's certificate against the system's roots or the ones given.
- **FR-007**: `dns` MUST resolve `A`, `AAAA`, `CNAME`, `MX`, `NS`, `TXT` and `SRV` records, each a `Result` whose error says whether the name does not exist, has no such record, or could not be asked.

## ACME certificates by DNS-01

- **FR-008**: `acme` MUST give `issue(o)`, which, given an ACME directory's URL, the names, a `DnsProvider` and optionally an account key, contacts, a wait for propagation and a `fetch`, gets a certificate: it reads the directory, gets the account (FR-010), places an order for the names, and for each authorization that is pending sets a TXT record at `_acme-challenge.<name>` (a wildcard's at its base name) whose value is the base64url SHA-256 of the key authorization (`token.thumbprint`, the thumbprint of RFC 7638); once every record is set it calls the wait for each, answers each `dns-01` challenge, polls each authorization until it is valid, sends the certificate signing request of FR-013 to the order's `finalize`, polls the order until it is valid, and downloads the certificate as `application/pem-certificate-chain`. Polling MUST wait the server's `Retry-After` where it gives one, else a wait that grows, within a total time. The result MUST be the certificate chain as PEM, the certificate's private key as PKCS #8 PEM, the account's private key as a JWK (to keep for the next run) and the certificate's `notAfter`. The module MUST name Let's Encrypt's production and staging directories (`LETS_ENCRYPT`, `LETS_ENCRYPT_STAGING`).
- **FR-009**: Every request but the directory and a new nonce MUST be a JWS in the flattened JSON serialization (`application/jose+json`) signed with ES256, whose protected header carries `alg`, the `nonce` and the `url`, and the account's public JWK until the account exists, its URL (`kid`) after. Each request MUST use a nonce not used before (the last `Replay-Nonce`, or one from `newNonce`), a POST-as-GET MUST send an empty payload, and a `badNonce` refusal MUST be sent again with the nonce it carries, up to five times.
- **FR-010**: Where no account key is given, an ES256 key MUST be made and its account made with the terms agreed and the contacts given; where a key is given, the account MUST be asked for with `onlyReturnExisting` and made only where the server says `accountDoesNotExist`. An account that is not `valid`, or a key that is not an ES256 private JWK, MUST be refused.
- **FR-011**: Every TXT record `issue` set MUST be removed before it returns, whether the certificate came or not. A record that cannot be removed MUST NOT lose a certificate that came: it MUST be a warning of the result, and part of the error where there is one.
- **FR-012**: Every expected failure (the directory unreachable or not ACME's, a refusal by the server, with its problem type and detail, an authorization that is not valid, the wait running out, the DNS provider throwing, the network failing, no names) MUST be a `Result` with one sentence, never an exception, and no sentence MUST carry a token or a private key.
- **FR-013**: The certificate signing request (PKCS #10) MUST be for a new ES256 key made for the certificate, with the first name as its common name (where it is at most 64 characters) and every name as a `dNSName` of a subject alternative name extension requested by `extensionRequest`, signed with ECDSA and SHA-256 (the raw signature Web Crypto gives written as DER), and built with Formats' `der`.
- **FR-014**: `notAfterOf(pem)` MUST read the `notAfter` of the first certificate in PEM text (UTCTime and GeneralizedTime) with Formats' `der`, or give nothing where it cannot; `needsRenewal(pem, now, days = 30)` MUST say whether the certificate ends within `days` of `now`, or has ended, or cannot be read.
- **FR-015**: A `DnsProvider` MUST be two functions, `setTxt(name, value)` and `removeTxt(name, value)`, so that any DNS host can serve. `cloudflareDns({ token, zone, api? })` MUST give one over Cloudflare's API (v4, `https://api.cloudflare.com/client/v4` unless another is given): the zone's id found by its name once, a TXT record added with its content quoted and a short TTL, and removed by the id it was given or, for a record made elsewhere, by its name and content; the token sent only as `Authorization: Bearer`; a name outside the zone, a zone the token cannot see and a refusal by the API each an error that says which, with Cloudflare's own message and never the token.

## Signals and the package

- **FR-016**: WHEN a pipeline of Telemetry is installed, the HTTP client MUST make a `client` span for each request (`http.request.method`, `url.full` redacted, `server.address`, `http.response.status_code`) that sends `traceparent`, and `serve` a `server` span whose parent is the request's `traceparent`, as Telemetry requires of the runtime's own modules (commons 0001-telemetry FR-018); where none is installed they MUST make no span and send no `traceparent`; an OTLP receiver over `serve` MUST make no span of its own, so that a pipeline exporting to it does not feed itself (commons 0001-telemetry FR-019).
- **FR-017**: Net MUST depend on Core, Formats, Crypto, System and Telemetry alone, MUST name `node:` builtins and no vendor's global, and MUST be published as compiled modules with their declarations as `@intellectual-frontiers/net` (commons 0032-libraries-by-concern FR-005, FR-013), one entry for the package and one for each module, importable by Node 26 and by Bun from `node_modules`, with `@types/node` as a peer.

## Acceptance scenarios

1. **Given** a server that answers 503 with `Retry-After: 120` when the cap is 30 seconds, **When** a download is retried, **Then** the wait is 30 seconds, per FR-001.
2. **Given** a handler of web `Request`s, **When** `serve` runs it on port 0, **Then** the system's free port is in `addr` and a `HEAD` is answered with no body, per FR-002.
3. **Given** a transport that refuses credentials, **When** a request carries an `Authorization` header, **Then** it is refused before it is sent and the header's value is never said, per FR-003.
4. **Given** a name and its wildcard, **When** `acme.issue` runs against a fake CA, **Then** two TXT records are set at `_acme-challenge.<name>` and both are removed, per FR-008 and FR-011.
5. **Given** a collector pipeline installed, **When** the client calls the server, **Then** the server's span is the child of the client's, per FR-016.
6. **Given** the packed package installed under `node_modules`, **When** Node 26 and Bun import each entry, **Then** both give the same value, per FR-017.

## Out of scope

- HTTP-01 and TLS-ALPN-01, External Account Binding, revocation, key rollover, account deactivation and ACME Renewal Information (RFC 9773): commons may add them when a harness needs one.
- Keys other than ES256 for the account or the certificate.
- Where a certificate and its keys are kept, and when a harness runs `issue`: the harness's, with the secret store it already has.
- Waiting for a record to be seen by the DNS: the caller's `propagationWait`, which can ask the zone's own servers with `dns`.

## Edge cases

- A request with an `Authorization` header to a transport that refuses credentials: refused, and the header's value never said, per FR-003.
- A server that answers 503 with `Retry-After: 120` when the cap is 30 seconds: the wait is 30 seconds, per FR-001.
- A download whose SHA-256 is not the one expected: the `.part` file is removed and nothing is kept, per FR-001.
- Port 0: the system picks a free port, and `addr` gives it, per FR-002.
- A TLS connection to a server whose certificate a given root did not sign: refused, per FR-006.
- `resolveDns("nonexistent.example", "MX")`: an `Err` saying the name does not exist, per FR-007.
- A `POST` to a GraphQL endpoint holding a `mutation`, where the predicate lets through only `query`: refused, never sent, per FR-004.
- A signed request sent by the live transport made with its default options: refused, the `Authorization` header named and its value never said, per FR-003 and FR-005.
- Names `example.org` and `*.example.org`: two TXT records at `_acme-challenge.example.org`, each with its own value, both removed, per FR-008 and FR-011.
- An account key given that the server does not know: asked for with `onlyReturnExisting`, then made, per FR-010.
- A server that answers the first `newOrder` with `badNonce`: the order is sent again with the new nonce, and the certificate comes, per FR-009.
- A server that always answers `badNonce`: an error naming `badNonce` after five retries, per FR-009 and FR-012.
- A challenge whose record the CA does not find: the error says the authorization is invalid, and the record is removed, per FR-011 and FR-012.
- The DNS provider throws on the second name: an error with its message, and the first name's record removed, per FR-011 and FR-012.
- A certificate came, and the DNS host was down for the removal: the certificate with one warning, per FR-011.
- An authorization that stays pending: an error when the total wait runs out, per FR-008 and FR-012.
- A certificate that ends in 29 days: `needsRenewal` is true; in 31 days, false, per FR-014.
- Text with no certificate in it: `notAfterOf` gives nothing, and `needsRenewal` is true, per FR-014.
- `setTxt("_acme-challenge.example.com", ...)` on a provider for the zone `example.org`: an error naming both, per FR-015.

## Assumptions

- The CA follows RFC 8555 as Let's Encrypt does: `Replay-Nonce` on every response, `Location` for accounts and orders, problem documents of type `urn:ietf:params:acme:error:*`.
- Web Crypto's ECDSA on P-256, its JWK, SPKI and PKCS #8 forms are in every runtime Net runs on.
- A harness keeps the account key as a secret and gives it back to the next run; a lost key costs a new account and nothing else.
- Tests use a fake CA, a fake Cloudflare, a small DNS server on a free UDP port and servers of their own on free local ports, and reach no real one.

## Open questions

- **OQ-1**: Whether to read ACME Renewal Information (RFC 9773) where the CA offers it, instead of a fixed number of days.
- **OQ-2**: Which DNS host after Cloudflare a harness needs (Route 53, through Crypto's `sigv4`, is the likely one).

## Key entities

- **Transport** - what a typed HTTP client sends its requests through: live over `fetch`, or recorded.
- **Account key** - the ES256 key that signs every request to a CA; its JWK is what a harness keeps.
- **DNS provider** - where TXT records are set and removed.

## Success criteria

- **SC-001**: A harness downloads, serves, calls an API and gets a certificate with no program and no package of the network but this one.
- **SC-002**: No TXT record of a challenge is left at the DNS host after a run.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Confidential: no sensitive fact written as a literal
