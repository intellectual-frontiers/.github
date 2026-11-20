# Feature Specification: GRC headless verbs

**Spec ID:** 0007-grc-surface
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** GRC is used from a terminal, a script or an agent through four verbs of a branch `grc`, made with Headless (commons headless 0002-headless-governance and commons headless 0003-headless-output): `check`, `assess`, `explain` and `evidence`. The branch is made by a function that is given a host (the governance documents, the registries of runners, stores, serializers and signers, and the clock), so that it names no runner and no store.

## The verbs

- **FR-001**: `grcBranch(host)` MUST give a branch `grc` of exactly the commands `check`, `assess`, `explain` and `evidence`, each declared as an action of Headless with its kind, effect and reach, and the model MUST have no defect by Headless' `modelProblems` with the reach required.
- **FR-002**: `grc check [id...]` MUST run the checks (all, or those named) over the subjects of the host, be a read-only report, and return the results as the data of the outcome, a problem for each result that is not `pass`, `accepted` or `not-applicable` (a `fail` as an error, a `pending` or `warn` as a warning), and the exit status of Headless' governance for those problems.
- **FR-003**: `grc assess [--format <id>] [--out <file>]` MUST assemble the assessment from the results and exceptions, apply the exceptions, and write it through the serializer the format names in the registry of serializers (the document itself where none is named); an unknown format MUST be a usage problem that names the registered ids; writing a file MUST make it an action that `--dry-run` previews.
- **FR-004**: `grc explain <id>` MUST say, for an id of a control URN, policy, check or requirement, what it is, what it maps to and what shows it, and for a result id why it has its status; an unknown id MUST be a problem that names the nearest ids.
- **FR-005**: `grc evidence [list|verify]` MUST list the evidence of the store the host gives with its digests and ages and by `verify` read each object back and report every digest that does not match, a read-only report whose mismatches are errors.
- **FR-006**: Every verb MUST give the same data under `--json` as the typed outcome holds, and MUST write nothing but what it was asked to write.

## Scenarios

- **Given** a host with one failing check, **When** `grc check --json` runs, **Then** the data holds the result, the exit status is that of an error problem, and nothing is written, per FR-002.
- **Given** `grc assess --format nothing`, **When** the verb runs, **Then** a usage problem names the formats registered, per FR-003.

## Out of scope

- A tool-server or REST surface (Headless gives those beside the command line); the editing of governance documents.

## Edge cases

- No checks loaded: `check` reports an empty run and a hint, not a failure, per FR-002.

## Assumptions

- The host is made by the program that uses the library, which registers the runners it wants.

## Open questions

- **OQ-1**: Whether `grc check` should offer `--on` to run on Headless' targets.

## Key entities

- **Host**, **Branch**.

## Success criteria

- **SC-001**: A program of three lines that registers a runner gives a working `grc check`.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
