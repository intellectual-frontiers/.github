# Feature Specification: Quality case runs

**Spec ID:** 0003-quality-case-runs
**Status:** Draft
**Owner:** if
**Domain:** quality

**Input:** The record of the quality system holds a case and what became of it (0001-quality-evidence FR-018, FR-019), and `checkRun` is how a check of Mizan, which is no test process, leaves its result in it. A run of an acceptance test (commons 0042-tests-as-workloads) has more than a case: steps, each with its result, its author, its grade and the files it yielded, parameters, a cycle, and steps that a person did or that nobody did. This specification gives the record those, adds `caseRun` beside `checkRun`, extends the writers of TAP 14, JUnit, CTRF and OSCAL and the pack, and adds the matrix of cases by cell with its freshness. It writes no second record and no second ladder. It is governed by commons 0042-tests-as-workloads (audit rows B1 to B16). **Every requirement that asks for code is Deferred.**

## The record

- **FR-001**: `QualityCase` MUST be able to hold `steps` (a list of `QualityStep`), `parameters` (a map of name to value), `cycle` and `runner` (the role and the kind of the runner); a `QualityStep` MUST hold its id, its name, its outcome (`pass`, `fail`, `skip` or `not_run`), its reason (required for `skip` and `not_run`), `by` (`person`, `script` or `tool`), its grade, its start and end, its `expected`, `actual` and `message`, its evidence references (name, path, SHA-256, size, media type), the digest of the attestation where `by` is `person`, and its own `steps`; and `readQuality` MUST read all of it back from a file it wrote. Relies on audit rows: B1, B2.
- **FR-002**: The record MUST hold a step as a `test step` span (the span `testStepSpan` makes from a `TestStep`) with the attributes this specification adds, written as `extras` are in `checkRun`: `ifc.quality.step.outcome`, `ifc.quality.step.reason`, `ifc.quality.step.by`, `ifc.quality.step.grade`, `ifc.quality.step.evidence` (one entry for each reference), `ifc.quality.step.attestation`; a `not_run` step MUST have a span with the outcome `skip` of `test` and `ifc.quality.step.outcome` of `not_run`, so that a reader of the record that knows only `test` still sees a step that did not pass. The library `test` MUST NOT change. Relies on audit rows: A2, A4, B2.
- **FR-003**: The attributes of a case MUST be `ifc.acceptance.case`, `ifc.acceptance.cycle`, `ifc.acceptance.param.<name>`, `ifc.acceptance.runner` (a role and the fingerprint of its key), `ifc.acceptance.runner.kind` (`native`, `bash` or `pwsh`) and `ifc.acceptance.plan.sha256`, on every resource of the file, and the record MUST name no person (0001-quality-evidence FR-025). Relies on audit rows: B1, B16.
- **FR-004**: `caseRun(CaseRunInput)` MUST give the canonical record (`Canonical`) of one or more cases that ran in one session on one cell, as `checkRun` gives one for a check: the ids of the trace, the run span and each case and step span are given by the caller, a step with no result is a `not_run` step with its reason, the counts include the cases that did not run, and the same input MUST give the same bytes; it MUST be pure and MUST import nothing of the library `workload`. Relies on audit rows: B4.
- **FR-005**: `CaseRunInput` MUST be plain typed data (the case id, title, file, requirements, risk, the cell, the cycle, the runner, the steps with their results as FR-001 says, the installation of the machine that ran it, the times), and `caseRun` MUST refuse an input where a `not_run` or `skip` step has no reason, a step of `by` `person` has no attestation digest, a result is not one of the four, or a reference has no SHA-256. Relies on audit rows: B4.

## The grade

- **FR-006**: The grade of a step MUST be a function of its outcome and its author: `pass` by `tool` or `script` `E3`; `pass` by `person` with an attestation digest `E2`; `pass` by `person` with none the step MUST be read as `not_run` with the cause `no-attestation` and `E0`; `fail`, `skip` and `not_run` `E0`; and the grade of a case MUST be the lowest grade of its steps that yield a result where the case passed and `E0` where it did not. Relies on audit rows: B3.
- **FR-007**: The file of a record MUST claim no more than `E3` for a case (FR-045 of 0001-quality-evidence); the branch (`gradeOf`) MUST lift the grade of a step or a case that is `E3` to `E4` where its conditions hold and MUST NOT lift one that is `E2`; and a grade MUST be shown with every rendering of a result. Relies on audit rows: B3.
- **FR-008**: `evidenceOfRun` MUST give a requirement the evidence of its cases and not of the run: its result is `fail` where a case that names it failed, `pass` where one passed and none failed, else `unproven`, and its grade the highest grade of the cases that passed, so that a requirement proved by a case run by a person is `E2` and counts as review debt (0001-quality-evidence FR-028) until an automated case or a probe gives it more. Relies on audit rows: B3.
- **FR-009**: A step by `person` MUST count in `reviewDebtByPerson` (0001-quality-evidence FR-051) and never in `reviewDebtByAgent`; an agent MUST NOT author a step by `person`, and a record in which one did MUST be refused by `caseRun` and found by `verify`. Relies on audit rows: B3.

## TAP 14

- **FR-010**: `tap` MUST write each case of a record that has steps as a subtest of its own, named with the case id, the title and the values of its cell, with a plan of its steps, a test point for each step in the order of the steps (a step that has steps of its own a subtest, as `tapSteps` writes it) and the closing point of the case; and the writer MUST be `tapSteps` and `tap14` extended, with no third. Relies on audit rows: B5.
- **FR-011**: Every test point of a case and of a step MUST be followed by a YAML block (written with `toYaml`) with the keys `id`, `outcome`, `reason`, `grade`, `by`, `started`, `ended`, `duration_ms`, `expected`, `actual`, `message`, `requirements`, `parameters`, `cycle` and `evidence` (a list of mappings of `name`, `path`, `sha256`, `bytes` and `media_type`), the keys of a value it has, in that order; a passing point MUST have a block too. Relies on audit rows: B5, E7.
- **FR-012**: A result MUST be a point as follows, and as no other: `pass` `ok N - <name>`; `fail` `not ok N - <name>`; `skip` `ok N - <name> # SKIP <reason>`; `not_run` `not ok N - <name> # SKIP not_run: <reason>`; the closing point of a case `ok` where it passed and `not ok` where a step failed or did not run. A `not_run` case that has no steps MUST be the same point, a test point of the plan, and the comments `# not_run` and `# grade` MUST be at the end of the stream. Relies on audit rows: B2, B5.
- **FR-013**: The text of a name or a reason on a line MUST be one line with `\` and `#` escaped (`tapDescription`), the stream MUST begin `TAP version 14`, MUST hold no `Bail out!`, and its plan MUST count a `not_run` point. Relies on audit rows: B5.

## The other renderings

- **FR-014**: JUnit XML (`junit`) MUST give a case that has steps one `testsuite` for each cell, the cycle and each parameter as `property`, each step as a `step` property (`<outcome> <path>`, `not_run` an outcome), each reference as an `evidence` property, and a `not_run` case or step as `skipped` with `type="not_run"` and its reason, and the counts MUST say `not_run` apart (`ifc.not_run`). Relies on audit rows: B6.
- **FR-015**: CTRF (`ctrfTest`) MUST give a case its `steps` (name, status by `ctrfStatus`, `other` for `not_run`) and its cell, cycle, evidence and grade under `extra`; SARIF MUST keep a `not_run` step as a warning with the step in its message. Relies on audit rows: B6.
- **FR-016**: OSCAL assessment results (`oscalAssessmentResults`) MUST give a step by `person` an observation whose method is a person's and not `TEST`, with the digest of the attestation in a property and each reference as a resource of the back matter with its `SHA-256`, and a step by `tool` or `script` an observation of the method `TEST`; the `uuid` of each MUST remain a version 5 UUID of a name in the run. Relies on audit rows: B6, D3.
- **FR-017**: The documents of ISO/IEC/IEEE 29119-3 (`completionReport`, `statusReport`, `incidentReports`) MUST list each cell with its counts and its grade, and MUST give a test incident report for each failed case and for each `not_run` case with its cause. Relies on audit rows: B6.

## The pack and the relations

- **FR-018**: The assessor pack of a span MUST hold, for each cycle kept in the span, the files of `evidence/<case id>/<cycle>/` that the record's references name, each in the manifest (`ManifestFile`) with its path, SHA-256, size and media type, and `verify-pack` MUST check each against the manifest offline and report a file it lacks as `not_run` with the reason (0001-quality-evidence FR-065); a file of binary evidence MUST NOT be redacted or changed by the pack, and the manifest MUST name it in `retained`. Relies on audit rows: B14, B16.
- **FR-019**: The relations of the SQL over the runs MUST add `case_steps` (`trace_id`, `file`, `name`, `step`, `outcome`, `grade`, `by`, `reason`, `duration_ms`), `case_parameters` (`trace_id`, `file`, `name`, `parameter`, `value`) and `case_evidence` (`trace_id`, `file`, `name`, `step`, `evidence`, `sha256`, `bytes`), and `cases` MUST add the column `cycle`; the catalog (`qualityCatalog`) MUST describe each. Relies on audit rows: B15.

## The matrix

- **FR-020**: `matrixOf(runs, cases, cadences, changes, day)` MUST be a pure function (no clock, no file) that gives one row for each case, one cell for each cell of the case's matrix (as the case declares it), and in each cell the newest cycle credited to it (the observed `os` of its installation agreeing with the cell's parameter, else the cycle is listed apart as a disagreement), its outcome, its grade, its freshness by `freshnessOf` (`Fresh`, `Due`, `Stale`, by time and by change), its day and its cycle, and `none` at `E0` for a cell with no cycle. Relies on audit rows: B10, B13.
- **FR-021**: The cadence of a cell MUST be the one the case declares or, where none, the shortest cadence of the evidence kinds of its steps (`run` for a step by `tool` or `script`, `review` for one by `person`), and `changes` MUST be what changed in the chain of the requirements the case proves after the revision of its cycle, found by `gather` with real Git as for any proof. Relies on audit rows: B10.
- **FR-022**: The matrix MUST be offered by a command `quality matrix [--repo DIR] [--json]` generated from the one definition of the commands (headless 0001-headless-layers FR-009), MUST write nothing, MUST end with 0 where every cell has a fresh cycle that passed and 1 where one has not, and 2 for a command line that does not fit; and the Trust page SHOULD show it beside the requirement matrix with the same figures. Relies on audit rows: B13, E6.

## The ledger and the signatures

- **FR-023**: A cycle kept with `keepRun` MUST be signed by the meanings `executed`, `reviewed` and `approved` of `signRun` as they are made, and the key of `approved` MUST differ from the key of `executed` (0001-quality-evidence FR-012), which `verifyEvidence` MUST check where both signatures are given. Relies on audit rows: B7.

## Acceptance scenarios

1. **Given** a case with four steps, one by a person, **When** `caseRun` makes the record and it is read back, **Then** the steps, their outcomes, grades, authors and references are the same, per FR-001 and FR-004.
2. **Given** a step by a person with no attestation digest, **When** `caseRun` is given it, **Then** it is refused, per FR-005.
3. **Given** the grades, **When** a step by a script, a step by a person and a step that failed are graded, **Then** they are `E3`, `E2` and `E0`, and the case that passed is `E2`, per FR-006.
4. **Given** a record whose case is `E3`, **When** it is kept signed and chained, **Then** it is `E4`, and one whose case is `E2` stays `E2`, per FR-007.
5. **Given** a requirement named by a case run by a person only, **When** its evidence is judged, **Then** it is `E2` and counts as review debt of a person, per FR-008 and FR-009.
6. **Given** a case with a `not_run` step, **When** it is rendered as TAP, **Then** the step is `not ok` with `# SKIP not_run:` and a block, the case closes `not ok` and the plan counts it, per FR-010 to FR-013.
7. **Given** a passing step with evidence, **When** it is rendered as TAP, **Then** its block holds the evidence and the timing, per FR-011.
8. **Given** a record with a step by a person, **When** it is rendered as OSCAL, **Then** its observation is not of the method `TEST` and each file is a resource with its SHA-256, per FR-016.
9. **Given** a pack of a span with a cycle, **When** it is verified offline and a file of the cycle is changed, **Then** the verifier finds it, per FR-018.
10. **Given** a case with a matrix of three cells and two cycles, **When** the matrix is made, **Then** two cells show their results and freshness and one shows `none` at `E0`, per FR-020.
11. **Given** a cycle whose observed `os` differs from the cell's, **When** the matrix is made, **Then** the cell is not credited and the disagreement is listed, per FR-020.
12. **Given** the SQL `SELECT step, outcome FROM case_steps WHERE outcome = 'not_run'`, **When** it is asked, **Then** it answers over the steps of the runs, per FR-019.

## Out of scope

- The translation of a run of a workload into `CaseRunInput`: the library `workload` (workload 0017-workload-test-cases).
- The attestation of a person and its verification: the library `grc` (grc 0018-grc-acceptance-attestation).
- A change of the library `test` or of the canonical record of a test (0001-quality-evidence FR-018): the record stays that, with the additions of FR-001 to FR-003.

## Edge cases

- A case with no step: it is a case with no subtest, per FR-010.
- A cycle that supersedes another: the older stays on the branch and is not credited, per commons 0042 FR-020.

## Assumptions

- The caller of `caseRun` gives the ids of the spans and the machine's installation, as the caller of `checkRun` does.

## Open questions

- None of its own; see commons 0042-tests-as-workloads OQ-6 for the grade of a person's step.

## Key entities

- **QualityStep** - a step of a case in the record, with its outcome, author, grade and references.
- **CaseRunInput** - the plain typed data that `caseRun` is given.
- **Cell** - one binding of the parameters of a case's matrix.
- **Matrix** - the cases by their cells, each with its newest credited cycle and its freshness.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0042-tests-as-workloads it relies on
