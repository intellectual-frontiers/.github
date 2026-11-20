# Feature Specification: Test evidence

**Spec ID:** 0008-test-evidence
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Running tests so that each run is objective evidence a quality system can keep: what was tested, against which requirement, at what risk, on what installation, with what outcome, run by which role, kept so that a change to the record afterwards is detected. It follows what the regulations and standards ask of software verification records: the FDA's Quality Management System Regulation (21 CFR 820, which incorporates ISO 13485:2016) and its Computer Software Assurance guidance (a risk-based record of the intended use, the risk, the assurance done, when and by whom, the issues found and the conclusion); 21 CFR Part 11's audit trail and signatures linked to their records with their meaning, applied as design guidance; ISO/IEC/IEEE 29119-3's test log, incident report and completion report; and installation, operational and performance qualification. The record of a run is one file of OpenTelemetry (0006-signals), using its `test.*` conventions; TAP 14, JUnit XML, CTRF, SARIF 2.1.0, OSCAL assessment results and a completion report are each a pure rendering of that one record, so every report of a run agrees with every other. It gives a record that is the same on Bun and Node (0005-typescript-runtime FR-013), whatever the runner's own reporter says.

## Capture (runtime)

- **FR-001**: The runtime MUST take the record of every test it registers from the library `test` (`@intellectual-frontiers/test`, test 0001-test FR-004), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-002**: The runtime MUST take the span and log record of a test with the test conventions from the library `test` (`@intellectual-frontiers/test`, test 0001-test FR-005), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-003**: The runtime MUST take the installation record as the resource of a test's record from the library `test` (`@intellectual-frontiers/test`, test 0001-test FR-006), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-004**: The test run requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-001), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.

## The run (runtime and tools)

- **FR-005**: The test run requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-002), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-006**: The test run requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-003), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-007**: The test run requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-004), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.

## Reports (kernel)

- **FR-008**: The test run requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-005), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-009**: The test run requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-006), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-010**: The test run requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-007), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.

## Evidence (kernel and runtime)

- **FR-011**: The test run requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-008), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-012**: The test run requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-009), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-013**: The test run requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-010), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-014**: CI MUST run the suite of `commons/ts/` through `ifc test` on each runtime and system of 0005-typescript-runtime FR-018 and keep the record and its reports as the job's artifacts.

## Out of scope

- Electronic signatures as 21 CFR Part 11 defines them for a regulated record (signer identity, signature manifestations with a name): a harness that holds identities adds them through its own signer; this repository is public and names roles alone.
- Validation of the tools themselves (TypeScript, the runtimes, the runners) beyond recording their versions.
- Performance qualification: what a harness measures in use, not what a test suite records.

## Edge cases

- A test that throws an `AssertionError` with expected and actual values: `fail`, with both values kept, per FR-001.
- A test whose actual value holds `Bearer abc`: written `Bearer REDACTED`, per FR-001.
- A test skipped with the reason `windows has no file modes`: `skip` with that reason, in TAP as `# SKIP windows has no file modes`, per FR-001 and FR-008.
- A test process killed in the middle of a test: the test is `cancelled`, the tests before it kept, and the run fails, per FR-004 and FR-006.
- `ifc.test.role=alice@example.com`: refused, as a person's address, per FR-003.
- A requirement in the list that no test proves and no review declares: the run fails naming it, per FR-006.
- The same record rendered twice to JUnit: the same bytes, per FR-010.
- A record changed by one byte after the run: `ifc test verify` fails, as its digest is not in the ledger, per FR-012.
- A high-risk requirement with no signature of meaning `reviewed`: `verify --require-review` fails, per FR-013.

## Assumptions

- OpenTelemetry's `test.*` attributes are in development; their names are used as they stand, with the rest under `ifc.test.*`.
- TAP 14 is stable though no longer maintained, and CTRF's version 1 schema may still change; both are renderings, so a change touches one function.
- The `TRACEPARENT` carrier reaches the test processes of all three runners, which pass their environment on.

## Open questions

- **OQ-1**: Whether to add the Linux kernel's KTAP, or JUnit's later forms, when a consumer asks.
- **OQ-2**: Whether performance measurements belong in the record as metrics (0006-signals FR-013) for performance qualification.

## Key entities

- **Test record** - the OTLP file of one run: its run span, its installation record and a span and log record per test.
- **Installation record** - the resource of a record: runtime, system, revision, lockfile and pins, and the role.
- **Rendering** - TAP, JUnit, CTRF, SARIF, OSCAL or a completion report, a pure function of a record.
- **Signature** - a DSSE envelope over a record, entered in the ledger with its meaning and role.

## Success criteria

- **SC-001**: One record per run, on any of the three runtimes, from which every report is rendered.
- **SC-002**: A reviewer can trace every requirement of a specification to the tests that prove it, their outcomes and the installation they ran on, from the completion report alone.
- **SC-003**: A change to a kept record is detected by `ifc test verify`.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
