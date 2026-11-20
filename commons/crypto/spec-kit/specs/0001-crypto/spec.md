# Feature Specification: Crypto

**Spec ID:** 0001-crypto
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The digests, signatures and envelopes that the compliance, the telemetry and the harnesses of commons sign and check with, in a package of its own that depends on `core` and `formats`: SHA-256, MD5, SHA-512 crypt, UUIDs, AWS Signature Version 4, CMS encrypted content, in-toto statements in DSSE envelopes, COSE keys and WebAuthn for a relying party, all in pure code on Web Crypto with no outside package. It is the third library lifted out of `commons/ts` (commons 0032-libraries-by-concern).

## Digests

- **FR-001**: Crypto MUST give SHA-256 through Web Crypto as a branded `Sha256` (64 lower-case hexadecimal digits), made only by `sha256` or the validating `sha256Of`, with hexadecimal conversion and the reading of `SHASUMS256` files.
- **FR-002**: Crypto MUST give MD5 (RFC 1321), which Web Crypto lacks, for the protocols that still ask for it (S3's `Content-MD5`, some ETags), as bytes and hexadecimal, and MUST say in its documentation that it is not for security.

## Passwords and requests

- **FR-003**: Crypto MUST hash a password as glibc's SHA-512 crypt (`$6$`, Drepper's algorithm, rounds written where they are given and clamped as glibc clamps them, the salt cut to 16 characters) on Web Crypto alone, giving the bytes glibc's `crypt(3)` gives, and verify a password against such a hash. The salt MUST be given (made from random bytes by the caller), so the kernel has no effect.
- **FR-004**: Crypto MUST sign HTTP requests by AWS Signature Version 4 (`AWS4-HMAC-SHA256`) with HMAC-SHA256 on Web Crypto, from a request's parts or a web `Request`, the credentials (an access key, its secret and an optional session token), the region, the service and the time given by the caller (the kernel reads no clock): the canonical request (the path normalized and encoded twice except for S3, which keeps it as given and encoded once; the query sorted and encoded by RFC 3986; the headers in lower case, trimmed, sorted and signed with `host` and `x-amz-date`), the string to sign, the derived key and the `Authorization` header, with the payload's SHA-256 (or `UNSIGNED-PAYLOAD` where asked) also sent as `x-amz-content-sha256` where asked and always for S3. Its signatures MUST be those of AWS's published examples.

## Envelopes

- **FR-005**: Crypto MUST encrypt content as CMS AuthEnvelopedData (RFC 5652, RFC 5083): AES-256-GCM with a 16-byte tag (RFC 5084), the content key encrypted to each recipient's RSA key with RSAES-OAEP, SHA-256 and MGF1 with SHA-256 (RFC 8017, RFC 4055) in a KeyTransRecipientInfo naming the certificate by issuer and serial number; open it with a recipient's private key, accepting SHA-256 parameters written as NULL or absent, and refusing a changed message, a wrong key and a certificate it was not encrypted to with a typed error; read and write PEM; and read an X.509 certificate (RFC 5280) for its issuer, serial, key, addresses, validity and key usage, saying why it cannot encrypt to an address now. The content key and nonce MUST come from the caller.
- **FR-006**: Crypto MUST build in-toto Statements v1 generic in their predicate (subjects named, with their digests) and DSSE envelopes: the pre-authentication encoding with lengths in bytes, signing with keys the caller imported (Ed25519; ECDSA on P-256, P-384 and P-521 with signatures in ASN.1 DER; RSA-PSS and RSASSA-PKCS1-v1_5), and verification against a threshold of distinct keys that checks the payload type first and refuses, by a typed error, a malformed envelope, a key that cannot verify, and too few valid signatures.

## Identifiers and keys

- **FR-007**: Crypto MUST give UUIDs by RFC 9562: the branded `Uuid`, its text form read and written, the name-based version 5 (SHA-1 of a namespace and a name, the same on every runtime) with the namespaces RFC 9562 defines (DNS, URL, OID, X.500), and a decoder from `unknown` to a `Uuid`.
- **FR-008**: Crypto MUST read a COSE key of ES256 and verify a WebAuthn registration and authentication for a relying party (the checks of Level 3's §7.1 and §7.2, each refusal a sentence and never an exception), as 0014-webauthn FR-002 to FR-008 say, which this library holds as `cose` and `webauthn`.

## The package

- **FR-009**: Crypto MUST depend on `core` and `formats` alone, MUST import nothing outside its own files, MUST name no host global, and MUST be published as compiled modules with their declarations as `@intellectual-frontiers/crypto`, with an entry for the package (`.`) and one for each of its modules (`./sha256`, `./dsse`, ...), each with its `types` (commons 0032-libraries-by-concern FR-005, FR-013), so that it runs on Bun, on Node 26 and in a browser with no build step.

## Acceptance scenarios

1. **Given** the bytes `abc`, **When** they are hashed, **Then** the SHA-256 is `ba7816bf...15ad`, a `Sha256`, per FR-001.
2. **Given** a password and a salt, **When** it is hashed as SHA-512 crypt, **Then** the hash is the one Drepper's specification gives for `Hello world!` with the salt `saltstring`, per FR-003.
3. **Given** a request and credentials, **When** it is signed by Signature Version 4, **Then** the signature is the one AWS's published Signature Version 4 examples give, per FR-004.
4. **Given** a statement and a key, **When** it is wrapped in a DSSE envelope, **Then** the envelope verifies and a changed payload does not, per FR-006.
5. **Given** the packed package installed under `node_modules`, **When** Node 26 and Bun import `@intellectual-frontiers/crypto` and `@intellectual-frontiers/crypto/sha256`, **Then** both give the same digest, per FR-009.

## Out of scope

- The reading and writing of the formats these use (hexadecimal, base64, DER, CBOR): `formats`.
- Signing files with keys on a disk: the host (`runtime/sign`, lifted with `grc`).

## Edge cases

- A SHA-256 text with upper-case digits: lowered by `sha256Of`, per FR-001.
- A rounds value outside the range SHA-512 crypt allows: clamped as glibc does, per FR-003.

## Assumptions

- Web Crypto (`crypto.subtle`) is there, as in Bun, Node 26, browsers and Workers.

## Open questions

- None.

## Key entities

- **Sha256** - a checksum the compiler keeps apart from any other string.
- **Envelope** - signed content with its payload type, as DSSE says.

## Success criteria

- **SC-001**: A harness signs, checks and hashes with these and with no outside package.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
