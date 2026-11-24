# Feature Specification: SQL signing: epochs and dumps under signed trust

**Spec ID:** 0011-sql-signing
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Under signed trust a SQL store takes deltas, epochs and dumps only from replicas whose key signed them. Deltas are judged as in the core; an epoch carries the signature of its proposer; a dump is replayed only with the manifest its replica signed for that text. What a raw import by the real database cannot check is said.

## Requirements

- **FR-001**: Replicas of every engine (SQLite, PGlite, DuckDB) MUST pass every case of the suite of signed deltas of AnyFS.
- **FR-002**: Under signed trust an epoch MUST be adopted only from a proposer on the list (where there is one) whose key signed it, valid when the epoch's bound id was made; an epoch that is not signed, one signed by a key of another replica and one from a replica off the list MUST be refused with a sentence, and the one that is signed MUST be adopted and end with the same files.
- **FR-003**: Under signed trust a dump MUST be replayed only with the manifest its replica signed (`<sha256>:<rows>:<blobs>` under the domain `anyfs-dump/1`): a dump that is not signed, one that is not the text the manifest was signed for, one whose counts are wrong, one signed by a key that is not the replica's, one from a replica off the list and one that holds a row of a replica off the list MUST each be refused and write nothing, and the manifest MUST be written to and read back from `<replica>.sql.sig`.
- **FR-004**: A raw import by the real `sqlite3` under signed trust MUST write no row of a replica the roster does not name (the trust table and its trigger), and the limit MUST be said: the database cannot check a signature, so what a raw import brings in from a replica of the roster is vouched for by nothing but that filter, and the library's import is what holds the signature.

## Acceptance scenarios

1. **Given** a dump of a replica off the roster replayed by the real `sqlite3` into a signed database, **When** the files are read, **Then** none of its rows is there, per FR-004.
2. **Given** a dump and the manifest its replica signed, **When** the text is changed by one byte, **Then** the import refuses it, per FR-003.

## Out of scope

- Revocation of a key: a key stops speaking by the end of its validity window, and a dump or delta made inside the window stays valid.
- A signature on each row: a signature is on a whole delta, epoch or dump.

## Edge cases

- A signed dump relayed by a replica that was not its author vouches for the rows of others unless `replicas` narrows the list (FR-003).
- An epoch's time is the time of its `bound` id, so that a key that has rotated since still speaks for the epoch made under it, per FR-002.

## Assumptions

- Keys are held as in the core: Ed25519, a roster of entries with a validity window, a key identified by the first 16 hexadecimal digits of the SHA-256 of its 32 bytes.

## Open questions

- None.

## Key entities

- **Manifest** - the digest, the counts and the signature of a dump, in a file next to it.
- **Roster** - the keys a replica knows, by replica, each with the window in which it speaks.

## Success criteria

- **SC-001**: A replica that takes signed changes only can still compact, adopt epochs and take dumps, and each of them proves who made it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
