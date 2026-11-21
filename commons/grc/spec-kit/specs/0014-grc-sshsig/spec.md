# Feature Specification: The sshsig signer

**Spec ID:** 0014-grc-sshsig
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** A person signs evidence with the SSH key they already hold: an Ed25519 key with its passphrase, which only `ssh-keygen` ever sees, and anyone verifies with the public key alone. The signature is in the envelope of DSSE, over DSSE's pre-authentication encoding of the payload type and the payload, in the SSHSIG format of OpenSSH, and is verified without OpenSSH so that a machine with nothing but this library can do it.

## Requirements

- **FR-001**: The signer MUST be `{ id: "sshsig", custody: "file" }` and `sign` MUST run `ssh-keygen -Y sign` in the namespace `grc-evidence` over the pre-authentication encoding of the payload type and the payload (`DSSEv1 <length of the type> <type> <length of the payload> <payload>`), with the key file or the agent it is given, and give an envelope of the payload type, the payload in base64 and one signature that holds the armored SSH signature and the fingerprint of the key as its key id; a missing key, a key `ssh-keygen` cannot use and a signature that cannot be read MUST be errors that say so.
- **FR-002**: `verify` MUST be pure (no program, no file, no network) over the SSHSIG format and Web Crypto: it MUST give the payload where a signature of the envelope is by one of the public keys given, in the namespace `grc-evidence`, over the pre-authentication encoding of the payload type and the payload.
- **FR-003**: `verify` MUST refuse, with the reason, a payload type that is not the one asked for, a payload that is not base64, a signature that is not an SSH signature or not of version 1, a namespace that is not `grc-evidence`, a signature by another key than the one trusted, a signature that does not verify (a payload changed after it was signed included), and a hash other than sha256 or sha512.
- **FR-004**: Only Ed25519 keys MUST be verified: any other key type MUST be refused saying that only `ssh-ed25519` is verified.
- **FR-005**: `fingerprintOf` MUST give the fingerprint of a public key line as OpenSSH writes it (`SHA256:` and the unpadded base64 of the SHA-256 of the key's blob), and the signatures this signer makes MUST be verified by `ssh-keygen -Y verify` and the signatures of `ssh-keygen -Y sign` in this namespace MUST be verified by this signer.

## Acceptance scenarios

1. **Given** a key and a payload, **When** the payload is signed and the envelope verified with the public key, **Then** the payload is given back, per FR-001 and FR-002.
2. **Given** a signed envelope, **When** its payload is changed by one byte, **Then** it does not verify, per FR-003.
3. **Given** a signature made in another namespace, **When** it is verified, **Then** it is refused, naming the namespace, per FR-003.
4. **Given** an RSA public key, **When** it is used to verify, **Then** it is refused, per FR-004.
5. **Given** a signature made here, **When** `ssh-keygen -Y verify` checks it against an allowed-signers file, **Then** it passes, per FR-005.

## Out of scope

- Keys held in a hardware token (`sk-` types): a signer of its own.
- Asking for the passphrase: `ssh-keygen` does, in the person's terminal.

## Edge cases

- A key that an agent holds is used through its public key file and the agent, per FR-001.

## Assumptions

- `ssh-keygen` of OpenSSH 8.0 or later is installed where a person signs; verifying needs nothing.

## Open questions

- None.

## Key entities

- **Envelope** - a payload with its type and the signatures over it.

## Success criteria

- **SC-001**: A bundle signed with a person's SSH key verifies on a machine that has no OpenSSH.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
