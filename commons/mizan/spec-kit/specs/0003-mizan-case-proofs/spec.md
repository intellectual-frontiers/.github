# Feature Specification: Mizan case proofs

**Spec ID:** 0003-mizan-case-proofs
**Status:** Draft
**Owner:** if
**Domain:** mizan

**Input:** The trace check reads which requirements a test proves from the array of a `proves(` call and from the `Proves:` lines of a test file (commons 0015-trace FR-006, FR-012). A case of an acceptance test (commons 0042-tests-as-workloads) is typed data in a file of workloads, where `proves` is a property of an object and not a call, so the reader does not see it and a requirement that only a case proves would be reported as unproved. This specification makes the reader read that property. It is governed by commons 0042-tests-as-workloads (audit rows A1, F1, F2). **Every requirement that asks for code is Deferred.**

## Requirements

- **FR-001**: The trace check MUST read, in a file it is given as a test file, the property `proves` whose value is an array of string literals (or of names of constants that hold string literals, as it reads the array of a `proves(` call), and MUST count each citation of the grammar `NNNN-slug FR-NNN` as a proof of that requirement, with the line of the property. Relies on audit rows: A1, F1.
- **FR-002**: A property named `proves` that is not an array of literals and constants (a call, a spread of a value the reader cannot see) MUST NOT be read and MUST NOT be an error: the requirement stays unproved (`trace/unproved`) until a literal, a constant or a `// Proves:` line names it, as for a `proves(` call that builds its id at run time. Relies on audit rows: F1.
- **FR-003**: A case file MUST be a file whose name ends `.case.ts`, and the harness MUST give such a file to the trace check as a test file with no other configuration than the suffix; a case file MUST carry a `// Spec:` line like any source (`trace/no-spec-line`). Relies on audit rows: F2.
- **FR-004**: A citation in a case's `proves` of a specification that does not exist or of a requirement it does not have MUST be `trace/unknown-spec` or `trace/unknown-requirement` with the file and the line of the property, and a requirement that only a case proves MUST NOT be `trace/unproved`. Relies on audit rows: F1.
- **FR-005**: The capability trace (`capability-trace`) MUST class a case file as a test of the requirements it proves, as it classes a test file. Relies on audit rows: F2.
- **FR-006**: The reading MUST be pure over the text it is given and MUST be made once for each text, as the reading of `proves(` is (commons 0015-trace FR-013); it MUST NOT read the value of the property of a file that is not a test file. Relies on audit rows: F1.

## Acceptance scenarios

1. **Given** a case file with `proves: ["commons 0042-tests-as-workloads FR-001"]`, **When** the trace check runs, **Then** the requirement is proved, per FR-001.
2. **Given** `proves: citationsOfCase()`, **When** the file is read, **Then** nothing is read and no error is made, per FR-002.
3. **Given** a case that cites a requirement the specification does not have, **When** the check runs, **Then** it is `trace/unknown-requirement` at the line of the property, per FR-004.
4. **Given** a file `x.case.ts`, **When** the harness lists the test files, **Then** it is one, per FR-003.
5. **Given** a file that is not a test file with a property `proves`, **When** it is read, **Then** it proves nothing, per FR-006.

## Out of scope

- The case itself and its static checks (workload 0017-workload-test-cases); the record of a run (quality 0003-quality-case-runs).

## Edge cases

- A file that has both a `proves(` call and a property `proves`: both are read and the requirements are the union, per FR-001.

## Assumptions

- The harness's configuration gives the check the test files by a suffix list that the suffix `.case.ts` can be added to.

## Open questions

- None of its own; see commons 0042-tests-as-workloads OQ-3.

## Key entities

- **Case file** - a file `<name>.case.ts` that holds a case.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0042-tests-as-workloads it relies on
