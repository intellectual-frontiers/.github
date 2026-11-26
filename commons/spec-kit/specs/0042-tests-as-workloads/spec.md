# Feature Specification: Tests as workloads

**Spec ID:** 0042-tests-as-workloads
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0040-workload-pattern

**Input:** A test that a person or an agent carries out by hand, or that a controller runs on a machine of a fleet, is operated work, and operated work is what a workload is (0040-workload-pattern). This specification states how an acceptance test is a typed workload of the form `runbook`, how a run of it is wrapped, never rewritten, into the record of the quality system (quality 0001-quality-evidence of `quality`), how a person's step is recorded and by whom, how the evidence files are laid out and checked, how the result is written as TAP 14, JUnit, CTRF and OSCAL and kept on the append-only `quality` branch of the fleet repository, how the same case is run natively by a person at a terminal or emitted as a script that a controller on Windows 10, Windows 11 or Debian 13 runs, and how a matrix of cases by platform is shown with its freshness. It invents no record, no chain and no grade: it joins what `workload`, `quality`, `grc`, `anyfs`, `mizan` and `planning` already have (the reuse audit, `reuse-audit.md`, row by row) and says where each piece lives. **Every requirement that asks for code is Deferred: this specification and the ones it governs hold no code.**

## The case

- **FR-001**: An acceptance test MUST be a workload of the form `runbook` that carries a case (the optional field `case` of the runbook, workload 0017-workload-test-cases); no form, no second algebra of steps and no second registry of tests MUST be made for it, and everything a workload has (effects, derived autonomy, needs, the static checks, the dry run, the projections, the runners and the run events as planning events) MUST apply to it unchanged. Relies on audit rows: C1, C7.
- **FR-002**: A case MUST have an id (the id of its workload), a title, the requirements it proves, its preconditions (texts, each a state of the workshop that a step does not make), its typed parameters (FR-017), its steps with their expected results (FR-004) and its risk (`high` or `not-high`, as `Risk` of the record of a test); it MAY have tags and a characteristic of ISO/IEC 25010 (`ifc.test.characteristic`), and it MUST NOT have a priority scale of its own. Relies on audit rows: A5, C1.
- **FR-003**: The requirements a case proves MUST be written once, as the list `proves` of citations, each a spec id and a requirement id in the grammar every test uses (`NNNN-slug FR-NNN`, `SpecCite`); a case with no citation, and a citation of a requirement that no specification in force has, MUST each be a finding of the static check of the runbook; and the trace check of Mizan MUST read the list as it reads the `proves` of a test (mizan 0003-mizan-case-proofs), so that a requirement proved only by a case is proved. Relies on audit rows: A1, C6, F1.
- **FR-004**: A step of a case that yields a result MUST state its expected result as text and the names of the evidence it yields: a `check` step (its `asserts` is its expected result, and it is read by a verb that only reads) and a person's step (an `ask`, FR-010). A `verb`, an `each` and an `undo` MAY be steps of a case and yield no result of their own: they are the steps that set the case up and take it down. A `judge` MUST NOT decide the result of a step: its proposal is not a result. Relies on audit rows: C2, C3.
- **FR-005**: The evidence a step yields MUST be declared by name, a closed kind (`log`, `output`, `screenshot`, `file`), a media type and whether it is required (`EvidenceDecl`), and a run MUST record each file it holds as a typed reference with the name, the path under the folder of the cycle (FR-021), the SHA-256, the size in bytes and the media type (`EvidenceRef`); a step whose required evidence is not held MUST NOT be recorded as passed. Relies on audit rows: C3, C5.

## The result of a step and of a case

- **FR-006**: The result of a step MUST be exactly one of `passed`, `failed` and `skipped`, the three result states, or `not_run`; they MUST be the outcomes `pass`, `fail`, `skip` and `not_run` of the record of the quality system (quality 0001-quality-evidence FR-019), and no fourth word (`blocked`, `error`) MUST be made: a step that cannot go on is `skipped` by a person's word with its reason, and the steps after it are `not_run`. Relies on audit rows: A4, B2.
- **FR-007**: A step MUST be `not_run` where it was planned and has no recorded result, with its reason in one of a closed list of causes (`awaiting-person`, `not-started`, `runner-cannot-carry`, `no-receipt`, `no-attestation`, `expired`): a person's step that no person has answered, a step after a step that failed that the runner did not start, a person's step of a case whose cycle was run by an emitted script, a script whose receipt was not ingested, a person's step whose attestation does not verify, and a deadline that passed. A `not_run` step MUST NOT be counted as passed, silently skipped or left out of any rendering. Relies on audit rows: B2, C2.
- **FR-008**: Only a person MAY skip a step, by the word `skipped` and a reason (FR-010); a runner MUST NOT skip a step that it can run, and a step that a runner cannot carry MUST be `not_run` (`runner-cannot-carry`), never `skipped`.
- **FR-009**: The result of a case MUST be a function of the results of its steps: `failed` where any step failed; else `passed` where every step passed; else `not_run` where any step is `not_run` (the case is incomplete); else `skipped`. A case MUST be counted as proof of the requirements it proves only where it is `passed`; a `skipped` case and a `not_run` case MUST prove nothing (the requirement is unproven, quality 0001-quality-evidence FR-019); and a case that `failed` MUST open a nonconformance as any failed proof does (quality 0001-quality-evidence FR-015). Relies on audit rows: B2, B11.

## A person's step

- **FR-010**: A person's step MUST be an `ask` of a case with an instruction (its `question`), an expected result, the evidence it asks for and the role that may answer it, and a person MUST record it as an outcome word (`passed`, `failed` or `skipped`) and a reason that is not empty, whatever the word (a passed step says what was observed); the autonomy of the step MUST be `human-only`, so that the run parks at it and an agent hands back (workload 0008-form-runbook FR-017, FR-020). Relies on audit rows: C2.
- **FR-011**: The word of a person MUST be a `grc.attestation` (its `claim` `pass`, `fail` or `skip`, its `statement` the reason, its `evidence` the digests of the files, its `role`), signed by a signer whose custody the evidence policy allows, and its subject and its check MUST name the case with its cycle and the step; the `answered` event of the run MUST cite its digest, and an answer to a step of a case with no such attestation, or with an attestation that does not verify, MUST be refused and the step stays `not_run`. Relies on audit rows: D1, D2, C2.
- **FR-012**: An agent, a tool and a script MUST NOT record the result of a person's step. The role that may answer MUST be one that the evidence policy lets attest (`mayAttest`) and that the workbench contract holds as `human`; a policy that lets a role held by an agent or by `either` attest a person's step MUST be a finding; and the answer of an event whose actor is not a person MUST be refused by the fold as it is for a gate. An agent MAY open the cycle, run every step that its autonomy allows, prepare the evidence and propose a word as a `judge` whose output is never a result. Relies on audit rows: C2, D1, E5.
- **FR-013**: The native runner MUST read the outcome word and the reason from an interactive terminal only (a terminal of a person), MUST refuse to read them from a pipe, a file or a harness of an agent, and MUST hand back where it is run without one; it MUST NOT ask for a word that the step's outcomes do not list. Relies on audit rows: C11.
- **FR-014**: The person who recorded a case as executed (the signature of meaning `executed`) MUST NOT be the person who approves it (the signature of meaning `approved`, quality 0001-quality-evidence FR-012: nothing authorizes itself); the two signatures MUST be of two keys. Relies on audit rows: B7.
- **FR-015**: A person's step MUST NOT make an entry of the ledger of statements and reviews of the quality system (`statement`, `review`) by itself; a person MAY make one, as an act of their own, for a requirement. Relies on audit rows: B12.

## Evidence grade of a result

- **FR-016**: The grade of a step MUST be stated in its record and MUST follow from what the step is: a step run by a verb or a script, passed, `E3` (tested: an automated run proved it and the record exists); a person's step, passed, with an attestation that verifies, `E2` (reviewed), and never higher whatever keeps it; a step that failed, was skipped or was not run, `E0` (it proved nothing). The grade of a case that passed MUST be the lowest grade of its steps that are not setup and teardown (a `verb`, an `each` or an `undo` that yields no result), and that of a case that did not pass MUST be `E0`; the file of a record MUST claim no more than `E3` for itself (quality 0001-quality-evidence FR-045), and the branch MUST lift a grade of `E3` to `E4` where the commit that keeps the file is signed, the chain verifies and the note matches the file, and MUST NOT lift a grade of `E2`. A requirement's grade MUST remain the highest grade of its fresh evidence (quality 0001-quality-evidence FR-026), so that a requirement proved only by a person's case is counted as review debt (FR-028 there) and not as proved. Relies on audit rows: B3, B7, B8.

## Parameters, the matrix and the platform

- **FR-017**: A parameter MUST be a typed input of the workload (`text`, `integer`, `flag` or `choice`), a `choice` naming its values (lower case words) and MAY name a default; a step reads it as an input of the run, and an emitted script reads it from the environment variable `WORKLOAD_INPUT_<NAME>`. The platform MUST be the parameter `os`, a `choice` whose values a case lists (`windows-10`, `windows-11` and `debian-13` are those of this specification), and the kind of host (`machine` or `container`) MUST be the parameter `host` where a case runs on a machine of `lab`. Relies on audit rows: C4, E3.
- **FR-018**: A case MAY declare a matrix: for some of its parameters, the values it must be run with. A cell of the matrix MUST be one binding of every parameter of the matrix, and the cells MUST be the product of the values, in the order of the parameters and of the values as written. A cycle (FR-020) MUST run exactly one cell. Relies on audit rows: C4.
- **FR-019**: The platform a run observes (`os`, `arch` of the installation of the record, 0008-test-evidence FR-006) MUST agree with the parameter `os` of the cell it ran; where it does not, the record MUST be kept, the cell MUST NOT be credited with the cycle, and the matrix MUST show the disagreement. A run on a machine of `lab` MUST say `container` as the parameter `host`, so that `debian-13` on a container and on a machine are two cells. Relies on audit rows: A2, E3.

## Cycles and the files of evidence

- **FR-020**: A cycle MUST be one run of one case on one cell, with the identity `YYYY-MM-DD.NN` (the UTC day it started and a number of two digits, from `01`, for that case on that day), the role of the runner (a role and the fingerprint of its key, never a name), the runner (`native`, `bash` or `pwsh`) and the parameters it ran with; the identity MUST be allocated by the code that opens the cycle and never typed, and a cycle MUST NOT be reopened: a correction is a new cycle, which supersedes the first in the ladder and leaves it where it is (0021-ifqs, `superseding`). Relies on audit rows: B3, E4.
- **FR-021**: The files of a cycle MUST be in the folder `evidence/<case id>/<cycle>/` beside the files of the workloads (the layout is that of a test-management-as-code tool that was read, and nothing else of it is taken): `result.auto.json` (the input of the mapper, FR-027, in canonical JSON, listing every file of the cycle with its SHA-256 and size), `run.auto.md` (the checklist of the case with the result of each step and a link to each file) and, for each file a step yielded, `<step id>/<evidence name>`. Every file MUST be written by typed code through a store of `anyfs` with the precondition that the path is absent, MUST NOT be changed after its cycle is closed, and a person MUST NOT edit one by hand. Relies on audit rows: E1, C10, D5.
- **FR-022**: A check of a cycle's files MUST find each file that the result lists and the folder lacks (`item-missing`), each whose SHA-256 or size differs (`item-hash-mismatch`, `item-size-mismatch`) and each that the result does not list (`item-extra`), in the words of 0011-grc-bundles FR-003, and MUST be pure over the contents it is given. Relies on audit rows: D4.
- **FR-023**: Evidence that is text MUST be redacted of secrets and e-mail addresses before it is written, and MUST name no person (quality 0001-quality-evidence FR-025, FR-067); evidence that is binary (a screenshot) cannot be redacted by code, so a person who attaches it MUST say in the attestation that it holds no secret and no personal data, and the case MAY refuse binary evidence. Relies on audit rows: B16.

## Wrapping a run

- **FR-024**: A run MUST be wrapped, not rewritten: the receipts and the run events of the workload MUST be mapped to a record of the quality system (`caseRun`, as `checkRun` maps a check of Mizan), each case an OTLP `test` span and a log record whose body is a CTRF test object, each step a `test step` span, a step that did not run a step with the outcome `not_run` and its reason, each carrying its grade (FR-016); and the workload MUST NOT keep a second format of result as evidence (`result.auto.json` is the input of the mapper and its digest is in the record). Relies on audit rows: B1, B2, B4.
- **FR-025**: The record of a run MUST carry, on every resource, the case id (`ifc.acceptance.case`), the cycle (`ifc.acceptance.cycle`), a parameter each (`ifc.acceptance.param.<name>`), the role of the runner and the kind of the runner (`ifc.acceptance.runner`, `ifc.acceptance.runner.kind`), and the SHA-256 of the plan of calls for an emitted run (`ifc.acceptance.plan.sha256`); and it MAY hold more than one case where they ran in one session on one cell, each with its own cycle. Relies on audit rows: B1, C8.
- **FR-026**: The record MUST be rendered, on demand and never kept as evidence, as TAP 14, JUnit XML, CTRF, SARIF, OSCAL assessment results and the documents of ISO/IEC/IEEE 29119-3 by the writers of `quality`, each extended as FR-030 to FR-033 say, and every rendering that shows a result MUST show its grade with it (quality 0001-quality-evidence FR-014). Relies on audit rows: B5, B6.
- **FR-027**: The mapper MUST be a pure function of the case, the run events, the receipts, the references of the files and the cell, and the same inputs MUST give the same record bytes; it MUST be in `quality` as a format-neutral function over a typed input (`CaseRunInput`) and in `workload` as the translation of a run state, a receipt and a result file into that input, as FR-053 says. Relies on audit rows: B4, C12.

## TAP 14

- **FR-028**: A case MUST be a TAP 14 subtest of its own, named with the case id, the title and the values of its cell, with a plan of its steps (`1..N`, a `not_run` step counted) and, as its closing test point, `ok` where the case passed and `not ok` where any step failed or did not run; a step MUST be a test point of that subtest numbered in the order of the steps, and a step that has steps of its own MUST be a subtest of its own, as `tapSteps` writes it. The stream MUST begin `TAP version 14`. Relies on audit rows: B5, A4.
- **FR-029**: Each step and each case MUST carry a YAML diagnostic block (the block that follows its test point, between `---` and `...`) holding, under these keys where it has them: `id`, `outcome` (`pass`, `fail`, `skip` or `not_run`), `reason`, `grade`, `by` (`person`, `script` or `tool`), `started` and `ended` (ISO 8601, UTC) and `duration_ms`, `expected`, `actual`, `message`, `requirements`, `parameters`, `cycle` and `evidence` (a list of the name, path, SHA-256, size and media type of each reference); TAP has no model of timing or of attachments besides the block, so the block MUST be where they are. Relies on audit rows: B5, E7.
- **FR-030**: The mapping of a result to its test point MUST be this table, and no other:

  | Result of the step | Test point | Directive | Block `outcome` |
  | --- | --- | --- | --- |
  | `passed` | `ok N - <step id>: <title>` | none | `pass` |
  | `failed` | `not ok N - <step id>: <title>` | none | `fail` |
  | `skipped` (a person's word) | `ok N - <step id>: <title>` | `# SKIP <reason>` | `skip` |
  | `not_run` | `not ok N - <step id>: <title>` | `# SKIP not_run: <reason>` | `not_run` |
  | a case that failed or did not run | the closing point `not ok` | none (a `not_run` case: `# SKIP not_run: <reason>`) | the case's outcome |

  A `not_run` step MUST be `not ok`, so that a consumer that counts `ok` never counts it as passed, and the directive `# SKIP` MUST say that it did not run; `# TODO` MUST NOT be used for it (TODO says that a test ran and is expected to fail); and a stream MUST end with the counts as comments (`# pass`, `# fail`, `# skip`, `# not_run`) and the grade of the record. Relies on audit rows: B2, B5.
- **FR-031**: A line of a TAP stream that carries free text (a name, a reason) MUST be one line with `\` and `#` escaped, as `tapDescription` writes it, and a stream MUST hold no `Bail out!` (a run that cannot go on is recorded as `not_run` steps, never as an abort). Relies on audit rows: B5.

## The other renderings

- **FR-032**: JUnit XML MUST give a case a `testcase` with the cycle and each parameter as `property` elements and each step as a `step` property (`<outcome> <step path>`, with `not_run` as an outcome), each evidence reference as an `evidence` property (name, SHA-256), a `not_run` case as `skipped` with `type="not_run"` and its reason, and one `testsuite` for each cell. Relies on audit rows: B6.
- **FR-033**: CTRF MUST give a step its status (`passed`, `failed`, `skipped`, `other` for `not_run`) and the evidence and the cell under `extra` of the case's test object; OSCAL assessment results MUST give a person's step an observation of the method that is a person's (not `TEST`) with the attestation as its subject and each evidence file as a resource of the back matter with its SHA-256, and a step run by a verb an observation of the method `TEST`; SARIF MUST keep a `not_run` step as a warning. Relies on audit rows: B6, D3.

## Native and emitted

- **FR-034**: A case MUST be run by the native runner (every kind of step, a person at a terminal with the gates, the run recorded as planning events on a work order) or emitted by the runners of Bash 5 and of PowerShell 7 (only where every step is a `verb`, a `check` or an `each` over a fixed list); a case that has a person's step MUST be refused by an emitter (`E-WL-RUNNER-EMIT-UNSUPPORTED`, workload 0008-form-runbook FR-023), and its automated part, where it has one, MUST be a case of its own (an emitted case whose cycle precedes it) that the person's case names in its preconditions. Relies on audit rows: C7, C8.
- **FR-035**: An emitted script MUST be the artifact of the plan of calls of its case and nothing else, MUST be checked by regenerating and comparing it (`E-WL-RUNNER-DRIFT`, workload 0010-workload-runners FR-014) before it is run and again by the ingest of its receipt, and the controller MUST run exactly the file that was emitted: on Debian 13 the Bash 5 script, on Windows 10 and Windows 11 the PowerShell 7 script, with the cell's parameters in the environment. The case MUST NOT be edited to suit a platform: a step that differs by platform is a verb with the parameter `os` as an input. Relies on audit rows: C8.
- **FR-036**: Each call of an emitted script MUST write one line `workload.step/1` to the standard error (the step id, its status, its start and its end in milliseconds since the epoch, and the SHA-256 and the name of each evidence file it wrote), and the script MUST end, from its trap, with the line `workload.receipt/1` (the plan hash, the workload, the runner, the exit status and the step that was running); the line of a step MUST be a claim of the script and MUST NOT by itself raise a step above `E3`. Relies on audit rows: C8.
- **FR-037**: A receipt MUST be pulled by ingest and never pushed: the log of a script MUST be read from a store the fleet controls (a path, a store of `anyfs`, a host read over SSH), and the ingest MUST refuse a log whose plan hash is not that of the case at the revision tested, whose lines do not parse, whose digest differs from the one given, or whose evidence files differ from the digests the lines give (`item-hash-mismatch`); it MUST then give the events `receipt` (workload 0010-workload-runners FR-009) and the results of the steps, and the mapper MUST make the record from them. A script that ended with no receipt line MUST give every step not yet recorded `not_run` with the cause `no-receipt`, and a step after the one the receipt names MUST be `not_run` with `not-started`. Relies on audit rows: C9, D4.
- **FR-038**: What the directive `# SKIP` cannot say MUST be said by the block of FR-029 (`outcome: not_run`, `grade: E0`) and by the closing `not ok` of the case (FR-030), so that a consumer that counts a skipped point as passed still finds the truth beside it; the behaviour of the consumers of TAP is UNVERIFIED (below). Relies on audit rows: B5.

## Tamper evidence

- **FR-039**: A cycle MUST be kept as a file of the `quality` branch of the fleet repository (`keepRun`, quality 0001-quality-evidence FR-021 to FR-023): the digest of the file before it is on every resource (the chain), the commit that keeps it is signed where Git is set to sign, and a note on the tested commit names its path, SHA-256 and grade; the digests of the files of the cycle MUST be in the record, so that a file changed after the cycle is found by the check of FR-022 and by `verify`, and a record changed is found by the chain. Relies on audit rows: B8.
- **FR-040**: The record of a cycle MAY be signed by a person's key (`signRun`, meaning `executed`, then `reviewed` and `approved` by other keys, FR-014) and its digest MAY be appended to the ledger of runs (`runEntry`); the branch MUST NOT be rewritten, and a cycle MUST NOT be removed from it. Relies on audit rows: B7, B8, B9.
- **FR-041**: The assessor pack of a span (quality 0001-quality-evidence FR-060) MUST hold the files of each cycle kept in the span under `evidence/<case id>/<cycle>/`, each in the manifest with its SHA-256, size and media type, and the offline verifier MUST check them (FR-064 there). Relies on audit rows: B14.

## The matrix with freshness

- **FR-042**: The matrix MUST be a pure function of the kept runs, the cases, the cadences and the day (no clock is read): one row for each case (and the requirements it proves), one column for each cell of its matrix, and in each cell the newest cycle that was credited to it (FR-019), its result, its grade, its freshness (`Fresh`, `Due` or `Stale`, judged by time and by change, quality 0001-quality-evidence FR-030), its day and its cycle; a cell with no cycle MUST be shown as `none` with the grade `E0`, never left out. Relies on audit rows: B10, B13.
- **FR-043**: The cadence of a cell MUST be the case's own (an ISO 8601 duration it MAY declare) or, where it declares none, the shortest cadence of the kinds of evidence its steps give (a step run by a verb a `run`, a person's step a `review`), and a cell MUST be `Stale` by change where a file in the chain of a requirement it proves changed after its revision, whatever its age. Relies on audit rows: B10.
- **FR-044**: The matrix MUST be offered as a table and as JSON by a command generated from one definition (headless 0001-headless-layers FR-009), MUST be a relation of the SQL over the runs (`case_parameters`, `case_steps`, quality 0002-quality-query), and SHOULD be shown on the Trust page beside the requirement matrix, the same figures in both. Relies on audit rows: B13, B15, E6.

## Where each piece lives

- **FR-045**: The case, its parameters and matrix, the expected result and the evidence declarations of a step, the outcome word and the attestation of a person's answer, the cycle and the layout of its files, the step and receipt lines of an emitted script, the ingest of its log, and the results column of the checklist MUST be in the library `workload` (workload 0017-workload-test-cases). Relies on audit rows: C1 to C11.
- **FR-046**: The step in the record, `caseRun`, the grade of a step and of a case, the TAP block and the test points of a `not_run`, the additions to JUnit, CTRF and OSCAL, the evidence in the pack, the relations and the matrix MUST be in the library `quality` (quality 0003-quality-case-runs). Relies on audit rows: B1 to B6, B10, B13 to B15.
- **FR-047**: The claim `skip` and the verification of an attestation (its signature, its role, its custody) MUST be in the library `grc` (grc 0018-grc-acceptance-attestation), and the reading of the `proves` of a case by the trace check MUST be in the library `mizan` (mizan 0003-mizan-case-proofs). Relies on audit rows: D1, F1.
- **FR-048**: The library `test`, `anyfs`, `evidence-capture`, `lab` and `planning` MUST NOT be changed by this specification: a case is not run in a test process (`test`), a file is written once through the stores `anyfs` has, a cycle is not an observation of an asset (`evidence-capture`), a machine of `lab` is only a host of the automated part, and a cycle that is due is a work order of `planning` with the label `workload:<id>`. Relies on audit rows: A2 to A4, E1 to E4.

## The dependencies

- **FR-049**: `quality` MUST import nothing of `workload`; `workload` MUST import `quality` only in its physical entry `./acceptance` (the translation of FR-027), and no other entry of `workload`, and none of its governance, logical or form modules, MUST import `quality`; the core and the forms of `workload` MUST stay free of the record. The edge MUST NOT close a cycle of libraries (0032-libraries-by-concern FR-003). Relies on audit rows: C12.
- **FR-050**: `workload` MUST import `grc` for the attestation (the `logical` and `physical` entries, in the table of its manifest) only in the same physical entry, and the verbs, the stores and the port of the terminal MUST be given to it by the consumer's host as ports. Relies on audit rows: D1, C11.

## The rules of this work

- **FR-051**: No product name MUST be in a requirement, a table or an example of this specification or of the ones it governs (0027-commons-libraries FR-028); the examples are synthetic (`synthetic-case-01`, `synthetic-approver-01`), and no person is named.
- **FR-052**: A tool that was read for its structure MUST be named only in the table of the standards considered and MUST NOT be a dependency of any library of commons.
- **FR-053**: The mapper MUST live as FR-027 and FR-049 say, for the reasons of the section of the reuse audit "Where the mapper lives"; the edge from `workload` to `quality` MUST be moved to a package of its own, with no change of either library, if the layers check refuses it.
- **FR-054**: This specification and the ones it governs MUST hold no code; every requirement that asks for code is a row of the enforcement register with the mechanism `none` and the note Deferred.
- **FR-055**: A requirement of this specification and of each specification it governs MUST be written with MUST, MUST NOT, SHOULD or MAY, and MUST state no history: what was true before is not said.
- **FR-056**: A requirement of this specification and of each specification it governs MUST name, as `Relies on audit rows`, the rows of `reuse-audit.md` it relies on; the count of the decisions there (reuse, extend, new, decision) is a test that is deferred.

## Acceptance scenarios

1. **Given** a runbook that carries a case, **When** it is checked, **Then** it passes the static checks of a runbook and the checks of a case, and a runbook with no citation in `proves` is refused, per FR-001 and FR-003.
2. **Given** a case with four steps, a verb, a check, a person's step and a verb, **When** the person answers `passed` with a reason and a verifying attestation, **Then** the steps are `passed`, `E3`, `E2` and `E3`, and the case is `passed` at `E2`, per FR-009 and FR-016.
3. **Given** the same case where nobody has answered, **When** the run is wrapped, **Then** the person's step and what follows it are `not_run` (`awaiting-person`), the case is `not_run` and proves nothing, and the TAP closes the case with `not ok`, per FR-007, FR-009 and FR-030.
4. **Given** an answer by an agent, **When** it is folded, **Then** it is refused and the step stays `not_run`, per FR-012.
5. **Given** an attestation signed by a key of a role that the contract holds as `either`, **When** the policy is checked, **Then** it is a finding, per FR-012.
6. **Given** a case with a person's step, **When** a Bash 5 emitter is asked for its artifact, **Then** it is refused naming the step, per FR-034.
7. **Given** an emitted script, **When** it is run on Debian 13 and its log is ingested, **Then** each step has its result from its `workload.step/1` line, the receipt is the event `receipt`, and the record is made by the mapper, per FR-036 and FR-037.
8. **Given** a log whose plan hash is not that of the case at the revision, **When** it is ingested, **Then** it is refused, per FR-037.
9. **Given** a script killed before its receipt, **When** the steps are read, **Then** each not yet recorded is `not_run` with `no-receipt`, per FR-037.
10. **Given** a cell `windows-11` that ran on a machine whose observed `os` is Linux, **When** the matrix is made, **Then** the cell is not credited and the disagreement is shown, per FR-019 and FR-042.
11. **Given** a file of a closed cycle that is changed, removed or added, **When** the cycle is checked, **Then** the finding names it as `item-hash-mismatch`, `item-missing` or `item-extra`, per FR-022.
12. **Given** a case with the matrix `os` of three values, **When** the cells are listed, **Then** there are three and the matrix shows each with its freshness, and a cell with no cycle as `none` at `E0`, per FR-018 and FR-042.
13. **Given** a record of a cycle, **When** it is rendered as TAP 14, **Then** it begins `TAP version 14`, the case is a subtest with a plan, each point has a block with the evidence and the timing, and a `not_run` step is `not ok` with `# SKIP not_run:`, per FR-028 to FR-030.
14. **Given** a person's step passed and kept on the `quality` branch, **When** the grade of the case is read, **Then** it is `E2`, and the requirement it proves is review debt, per FR-016.
15. **Given** the libraries `quality` and `workload`, **When** their imports are read, **Then** `quality` imports nothing of `workload` and only `./acceptance` of `workload` imports `quality`, per FR-049.

## Out of scope

- The code of any of it: every requirement here is Deferred until it is built.
- A test management tool of any vendor: none is a dependency, and no file format of one is read or written.
- The terminal that collects a person's word: a renderer of the SDK (headless 0001-headless-layers FR-009), specified where it is built.
- A form `campaign` and the sampling of cases over a period: the form stays reserved (0040-workload-pattern FR-005); a sample of attestations is Tier 2 of the quality system and is not changed here.
- A Windows machine in `lab` and the installation of the pinned verb command on a controller: the consumer's host.

## Edge cases

- A person's step in a case that also has automated steps: the case runs natively, the person at the terminal, and the automated part is not emitted (FR-034); a person who wants the automated part on a controller makes it a case of its own.
- A person answers `skipped` for a step whose result a requirement needs: the case is `skipped` and proves nothing, and the matrix shows the cell with its reason, per FR-009.
- A cycle with two persons (one executed, another approved): two signatures of two keys, per FR-014.
- The same case on the same day on two platforms: two cycles, `.01` and `.02`, each with its own cell, per FR-020.
- A case whose evidence is binary and that refuses binary: the step is not recorded as passed, per FR-005 and FR-023.
- An emitted script that passes and whose receipt is ingested twice: the second ingest gives the same record and is refused by the branch as a trace already kept (quality 0001-quality-evidence FR-021).

## Assumptions

- The fleet repository has the `quality` branch (quality 0001-quality-evidence FR-021) and Git set to sign; where it does not, a cycle is `E3` and not `E4`.
- A person who answers has a key that the evidence policy knows, with the custody it asks for.
- The pinned verb command of `workload` is installed on the controller, on Debian 13 and on Windows.

## Open questions

- **OQ-1**: Should a case with a person's step be able to name an emitted case of the same cycle as its automated part, so that one command runs both (FR-034), or is a precondition enough?
- **OQ-2**: Is the cycle identity `YYYY-MM-DD.NN` for a case enough, or does a release name a cycle across cases (a suite)?
- **OQ-3**: Which files does the harness class as test files for the trace check: a case is in a file whose name ends `.case.ts`, and the classing is to be confirmed in the configuration of the harness (mizan 0003-mizan-case-proofs).
- **OQ-4**: How is a screenshot kept without a secret in it, other than the word of a person (FR-023)?
- **OQ-5**: Does the one mapper edge from `workload` to `quality` stay in `workload`, or does the layers table, which does not list `workload`, ask for a package of its own (FR-053)?
- **OQ-6**: Is a grade of `E2` for a person's step too low for a regulated harness that needs a person to witness a restore, and is a witness's second signature (meaning `reviewed`) to lift it?

## UNVERIFIED

- How the consumers of TAP count a `# SKIP` on a `not ok` point; the directives were read from the specification of TAP 14 and no consumer was run (FR-030, FR-038).
- The OSCAL method of an observation made by a person and the `rlinks` with `hashes` of a back-matter resource, from memory of OSCAL 1.x (FR-033).
- Bun and PowerShell 7 on Windows 10 and 11 as a controller; Bash 5 on Debian 13 (the version of `bash` of Debian 13 is not read here).
- That an SSH signature by a key of a hardware token (`sk-ssh-ed25519`) can be verified: only Ed25519 keys are (grc 0014-grc-sshsig FR-004), so a custody of `hardware` by that key type is not available.
- That a person at a terminal is a person: the code can only refuse a non-terminal and trust the key's custody; it cannot prove who types (FR-012, FR-013).

## Key entities

- **Case** - a runbook with the requirements it proves, preconditions, parameters, expected results and evidence.
- **Cycle** - one run of one case on one cell, `YYYY-MM-DD.NN`.
- **Cell** - one binding of the parameters of a matrix, for example `os = windows-11`.
- **Result** - `passed`, `failed`, `skipped`, or `not_run` with its cause.
- **Person's step** - an `ask` of a case, answered by a person with a word and a reason, as a signed attestation.
- **EvidenceRef** - the name, path, SHA-256, size and media type of a file a step yielded.
- **Mapper** - `caseRun` of `quality` and its translation in `workload`.
- **Receipt** - the lines `workload.step/1` and `workload.receipt/1` that an emitted script writes, pulled by ingest.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| TAP 14 (the specification of the Test Anything Protocol, version 14) | The version line, the plan `1..N`, `ok` and `not ok`, the directives `# SKIP` and `# TODO`, `Bail out!`, subtests, YAML blocks and comments; there is no model of timing or of attachments besides a YAML block | The specification was read for these facts; no consumer was run |
| A test-management-as-code layout in Markdown (the project's documentation, read; its name is Qualityfolio) | The roles of a document by heading depth (project, strategy, plan, suite, case, evidence), an `@id`, a `yaml META` block, the sections Description, Preconditions, Steps and Expected Results, and the layout `evidence/<case id>/<cycle>/` with `result.auto.json` and `run.auto.md`; the examples show the statuses passed and failed and say nothing of skipped or blocked | Structural reference only: its licence is not known, and no code, format reader or dependency of it is used |
| ISO/IEC/IEEE 29119-3 (as the quality system renders it) | The test completion, status and incident reports | `commons/quality/src/pure/render.ts` `DOCUMENTS`; the standard itself is not copied |
| OSCAL assessment results (NIST, version 1.x) | An observation, a finding, a resource of the back matter with a hash | The writer of `quality`; the person's method and the `rlinks` are UNVERIFIED |
| in-toto Test Result v0.1 | The statement that signs a run | `commons/quality/src/test-report.ts` `testResultStatement` |
| SSHSIG (OpenSSH PROTOCOL.sshsig) and DSSE | The signature of a person's attestation | commons grc 0014-grc-sshsig and crypto 0001-crypto, already implemented |

## Success criteria

- **SC-001**: Every requirement of this specification that asks for code has a row of the enforcement register with the mechanism `none` and the note Deferred; each row that gets code has a test with synthetic names and no network.
- **SC-002**: Every requirement says which row of the reuse audit it relies on, and no requirement states a history.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement says which row of the reuse audit it relies on, or is about the rule itself
