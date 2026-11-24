# Feature Specification: Signing in the exchange and the merge

**Spec ID:** 0009-bridge-merge-signing
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The exchange publishes its deltas signed by the key of its replica and takes the files of others only as a trust of its own allows, and the merge of two stores in hand signs each delta with the key of its origin and has each side judged by its trust before the store is asked.

## Requirements

- **FR-001**: A replica given a signer MUST publish delta files that carry its signature (the identity of a file is made without it), and a replica under signed trust MUST take them and hold the same rows.
- **FR-002**: An unsigned file, a file signed by a key that is not the origin's and a file whose rows were changed after it was signed MUST be refused with the kind each has and put aside for good (`unsigned`, `bad-signature`, as `forged` is); a file that is refused for the replica's own reasons MUST not be taken.
- **FR-003**: A file whose key the trust does not know (`unknown-key`) MUST be refused but not put aside for good, so that it is taken when the roster is later given the key.
- **FR-004**: The exchange MUST judge each file by a trust of its own (`trust`) before the replica is asked, and the merge of two stores MUST sign each delta with the signer of its origin (a delta of an origin with no signer is unsigned) and judge what each side takes by the trust given for that side; a store that takes only signed deltas MUST refuse the unsigned delta of the other and the two MUST then not report the same rows.

## Acceptance scenarios

1. **Given** a medium holding an unsigned file and a replica under signed trust, **When** it synchronises, **Then** the file is put aside as `unsigned` and nothing is taken, per FR-002.

## Out of scope

- Where the keys come from, which is for the program that uses the exchange.

## Edge cases

- A signer for one replica only: the deltas of the others go out unsigned, per FR-004.

## Assumptions

- A signer is a replica with a key; a trust is the one of the governance of AnyFS.

## Open questions

- None.

## Key entities

- **Signer** and **Trust** - as in AnyFS, handed to the exchange and to the merge.

## Success criteria

- **SC-001**: Two replicas that do not share a store but share a medium can require each other's signatures.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
