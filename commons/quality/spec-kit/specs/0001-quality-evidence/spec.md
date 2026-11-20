# Feature Specification: Quality evidence

**Spec ID:** 0001-quality-evidence
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The run of a suite of tests as evidence, and the quality system that keeps it (the canonical record of a run, its renderings, the append-only `quality` branch, the evidence ladder, freshness, nonconformance and CAPA, objectives, the tiers, and the Trust page and the assessor pack made from it), lifted out of `commons/ts` into the library `quality`. The requirements are those of commons 0008-test-evidence FR-004 to FR-013, commons 0021-ifqs and commons 0022-trust that these modules prove; those specifications now point at this one (commons 0032-lifting-libraries FR-010).

## Test runs: Capture (runtime)

- **FR-001**: Where `IFC_TEST_RECORD` names a file, each test process MUST append its records to it as OTLP JSON lines as each test ends, so that a process that dies keeps what it finished; a test that started and did not end before its process exited MUST be recorded as `cancelled`. Where it is not set, records MUST go to the installed pipeline (commons 0006-signals) if any, and otherwise be kept in memory for the process.

## Test runs: The run (runtime and tools)

- **FR-002**: `src/host/test-run.ts` MUST run a suite: start one trace with a `test run` span, run `bun test` or `node --test` (chosen, one or both in turn) with `TRACEPARENT` and `IFC_TEST_RECORD` set, pass the runner's own output on, gather every process's records into one OTLP JSON file for the run (`<out>/<trace id>.otlp.json`) with the run's span, and say where it is. `src/test-cli.ts` (`ifc test`) MUST be its command line.
- **FR-003**: A run MUST fail (exit 1) when a test failed, when a runner exited non-zero, when a test is `cancelled`, or when a requirement of the list given (`--requirements`, one id per line or a spec-kit enforcement register's rows of mechanism `check`) is neither proven by a test of the run nor declared `reviewed` with its reason; the run's span MUST say which, by `test.suite.run.status` and `ifc.test.unproven`.
- **FR-004**: The record of a run MUST be the evidence: kept as written, read only through the decoder of commons 0006-signals FR-004, and its digest the SHA-256 of its bytes.

## Test runs: Reports (kernel)

- **FR-005**: `src/test-report.ts` MUST read a run's record into a typed model (the run, its installation record, its tests, its requirements) and render it, purely, as: TAP version 14 (a plan, `ok` and `not ok` numbered, `# SKIP` and `# TODO` with their reasons, a YAML diagnostic block for a failure with its message, expected, actual and requirements, one subtest per file); JUnit XML (one `testsuite` per file and runtime, `testcase` with `classname` and time in seconds, `failure`, `skipped`, and the requirements as `properties`); CTRF JSON (its `results.tool`, `summary` and `tests`, the requirements and risk under `extra`); SARIF 2.1.0 (each failed test a result at its file, with the requirement as a rule); and OSCAL 1.2.3 assessment results (commons 0007-grc FR-017) with one observation per test and one finding per requirement.
- **FR-006**: The library MUST render a test completion report, in Markdown and in HTML that needs nothing outside itself: the summary; the installation record; a requirement trace matrix (each requirement, the tests that prove it and their outcomes, or that it was reviewed, waived or left unproven); the incidents (each failure, cancellation and skip with its reason); high-risk requirements and whether they have a signed review; the conclusion; and the signatures on the run with their meaning and role.
- **FR-007**: The counts in every rendering of a record (tests, passed, failed, skipped, todo, cancelled) MUST be equal to the model's, and a rendering MUST hold no time or value that is not in the record, so that rendering a record twice gives the same bytes.

## Test runs: Evidence (kernel and runtime)

- **FR-008**: A run MUST append the digest of its record to an evidence ledger (commons 0007-grc FR-007) with the kind `test-run`, and MAY sign it: an in-toto Statement v1 whose subject is the record and whose predicate is the in-toto Test Result (`https://in-toto.io/attestation/test-result/v0.1`: the result `PASSED`, `WARNED` or `FAILED`, the configuration as resource descriptors, and the passed, warned and failed tests), in a DSSE envelope, and the signature entered in the ledger with its meaning (`executed`, `reviewed` or `approved`), its role and its time, so that the signature is linked to its record.
- **FR-009**: `ifc test verify` MUST check that a record's digest is in the ledger, that the ledger's chain is whole, and that each envelope given verifies with the key given and names the record's digest; it MUST fail and say which when any does not.
- **FR-010**: A requirement whose tests are of `high` risk MUST be reported as needing a signed review, and `ifc test verify --require-review` MUST fail until a signature of meaning `reviewed` is in the ledger for the run.

## Quality: Principles

- **FR-011**: Everything the quality system reports MUST be reported in OpenTelemetry (commons 0006-signals): runs, results, probes and measures are spans, log records and metrics through one pipeline, and no second channel MAY carry a result that the pipeline does not.
- **FR-012**: Nothing authorizes itself: what produces a result MUST NOT be what accepts it, a check MUST NOT waive or close its own failure, and an agent that opened a nonconformance MUST NOT approve the closure of its CAPA (commons 0020-ifccm FR-018 to commons 0020-ifccm FR-020).
- **FR-013**: A planned case, check or requirement that did not run MUST be recorded as `ifqs:NotRun` (written `not_run`) with the reason, and MUST NOT be counted as passed, silently skipped or left out; the count of `not_run` MUST be shown wherever the counts of passed and failed are.
- **FR-014**: Every piece of evidence MUST carry its grade (`ifqs:EvidenceGrade`), and every rendering that shows evidence, or a count of requirements proved, MUST show the grade with it; a count of proved requirements with no grade MUST NOT be shown.
- **FR-015**: WHEN a result that a requirement relies on fails, or a proof of it is stale (FR-030), the system MUST open a nonconformance (`ifqs:Nonconformance`) itself, with the requirement, the evidence it arises from and the reason, and MUST NOT wait for a person to notice.

## Quality: What it is held to

- **FR-016**: WHERE a requirement's tests are of `high` risk (commons 0008-test-evidence FR-001), the requirement MUST NOT be counted proved below grade `ifqs:E4`, and otherwise MUST NOT be counted proved below `ifqs:E3`, so that the assurance asked for follows the risk, as the FDA's guidance on Computer Software Assurance asks; WHERE a harness declares a regulated domain and has declared production (commons 0020-ifccm FR-010), every requirement of it MUST need `ifqs:E4`, whatever its risk, from the day it declares production (that day included). The grade needed is a pure function of the risk, the declaration and the day (`gradeNeeded(risk, declaration, today)`: none of the three is read from the clock or a file inside it), and the ladder, the Trust page and the tier claim (FR-040) MUST use it, a tier claim being refused where a requirement of the tier is held by a mechanism but proved below the grade needed.
- **FR-017**: A test MAY name the quality characteristic it proves, in the words of ISO/IEC 25010, as the record attribute `ifc.test.characteristic`, and a report of a run MUST bear the document names of ISO/IEC/IEEE 29119-3 (the test completion report of FR-006, the test status report of a run in progress and the test incident report of each failure, cancellation and `not_run`).

## Quality: The canonical record (it extends commons 0008-test-evidence)

- **FR-018**: The canonical result of a run MUST be the record of commons 0008-test-evidence FR-002 to FR-002 (OTLP/JSON, the OpenTelemetry test conventions), one file per run and one log record per case, and the body of a case's log record MUST be a CTRF test object (`name`, `status` and `duration`, and the other CTRF fields the case has); JUnit XML, TAP, CTRF documents, SARIF and OSCAL (FR-005) MUST be rendered from it on demand and MUST NOT be kept as evidence.
- **FR-019**: The record's outcome (`ifc.test.outcome`) MUST also take the value `not_run`, with its reason (`ifc.test.reason`), in addition to those of commons 0008-test-evidence FR-001; a requirement whose only proofs are `not_run` is unproven (FR-003), and a CTRF rendering MUST give it the status `other`.
- **FR-020**: A check of Mizan (the specification rules, the trace and layers checks, the changes check of commons 0020-ifccm) MUST leave its result in the same record, each rule a case and each finding a failed case with its rule id, file and line, so that its findings render as SARIF results.

## Quality: Git is the evidence

- **FR-021**: A run's record MUST be kept as one immutable file at `quality/evidence/YYYY/MM/DD/<trace id>.otlp.json` on an orphan branch named `quality`, committed by signed commits that only append; a harness MUST refuse a force-push or a rewrite of the branch, a file MUST never be changed after its commit, and a correction MUST be a new run.
- **FR-022**: The resource of each file MUST carry `ifc.quality.previous.sha256`, the SHA-256 of the file before it on the branch (64 zeros for the first), so that a file removed, inserted or changed is found by the chain, and verification MUST name the first file that does not match (as commons 0007-grc FR-007 does for a ledger).
- **FR-023**: WHEN a run is kept, a Git note under `refs/notes/quality` on the tested commit MUST give the evidence file's path, its SHA-256 and its grade, so that a commit shows its evidence without being changed; a commit with no note MUST be shown as having no evidence (`ifqs:E0`).
- **FR-024**: The index of runs, for search, trends and the public page, MUST be derived from the `quality` branch, MUST be rebuildable from it alone, and MUST NOT be a source of evidence; a harness MAY keep it in a database.
- **FR-025**: A file MUST be redacted before it is committed (commons 0006-signals FR-006) and MUST name no person (commons 0008-test-evidence FR-003), because a committed file cannot be changed.

## Quality: The evidence ladder

- **FR-026**: Evidence MUST be graded, from `ifqs:E0` to `ifqs:E5`: `ifqs:E0` none (a requirement with no evidence), `ifqs:E1` stated (a person or an agent says it is met), `ifqs:E2` reviewed (a review is recorded against the requirement), `ifqs:E3` tested (an automated run proved it and the record exists), `ifqs:E4` attested (the run is kept on the `quality` branch, chained, signed and linked to its commit, FR-021 to FR-023) and `ifqs:E5` observed (a probe of the system in operation reports it); a requirement's grade MUST be the highest grade of its fresh evidence.
- **FR-027**: The proof register of a specification kit (the enforcement register, commons 0003-mizan FR-005) MUST be shown with the grade and the day of the evidence of each row, generated from the evidence and never written by hand.
- **FR-028**: A harness MUST report its review debt (`ifqs:ReviewDebt`) as a number: the count of requirements whose best fresh evidence is `ifqs:E1` or `ifqs:E2`, counted at a stated revision; it MUST be shown beside every count of proved requirements, and it MUST NOT grow from one revision of the default branch to the next without a Decision.
- **FR-029**: WHERE a review (`ifqs:E2`) is made by an agent, the record MUST say that it was an agent's, and it MUST be graded no higher than `ifqs:E2`.

## Quality: Freshness

- **FR-030**: A proof MUST be `ifqs:Fresh`, `ifqs:Due` or `ifqs:Stale` (`ifqs:FreshnessState`): by time, as commons 0007-grc FR-011 judges evidence against a cadence, and by change, being stale where a file in the requirement's trace chain (its text, term, code or test, commons 0020-ifccm FR-014) changed after the revision of the run; a stale proof MUST open a nonconformance (FR-015) and MUST NOT count at its grade.

## Quality: Nonconformance and CAPA

- **FR-031**: A nonconformance MUST carry its requirement, the evidence it arises from, its reason, who opened it (the system or a role) and its state (`ifqs:NonconformanceOpen` or `ifqs:NonconformanceClosed`), and MUST be linked to a Problem change request (commons 0020-ifccm FR-021).
- **FR-032**: A nonconformance MUST be closed only through a CAPA that is closed (FR-035), never by editing its state.
- **FR-033**: A corrective and preventive action (`ifqs:Capa`) MUST state the corrective action, MUST name the test that verifies it (a test that exists and proves the requirement) and MUST be in one state of `ifqs:CapaOpen`, `ifqs:CapaVerified` and `ifqs:CapaClosed`, in that order.
- **FR-034**: WHEN the test a CAPA names passes in a run at a revision that holds the last commit of the corrective change (the revision after it, or that commit itself, whose code is the corrected code), the CAPA MUST become `ifqs:CapaVerified`, and its verification MUST NOT be recorded in any other way.
- **FR-035**: A CAPA MUST become `ifqs:CapaClosed` only from `ifqs:CapaVerified` and only by the approval of a named person, recorded as a Decision with the person and the day; an automated run closes the verification step and a person closes the CAPA, and where commons 0020-ifccm FR-020 applies the person MUST NOT be the author of the corrective change.
- **FR-036**: A nonconformance and its CAPA MUST appear in the index and on the public page (commons 0022-trust) from the moment they are opened, and a nonconformance that closed MUST stay in the record with its CAPA.

## Quality: Objectives

- **FR-037**: A success criterion MUST be a quality objective (`ifqs:QualityObjective`): a metric named as OpenTelemetry names a metric (commons 0006-signals FR-013), a target, a unit, an error budget and the window it is spent in; its measure MUST be computed from the evidence and MUST NOT be typed in.
- **FR-038**: WHEN an objective's error budget is spent within its window, the system MUST open a nonconformance (FR-015); WHILE budget remains, the remaining budget MUST be shown with the objective.
- **FR-039**: A harness SHOULD declare objectives for the share of its requirements at `ifqs:E3` or above, its review debt, its count of `not_run` cases, the age of its oldest open nonconformance and the number of its stale proofs.

## Quality: Tiers

- **FR-040**: A harness MUST state the tier it claims (`ifqs:QualityTier`), `ifqs:Tier0` (evidence exists: FR-018 to FR-025), `ifqs:Tier1` (the system reports itself: FR-026 to FR-039) or `ifqs:Tier2` (people see and prove: the console of commons 0021-ifqs FR-037 and FR-041 to FR-044), and MUST claim a tier only where every requirement of it and of the tiers below it is met.
- **FR-041**: WHERE a harness claims `ifqs:Tier2`, a person's attestation MUST be a recorded sample: what was sampled, the rule and seed that chose it, the result of each, the role and the day, signed.
- **FR-042**: WHERE a harness claims `ifqs:Tier2`, a test plan MAY be pre-registered, committed and signed before the run it governs, naming its cases and acceptance criteria; the run MUST then report each case not in the plan, and each planned case not run as `ifqs:NotRun`.
- **FR-043**: WHERE a harness claims `ifqs:Tier2`, a run MAY mutate the code that a test proves and record whether the test failed, and the strength of a proof that results MUST be shown beside its grade.
- **FR-044**: WHERE a harness claims `ifqs:Tier2`, an agent MAY perform a review mechanism, graded as FR-029 says, and a person MUST sample the agents' reviews (FR-041) at a rate the harness states.

## Quality: The grade of kept evidence

- **FR-045**: A file MUST claim no more than `ifqs:E3` for itself (`ifc.quality.grade`), because what makes it `ifqs:E4` is what happens to it after it is written; the grade of kept evidence MUST be the one its note gives, which MUST be `ifqs:E4` only where the commit that keeps the file is signed, the chain verifies and the note matches the file's SHA-256, `ifqs:E3` where the file is kept and any of these is not so but nothing is broken, and `ifqs:E0` where the chain does not verify or the note does not match its file; a note MUST be the lines `path`, `sha256` and `grade`, one such paragraph for each run kept for the commit, the last being the newest.

## Quality: Where Tier 1 keeps what it records

- **FR-046**: The records of Tier 1 (a nonconformance opened, linked and closed, a CAPA opened, verified and closed, and a statement, a review or a probe's typed result kept as evidence) MUST each be one new file `quality/records/NNNNNN-<kind>.json` on the `quality` branch, in a commit that only appends, redacted as FR-025 asks and chained to the file before it by its digest (64 zeros for the first) as FR-022 chains the evidence files, so that a file changed, removed or inserted is found by the branch's verifier; a state MUST be the fold of its events and MUST NOT be a field that is edited, so that no event closes a nonconformance but the one that follows a closed CAPA.
- **FR-047**: A proof MUST be held to a cadence by its kind of evidence (FR-030), by default 30 days for a run, 7 days for a probe, 90 days for a statement and a year for a review, and a harness MAY state its own.

## Quality: Where Tier 2 keeps what it records

- **FR-048**: The records of Tier 2 (a test plan registered, a sample drawn, a person's attestation of it and a mutation run) MUST each be a file of the ledger of FR-046, in its chain, and an event that does not follow what came before MUST be refused and written nowhere: an attestation of a sample that gives no result on an item sampled, a result on an item not sampled, no named person, or a second attestation; a plan with no case or a case with no acceptance criterion; a mutation row that does not account for its mutants. A sample MUST record its rule, its seed and the count and digest of its population, so that it can be drawn again, and a run that is governed by a plan MUST name it by the SHA-256 of the plan (`ifc.quality.plan.sha256`).
- **FR-049**: The strength of a proof (FR-043) MUST be the share of its mutants that its tests detected, and a strength below the floor the harness states (60 % where it states none, and 80 % where it declares a regulated domain and has declared production, a floor it states for itself never lowering that one; a pure function of the declaration and the day, `mutationFloor`) MUST lower the grade of a proof that is a run by one rung, `E4` to `E3` and `E3` to `E2`, with both shown; a grade that is not a run's, and a proof that no mutation run measured, MUST keep its grade and say which.
- **FR-050**: A harness's record (`ifccm.declaration.ts`, commons 0020-ifccm FR-010) MUST be able to state the retention period of its evidence in days (`retentionDays`, a whole number of at least one), and the period a harness states MUST NOT be shorter than the longest retention that applies to its evidence. Evidence MUST be kept on the `quality` branch for that period and, once the period of the oldest evidence has passed, MUST be archived by a Git tag on the tip of the branch (`quality archive --tag NAME`), never deleted: no command of the quality system deletes a file, a commit, a tag or the branch, and a tag that exists MUST NOT be moved or replaced. Where the record states no period the command MUST refuse and say so. The period and the day are arguments of the pure judgement; the command reads the day from the clock.
- **FR-051**: The review debt of FR-028 MUST be counted apart for what rests on an agent's statement or review (`reviewDebtByAgent`) and for what rests on a person's (`reviewDebtByPerson`), because an agent's review is graded below a test run (FR-029); the total MUST remain, as the sum of the two, and a count of proved requirements, the proof register, the index and the Trust page MUST show the total with both.

## Trust: The Trust page

- **FR-052**: A Trust page MUST be generated, never written by hand, from the evidence of a harness (the files of the `quality` branch and the index derived from them, FR-021) and its specifications, and the generator's `--check` MUST fail where the page differs from what the evidence makes.
- **FR-053**: The page MUST show, for the revision it was made at, each requirement with its grade (`ifqs:EvidenceGrade`), its freshness (`ifqs:FreshnessState`) and the day and run of its last proof, the review debt (`ifqs:ReviewDebt`), each objective with its target and the error budget that remains (`ifqs:QualityObjective`), and the count of `not_run` cases beside the counts of passed and failed.
- **FR-054**: The page MUST show failures: each failed case, each open nonconformance with its age and each open CAPA MUST be listed before any success, and the page MUST NOT drop, hide or reorder a failure to improve a figure.
- **FR-055**: The page MUST state its scope (the harness, the revision, the day it was generated and the span of evidence it covers) and what it does not cover, and MUST NOT state that a harness conforms to, is certified to or complies with a standard, a regulation or a control.
- **FR-056**: WHEN the evidence a page was made from is older than its harness's cadence for it (commons 0007-grc FR-011), the page MUST say that it is stale and by how long.

## Trust: Audiences and redaction

- **FR-057**: Each rendering of evidence MUST be made for one audience (`ifqs:Audience`): `ifqs:Public` (the page; a figure, an identifier, a grade and a failure's requirement and reason), `ifqs:Assessor` (the pack of FR-060) or `ifqs:Internal` (the harness's own console).
- **FR-058**: A rendering for `ifqs:Public` MUST leave out what commons 0006-signals FR-006 redacts, the names of people, customers and hosts, the paths and names of private repositories and any value a failure message holds beyond its requirement and reason, and MUST say how many values it redacted, so that a redaction is never silent.
- **FR-059**: Redaction MUST be deterministic and MUST NOT change a figure: the same evidence and the same audience MUST give the same bytes, and a count, a grade or a digest of a rendering for a narrower audience MUST equal the same figure of a wider one.

## Trust: The assessor pack

- **FR-060**: An assessor pack (`ifqs:AssessorPack`) MUST be a self-contained bundle for one revision and one span of time: the evidence files of that span with their chain (FR-022), the notes that link them to commits, the specifications at the tested revisions, the traceability matrix, the OSCAL assessment results of the runs (FR-005), the ledger and the signatures with the public keys that verify them, and a manifest giving each file's SHA-256 and media type.
- **FR-061**: A pack MUST give an assessor what the page leaves out for the public (full failure messages, run files and signed envelopes) with only secrets and personal data redacted (FR-058, FR-059), and MUST be marked with its audience and the redactions it made.
- **FR-062**: The page and the pack of a revision MUST be made from the same evidence in one run, so that a figure of the page equals the same figure computed from the pack, and a test MUST compare them.
- **FR-063**: A pack MUST be offered as a download of a file (a DCAT distribution, commons 0019-mizan-integrations FR-018), with its SHA-256 beside it.

## Trust: Offline verification

- **FR-064**: A person MUST be able to verify a pack with no network and no account: the command MUST check the manifest's digests, the hash chain of the evidence files, the signature of each signed envelope against the keys in the pack, that each note names a file the pack holds, and that the figures of the pack's summary equal the figures computed from its files, and MUST name the first thing that fails.
- **FR-065**: A verification that cannot check part of the pack (a key that is not in the pack, a file the manifest lists and the pack lacks) MUST report that part as `not_run` with the reason, and MUST NOT report the pack as verified.
- **FR-066**: The verifier MUST be small, typed TypeScript that runs on Bun and Node 26 with no dependency, and MUST be included in the pack so that the pack can check itself.

## Trust: What a pack cannot redact

- **FR-067**: Redaction MUST be at the source: every writer of a file kept on the `quality` branch (the records of runs, the events of the ledger of every kind, plans, samples, attestations, mutation runs and the notes) MUST redact the file of secrets and e-mail addresses before it is kept (FR-025), a person's name being data that stays. A file kept MUST NOT be changed to redact it for a pack, because its digest is in a chain; the pack's refusal is the backstop for a file kept before this rule or by another writer: a pack MUST refuse a kept file that still holds a secret, naming it, so that its source is fixed and kept again, and MUST name in its manifest the personal data (an e-mail address) that a kept file retains; the files a pack makes itself MUST be redacted and the redactions counted (FR-061).
- **FR-068**: The page for `ifqs:Public` MUST name an open nonconformance by its identifier, the identifier of its requirement, its state, its age and a code from the closed list of causes (`failed`, `stale`, `probe-failed`, `budget-spent`), and MUST NOT show the text of the requirement, the reason the nonconformance was opened, the text of the corrective action of its CAPA or any other text of its record (a CAPA is named by its identifier, its state and the named test); the renderings for `ifqs:Assessor` and `ifqs:Internal` MUST show the text of the requirement as the specifications state it at the tested revision, the reason and the corrective action. What the public page withholds is counted among its redactions (FR-058).
## Acceptance scenarios

1. **Given** a suite and a requirements list, **When** `ifc test run` runs it on Bun and on Node, **Then** one OTLP record of the run is written with its reports, and the run fails where a requirement is neither proven nor declared reviewed, per FR-002, FR-003 and FR-004.
2. **Given** a record with a case that did not run, **When** it is rendered, **Then** the case is `not_run` with its reason and is counted apart from passed and failed, per FR-013 and FR-019.
3. **Given** a record, **When** it is kept on the `quality` branch, **Then** it is one new file chained to the file before it and a note on the tested commit gives its path, digest and grade, per FR-021, FR-022 and FR-023.
4. **Given** a failed run or a stale proof, **When** the ledger is read, **Then** a nonconformance is open by itself, and it closes only through a closed CAPA, per FR-015, FR-032 and FR-035.
5. **Given** the evidence of a span, **When** the Trust page and the assessor pack are made, **Then** each figure of the page equals the same figure computed from the pack and the pack verifies offline, per FR-059, FR-062 and FR-064.

## Out of scope

- The ontology of the quality system (`ifqs:`), which is the library `ontology`'s (`@intellectual-frontiers/ontology/ifqs`).
- The record of one test and the registration of tests, which are the library `test`'s (`@intellectual-frontiers/test`).
- A harness's own console and the publication of commons' own Trust page, which are planned in commons 0021-ifqs and commons 0022-trust.

## Edge cases

- A repository with no `quality` branch: its commits are at `ifqs:E0`, per FR-021, FR-022 and FR-023.
- A record that names a person or holds a secret: refused before it is committed, per FR-025.
- A run killed before a test ended: the test is `cancelled`, per FR-001.

## Assumptions

- Git, and `ssh-keygen` where evidence is signed, are installed where the `quality` branch is kept; a test that needs either is skipped where it is not.
- A role is enough to say who approved a closure in this public repository; a harness that must name people adds them in its own records.

## Open questions

- None.

## Key entities

- **Run** - one trace of a suite with its record, reports and ledger entry.
- **Quality branch** - the append-only branch that keeps each record as one immutable file.
- **Ledger** - the chained events of nonconformances, CAPA, samples, plans and attestations.
- **Trust page** - the page made for one audience from the evidence.
- **Assessor pack** - the signed archive of the evidence with its verifier.

## Success criteria

- **SC-001**: Every claim of proof on the page of a harness can be followed to an evidence file whose chain verifies.
- **SC-002**: A failure appears as a nonconformance without a person having to notice it.
- **SC-003**: No figure of proof is shown without its grade and its review debt.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
