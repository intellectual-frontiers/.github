# Feature Specification: GRC evidence and attestation

**Spec ID:** 0006-grc-evidence
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** Evidence is kept by a store and made trustworthy by an attestation. Both are ports with registries and conformance suites: a store holds bytes by their digest and the evidence documents that describe them; a signer signs and verifies a payload and says how its key is held; the evidence policy of governance (0002) decides what counts, what is kept and for how long, who may attest and what custody a key needs.

## Stores

- **FR-001**: An evidence store MUST be `{ id, put(bytes, meta), get(digest), has(digest), list(filter) }`, content-addressed: `put` returns the `grc.evidence` document whose digest is the SHA-256 of the bytes, putting the same bytes twice MUST give one object, and `get` MUST verify the digest of what it reads and give an error value for bytes that do not match.
- **FR-002**: The stores of this library MUST be `memory`, `files` (a folder of objects named by their digest, written by renaming a temporary file so that no partial object is read), `git` (the files store inside a working tree that commits each put with a message naming the digest) and `object` (a store over an object-storage client of the shape `{ put(key, bytes), get(key), head(key), list(prefix) }` the host gives, naming no vendor).
- **FR-003**: Retention MUST be a pure function: `retained(evidence, policy, now)` says whether an item is still to be kept, and `expired` lists those whose retention has passed; a store MUST NOT delete an item itself, a caller that applies `expired` does.
- **FR-004**: A ledger MUST be append-only and hash-chained: each entry has its sequence number, the digest of the entry before it (64 zeros for the first), its time, its kind, its subject and the digest of its evidence, and its own digest is the SHA-256 of the canonical form of the rest; `verifyLedger` MUST name the first entry that was changed, removed, inserted or reordered.


## Attestation

- **FR-005**: A signer MUST be `{ id, custody, sign(payload, key), verify(envelope, keys) }` registered in a registry of signers; the `dsse` signer MUST sign an in-toto statement of an assessment or evidence into a DSSE envelope with Web Crypto keys and verify it, and MUST NOT read a key it was not given.
- **FR-006**: Key custody MUST be decided by policy: `signerAllowed(policy, signer)` MUST refuse a signer whose custody is weaker than the policy's (`none < file < managed < hardware`), and `mayAttest(policy, role)` MUST say whether a role may attest.
- **FR-007**: `attest` MUST make a `grc.attestation` document for a subject and its evidence, signed by a signer that policy allows by a role policy lets attest, and MUST refuse otherwise with an error value that names which of the two failed.
- **FR-008**: Conformance suites for stores and for signers MUST be run on every one of this library's, and MUST check, for a store, content addressing, idempotent `put`, a missing digest, a tampered object and `list`; and, for a signer, sign then verify, verify with a wrong key, and a tampered payload.
- **FR-009**: One evidence bundle design: a manifest, a document of kind `grc.evidence-manifest` that lists each item by digest, size and media type, in the byte order of the digests, and the head of the ledger of FR-004, is what is signed; `verifyManifest` MUST name each item that is missing, extra or different, and a bundle is any set of objects a store holds plus its manifest (the archive that carries it is a surface's concern and is out of scope).

## Scenarios

- **Given** two puts of the same bytes, **When** it is used, **Then** one object and one digest, per FR-001.
- **Given** an object whose file was edited, **When** it is read, **Then** an error value names the digest, per FR-001.
- **Given** a policy requiring `hardware` and a `file` signer, **When** it is used, **Then** `attest` is refused naming custody, per FR-006.
- **Given** a ledger whose third entry was edited, **When** it is used, **Then** verification names entry 3, per FR-004.

## Out of scope

- Signer namespaces, files of allowed signers, key-custody checks of a fleet and refusals of a rolled-back tip: a small signing library will hold them, and the signer port here stays structural so that it can use it.
- Sigstore and transparency logs; signing with `ssh-keygen` (a later signer); the clients of any object storage.

## Edge cases

- Retention of zero: expired at once, per FR-003.
- A store with a half-written temporary file: not listed, per FR-002.

## Assumptions

- Removing the last entries leaves a valid chain, so a signature covers a ledger head given to `verifyLedger`.

## Open questions

- **OQ-1**: Whether the `git` store should push.

## Key entities

- **Evidence store**, **Signer**, **Ledger**, **Attestation**.

## Success criteria

- **SC-001**: Evidence tampered with in any store is found by its digest.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
