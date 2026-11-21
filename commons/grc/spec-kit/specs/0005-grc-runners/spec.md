# Feature Specification: GRC runners

**Spec ID:** 0005-grc-runners
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** A check names a kind of runner and gives it an input; a runner is the extension that answers the question. The runner port is structural: a runner is given the things it needs (a connection that answers queries, a reader of files, a client, a remote) as small interfaces, so GRC depends on no database library, no HTTP client and no remote tool. `data`'s drivers, and the osquery driver that is coming (data 0058), satisfy the `sql` connection by shape, and Headless' targets satisfy `remote` by shape.

## The port

- **FR-001**: A runner MUST be `{ id, run(check, ctx) }`, its `id` being the kind a check names, returning `Result<Observation, RunnerProblem>`, where an observation is `{ value, observedAt, via, tookMs }` and `value` is JSON data; runners MUST be registered by kind in a registry of runners, and a second runner of one kind MUST be refused.
- **FR-002**: `runCheck` MUST, for a check and a subject, find whether the check applies to the subject's platform (a result of `not-applicable` where it does not), find the runner by the check's kind (a `grc.result` of status `error` naming the kind where there is none), run it, judge the observation by `evaluate` (0003), and make the `grc.result`; a runner that throws or returns a problem MUST give `error` for that subject and MUST NOT stop the other checks of `runChecks`.
- **FR-003**: The time MUST come from a clock the caller gives, and a run MUST be bounded by a timeout the caller gives.

## The runners

- **FR-004**: The `sql` runner MUST take its input as `{ query, params? }` and run it on a connection of the shape `{ query(text, params) -> rows, readOnly }` that the host gives; it MUST refuse a connection that is not read-only, and MUST refuse a query that the guard of the SQL language library (`@intellectual-frontiers/lang-sql/aide/guard`) does not judge, in the dialect of the connection (ANSI where none is given), to be a single read: more than one statement, a write, a `SELECT ... INTO` and a `PRAGMA` that sets are refused by the tree, so a word in a string or a comment is not code; the value is the rows. It MUST import no database library.
- **FR-005**: The `file` runner MUST take `{ path, format, select? }` and read the file by a reader the host gives, decode it as `json`, `lines` or `text`, and select a value by a JSON pointer (RFC 6901); a missing file is a problem, not a value.
- **FR-006**: The `api` runner MUST take `{ method, url, select? }` (`GET` and `HEAD` only) and call a client of the shape `{ fetch(request) -> { status, body } }` that the host gives; the value is `{ status, body }` or what `select` picks.
- **FR-007**: The `remote` runner MUST take `{ target, argv }` and run it on a remote of the shape `{ exec(target, argv) -> { code, stdout, stderr } }` that the host gives (the targets of Headless satisfy it); the value is the code and the output.
- **FR-008**: The `manual` runner MUST give the status `pending` until a `grc.attestation` for the check and subject exists that was made by a role the evidence policy lets attest and is not older than the policy's longest age, and then `pass` or `fail` by the attestation's claim; it MUST never answer a question by itself.
- **FR-009**: The `external` runner MUST delegate to an evaluator found by id in a registry of evaluators (`{ id, evaluate(input, data) }`); GRC ships none, so that OPA/Rego and CEL are optional adapters a third party registers, and an unknown evaluator id is a problem that names it.

## Conformance

- **FR-010**: A conformance suite for runners MUST run any registered runner against fixtures its author gives (an input and the value it must observe) and return each failure as data, and it MUST check that the runner gives the same value for the same input and never an exception; the suite is run on every runner of this library.

## Scenarios

- **Given** a check of kind `sql` and a connection that is not read-only, **When** the check is run, **Then** the result is `error` naming it, per FR-004.
- **Given** a check of kind `nothing-registered`, **When** the check is run, **Then** the result is `error` and names the kind, per FR-002.
- **Given** a check of kind `manual` with no attestation, **When** the check is run, **Then** `pending`; with a role not allowed to attest, `pending` and the reason, per FR-008.
- **Given** the query `select 1; drop table t`, **When** the check is run, **Then** it is refused, per FR-004.

## Out of scope

- Writing a driver for any database; scheduling runs; OPA and CEL adapters.

## Edge cases

- A check that applies to `linux` run on a `windows` subject: `not-applicable`, runner never called, per FR-002.
- A pointer to a missing member: a problem, per FR-005.

## Assumptions

- A host that wants writes through `sql` is out of the port: a runner reads.

## Open questions

- **OQ-1**: Whether an osquery connection should declare its tables so that applicability is checked before the run.

## Key entities

- **Runner**, **Observation**, **Registry of runners**.

## Success criteria

- **SC-001**: A new runner of a third party passes `conformance` and runs with no change to the core.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
