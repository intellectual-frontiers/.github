# Feature Specification: Workload test cases

**Spec ID:** 0017-workload-test-cases
**Status:** Draft
**Owner:** if
**Domain:** workload

**Input:** An acceptance test is a workload of the form `runbook` (commons 0042-tests-as-workloads FR-001). The runbook has the steps it needs (a verb, a check, an `ask` that parks the run for a person, an `each`) and the rule that only a person answers an `ask`, but it has no case: it does not say which requirements it proves, what must hold before it starts, which parameters it takes (the platform among them), what each check or person's step is expected to give, or which files a step yields; the answer of a person is one of three words with no reason; the receipt of an emitted script is one line with no result for each step; and nothing reads that line. This specification adds those, to the runbook and to its runners, and no form. It is governed by commons 0042-tests-as-workloads (audit rows C1 to C11). **Every requirement that asks for code is Deferred.**

## The case of a runbook

- **FR-001**: A runbook MUST be able to carry a case, the optional field `case`, and a runbook that carries one MUST be an acceptance test; the field MUST be a field of the form `runbook` and MUST NOT be a field of the head of every workload, so that the core and the other forms are unchanged. A decoder MUST turn a value from outside into a runbook with its case or into every reason it is not one (0008-form-runbook FR-003). Relies on audit rows: C1.
- **FR-002**: A case MUST hold `proves` (a list of at least one `SpecCite`, the citations of `parseCite`, written as `NNNN-slug FR-NNN` by `citeText`), `preconditions` (a list of texts), `parameters` (FR-004), an optional `matrix` (FR-005), `risk` (`high` or `not-high`), and MAY hold `tags` (lower case words), a `characteristic` (a word of ISO/IEC 25010) and a `cadence` (an ISO 8601 duration). Relies on audit rows: C1, C6, A5.
- **FR-003**: The static check of a runbook MUST find, as findings of a closed catalog of codes `E-RB-CASE-<KIND>` with their fixers and fixes (0008-form-runbook FR-013): a case with no citation in `proves`; a citation that is not of the grammar of `parseCite`; a precondition that is empty; a `check` step or a person's step with no expected result or with no name of evidence where the case declares it required; two evidence names in one step; a matrix that names a parameter the case does not have or a value the parameter's `choice` does not list; and a step id of a case that is not a lower case word. A requirement of a citation MUST be found in a specification in force by the check of citations, as for a step. Relies on audit rows: C1, C6.

## Parameters and the matrix

- **FR-004**: A parameter of a case MUST be an input of the workload (`InputSpec`) whose type is one of `text`, `integer`, `flag` or `choice`; the type `choice` MUST list its values (one or more lower case words, no value twice), MAY name a default that is one of them, and MUST be added to `INPUT_TYPES` as the one new type; a step MUST read a parameter as an input of the run (`{kind: "input"}`), and an emitter MUST pass it in the environment variable `WORKLOAD_INPUT_<NAME>` (`inputVariable`) unchanged. Relies on audit rows: C4.
- **FR-005**: A case MAY declare a `matrix`: for each of some of its parameters of type `choice`, the values it must be run with (a subset of the values of the parameter, in the order written); the cells of the matrix MUST be the product of those lists, the first parameter changing slowest, and the function `cellsOf(case)` MUST be pure and give the same cells in the same order for the same case. A run MUST bind every parameter that has no default and MUST refuse a value that the `choice` does not list. Relies on audit rows: C4.
- **FR-006**: The platform MUST be the parameter `os`, and the kind of host MAY be the parameter `host`; both are ordinary parameters, and the library MUST NOT define a list of platforms: the case lists the values it supports. Relies on audit rows: C4.

## The steps of a case

- **FR-007**: A `check` step and an `ask` step of a case MUST carry `expect` (the expected result, a text; for a `check` it is its `asserts`, so that no second text is kept) and MAY carry `captures`, a list of evidence declarations (`EvidenceDecl`: a name, a kind from `log`, `output`, `screenshot` and `file`, a media type and whether it is required); a `verb` step MAY carry `captures` too. A name MUST be a lower case word with its extension allowed (`stdout.txt` is the name `stdout` with the media type `text/plain`), unique in its step. Relies on audit rows: C3, C2.
- **FR-008**: A person's step MUST be an `ask` of a case, whose `approver` names a role, and the static check MUST find an `ask` of a case whose role is not one that the workbench contract holds as `human` (the rule of the contract for the approver of a gate, extended to this step; commons 0042 FR-012); the instruction of the step is its `question`, and the outcomes it takes are `passed`, `failed` and `skipped`. Relies on audit rows: C2, E5.
- **FR-009**: The autonomy of a person's step MUST remain `human-only`, the native runner MUST park the run at it with the approver and the deadline (0008-form-runbook FR-017), and a runner that cannot carry `interactive` MUST refuse a case that has one (`E-WL-RUNNER-EMIT-UNSUPPORTED`, FR-023 there). Relies on audit rows: C7.

## The result of a person's step

- **FR-010**: The event `answered` of a step of a case MUST carry `outcome` (`passed`, `failed` or `skipped`), `reason` (a text that is not empty), `evidence` (the references that the step's declarations name) and `attestation` (the SHA-256 of the `grc.attestation` that holds the word of the person, commons grc 0018-grc-acceptance-attestation), and an `answered` event of such a step that lacks one of them MUST be refused by the fold and the step MUST stay parked; the three words `approved`, `declined` and `answered` MUST remain those of a gate and of an `ask` that is not of a case. Relies on audit rows: C2, C5, D1.
- **FR-011**: The fold MUST refuse an `answered` event whose actor is not a person, as it does for a gate, and MUST take a person's word as a result only after a function of the host has verified the attestation the event cites (its signature, its role and its custody) and found that its subject names the case and the cycle and its check names the step; the verification MUST be a port that the host gives, so that the fold stays pure. Relies on audit rows: C2, D1.
- **FR-012**: The state of a step MUST hold, besides what it holds, its `result` (`passed`, `failed`, `skipped` or `not_run`) and, for `not_run`, its cause (`awaiting-person`, `not-started`, `runner-cannot-carry`, `no-receipt`, `no-attestation`, `expired`), and the function `caseResultOf(case, state)` MUST give the result of the case from the results of its steps as commons 0042 FR-009 says: `failed` if any step failed, else `passed` if every step passed, else `not_run` if any is, else `skipped`. Relies on audit rows: C5.
- **FR-013**: The event `step-succeeded` of a step that declares `captures` MUST carry `evidence`, a list of typed references (`EvidenceRef`: name, path, SHA-256, size in bytes, media type), and its `digests` MUST be the SHA-256 of those references; a step whose required evidence is missing MUST NOT be recorded `step-succeeded`. Relies on audit rows: C5.

## Cycles and the files of evidence

- **FR-014**: A cycle MUST be a value `CycleId` made only by a smart constructor of the form `YYYY-MM-DD.NN` (a real day, UTC, and a number from `01` to `99`), and the function `nextCycle(existing, day)` MUST give the next number for a case on a day from the cycles that exist, the same for the same inputs, refusing the hundredth. Relies on audit rows: C5.
- **FR-015**: The path of a file MUST be a pure function `evidencePath(caseId, cycle, stepId, name)` giving `evidence/<case id>/<cycle>/<step id>/<name>`, and the paths `evidence/<case id>/<cycle>/result.auto.json` and `.../run.auto.md`, and MUST refuse a name that is not one of the words of FR-007 and a path that would leave its folder; the folder `evidence` MUST be beside the files of the workloads. Relies on audit rows: E1.
- **FR-016**: A file of a cycle MUST be written through a store of `anyfs` with the precondition that the path is absent, by a port of the physical layer that the host gives (`EvidencePort`), MUST be hashed as it is written, and MUST NOT be written again once the cycle is closed (the event `finished`); a check of a cycle MUST be a pure function over the contents it is given and MUST give the findings `item-missing`, `item-hash-mismatch`, `item-size-mismatch` and `item-extra` in the words of grc 0011-grc-bundles FR-003. Relies on audit rows: E1, D4, C11.
- **FR-017**: `result.auto.json` MUST be the canonical JSON (RFC 8785, the canonical text of grc) of the case, the cycle, the cell, the runner, the result and the references of every step and the digest of each file of the cycle, and it MUST be the input that the mapper (FR-025) reads; its digest MUST be in the record of the quality system. Relies on audit rows: D5, B1.

## The projection for a person

- **FR-018**: `checklist(view, results?)` MUST take, besides the view of a workload, the results of a cycle, and where they are given MUST show for each step its result, its grade and a link to each file of evidence, with a line for each `not_run` and its cause; `run.auto.md` MUST be that checklist, written with the files of the cycle and never by hand, and `scenario(view)` MUST be unchanged and MUST cite the requirements of the case in its Then. Relies on audit rows: C10.

## The emitted script

- **FR-019**: An emitted Bash 5 or PowerShell 7 script MUST write, for each call it makes, one line `workload.step/1` to the standard error with the step, its status (`ok` or `failed`), its start and end in milliseconds since the epoch, and each evidence file it wrote as its name and SHA-256; the pinned verb command (`workload verb`) MUST be the program that measures and writes the digests, so that the script holds no hash tool of its own; the line MUST be written before the next call, and the trap on `EXIT` MUST still write the one line `workload.receipt/1` as 0011-runner-bash FR-005 and 0012-runner-powershell say. The same plan MUST give the same bytes (the lines are the script's output, not its text). Relies on audit rows: C8.
- **FR-020**: A case MUST be emitted only where its plan of calls can carry every step (a `verb`, a `check`, an `each` over a fixed list); a case with a person's step, a `judge`, a `branch`, a `gate` or an `undo` MUST be refused as 0008-form-runbook FR-023 says, and the platform MUST NOT be a reason to edit the case: a step that differs by platform is a verb that takes the parameter `os`. Relies on audit rows: C7, C8.

## The ingest of a script's log

- **FR-021**: `ingestScriptLog(log, expected, who)` MUST read the log of a script (the lines `workload.step/1` and `workload.receipt/1` among other lines, which it ignores) and MUST give the `receipt` event (`plan`, `ref`, `status`, `log` the SHA-256 of the log, the approvals none) and the result of each step of the plan, or the findings that refuse it: a plan hash that is not the one the case has at the revision (`E-WL-RUNNER-INGEST-PLAN`), a line that does not parse, a step that is not a step of the plan or is twice, a status that is not the receipt's, a log whose digest is not the one given, and evidence whose SHA-256 differs from the file it names. Relies on audit rows: C9, D4.
- **FR-022**: The log MUST be read by ingest from a store that the fleet controls (a path, a store of `anyfs`, a file read over SSH) and never be pushed to the library; a step of the plan that has no line MUST be `not_run` with the cause `not-started` where a receipt line exists and `no-receipt` where none does; and the function MUST be pure over the text it is given, with the reading of the store left to the host. Relies on audit rows: C9.
- **FR-023**: The log of a script is the script's claim: the results of its steps MUST NOT be graded above `E3` by the library, and `who` (`person`, `agent` or `tool`) MUST say who recorded the ingest, as `receiptFromRun` does for a run of GitHub, with the approvals left out of the event where it is not a person. Relies on audit rows: C9.

## The mapper

- **FR-024**: The physical entry `./acceptance` MUST give `caseRunInputOf(case, cycle, cell, state, results, receipt?)`, a pure function that translates the case, its run state (the fold of the events of the work order), the results of its steps, the references of its files and the receipt into the `CaseRunInput` of the library `quality` (commons quality 0003-quality-case-runs), the same inputs giving the same input; it MUST be the only module of `workload` that imports `quality`, and the core, the forms and the other entries MUST import none. Relies on audit rows: C12, B4.
- **FR-025**: The mapper MUST give each step the author kind of its result: `person` for a person's step, `script` for a step of an emitted run and `tool` for a step of the native runner; a step whose `by` is `person` MUST carry the digest of its attestation. Relies on audit rows: C2, C5.
- **FR-026**: The table of the manifest `library.ts` MUST list, for the unit of the physical layer that holds `./acceptance`, the packages `quality` (its pure entries only) and `grc` (its `logical` and `physical` entries), and no other unit MUST list either; the checker of Kanon MUST find no import its table does not allow. Relies on audit rows: C12.

## Acceptance scenarios

1. **Given** a runbook with a case that cites a requirement of a specification in force, **When** it is decoded and checked, **Then** it passes, and **Given** none cited, **Then** the code `E-RB-CASE-` for it is found, per FR-001 and FR-003.
2. **Given** a parameter `os` of type `choice` with three values and a matrix of two of them, **When** the cells are listed, **Then** there are two, in the order written, and a value outside the three is refused, per FR-004 and FR-005.
3. **Given** a person's step whose `approver` names a role that the contract holds as `either`, **When** it is checked, **Then** it is a finding, per FR-008.
4. **Given** an `answered` event of a person's step with an outcome and no reason, **When** it is folded, **Then** it is refused and the step stays parked, per FR-010.
5. **Given** an `answered` event by an agent, **When** it is folded, **Then** it is refused, per FR-011.
6. **Given** a case with a person's step that nobody answered, **When** `caseResultOf` is asked, **Then** it is `not_run` with the cause `awaiting-person`, per FR-012.
7. **Given** the day 2026-12-03 and the cycles `.01` and `.02`, **When** the next is asked, **Then** it is `2026-12-03.03`, per FR-014.
8. **Given** a name with `..` or a path out of the folder, **When** `evidencePath` is asked, **Then** it is refused, per FR-015.
9. **Given** a file of a closed cycle that is written a second time, **When** the port writes it, **Then** the store refuses, per FR-016.
10. **Given** a cycle whose folder has a file the result does not list, **When** it is checked, **Then** the finding is `item-extra` naming it, per FR-016.
11. **Given** a log with a receipt line and the lines of two of three steps, **When** it is ingested, **Then** the third is `not_run` with `not-started`, per FR-022.
12. **Given** a log whose plan hash is another's, **When** it is ingested, **Then** `E-WL-RUNNER-INGEST-PLAN` is found, per FR-021.
13. **Given** a case with a person's step, **When** a script is asked for, **Then** it is refused, per FR-020.
14. **Given** the imports of the library, **When** the Kanon checker runs, **Then** only the unit of `./acceptance` imports `quality`, per FR-024 and FR-026.

## Out of scope

- The record of the quality system, its grades and its renderings: the library `quality` (quality 0003-quality-case-runs).
- The attestation and its verification: the library `grc` (grc 0018-grc-acceptance-attestation).
- The terminal that asks a person: a renderer of the SDK.
- A form for tests: none is made (commons 0040-workload-pattern FR-005).

## Edge cases

- A parameter with a default that is not run in a cell: the default binds it and the cell does not name it, per FR-004.
- A step with no evidence declared: it has no `evidence` and its `digests` may be empty, per FR-013.
- A log that holds a line of a step twice: refused, per FR-021.

## Assumptions

- The pinned verb command writes the lines of FR-019 and is installed on the controller.

## Open questions

- None of its own; see commons 0042-tests-as-workloads OQ-1 to OQ-6.

## Key entities

- **Case** - the field of a runbook that makes it a test.
- **CycleId** - `YYYY-MM-DD.NN`.
- **EvidenceDecl** and **EvidenceRef** - the declaration of a file, and the reference to one that was written.
- **Cell** - one binding of the parameters of a matrix.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0042-tests-as-workloads it relies on
