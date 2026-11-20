# Feature Specification: operating-model

**Spec ID:** 0063-operating-model
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The fourth stage of the toolkit of the book "Accepted Is Not Correct": the operating model and the watching of it. What the work waits on and from whom, with a status computed from its dates; decision records that replace one another; the limits and expiries that will stop the platform; the inventory of copies of data; the environments, the releases and the log of their promotion, in order and with evidence, and the parity of what runs in each; the workloads and the recorded statements that can be replayed and compared; the catalog of signals that every emitter is checked against; and the freshness of each source, computed from the loads of the flow model (0060). Its fixtures are from two domains: a hospital's nightly patient extract and a batch extract for analytics. Streaming is out of scope for now.

## Requirements

- **FR-001**: The model MUST be a module of governance named `operations` that requires nothing, with a waiting-on ledger as records of what is waited on, from whom, since when, by when, its status and when it came, with the status a closed code list (open, resolved, cancelled).
- **FR-002**: A decision MUST be a record of its title, context, outcome, consequences, status (proposed, accepted, rejected, superseded as a closed code list), who decided and when, and the decision it replaced.
- **FR-003**: A limit MUST be a record of what runs out, its kind (a closed code list: certificate, credential, quota, license, agreement), when, who renews it and how many days before it someone must act.
- **FR-004**: A copy of data MUST be a record of the dataset, the place, why it exists, who answers for it, its classification and when it was last refreshed.
- **FR-005**: An environment MUST be a record of its name (unique), its kind (a closed code list in the order of promotion: development, test, staging, production), whether it holds real data and its owner, and a release a record of the artifact and version (unique), when it was cut and its evidence, and the promotion log MUST be records of a release arriving in an environment, who, when and the evidence, annotated append-only.
- **FR-006**: A workload MUST be a record of its name (unique), owner, schedule and criticality, and a statement of it a record of a single select with the rows and the SHA-256 of the rows it gave when recorded.
- **FR-007**: A signal MUST be a record of its name, its kind (a closed code list: counter, gauge, histogram, event), unit, the attributes it carries, what it measures and who answers for it, and a freshness rule a record of a source (unique), the hours its latest load may be old and who is told; every concept MUST be defined.
- **FR-008**: `waitingOn` MUST list what is open, the oldest first, with the days it has been waited on and the status `overdue` where its date has passed and `waiting` where not; `resolveWait` MUST mark one as resolved with when.
- **FR-009**: `supersede` MUST accept the new decision with the one it replaced and mark the replaced one superseded, and `decisionsInForce` MUST list the accepted decisions and no others.
- **FR-010**: `limitsDue` MUST list the limits that are expired or within the days of notice their owner needs, the soonest first, with the days left, and not a limit that is further off or has no end.
- **FR-011**: `copyFindings` MUST list the copies with no owner, never refreshed, or not refreshed within the days given, each with the reason.
- **FR-012**: `promote` MUST add to the log a release's arrival in an environment only where the environment before it in the order has had it, and refuse, writing nothing, where it has not, where the release or environment does not exist, or where it goes to production with no evidence of the release or the promotion.
- **FR-013**: `parity` MUST give the version of an artifact that each environment last received and the environments that are not at the version of the furthest one, and `realDataOutsideProduction` MUST name the environments that hold real data and are not production.
- **FR-014**: `catalog` MUST read the signals and `sample` MUST make a sample with its kind and unit and throw for a name not in the catalog, attributes that are not exactly the signal's, or a counter that goes down.
- **FR-015**: `freshness` MUST give for each rule `fresh` where the latest load of its source that was not undone is within the hours, `stale` past them and `never-loaded` where there is none, with its age.
- **FR-016**: `replayWorkload` MUST run the recorded statements of a workload and say for each the rows it gave, the rows recorded and whether the rows are the same by their hash, and MUST refuse and not run a statement that is not a single select.

## Out of scope

- Streaming and the signals of a stream: a later stage; the catalog and the emitters are what it will use.
- Sending a sample to a telemetry backend: `commons/telemetry`'s; this library makes the sample and checks it, and imports nothing of it.
- Running a release or a rollback: the lifecycle runs the changes, and 0064 proves the recovery.

## Edge cases

- A wait with no date is never overdue, per FR-008.
- A release that is promoted to the same environment again is a new row of the log and the latest decides parity, per FR-013.
- Parity compares to the furthest environment that has any version, not to production by name, per FR-013.

## Assumptions

- The tables are made by `bind` from the model on any of SQLite, DuckDB and PostgreSQL; the fixtures of the tests are synthetic.

## Open questions

- **OQ-1**: Whether `sample` should also be given to the telemetry library as a typed emitter, once that library's own spec offers one.

## Key entities

- **Waiting** - what the work waits on, from whom, with a computed status.
- **Decision** - what was decided and what it replaced.
- **Limit** - what runs out and who renews it.
- **Promotion** - a release arriving in an environment: the log.
- **Signal** - a measurement every emitter agrees on.

## Success criteria

- **SC-001**: What the platform waits on, what will expire, which copies have no owner, what version runs where, which sources are stale and whether a workload still gives what it gave are each one call, with no step of a release skipped.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
