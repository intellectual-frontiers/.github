# Feature Specification: Integrations verbs

**Spec ID:** 0009-integrations-verbs
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The headless verbs of Integrations are commands of Headless built from the typed cores: `integrations observe|probe|check` for connectors and `integrations validate|translate|send|receive|explain` for exchange. Each declares its action and its reach policy; each outcome is typed; every outcome of a verb over a document is passed through the redaction of Headless over the values of the payload. A tool server and a REST surface slot in beside them later.

## The verbs

- **FR-001**: The surface MUST give the verbs `observe`, `probe`, `check`, `validate`, `translate`, `send`, `receive` and `explain`, built from `Deps`, a record of ports (connectors and their read ports, plugins, schemas, agreements, files, transports and the clock), so that a verb is a function of its ports and a test runs it over in-memory ones.
- **FR-002**: Each verb MUST declare its action and a reach policy: the reading verbs `report` and read-only on every channel; `translate`, `send` and `receive` actions that change something and are not reachable over `ssh`.
- **FR-003**: No verb over a document MUST say a value of the payload in its text, its data, its problems or its hints: the outcome MUST be redacted over the values of the tree, and a test MUST show a payload value absent from the JSON of every such verb.
- **FR-004**: `explain` MUST say one sentence for each finding code and refuse a code it does not know.
- **FR-005**: A missing credential MUST be a pending problem naming the reference (never a value), an unreached partner a failure with the kind, and a `send` MUST leave the exchange in the state the transition function gives.

## Acceptance scenarios

1. **Given** a document whose patient name is `Zyxwvut`, **When** `validate` runs and finds a problem there, **Then** `Zyxwvut` is not in the outcome, per FR-003.

## Out of scope

- The tool server and REST surfaces; the process entry that wires real ports.

## Edge cases

- A code `explain` does not know: a failure naming it, per FR-004.

## Assumptions

- Deps are wired at the edge by the program that draws the verbs.

## Open questions

- None.

## Key entities

- **Verb** - a command of Headless.
- **Deps** - the ports a verb needs.

## Success criteria

- **SC-001**: The same verbs run here and anywhere, and say nothing of a payload.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
