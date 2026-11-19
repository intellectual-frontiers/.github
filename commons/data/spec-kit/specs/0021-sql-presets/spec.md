# Feature Specification: Presets

**Spec ID:** 0021-sql-presets
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** A project does not want to choose a strategy, then each feature, then each setting; it wants to say how its team works. A preset is named for the approach, not for a product, and is a composition of one strategy (history or convergence, 0018-sql-history, 0019-sql-convergence) with the features that approach needs (idempotency, quarantine instead of drop, lock discipline, generated verification, the governance-aware plan report), each with the settings the approach calls for. There are four, the two of convergence first and the default being reviewed convergence, because convergence reads each database's own state and so cannot be fooled by a history that a database has left: team-managed (the application's team writes the SQL, and the pipeline applies it), dba-managed (the SQL is written by people and handed to a database administrator as a release package that is checked before it is run), reviewed-convergence (a tool computes the SQL, a person approves it, and it is applied), and autonomous-convergence (a tool computes the SQL and applies it on first access, holding anything that does not only add). Every setting of a preset is the default of the thing it sets and can be changed by the project, so a preset is a starting point and never a cage.

## The presets

- **FR-001**: `preset` MUST give, for each of the four names (`team-managed`, `dba-managed`, `reviewed-convergence`, `autonomous-convergence`), the strategy it uses, the settings of that strategy, the settings of the safety features, of idempotency and of the plan report, and what `plan` and `execute` are given (the transforms in the order quarantine, locks, validation, verification, then idempotency; whether a step that only the ledger keeps from running twice is refused; and the retry), and MUST refuse, as an error value, a name that is not one of the four.
- **FR-002**: `team-managed` MUST use the history strategy delivered by the pipeline; `dba-managed` MUST use the history strategy delivered as a release package, with a guard the dialect cannot write refused and a step that only the ledger keeps from running twice refused, because a person runs those files by hand and may run them twice; `reviewed-convergence` MUST use the convergence strategy with reviewed approval; and `autonomous-convergence` MUST use it with autonomous approval, the default policy that only adds, a lock timeout shorter than the other presets and more attempts, because a first access must not hold an application's start for long.
- **FR-003**: Every preset MUST have idempotency, quarantine instead of drop, lock discipline and generated verification on, and the plan report on, unless the project turns one off; and where quarantine is on, a convergence preset MUST leave the tables it keeps aside out of what the reader reads, and the integrations' ledger table, so that what was quarantined and what was loaded is not found as drift and a second apply still finds nothing to do.

## Changing a preset

- **FR-004**: A project's changes to the settings of the strategy, of safety, of idempotency or of the plan report MUST be taken over the preset's, setting by setting (what it does not say stays the preset's), and a change to the settings of a strategy the preset does not use MUST be refused as an error value naming both.

## Working end to end

- **FR-005**: On real engines, `autonomous-convergence` MUST bring a database to the state wanted on first access, hold a plan that does not only add and change nothing, and find the next access current; and `reviewed-convergence` MUST propose a plan, apply it only with the hash of the approved text, and find a second apply has nothing to do.

## Out of scope

- A preset for a product's file format: interchange is on the roadmap.
- A choice between presets made by the library: the project's.

## Edge cases

- A name that is a product (`flyway`): refused, per FR-001.
- A project that turns every feature off: allowed, and said by the settings it gets back, per FR-003.
- Settings given for convergence to `team-managed`: refused, per FR-004.

## Assumptions

- A preset is data: nothing is applied by choosing it.

## Open questions

- **OQ-1**: Whether presets can be given by a project's own name for its own compositions.

## Key entities

- **Preset** - a named composition of a strategy and features, with each setting.
- **Strategy** - history or convergence.

## Success criteria

- **SC-001**: A project says how its team works and gets a reliable setup, and changes only what it must.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
