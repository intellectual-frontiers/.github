# Feature Specification: Convergence

**Spec ID:** 0019-sql-convergence
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The second of the two strategies. Where history (0018-sql-history) replays what was frozen, convergence computes, for each database it meets, the plan from the state that database is in to the state wanted. The state is read from the database's own catalog, so that a database that was made by hand, restored from a backup, or changed by someone in a hurry is met as it is, and what differs is found: drift is a plan, not a surprise. How the plan is approved is a feature of the strategy. Reviewed: the plan is written as a file that a person reads and approves, it is pinned to the state it was computed from, and it is applied only if the database is still in that state and the file is the one that was approved. Autonomous: on first access the plan is computed and, if every step is of a kind the policy trusts (by default only additive and lossless ones), applied with nothing reviewed; if any step is not, nothing is changed and the plan is held for a person; if a step fails the database stays at the step before it and the next access resumes. A version gate refuses to start an application whose database is not in the state it expects.

## Reading a database

- **FR-001**: A dialect MUST be able to read its own catalog into a neutral value (the tables, each with its columns' written types and nullability, its primary key, its indexes and, where the dialect can list them, the names and kinds of its foreign keys, uniques and checks) and to say what it compares, so that reading is owned by the dialect and the strategy names no engine.
- **FR-002**: `readState` MUST make a state from that value: a table and a column by the words of its name (with the schema's words taken from a table's where the dialect has none), a type as the desired state's where the two are the same type under another name (`character varying` and `VARCHAR`), nullability and key as found, an index and a constraint as the desired state's where one of the same name is found and as unknown where not, and what the dialect cannot list as the desired state's; and the state of a database made from the desired schema MUST have the hash of the desired state.
- **FR-003**: What a state does not compare (a default, a check's text, a table clause, and a foreign key, unique or check of a dialect that cannot list them) MUST be said by the dialect, and a difference in what is compared MUST be a change: a column added by hand is a column to drop, a column made optional is a change of nullability, a table missing is a table to make.

## The plan from what is there

- **FR-004**: `propose` MUST read the database's state, compute the plan from it to the state wanted with the transforms and the fallback it is given, and pin it: the hash of the state it was computed from and the hash of the state it ends in; and a plan between states that are equal MUST have no step.
- **FR-005**: Applying a proposal MUST read the state again and refuse, as an error value naming both hashes, a database that is no longer in the state the proposal was pinned to.

## Reviewed

- **FR-006**: A reviewed proposal MUST be a file of text (the pinned hashes, each step's name, class, reversibility, idempotency and why, its statements and its verification) that is the same every time for the same proposal; `apply` MUST take the hash of the text that was approved and refuse, as an error value, text that does not have it, and MUST then run the steps through the lifecycle's run, so that a second apply finds nothing to do.

## Autonomous

- **FR-007**: `connect` MUST read the state, compute the plan and, where the policy allows every step (by default `safe` steps that are `lossless`, of the kinds that only add), apply it, with a lock that keeps one instance applying where the dialect has one; where the policy does not allow a step it MUST change nothing and return the plan as held for a person, naming the steps it did not allow; and where a step fails it MUST return the error and leave the database at the step before.
- **FR-008**: The policy MUST be a setting (the classes, the reversibilities and the kinds of change allowed, and whether it is on at all), with a default that only adds, and a policy that is off MUST apply nothing and hold every plan.
- **FR-009**: A rehearsal MAY be given: where it is, `connect` MUST run it on the plan before it applies it and MUST hold the plan where it says no.

## The version gate

- **FR-010**: The version gate MUST say whether a database is in the state an application expects, by the hash, and MUST return an error value naming both where it is not, so that an application can refuse to start instead of migrating.

## Settings

- **FR-011**: The approval (`reviewed` or `autonomous`), the policy, the ledger's table and the names the reader leaves out (by default the ledger's table and the tables that quarantine makes by its default suffixes, so that what the library keeps aside is not read as drift; a name that begins with `*` leaving out every table whose name ends with the rest of it, so that what a feature keeps aside is not read as drift) MUST each have a default and be changeable.

## What the database holds

- **FR-012**: On SQLite, DuckDB and PostgreSQL, a database made by `bind` for one version of a domain (outside the lifecycle) MUST be read as the state of that version, drift made by hand MUST be found, reviewed convergence to the next version MUST leave the database as `bind` makes it for that version, autonomous convergence MUST apply what only adds and hold what does not, and a stale proposal MUST be refused.
- **FR-013**: The reader MUST read each column's default as the catalog says it and compare it with the state wanted after casts, outer parentheses, spaces and case outside quotes are set aside, so that a default changed by hand is a difference and a default the model made is not; and where a project says `unmanaged: hold`, a table, a column, an index or a constraint that is in the database and not in the model MUST be left out of the state read, so that no step touches it, and MUST be named in the proposal as held.

## Out of scope

- Comparing defaults, the text of checks and partitions with the catalog: said by each dialect and left to the strategy that reads.
- Signing the approval: the approved hash is what is checked; who approved it is the project's workflow.
- Converging many databases at once: each is met on its own.

## Edge cases

- A table made by hand that governance does not know: a table to drop, quarantined, per FR-003.
- A database restored from a backup of an older release: the plan from that state, per FR-004.
- A proposal approved and then the database changed: refused as stale, per FR-005.
- Two application instances starting together: one applies and the other waits, then finds nothing to do, per FR-007.
- Autonomous on a plan that renames a column: held, per FR-007.
- The policy off: every plan held, per FR-008.

## Assumptions

- The catalog is read inside no transaction of its own and is the state of the moment.
- A code table's rows are part of the state; other data is not.

## Open questions

- **OQ-1**: Whether the held plans are also written as proposals to a place a person is told of, and by whom.

## Key entities

- **Live state** - the state read from a database's catalog.
- **Proposal** - a plan pinned to the state it was computed from.
- **Policy** - what may be applied with no one's approval.
- **Version gate** - the check that a database is where an application expects.

## Success criteria

- **SC-001**: Any database, however it came to be, is brought to the state wanted by a plan someone can read first, or by one that only adds.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
