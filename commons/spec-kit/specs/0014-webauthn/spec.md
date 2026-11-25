# Feature Specification: WebAuthn for a relying party

**Spec ID:** 0014-webauthn
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A harness that signs people in on the web should use passkeys, not passwords: WebAuthn (Web Authentication Level 3), where the browser and an authenticator do the cryptography and the relying party checks what they answer. IFC TypeScript's kernel (0005-typescript-practice) does the relying party's part, pure, with Web Crypto and no package: the options a browser takes, and the verification of a registration and an authentication, in the JSON shapes the browser's `toJSON()` gives. It needs CBOR (RFC 8949) to read attestation objects and COSE (RFC 9052, RFC 9053) for the keys, which the kernel gives as modules of their own.

## CBOR and COSE (kernel)

- **FR-001**: `kernel/cbor.ts` (exported as `cbor`) MUST read the definite-length forms of every CBOR major type (unsigned and negative integers to 64 bits, a `bigint` beyond the safe range; byte and text strings; arrays; maps whose keys are integers or text strings; tags; `false`, `true`, `null`, `undefined`; half, single and double floats), one item from an offset with where it ends, or one item that is the whole input; and MUST refuse, as a `Result` saying what and at which byte, an indefinite length, a reserved additional value, text that is not UTF-8, a key given twice or of another type, a count the bytes cannot hold, nesting deeper than 64 levels, and bytes left over. It MUST write a value in the core deterministic encoding (the shortest heads, map keys sorted by their encoded bytes).
- **FR-002**: `kernel/cose.ts` (exported as `cose`) MUST read a `COSE_Key` of ES256 (`kty` EC2, `alg` -7, P-256, 32-byte `x` and `y`) or EdDSA (`kty` OKP, `alg` -8, Ed25519, 32-byte `x`) and refuse any other with a sentence; write one deterministically, also from a public JWK; import it into Web Crypto; and verify a signature with it, an ES256 signature turned from DER into the raw `r || s` Web Crypto takes.

## Options (kernel)

- **FR-003**: `kernel/webauthn.ts` (exported as `webauthn`) MUST give `registrationOptions` and `authenticationOptions`, which return `PublicKeyCredentialCreationOptionsJSON` and `PublicKeyCredentialRequestOptionsJSON` as Level 3 defines them: for registration the RP's id and name, the user (id as base64url), the challenge, EdDSA (-8) and ES256 (-7) offered, a timeout, the credentials to exclude, a resident key `preferred`, user verification `required` and attestation `none`; for authentication the challenge, the RP ID, a timeout, user verification `required` and, only where given, the credentials allowed. The kernel has no randomness: the caller gives the challenge. A challenge under 16 bytes, a user id outside 1 to 64 bytes or a credential id that is not base64url MUST throw a `RangeError` (a fault of the code).

## Registration (kernel)

- **FR-004**: `verifyRegistration` MUST check, as Level 3's §7.1 says, the client data (type `webauthn.create`, the challenge the same bytes as the expected one, the origin one of those expected, not cross-origin), the attestation object (CBOR with `fmt`, `attStmt` and `authData`), the authenticator data (the SHA-256 of the RP ID, user presence, user verification, BS only with BE, the attested credential data, every byte accounted for), that the credential id there is the response's `rawId`, and the credential's COSE key (FR-002). It MUST accept the format `none` with an empty statement and `packed`: self-attestation with its signature checked by the credential's key, or a certificate chain not judged, so that every credential has the trust of `none`. It MUST give back the credential id, the COSE public key (base64url), its algorithm, the counter, whether the user was verified, whether the credential is backed up and may be, the AAGUID, the format and the transports.
- **FR-005**: A registration MUST be refused, with a sentence and never an exception, for the wrong challenge, origin, RP ID or client data type, a cross-origin ceremony, no user presence or verification, malformed base64url, JSON or CBOR, authenticator data that ends early or has bytes its flags do not account for, an attestation format other than `none` or `packed`, a `none` with a statement, a packed self-attestation that does not verify, a credential id that is not `rawId`, and a key of another algorithm.

## Authentication (kernel)

- **FR-006**: `verifyAuthentication` MUST check, as §7.2 says, against the credential kept at registration (its id, COSE key, algorithm and counter): the response is by that credential; the client data (type `webauthn.get`, challenge, origin, not cross-origin); the authenticator data (RP ID hash, user presence, user verification, its extensions read past); the signature over the authenticator data followed by the SHA-256 of the client data, by ES256 (DER) or Ed25519; and that the counter went up, unless it was and is 0 (an authenticator that keeps none). It MUST give back the counter to keep, whether the user was verified and whether the credential is backed up.
- **FR-007**: An authentication MUST be refused, with a sentence and never an exception, for a signature that does not verify or is malformed, a counter that does not go up, the wrong challenge, origin, RP ID or client data type, no user verification, another credential, a stored algorithm that is not the stored key's, and authenticator data that is malformed.

## The boundary (kernel)

- **FR-008**: The kernel MUST give `parseRegistrationResponse` and `parseAuthenticationResponse`, which read JSON a browser sent (`unknown`) into the response types or refuse it naming the path that is wrong, so that a harness decodes once at its boundary.

## Out of scope

- Attestation trust: certificate chains, the FIDO Metadata Service, AAGUID allow lists, and the formats `tpm`, `android-key`, `android-safetynet`, `apple` and `fido-u2f`.
- RS256 and every algorithm but ES256 and EdDSA.
- Storing challenges, users and credentials, sessions and cookies: the harness's.
- Interpreting extensions (`credProps`, `prf`, `largeBlob`), and related origins (`topOrigin`, `.well-known/webauthn`).
- The browser's side (`navigator.credentials`).

## Edge cases

- A passkey that is synced: `backedUp` true, per FR-004 and FR-006.
- An authenticator that keeps no counter, 0 at registration and 0 at each sign-in: accepted, per FR-006.
- A counter of 5 kept and 5 given: refused, the authenticator may be cloned, per FR-007.
- `clientDataJSON` whose origin is `https://evil.example`: refused naming it, per FR-005 and FR-007.
- Authenticator data for another RP ID: refused, per FR-005 and FR-007.
- UP set and UV not: refused, as user verification is required, per FR-005 and FR-007.
- An attestation object of format `tpm`: refused, as commons asks for `none`, per FR-004 and FR-005.
- A COSE key of RS256 (-257): refused, per FR-002 and FR-005.
- An Ed25519 signature of 3 bytes, or an ES256 signature that is not DER: refused, per FR-007.
- CBOR `5f 41 01 ff` (an indefinite byte string): refused, per FR-001.
- CBOR `1b ff ff ff ff ff ff ff ff`: the `bigint` 18446744073709551615, per FR-001.
- A challenge of 4 bytes given to `registrationOptions`: a `RangeError`, per FR-003.
- `{ "type": "password" }` from a browser: refused at `$.type`, per FR-008.

## Assumptions

- Web Crypto has ECDSA on P-256 and Ed25519 in every runtime IFC TypeScript runs on, and in the browsers that make passkeys.
- Browsers give attestation `none` when it is asked for, so `packed` is rare and other formats rarer.
- The tests play the authenticator with Web Crypto: the bytes are those an authenticator makes, not recorded from a device.

## Open questions

- **OQ-1**: Whether a harness needs attestation trust (an enterprise that admits only certain authenticators), and then which formats.
- **OQ-2**: Whether to check `topOrigin` and related origins once a harness is embedded across origins.

## Key entities

- **Relying party** - the harness that registers and checks credentials, named by its RP ID.
- **Credential** - an authenticator's key pair for one RP and one user; the RP keeps its id, COSE key, algorithm and counter.
- **Ceremony** - a registration or an authentication, bound to one challenge.
- **Authenticator data** - the bytes the authenticator signs: RP ID hash, flags, counter, attested credential, extensions.

## Success criteria

- **SC-001**: A harness signs people in with passkeys using nothing but IFC TypeScript's kernel.
- **SC-002**: Every check of Level 3's §7.1 and §7.2 that applies to attestation `none` is made, each with a test that breaks it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Confidential: no sensitive fact written as a literal
