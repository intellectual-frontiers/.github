# Feature Specification: Signed deltas of the merge

**Spec ID:** 0010-anyfs-merge-signing
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A replica may take changes only from deltas signed by a key of the roster of the replica that made them: the signature is Ed25519 over a digest with the domain of the thing it is for, a roster names the keys with the windows in which they speak, and each way a delta can fail is a refusal with a kind of its own.

## Requirements

- **FR-001**: Replicas in memory MUST pass every case of the suite of signed deltas (`runSigningConformance`): a delta signed by a key of its origin is taken; an unsigned delta, one with a signature that does not hold and one whose key the roster does not know are each refused with the kind `unsigned`, `bad-signature` and `unknown-key`; the trust that names replicas and a signature MUST both hold; a delta taken twice is taken once.
- **FR-002**: A replica that checks nothing, one that checks the signature and not the list of replicas, and one that trusts everyone MUST each fail the suite with a sentence, so that the suite is a test that notices.
- **FR-003**: A signature MUST be `ed25519:<key id>:<base64>`, the key id MUST be the first 16 hexadecimal digits of the SHA-256 of the 32 bytes of the key, and what is signed MUST be `<domain>\n<replica>\n<digest>`; a text that is not that MUST be a signature that does not hold.
- **FR-004**: A roster MUST be read from a JSON list of entries `{replica, keyId, publicKey, notBefore?, notAfter?}`, each entry checked (an identity, 16 hexadecimal digits, a public key of 32 bytes in base64, windows in milliseconds), and written back to the same list.
- **FR-005**: A key MUST speak for its replica only inside its window, measured at the time of the newest row of what it signed: a delta made under a key that has since been rotated MUST stay valid, and a new key MUST speak from where the old one ends.
- **FR-006**: A signature of one thing MUST NOT be a signature of another: a signature of a delta MUST NOT verify as one of an epoch or a dump, the verifier of a trust MUST be asked in the domain of what it checks (`anyfs-delta/1`, `anyfs-epoch/1`, `anyfs-dump/1`), and a signing key MUST be kept in a file as the entry for the roster and the private key, read back into the same key.

## Acceptance scenarios

1. **Given** a delta whose rows were changed after it was signed, **When** a replica under signed trust takes it, **Then** it is refused as `bad-signature`, per FR-001.
2. **Given** a delta signed by a key whose window has ended before the rows were made, **When** it is taken, **Then** it is refused as `unknown-key`, per FR-005.

## Out of scope

- Keys of other algorithms, the distribution of a roster, and the revocation of a key before its window ends.

## Edge cases

- A delta from a replica whose key is not yet on the roster: it is refused as `unknown-key`, and is taken once the roster knows the key (the refusal is not for good), per FR-001.

## Assumptions

- The runtime has Ed25519 in WebCrypto (Bun and Node 26).

## Open questions

- None.

## Key entities

- **Signer** - a replica, a key id and the signing of a text.
- **Roster** - the keys known, with the windows they speak in.

## Success criteria

- **SC-001**: A fleet can say that it takes changes only from the replicas that hold a key it knows, and a forged or altered delta changes nothing.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
