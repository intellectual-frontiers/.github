# Feature Specification: Evidence capture seal and bundle

**Spec ID:** 0004-evidence-capture-seal
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The collector never signs: a seal and a bundle are a person's act, on demand, with an SSH key whose passphrase only `ssh-keygen` sees. A seal is a signature over the head of the journal at an instant, kept on the branch with an entry of the journal; a bundle is the journal up to an instant, the states it names by their digests, the evidence documents, a manifest and the signature over it, in the folder that `grc` verifies offline. Verifying needs only the bundle and the public keys.

## Requirements

- **FR-001**: `sealJournal` MUST refuse an empty journal and a journal that does not hold, and otherwise sign, with the key given, the payload `ifc-seal/1` (media type `application/vnd.ifc.seal+json`, the policy id of a bundle `policy:evidence-bundle`: vendor-neutral wire formats that the verifiers accept and no other, with no legacy form; IF Commons names no product) (the fleet, the branch, the position and digest of the head of the journal and the instant), keep the envelope at `seals/<position>.json` and an entry `seal` chained to the head in one commit made at the instant; the seal covers the head before its own entry.
- **FR-002**: `sealStatus` MUST verify each seal with the signers trusted and say, for each, whether it verifies and why not (a signature that does not verify, a seal that is not JSON, a head that is not the entry of the journal at that position), and say how many entries other than seals came after the last seal that verifies.
- **FR-003**: `exportBundle` MUST refuse an instant that is not one, a journal that holds nothing up to it and a folder that exists, and otherwise write the entries of the journal up to the instant in order from the first, the states the entries name as `items/<digest>` (read from the history of the branch), one evidence document for each, the manifest naming the items and the head of the entries, and the signers it was made with.
- **FR-004**: Where a key is given, `exportBundle` MUST sign the manifest with it (`signature.json`); where none is, the bundle MUST have no signature.
- **FR-005**: `verifyBundleDir` MUST verify a bundle offline with the signers given, or with the bundle's own `signers.json` where none are given and say that it did, and MUST find, naming it: an item changed, missing or extra, a journal cut or changed, a manifest changed, a signature absent or by a key that is not trusted or does not verify.
- **FR-006**: Nothing here MUST need a network, MUST write outside the folder of the bundle and the branch, or MUST read a private key but through `ssh-keygen`.

## Acceptance scenarios

1. **Given** a journal, **When** it is sealed and a state is added, **Then** the seal verifies and one entry is unsealed, per FR-001 and FR-002.
2. **Given** a sealed journal whose entry was changed, **When** the seals are checked, **Then** the journal does not hold, per FR-002.
3. **Given** a bundle signed with a key, **When** one item is changed, **Then** verification names the item, per FR-005.
4. **Given** a bundle and a key that is not a signer, **When** it is verified, **Then** the signature is not trusted, per FR-005.

## Out of scope

- Which person's key signs: the tenant's signers.
- The collector: it never signs.

## Edge cases

- A bundle of a period that ends before the first entry is refused, per FR-003.

## Assumptions

- The retention of evidence is the verifier's policy; a bundle verified years later is not made stale by the bundle.

## Open questions

- None.

## Key entities

- **Seal** - a person's signature over the head of the journal at an instant.
- **Bundle** - the journal and its evidence, signed, for someone who does not trust the collector.

## Success criteria

- **SC-001**: A stranger with the bundle and the public keys can say whether it is whole and who vouched for it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
