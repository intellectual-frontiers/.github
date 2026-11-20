# Feature Specification: Invariants in the database

**Spec ID:** 0043-sql-invariants
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** A guarantee that is enforced only by the application that is meant to keep it can be stepped around by any other client: a second service, a statement typed by hand, a table's owner. Where the database can refuse what is wrong, it should, for every client; and where it cannot, the library should say so rather than claim it. This feature has two parts. First, a vocabulary in which governance says what must always be true of the records of a concept: that they are only added and never changed or removed (and, where they form a chain, that each is the next in number and names the hash of the one before it, so that none is left out, none put between and none forked), that a status moves only along the moves it may make, and that a number is never above another of the same record. Second, an extension that writes these as triggers for the dialects that have them. The third part is honesty about engines: PostgreSQL can enforce all of it in the database (triggers, stored routines, row-level security, grants, event triggers, advisory locks), SQLite can enforce checks, keys and triggers and has no roles, and DuckDB can enforce checks and keys and has no triggers. A dialect says which, and for each guarantee the library says whether the database or the application's runtime enforces it. A guarantee that an engine cannot enforce in the database is not a defect of the engine or of the library; one that it can and that only the application enforces is a defect of the library.

## Requirements

- **FR-001**: The quality vocabulary MUST have `appendOnly` (a concept, with an optional chain naming the members that hold the hash, the previous hash, the sequence and the start), `transitions` (a code attribute, with from each code the codes it may become) `atMost` (a concept, a member that is never above another) and `temporal` (a concept, the members that say from when and until when a record holds, so that it can be read as of an instant), and lint MUST find a member that the concept does not have and a code that the attribute's list does not have.
- **FR-002**: For a dialect that has triggers, an append-only concept MUST be made so that the database refuses any statement that changes or removes a record, and, on PostgreSQL, one that empties the table.
- **FR-003**: For a concept that is a chain, the database MUST refuse a record that is not number one after the start where there is none, and any other that is not one more than the last and does not name the hash of the last, so that a record cannot be left out, put between or forked.
- **FR-004**: The database MUST refuse a change of a status to a code that its attribute's moves do not allow (a code with no moves is terminal), and a record in which a member is above the member it may not be above; and the operations of the identity model MUST run through these triggers.
- **FR-005**: Where a dialect has no triggers, the statement source MUST give an error value naming what it cannot enforce, unless the project says to carry the invariants, in which case it MUST make no trigger; and the invariants a schema declares MUST be listable.
- **FR-006**: `enforcementOf` MUST say, for a dialect, its tier (full, standard or basic), what it can make the database do and what it cannot and why; `where` MUST say, for a guarantee, whether the database or the application's runtime enforces it for that dialect, and how; and `placed` MUST say it for each invariant of a schema, so that on a dialect that can the database enforces each of the identity model's invariants and on one that cannot each says why it is the application's.
- **FR-007**: Where the dialect has event triggers (PostgreSQL), the invariants MUST come with a guard, unless the project leaves it out, that refuses to drop a trigger or function of an invariant (alone, with its table or by cascade), to disable one, to rename one and to replace one, for any session that does not hold an unlock secret (kept outside the database; the database holds only its hash); the guard's own functions MUST be named as an invariant's so that they are guarded too; and with no secret given nothing but a superuser's disabling of the guard MUST open it.

## Out of scope

- Row-level security as a sealed scope, and roles and grants: separate guarantees, and the weaknesses found in them are tracked as defects of the PostgreSQL embodiment.
- A superuser: one can disable an event trigger, as one can change anything; the guard is against the owners of tables and the roles of applications.
- Enforcement by the application's runtime: the operations runtime (0031), whose limits are said there.
- Concurrency: the tests cannot show two connections acting at once.

## Edge cases

- A trigger that must also hold for a table owner: a table's owner can drop a trigger; the guard of FR-007 refuses it, and a migration that must change an invariant unlocks the guard for its transaction.
- Event triggers belong to the database, not a schema: the guard's names are the database's, and an invariant's names begin `inv_`, per FR-007.
- A dialect that gains triggers later: its tier changes with its features and nothing else does, per FR-006.
- DuckDB: the invariants are carried as data and enforced by the runtime, and the report says so, per FR-005.

## Assumptions

- A trigger's cost is a few reads of an index on each write of a record of the concept.
- The application supplies the chain's sequence; the database checks it, per FR-003.

## Open questions

- **OQ-1**: Whether the unlock should also be bound to a role and not only to a secret that the session holds.

## Key entities

- **Invariant** - what must always be true of the records of a concept.
- **Tier** - how much a dialect lets the database enforce.

## Success criteria

- **SC-001**: A statement typed by hand that breaks what governance says must always be true is refused by the database, on every engine that can, and the library says which engines cannot.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
