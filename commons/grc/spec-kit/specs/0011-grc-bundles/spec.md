# Feature Specification: GRC evidence bundles

**Spec ID:** 0011-grc-bundles
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** A whole evidence bundle (its manifest, its items, its ledger and its signature) is verified offline by a pure core and a file adapter, and every fault is a typed finding that names the item or entry it concerns.

## The bundle

- **FR-001**: A bundle MUST be a folder of `manifest.json` (a `grc.evidence-manifest`), `ledger.json` (an array of `grc.ledger-entry`), `evidence.json` (an array of `grc.evidence`), `signature.json` (a DSSE envelope over the canonical manifest, of payload type `application/vnd.grc.evidence-manifest+json`) and `items/<digest>`, the bytes of each item; the trust (the signing keys and their roles) and the evidence policy MUST NOT be read from the bundle but given by the verifier.
- **FR-002**: `verifyBundle(input, trust, at)` MUST be a pure core over the contents (text and bytes) of a bundle, with no file, network or clock, giving a report of findings in a fixed order; the file adapter `readBundle` MUST only read a folder into those contents.

## The findings

- **FR-003**: A finding MUST be of the closed union `item-missing`, `item-hash-mismatch`, `item-size-mismatch`, `item-extra`, `chain-broken`, `not-canonical`, `signature-absent`, `signature-bad`, `signer-unallowed`, `evidence-expired`, `kind-unknown`, `schema-unknown` and `document-invalid`, and each MUST name what it concerns: an item by digest, a ledger entry by sequence number, a signature by key id, or a file of the bundle.
- **FR-004**: Each item of the manifest MUST be found missing where `items/<digest>` is absent, a hash mismatch where the SHA-256 of its bytes is not its digest, a size mismatch where its length is not its size, and each item the folder holds that the manifest does not list MUST be extra.
- **FR-005**: The ledger MUST be verified with `verifyLedger` against the head the manifest names, and a fault MUST be `chain-broken` naming the first entry at fault.
- **FR-006**: The manifest, the ledger and the evidence list MUST be in their canonical form (RFC 8785, with no white space), and a file that is not MUST be `not-canonical`.
- **FR-007**: The signature MUST verify with the signer and the keys the verifier gives, over the canonical bytes of the manifest; an absent envelope MUST be `signature-absent`, a signature that does not verify (or a payload that is not the manifest) `signature-bad`, and a signature by a key the verifier does not trust, by a role the evidence policy does not allow to attest, or with a signer whose custody is weaker than the policy's MUST be `signer-unallowed`; a bundle MUST hold at least one signature, and every signature it holds MUST be valid and allowed.
- **FR-008**: An item of evidence whose retention has passed at the instant MUST be `evidence-expired`, by `retained`.
- **FR-009**: A file that is not valid JSON, is absent or does not decode MUST be `document-invalid`, a document of a kind no reader knows MUST be `kind-unknown`, and a document of a schema this release does not read MUST be `schema-unknown`, each naming the file.

## The verb

- **FR-010**: The verb MUST be `grc bundle verify <folder> --keys <file> --policy <file> [--at <instant>]`, a read-only report with the reach of the existing reports; `grc evidence verify` MUST stay the verification of the objects of the store, because a bundle is a set of files and not a store.
- **FR-011**: The exit MUST be `ok` (0) where there is no finding, `findings` (1) where there is any, `usage` (2) for a wrong command line (no folder, an instant that is not one), and `environment` (3) for a folder, keys file or policy file that cannot be read; each finding MUST carry the code `E-BUNDLE-` and its kind in upper case, which `grc explain <code>` MUST explain with what happened, the likely cause and the fix.
- **FR-012**: The verification MUST use no network and MUST write nothing.

## Scenarios

- **Given** an item whose bytes were edited, **When** the bundle is verified, **Then** an `item-hash-mismatch` names its digest and the exit is 1, per FR-004, FR-011.
- **Given** a bundle with no `signature.json`, **When** it is verified, **Then** `signature-absent`, per FR-007.
- **Given** a folder that does not exist, **When** it is verified, **Then** the exit is 3, per FR-011.

## Out of scope

- Making a bundle, and the archive that carries one; a transparency log.

## Edge cases

- A bundle of no items: valid where the ledger and signature are, per FR-004.

## Assumptions

- The verifier holds the keys it trusts: a bundle never vouches for its own signer.

## Open questions

- **OQ-1**: Whether a bundle may carry several manifests.

## Key entities

- **Bundle**, **Finding**, **Trust**.

## Success criteria

- **SC-001**: Every way a bundle can be wrong is a finding that names the item or entry.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
