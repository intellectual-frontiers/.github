# Feature Specification: flow-ledger

**Spec ID:** 0060-flow-ledger
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The first stage of the toolkit of the book "Accepted Is Not Correct" (chapters 1, 6, 11 and 13), as a governed model and the code that works on it: every stage of a pipeline reports success in its own terms, so each confirmation is a row of a ledger that is only added to, every accepted object has a load id from the first stage, the intake of a delivery says whether it is the first, a duplicate or a conflict and never overwrites, a manifest is reconciled to what was accepted and what was lost with a reason so that nothing is unexplained, and a load is undone by its id. The model names no domain (a message, a batch and an entity are what a pipeline moves); the worked examples of the book are its tests. What produces the stage events and the reason codes (the codecs, the validation findings, the acknowledgements) is `commons/integrations`'s, which defines a ledger port that this library's SQL satisfies by shape; this library imports nothing of it.

## Requirements

- **FR-001**: The model MUST be a module of governance named `flow` that requires nothing, with the stages of a pipeline as a closed code list in their order (received, captured, parsed, mapped, validated, forwarded, destVerdict, usable) and a closed code list for each other thing that is said of one (outcome, grain, load type, disposition, conflict status), and an open list of who produces a reason code; every concept and every code list MUST be defined.
- **FR-002**: A reason MUST be a record whose code is its identity, with what it means, who produces it and, where it is of one, its stage, so that the codes that an integration produces can be carried as data and no loss is unexplained.
- **FR-003**: A load MUST be a record with an id that is given at the first stage, its type (delivery, backfill, incremental or replay), its sender, the tenant where there is one, when it began and, where it was undone, when.
- **FR-004**: The stage contract of a pipeline MUST be a record (the stage, what it may assume, what it guarantees, who owns it, how its failure is found and the grain of its rows), and a row of the ledger MUST say what one stage confirmed of one message, batch or entity, with the load it was in and a reason where it did not pass, and the ledger MUST be annotated append-only.
- **FR-005**: The intake MUST be records: a delivery (the tenant and the sender's id, the SHA-256 of its first content, how many times it has been delivered, when it was first seen and the load of its first delivery) and a conflict (a delivery with the id of one already taken and other content, with its status), so that a redelivery is safe and a change is never an overwrite.
- **FR-006**: The reconciliation MUST be records: a manifest (what a sender says a batch holds), the number of entities each stage confirmed of it, and the losses (the stage they stopped at, how many and the reason).
- **FR-007**: `openLoad` MUST give a load an id (the caller's or a made one) and record it, and `confirm` MUST add the confirmations to the ledger, each with the id of its load, its subject and its stage, so that the same confirmation twice is refused by the database.
- **FR-008**: `lastConfirmed` MUST give for each subject the last stage that confirmed it and what it said, and `gaps` MUST give exactly the subjects whose last row is the stage given and passed: the messages that vanished.
- **FR-009**: `intake` MUST say `first` for a message not seen, record it and let the caller make its one effect; `duplicate` for the same message with the same content, counting it; and `conflict` for the same id with other content, queueing it once and leaving the original as it is; two deliveries of one message at once MUST give one `first`.
- **FR-010**: `funnel` MUST give for each manifest what was accepted, what was lost with a reason and what is unexplained (the manifest less the two), and where it is not 0 the boundary between two stages at which entities went missing without a reason, and how many.
- **FR-011**: `rollbackLoad` MUST remove from each table that carries a load's id the rows of that load and no others, mark the load as undone, and leave the ledger as it was, so that what the load confirmed stays as the record that it was made and undone.

## Out of scope

- Producing stage events from a codec or a validator, and the acknowledgement kinds: `commons/integrations`'s; the codes it produces are carried here as data, and a conformance test of a consumer proves that the two sets agree.
- Replay of the raw copy, the restore drill and the dry-run of a rollback: a later stage (0066 and after).
- A queue or a stream: a later stage; the load id and the intake are what they will use.

## Edge cases

- A subject with no row at all is not in the ledger and cannot be found by it: the manifest is what counts it, per FR-010.
- A message that is refused at a stage has a row with a reason and is not a gap, per FR-008.
- The stage whose count is "accepted" is a parameter of `funnel`; `destVerdict` where not given, per FR-010.
- Call `intake` outside a transaction: a refused insert ends one on some engines, per FR-009.

## Assumptions

- The tables are made by `bind` from the model on any of SQLite, DuckDB and PostgreSQL; the append-only trigger is the database's where the engine has triggers.
- The examples of the book are synthetic, and so are the tests'.

## Open questions

- **OQ-1**: Whether `confirm` should also write to the OpenTelemetry signals of the telemetry library as a span event, for the observability stage.

## Key entities

- **Load** - an id given at the first stage and carried on every row and effect.
- **Ledger entry** - what one stage confirmed of one thing.
- **Delivery** - the intake of a message: its first content and how many times it came.
- **Manifest** - what a sender says a batch holds, which the funnel reconciles.

## Success criteria

- **SC-001**: For any message, which stage last confirmed it, what the destination said and whether the consumer could use it are one query; a manifest reconciles to 0 unexplained or says where the entities went missing; and a load is undone by its id without touching another.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
