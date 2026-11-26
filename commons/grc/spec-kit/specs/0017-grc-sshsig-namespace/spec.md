# Feature Specification: GRC SSHSIG namespace

**Spec ID:** 0017-grc-sshsig-namespace
**Status:** Draft
**Owner:** if
**Domain:** grc

**Input:** The `sshsig` signer signs and verifies in one namespace, `grc-evidence`. A signature of a telemetry batch, or of a Git object that change-control verifies by running a program, must be told apart from evidence by its namespace, and the one pre-authentication encoding of DSSE must be written once. This specification makes the namespace a parameter, exports the verification of a message that was not made by the encoding of DSSE, and removes the second copy of `pae`. It is governed by commons 0041-telemetry-and-reach (audit rows A7 and E7). **Every requirement that asks for code is Deferred until after the owner's acceptance run of the command line.**

## Requirements

- **FR-001**: `grc/signers/sshsig` MUST give `sshsigSignerFor(namespace)`, a `Signer` that signs and verifies in the namespace it is given, and `sshsigSigner` MUST remain the signer of the namespace `grc-evidence` and MUST behave exactly as it does today. Relies on audit rows: A7.
- **FR-002**: A namespace MUST be a value made only by `parseNamespace`, which MUST refuse an empty text, a text with a space, a comma or a control character, and a text over 64 characters; the known namespaces (`grc-evidence`, `ifc-telemetry`) MUST be one closed table. Relies on audit rows: A7.
- **FR-003**: Verification MUST refuse a signature made in another namespace and MUST say both namespaces, MUST refuse a key that is not an Ed25519 key and say so (other types stay unverified: UNVERIFIED for ECDSA and RSA), and MUST be pure (Web Crypto only, no program). Relies on audit rows: A7, E7.
- **FR-004**: `verifySshsig(armored, message, publicKey, namespace)` MUST be exported for a message that is not the encoding of DSSE (the bytes of a Git object, for instance), giving a `Result` of success or a `SignProblem`, so that a library that now runs `ssh-keygen -Y verify` (change-control `physical/keys.ts`) MAY use it later; this specification MUST NOT change change-control. Relies on audit rows: E7.
- **FR-005**: `pae` MUST be imported from `@intellectual-frontiers/crypto/dsse` and the copy in `grc/src/signers/sshsig/mod.ts` MUST be removed, and a test MUST show that both gave the same bytes for a set of payload types and payloads before the removal is made. Relies on audit rows: A7 and duplication 1.
- **FR-006**: Signing MUST remain by `ssh-keygen -Y sign` and MUST name the program in its error where it is not installed; a signer from an OpenSSH private key file in pure code MAY be made later and is not specified here. Relies on audit rows: A7.

## Acceptance scenarios

1. **Given** a signature made in `ifc-telemetry`, **When** it is verified in `grc-evidence`, **Then** it is refused naming both, per FR-003.
2. **Given** a namespace with a space, **When** it is parsed, **Then** it is refused, per FR-002.
3. **Given** a signature from an Ed25519 key over bytes, **When** `verifySshsig` runs with the key and the namespace, **Then** it verifies with no program, per FR-004.
4. **Given** the old and the new `pae`, **When** both run over the same inputs, **Then** the bytes are equal, per FR-005.

## Out of scope

- A change to change-control, to the evidence bundle or to the seal; their signatures keep their namespaces.

## Edge cases

- A signature made with hash `sha512`: verified as today, per FR-003.

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Namespace** - the text a signature is bound to, so that a signature for one purpose is not another's.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
