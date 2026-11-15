# Feature Specification: Test evidence

**Spec ID:** 0008-test-evidence
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Running tests so that each run is objective evidence a quality system can keep: what was tested, against which requirement, at what risk, on what installation, with what outcome, run by which role, kept so that a change to the record afterwards is detected. It follows what the regulations and standards ask of software verification records: the FDA's Quality Management System Regulation (21 CFR 820, which incorporates ISO 13485:2016) and its Computer Software Assurance guidance (a risk-based record of the intended use, the risk, the assurance done, when and by whom, the issues found and the conclusion); 21 CFR Part 11's audit trail and signatures linked to their records with their meaning, applied as design guidance; ISO/IEC/IEEE 29119-3's test log, incident report and completion report; and installation, operational and performance qualification. The record of a run is one file of OpenTelemetry (0006-signals), using its `test.*` conventions; TAP 14, JUnit XML, CTRF, SARIF 2.1.0, OSCAL assessment results and a completion report are each a pure rendering of that one record, so every report of a run agrees with every other. It replaces `deno test`'s reporters with a record that is the same on Deno, Node and Bun (0005-typescript-runtime FR-013).

## Capture (runtime)

- **FR-001**: `runtime/test.ts` MUST record every test it registers, by its own code and not a runner's reporter: its id (the SHA-256 of its file and name), its file, its name, the requirements it proves, its risk (`high` or `not-high`, given as an option and `not-high` by default, after the Computer Software Assurance guidance's high process risk), its start and end time, its outcome (`pass | fail | skip | todo | cancelled`), a skip's or todo's reason, a failure's message, expected and actual values (redacted by 0006-signals FR-006 and cut to 4096 characters), and the attempt number.
- **FR-002**: Each test MUST be recorded as a `test` span and an OpenTelemetry log record, with the `test.case.name`, `test.case.result.status` (`pass` or `fail`, as OpenTelemetry defines it), `test.suite.name` (the file) and `test.suite.run.status` conventions and the `ifc.test.*` attributes for the rest; its parent MUST be the run's span from `TRACEPARENT` (0006-signals FR-017).
- **FR-003**: The resource of the record MUST be the installation record: `process.runtime.name` and `process.runtime.version`, `os.type`, `host.arch`, `vcs.ref.head.revision` where it is known, `ifc.test.lockfile.sha256` and `ifc.test.pins.sha256` where given, and `ifc.test.role` (the role that ran it, `ci` or `developer` by default). It MUST NOT carry a person's name, user name, e-mail address or host name; an attribute of the conventions that names a person (`user.*`, `enduser.*`, `host.name`) MUST be refused.
- **FR-004**: Where `IFC_TEST_RECORD` names a file, each test process MUST append its records to it as OTLP JSON lines as each test ends, so that a process that dies keeps what it finished; a test that started and did not end before its process exited MUST be recorded as `cancelled`. Where it is not set, records MUST go to the installed pipeline (0006-signals) if any, and otherwise be kept in memory for the process.

## The run (runtime and tools)

- **FR-005**: `runtime/test-run.ts` MUST run a suite: start one trace with a `test run` span, run `node --test`, `deno test -A` or `bun test` (chosen, one or several in turn) with `TRACEPARENT` and `IFC_TEST_RECORD` set, pass the runner's own output on, gather every process's records into one OTLP JSON file for the run (`<out>/<trace id>.otlp.json`) with the run's span, and say where it is. `tools/test.ts` (`ifc test`) MUST be its command line.
- **FR-006**: A run MUST fail (exit 1) when a test failed, when a runner exited non-zero, when a test is `cancelled`, or when a requirement of the list given (`--requirements`, one id per line or a spec-kit enforcement register's rows of mechanism `check`) is neither proven by a test of the run nor declared `reviewed` with its reason; the run's span MUST say which, by `test.suite.run.status` and `ifc.test.unproven`.
- **FR-007**: The record of a run MUST be the evidence: kept as written, read only through the decoder of 0006-signals FR-004, and its digest the SHA-256 of its bytes.

## Reports (kernel)

- **FR-008**: `kernel/test-report.ts` MUST read a run's record into a typed model (the run, its installation record, its tests, its requirements) and render it, purely, as: TAP version 14 (a plan, `ok` and `not ok` numbered, `# SKIP` and `# TODO` with their reasons, a YAML diagnostic block for a failure with its message, expected, actual and requirements, one subtest per file); JUnit XML (one `testsuite` per file and runtime, `testcase` with `classname` and time in seconds, `failure`, `skipped`, and the requirements as `properties`); CTRF JSON (its `results.tool`, `summary` and `tests`, the requirements and risk under `extra`); SARIF 2.1.0 (each failed test a result at its file, with the requirement as a rule); and OSCAL 1.1.2 assessment results (0007-grc FR-017) with one observation per test and one finding per requirement.
- **FR-009**: The kernel MUST render a test completion report, in Markdown and in HTML that needs nothing outside itself: the summary; the installation record; a requirement trace matrix (each requirement, the tests that prove it and their outcomes, or that it was reviewed, waived or left unproven); the incidents (each failure, cancellation and skip with its reason); high-risk requirements and whether they have a signed review; the conclusion; and the signatures on the run with their meaning and role.
- **FR-010**: The counts in every rendering of a record (tests, passed, failed, skipped, todo, cancelled) MUST be equal to the model's, and a rendering MUST hold no time or value that is not in the record, so that rendering a record twice gives the same bytes.

## Evidence (kernel and runtime)

- **FR-011**: A run MUST append the digest of its record to an evidence ledger (0007-grc FR-007) with the kind `test-run`, and MAY sign it: an in-toto Statement v1 whose subject is the record and whose predicate is the in-toto Test Result (`https://in-toto.io/attestation/test-result/v0.1`: the result `PASSED`, `WARNED` or `FAILED`, the configuration as resource descriptors, and the passed, warned and failed tests), in a DSSE envelope, and the signature entered in the ledger with its meaning (`executed`, `reviewed` or `approved`), its role and its time, so that the signature is linked to its record.
- **FR-012**: `ifc test verify` MUST check that a record's digest is in the ledger, that the ledger's chain is whole, and that each envelope given verifies with the key given and names the record's digest; it MUST fail and say which when any does not.
- **FR-013**: A requirement whose tests are of `high` risk MUST be reported as needing a signed review, and `ifc test verify --require-review` MUST fail until a signature of meaning `reviewed` is in the ledger for the run.
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
