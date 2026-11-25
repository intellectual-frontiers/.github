# Feature Specification: Test

**Spec ID:** 0001-test
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Tests that run unchanged under `bun test` and `node --test`, and that each leave objective evidence: what was tested, against which requirement, at what risk, on what installation, with what outcome. A harness imports one module for its assertions and for `proves`, and its runs are recorded by the module's own code, not by a runner's reporter. This library is the registration and the record of one test; the run of a suite, the reports and the evidence ledger are the quality system's (commons 0008-test-evidence, commons 0021-ifqs).

## Registration

- **FR-001**: Tests MUST register through `test`, which MUST run on `node:test` and assert with `node:assert/strict` under short plain names (`assert`, `assertEquals`, `assertStringIncludes`, ...); `proves(requirements, name, fn)` MUST name each test for the requirements it proves and keep them for a report. The same test files MUST pass unchanged under `bun test` and `node --test`.
- **FR-002**: `test` MUST give `only` (a test run alone where any test is marked so: `node --test --test-only` runs it of itself, and on `bun test` the other tests of the file skip themselves), steps (`t.step(name, fn)` as subtests of `node:test`, recorded in the test's evidence as commons 0008-test-evidence records a test), and `assertAlmostEquals`, `assertNotMatch` and `assertNotStrictEquals`. Resource sanitizers and per-test permissions MUST NOT be given, as Node and Bun have neither: a test closes what it opens, by `using` and `await using`.
- **FR-003**: `test` MUST give `the(value, message?)`, which fails as `assertExists` does where the value is `null` or `undefined` and otherwise gives the value back narrowed to `NonNullable`, so that a test reads `the(map.get(k)).name`; `assertExists` MUST keep its form as an assertion.

## The record of a test

- **FR-004**: `test` MUST record every test it registers, by its own code and not a runner's reporter: its id (the SHA-256 of its file and name), its file, its name, the requirements it proves, its risk (`high` or `not-high`, given as an option and `not-high` by default, after the Computer Software Assurance guidance's high process risk), its start and end time, its outcome (`pass | fail | skip | todo | cancelled`), a skip's or todo's reason, a failure's message, expected and actual values (redacted by commons 0006-signals FR-006 and cut to 4096 characters), and the attempt number.
- **FR-005**: Each test MUST be recorded as a `test` span and an OpenTelemetry log record, with the `test.case.name`, `test.case.result.status` (`pass` or `fail`, as OpenTelemetry defines it), `test.suite.name` (the file) and `test.suite.run.status` conventions and the `ifc.test.*` attributes for the rest; its parent MUST be the run's span from `TRACEPARENT` (commons 0006-signals FR-017).
- **FR-006**: The resource of the record MUST be the installation record: `process.runtime.name` and `process.runtime.version`, `os.type`, `host.arch`, `vcs.ref.head.revision` where it is known, `ifc.test.lockfile.sha256` and `ifc.test.pins.sha256` where given, and `ifc.test.role` (the role that ran it, `ci` or `developer` by default). It MUST NOT carry a person's name, user name, e-mail address or host name; an attribute of the conventions that names a person (`user.*`, `enduser.*`, `host.name`) MUST be refused.

## The package

- **FR-007**: The library MUST be published to npm as compiled modules with their declarations, one entry for the package (`.`, the registration and the assertions), one for the record (`./record`, the pure model of a test's record and its OpenTelemetry form) and one for the canaries (`./canaries`, FR-009), built, inspected and packed by `tools/pack.ts` (commons 0032-libraries-by-concern FR-005, FR-013), and it MUST depend only on `core`, `crypto`, `system` and `telemetry`, so that it imports nothing of the evidence's reports, ledger or runner.

- **FR-008**: The library MUST export `reportFindings(rule, found)`, which names each finding of `rule` on the standard error as `finding: <rule>: <what>`, returns the number of findings, and MUST NOT throw, so that a test of the repository's own tree reports what it finds and leaves the failing to the typed red causes of the build policy (commons 0038-build-policy).

- **FR-009**: The library MUST export the canaries of the secret scanner from the one module `./canaries` (`CANARIES`, `canary(id)` and `canaryText(id)`): the typed corpus of text that looks like a secret and is not one, where each canary has an id, a kind (`private-key`, `token` or `access-key`), the rule of the scanner that must catch it (the label of that rule) and its text, every text carries `CANARY` and is no working secret, the module imports nothing, and a test that must hand a program a secret-looking text imports it from there and holds none in its own file (commons repoctl 0016-repoctl-canaries).

## Acceptance scenarios

1. **Given** a test file that imports `proves` and the assertions from this package, **When** it runs under `bun test` and under `node --test`, **Then** it passes unchanged on both, per FR-001.
2. **Given** a test marked `only`, **When** its file runs, **Then** it runs alone and the others of the file are recorded as skipped, per FR-002.
3. **Given** a run with `IFC_TEST_RECORD` set, **When** a test ends, **Then** its span and log record are appended to that file, on the installation record, per FR-004 to FR-006.
4. **Given** the package is installed in an empty project, **When** Node 26 and Bun import its entries and a consumer type-checks them, **Then** they work, per FR-007.
5. **Given** the corpus of canaries, **When** each canary is read, **Then** it has a unique id, a kind and a rule, its text carries `CANARY`, and `canary` of an id that is not there throws and names the ids there are, per FR-009.

## Out of scope

- The run of a suite (`runtime/test-run`, `ifc test`), the renderings of a record (TAP, JUnit, CTRF, SARIF, OSCAL, the completion report), the evidence ledger and its signing: the quality system's, which depend on this library, not the reverse (commons 0008-test-evidence FR-005 to FR-014).

## Edge cases

- A person's name in the installation record's role: refused, per FR-006.
- A test that has not ended when the process exits: recorded as `cancelled`, per commons 0008-test-evidence FR-004.
- `bun test --only`: runs no test of `node:test` at all, as Bun's `node:test` never marks one; give `bun test` no `--only`, per FR-002.

## Assumptions

- `node:test` is the registration both runners implement.

## Open questions

- None.

## Key entities

- **Test** - a registered body with the requirements it proves and its risk.
- **Record** - the span and the log record of a test, on the installation record.
- **Installation record** - the resource that says where a test ran: runtime, system, architecture, revision, role.

## Success criteria

- **SC-001**: One import gives a harness its assertions and the evidence of its runs.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Confidential: no sensitive fact written as a literal
