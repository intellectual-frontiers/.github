# Feature Specification: Headless machine verbs

**Spec ID:** 0006-machine-verbs
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Two verbs for asking a machine something: `machine query` takes a query string and `machine check` a check id, each with a target selector, and neither learns what a query is. What answers them (SQL, the schema of osquery, a check of governance, risk and compliance) sits in the data library and the grc library, which give a backend to the verbs; Headless imports neither.

## The verbs

- **FR-001**: The library MUST give the branch `machine` with the verbs `query` and `check`, each a report that only reads and is safe to repeat, reached through every channel (`local`, `ssh`, `mcp`, `rest`), so that each takes `--on <targets>` (an id, ids joined by commas, `class:<class>` or `all`) with the target selector of 0005-reach-and-targets and is dispatched there as `<program> run --json machine <verb> ...`, and each MUST be a model with no defect (`modelProblems` finds none, `requireReach` included). Taken from: the plan of this library (machine verbs take a check id or an opaque query plus a target selector).
- **FR-002**: `machine query` MUST take exactly one query, an opaque string that is handed to the backend byte for byte (spaces, quotes, newlines and all) and never parsed, trimmed or interpreted here; `machine check` MUST take exactly one check id, one line with no NUL, and where the backend names the checks there are, an id that is not one MUST be refused with the nearest named; a wrong number of words MUST be a failure with a stable code (`E000-USAGE-QUERY`, `E000-USAGE-CHECK`) and the backend MUST NOT be called. Taken from: the plan of this library.
- **FR-003**: No unit of Headless MAY import the data library, the grc library or the ontology library, and the verbs MUST name no SQL, no osquery table and no check of grc: the layers check MUST find an import of any of them (`layers/external`), and what a backend is MUST be only a function from a query string or a check id and the context of a run to a typed outcome. Taken from: the decision that headless is about actions and the SQL, the osquery schema and the check sit in data and grc.

## Acceptance scenarios

1. **Given** the verbs with a backend, **When** the model is checked with the reach policy required, **Then** there is no problem, per FR-001.
2. **Given** a query with quotes, spaces and a newline, **When** `machine query` runs, **Then** the backend gets exactly that string, per FR-002.
3. **Given** two words after `machine query`, **When** it runs, **Then** it fails with `E000-USAGE-QUERY` and the backend is not called, per FR-002.
4. **Given** a backend that knows the check `disk-free`, **When** `machine check disk-fre` runs, **Then** it fails naming `disk-free`, per FR-002.
5. **Given** a source of the logical layer that imports the data library, **When** the layers check runs, **Then** `layers/external` is found, per FR-003.
6. **Given** `machine query 'q' --on class:server` with two servers, **When** it runs, **Then** each is asked through its executor as `run --json machine query q`, per FR-001.

## Out of scope

- The backends: SQL, osquery and the checks of grc, which their libraries give.
- Fan-out over targets and the mapping of what comes back (0005-reach-and-targets).

## Edge cases

- A query of only white space: still one query, handed over as it is; an empty one is refused, per FR-002.
- A check id with a newline: refused, per FR-002.

## Assumptions

- A program that uses the verbs gives a backend and, where it wants remote runs, its targets and executors.

## Open questions

- None.

## Key entities

- **Machine backend** - the function that answers a query string or a check id.
- **Target selector** - which targets a verb is run on.

## Success criteria

- **SC-001**: A program asks any machine anything its backend can answer, and Headless has learned none of it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
