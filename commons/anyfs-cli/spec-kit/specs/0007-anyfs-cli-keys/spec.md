# Feature Specification: Keys and rosters of signed merges

**Spec ID:** 0007-anyfs-cli-keys
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `keygen` makes a replica's signing key; `roster show|add|publish|fetch|rotate` keeps the roster of known keys, hands it through a store and rotates a key.

## Requirements

- **FR-001**: `keygen --replica ID --key FILE` MUST write the key of the replica to FILE readable by its owner only, MUST print the entry for the roster and never the private key, MUST NOT write over a file that is there, and MUST accept `--not-before` and `--not-after` (milliseconds) as the window of the key. It replaces the script `tools/keygen.ts` of 0005 FR-005 (the script stays and does the same).
- **FR-002**: The verbs that make or change keys and rosters (`keygen`, `roster add`, `roster publish`, `roster fetch`, `roster rotate`) MUST come through the command line only, never through the tool server; `roster show` only reads.
- **FR-003**: `roster show ROSTER` MUST say each key with its replica, its id and whether it is `active`, `expired` or `future` at `--at` (now by default); `roster add ROSTER SOURCE...` MUST add the public keys of rosters, entries and signing keys (never reading out the private part), MUST be idempotent, and MUST refuse a key id that is there with another public key.
- **FR-004**: `roster publish ROSTER LOCATION` MUST write the roster, public keys only, to a file of a store.
- **FR-005**: `roster fetch ROSTER LOCATION` MUST add a key that is new only where its id is named in `--accept`, and MUST otherwise show it as pending with the command that accepts it; a key that is there MUST be kept as it is (a fetched roster never widens a window), and a key id that is there with another public key MUST be refused.
- **FR-006**: `roster rotate ROSTER KEYID --key FILE [--at MS]` MUST make a new key for the replica of KEYID, end the old key at the instant (never later than it ended), start the new key at the next millisecond, write the new key as FILE readable by its owner only without writing over a file, and so that a delta signed with the old key before the instant still holds and one signed with it after does not.

## Acceptance scenarios

1. **Given** two replicas that sign, **When** one rotates its key and signs a delta with the new key, **Then** `merge --trust signed` with the rotated roster takes it, per FR-006.

## Out of scope

- Revocation of a key before its window ends, a roster that is itself signed, and the check of a key with its owner (that is the person's, by `--accept`).

## Edge cases

- A roster file that is not there is made by `roster add` and `roster fetch`; `roster show` and `roster rotate` need it, per FR-003 and FR-006.

## Assumptions

- The id of a key (the digest of its public key) is told to the person who accepts it by another way than the store that carries the roster.

## Open questions

- None.

## Key entities

- **Roster** - the JSON list of the entries of public keys, with their windows.

## Success criteria

- **SC-001**: A fleet can add a replica, move a roster between computers and replace a key without a script and without a secret on a command line or in a store.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
