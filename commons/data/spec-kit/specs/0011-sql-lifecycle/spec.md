# Feature Specification: The lifecycle of a physical schema

**Spec ID:** 0011-sql-lifecycle
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** A database outlives the schema it was made from, so what changes it from one physical schema to the next is a layer of its own, between the physical schema (0007-physical) and the extensions that use it. The lifecycle does not name a tool or a workflow; it makes what every workflow needs. It takes the state a database is in (the written structure of its tables, as a canonical value with a hash, so that a state is addressed by its content and never by a number), finds what differs from the state wanted by the identity of each element and not by its name, classifies each change (what could be lost, whether it can be undone), makes the ordered steps that move one state to the other with the statements to do it and to undo it, keeps a ledger that cannot be changed without being found out, and runs the steps on a real engine, each in a transaction, refusing to run on a base it was not made for. The strategies (0018, 0019) and the features (idempotency, safety, protection) are extensions of this core.

## The unit and the state

- **FR-001**: The lifecycle MUST be a unit of its own, `sql/lifecycle/`, whose public surface is the entry `./sql/lifecycle` of the package's `exports`, that imports the physical and logical schemas, governance and the engine and nothing else, and that names no engine.
- **FR-002**: A state MUST be a plain, serializable value that holds, for a logical schema bound to a dialect and a naming, every table with its words and written name, its columns (words, written name, written type, nullability, written default), its primary key, foreign keys, uniques, checks and indexes by identity and written form, its table clause and the rows of its code table; and `stateHash` MUST be the SHA-256 of its canonical JSON, the same for the same structure whatever the order of its tables and columns, and different when the dialect or the naming differs.
- **FR-003**: `bind` MUST mark each statement it makes as the core's or an extension's (`origin`), so that what the lifecycle diffs (the core's tables, constraints, indexes and rows) is told from what it applies again (what extensions add).

## Changes

- **FR-004**: `diff` MUST give the changes that take one state to another, matching tables and columns by their words and not by their written names, so that a change of case style is a rename and not a drop and an add, and matching a table or column that carries `lifecycle.renamedFrom` with the element of that name; each change MUST have a key, stable for the same change, that a hand-written step names.
- **FR-005**: `applyChange` MUST give the state that a change leads to, so that applying the changes of `diff(a, b)` to `a` gives a state of the hash of `b`; a plan whose steps do not end at the hash of the state wanted MUST be an error value.
- **FR-006**: Each change MUST be classified `safe`, `data-dependent` (it may fail or change on the data that is there), `destructive` (it loses data) or `manual` (the engine cannot do it in place, or it may lose data in a way only a person can judge), and as `lossless` (undone without loss by its down statements), `quarantine` (undone from what an extension kept) or `irreversible`.

## Plans

- **FR-007**: A plan MUST be the ordered steps from the state a database is in (or from none, an empty database) to the state wanted, each with the hash of the state it needs and of the state it leaves, an identifier made of its content, a name a person reads, its class, its reversibility, the statements that do it and, where it has one, the statements that undo it, and the logical elements it is made from; a plan between equal states MUST have no step; the order MUST be renames, then drops of constraints and indexes, then changes of columns, then new tables, then new constraints, indexes and rows, then drops of tables.
- **FR-008**: A plan MUST refuse, as error values returned together, a destructive step that was not allowed, and a change that the dialect cannot do in place and no hand-written step resolves; a hand-written step MUST replace the statements of the change whose key it names and be marked as written by a person, and one that resolves no change MUST be an error value.
- **FR-009**: What extensions add to the schema, and the setup the core makes, MUST be repeatable objects of the plan, each with a key and the hash of its text, and `dueRepeatables` MUST give those whose hash is not the one last applied.

## The ledger and the run

- **FR-010**: A ledger MUST be a list of entries, each with the identity and the hashes of what was applied and a chain hash made of the entry before it, so that `verifyChain` finds an entry that was changed, taken out, added or moved.
- **FR-011**: `execute` MUST apply a plan to a driver (a way to run statements and read rows) by making the ledger table where there is none, reading the ledger and checking its chain, finding where the database is among the plan's states (nothing to do, the start, or after a step) and refusing as an error value a database that is in none of them, then running the setup the plan holds (a schema, an extension its types need), then each step's statements with its ledger entry in one transaction, then what extensions add, so that a step that fails leaves the database and the ledger as they were; run again it MUST do nothing.
- **FR-012**: On SQLite, DuckDB and PostgreSQL, the steps of a plan from an empty database, and then of each plan from one version of a domain to the next, MUST leave the database with the tables, columns, nullability, keys and indexes of the physical schema bound for the domain's latest version, and the ledger MUST hold one entry for each step.
- **FR-013**: For any two states, `applyChange` over `diff` MUST reach the second, and the diff of a state with itself MUST be empty.

## Governance

- **FR-014**: Governance MUST have a vocabulary `lifecycle` of annotations that say what the physical schema cannot know: `renamedFrom` (the name an element had) and `since` (the release that made it).

## Out of scope

- Ways to change a database with no strategy: the strategies and features say how a plan is delivered, reviewed and made safe (0012 and the specifications after it).
- Reading a state from a live database: the convergence strategy's.
- Changing a primary key, a table clause (a partition) or a column's type in place: a hand-written step until the features of safety and rewrite.
- A constraint or an index renamed together with its table: it is dropped and made again.

## Edge cases

- A domain whose tables are written in camel case after being in snake case: renames of every table and column, per FR-004.
- A column that carries `renamedFrom`: one rename and no drop, per FR-004.
- A new column that is required and has no default, on a table that has rows: data-dependent, per FR-006.
- A column dropped: destructive and refused unless allowed, per FR-008.
- A type changed: manual, so a plan without a step for it is an error value, per FR-008.
- A plan run against a database in another state: an error value naming both hashes, per FR-011.
- A ledger entry deleted by hand: the chain breaks, per FR-010.
- A step that fails in the middle: rolled back, no ledger entry, per FR-011.

## Assumptions

- DDL is transactional on the engines the library supports, so a step is atomic; a step that cannot be (an index made concurrently) is the safety feature's.
- A hash is made by this layer itself, so that a plan is a pure function; it is the same SHA-256 the kernel makes.

## Open questions

- **OQ-1**: Whether a state is also kept as a file next to the migrations (a snapshot), or only the hash is, for the history strategy (0018).

## Key entities

- **State** - the written structure of a database's tables, addressed by its hash.
- **Change** - one difference between two states, with a key.
- **Step** - a change made into statements, classified, from one state hash to another.
- **Plan** - the ordered steps from one state to another and the repeatable objects.
- **Ledger** - the chained record of what was applied.

## Success criteria

- **SC-001**: Whatever workflow delivers a plan, the database it leaves is the one `bind` makes for the latest version.
- **SC-002**: No step runs on a database in a state it was not made for, and nothing destroys data unless it was allowed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
