# Feature Specification: Intellectual Frontiers Quality System

**Spec ID:** 0021-ifqs
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** The Intellectual Frontiers Quality System (IFQS; colloquially "Quality System") is based on Operational Truth: what is true of a system is what the system reports when it runs, kept as evidence anyone can check, with the grade of that evidence shown and a failure opened as a nonconformance by the system itself. It is written in Mizan (`0003-mizan`), and its terms are in the `ifqs:` ontology (`commons/ontology/ifqs/`). It builds on the test record of `0008-test-evidence` and the signals of `0006-signals`, and does not restate them: this specification adds what a run must leave behind (a stored, chained, immutable file), what the evidence is worth (a grade and its debt), what happens when a proof fails or goes stale (a nonconformance and a CAPA), and how a harness states what it aims for (objectives). Evidence is rung 9 of the ladder (`0016-ladder`). The change records that a quality failure leads to are IFCCM's (`0020-ifccm`), and the public page and the assessor pack are `0022-trust`.

## Principles

- **FR-001**: A fact about a system MUST be established by the system running (a test, a check, a probe or a production signal) and MUST NOT rest on a person's statement alone; a statement by a person or an agent MAY be recorded and MUST be graded below what a run gives (FR-021).
- **FR-002**: Everything the quality system reports MUST be reported in OpenTelemetry (0006-signals): runs, results, probes and measures are spans, log records and metrics through one pipeline, and no second channel MAY carry a result that the pipeline does not.
- **FR-003**: Nothing authorizes itself: what produces a result MUST NOT be what accepts it, a check MUST NOT waive or close its own failure, and an agent that opened a nonconformance MUST NOT approve the closure of its CAPA (0020-ifccm FR-018 to FR-020).
- **FR-004**: WHERE a harness's source is public, its quality evidence, failures and open nonconformances included, MUST be published (0022-trust); where it is private, it MUST be publishable in the same form to an assessor on request.
- **FR-005**: A planned case, check or requirement that did not run MUST be recorded as `ifqs:NotRun` (written `not_run`) with the reason, and MUST NOT be counted as passed, silently skipped or left out; the count of `not_run` MUST be shown wherever the counts of passed and failed are.
- **FR-006**: Every piece of evidence MUST carry its grade (`ifqs:EvidenceGrade`), and every rendering that shows evidence, or a count of requirements proved, MUST show the grade with it; a count of proved requirements with no grade MUST NOT be shown.
- **FR-007**: WHEN a result that a requirement relies on fails, or a proof of it is stale (FR-025), the system MUST open a nonconformance (`ifqs:Nonconformance`) itself, with the requirement, the evidence it arises from and the reason, and MUST NOT wait for a person to notice.

## What it is held to

- **FR-008**: The quality system MUST be held to the standards of the crosswalk below as mapping statements, each a standard, a clause cited by its identifier and never copied (0018-standards-first FR-007), one of the relations `closeMatch`, `broadMatch` or `narrowMatch` (SSSOM's words), and the requirements that serve it, and MUST NOT define a term for a clause; every requirement it names MUST exist.
- **FR-009**: WHERE a harness claims `ifccm:DeviceQuality`, its design controls, verification and validation records, design history and corrective and preventive action records MUST be kept as the Quality Management System Regulation, 21 CFR Part 820, which incorporates ISO 13485:2016 by reference, asks of the manufacturer, and the test record of FR-013 MUST be what is kept as the objective evidence of verification. Authority: mzid:authority-21-cfr-820.
- **FR-010**: The quality system MUST satisfy these NIST SP 800-53 Rev. 5 controls, cited by their OSCAL identifiers: ca-2 (control assessments: the runs), ca-5 (plan of action and milestones: the CAPA), ca-7 (continuous monitoring: probes and objectives), sa-11 (developer testing and evaluation: the test record) and si-2 (flaw remediation: the nonconformance). Controls: ca-2, ca-5, ca-7, sa-11, si-2.
- **FR-011**: WHERE a requirement's tests are of `high` risk (0008-test-evidence FR-001), the requirement MUST NOT be counted proved below grade `ifqs:E4`, and otherwise MUST NOT be counted proved below `ifqs:E3`, so that the assurance asked for follows the risk, as the FDA's guidance on Computer Software Assurance asks.
- **FR-012**: A test MAY name the quality characteristic it proves, in the words of ISO/IEC 25010, as the record attribute `ifc.test.characteristic`, and a report of a run MUST bear the document names of ISO/IEC/IEEE 29119-3 (the test completion report of 0008-test-evidence FR-009, the test status report of a run in progress and the test incident report of each failure, cancellation and `not_run`).

### The crosswalk

| Standard | Clause | Relation | Requirements |
| --- | --- | --- | --- |
| ISO 9001:2015 | 7.5, documented information | closeMatch | FR-013, FR-016, FR-017, FR-020 |
| ISO 9001:2015 | 8.5, production and service provision | broadMatch | FR-001, FR-005, FR-025 |
| ISO 9001:2015 | 9.1, monitoring, measurement, analysis and evaluation | closeMatch | FR-032, FR-033, FR-034 |
| ISO 9001:2015 | 10.2, nonconformity and corrective action | closeMatch | FR-007, FR-026, FR-028, FR-030 |
| ISO 13485:2016 | 7.3.6, design and development verification | closeMatch | FR-011, FR-013, FR-021 |
| ISO 13485:2016 | 7.3.10, design and development files | closeMatch | FR-016, FR-017, FR-018 |
| ISO 13485:2016 | 8.5.2, corrective action | closeMatch | FR-026, FR-028, FR-029, FR-030 |
| FDA QMSR (21 CFR Part 820) | design controls, design history and CAPA, through ISO 13485:2016 | narrowMatch | FR-009 |
| IEC 62304:2006+A1:2015 | clause 5, software development process (traceability and verification) | closeMatch | FR-013, FR-021 |
| IEC 62304:2006+A1:2015 | clause 9, software problem resolution process | closeMatch | FR-007, FR-026, FR-028, FR-030 |
| FDA guidance | Computer Software Assurance | closeMatch | FR-001, FR-011 |
| ISO/IEC 25010 | quality characteristics of a product | closeMatch | FR-012 |
| ISO/IEC/IEEE 29119-3 | test documentation | closeMatch | FR-012 |
| ISO/IEC 27001:2022 and SOC 2 | through the compliance controls of 0007-grc | broadMatch | FR-010, FR-016 |
| NIST SP 800-53 Rev. 5 | CA, CM and SA families | closeMatch | FR-010 |

## The canonical record (it extends 0008-test-evidence)

- **FR-013**: The canonical result of a run MUST be the record of 0008-test-evidence FR-002 to FR-005 (OTLP/JSON, the OpenTelemetry test conventions), one file per run and one log record per case, and the body of a case's log record MUST be a CTRF test object (`name`, `status` and `duration`, and the other CTRF fields the case has); JUnit XML, TAP, CTRF documents, SARIF and OSCAL (0008-test-evidence FR-008) MUST be rendered from it on demand and MUST NOT be kept as evidence.
- **FR-014**: The record's outcome (`ifc.test.outcome`) MUST also take the value `not_run`, with its reason (`ifc.test.reason`), in addition to those of 0008-test-evidence FR-001; a requirement whose only proofs are `not_run` is unproven (0008-test-evidence FR-006), and a CTRF rendering MUST give it the status `other`.
- **FR-015**: A check of Mizan (the specification rules, the trace and layers checks, the changes check of 0020-ifccm) MUST leave its result in the same record, each rule a case and each finding a failed case with its rule id, file and line, so that its findings render as SARIF results.

## Git is the evidence

- **FR-016**: A run's record MUST be kept as one immutable file at `quality/evidence/YYYY/MM/DD/<trace id>.otlp.json` on an orphan branch named `quality`, committed by signed commits that only append; a harness MUST refuse a force-push or a rewrite of the branch, a file MUST never be changed after its commit, and a correction MUST be a new run.
- **FR-017**: The resource of each file MUST carry `ifc.quality.previous.sha256`, the SHA-256 of the file before it on the branch (64 zeros for the first), so that a file removed, inserted or changed is found by the chain, and verification MUST name the first file that does not match (as 0007-grc FR-007 does for a ledger).
- **FR-018**: WHEN a run is kept, a Git note under `refs/notes/quality` on the tested commit MUST give the evidence file's path, its SHA-256 and its grade, so that a commit shows its evidence without being changed; a commit with no note MUST be shown as having no evidence (`ifqs:E0`).
- **FR-019**: The index of runs, for search, trends and the public page, MUST be derived from the `quality` branch, MUST be rebuildable from it alone, and MUST NOT be a source of evidence; a harness MAY keep it in a database.
- **FR-020**: A file MUST be redacted before it is committed (0006-signals FR-006) and MUST name no person (0008-test-evidence FR-003), because a committed file cannot be changed.

## The evidence ladder

- **FR-021**: Evidence MUST be graded, from `ifqs:E0` to `ifqs:E5`: `ifqs:E0` none (a requirement with no evidence), `ifqs:E1` stated (a person or an agent says it is met), `ifqs:E2` reviewed (a review is recorded against the requirement), `ifqs:E3` tested (an automated run proved it and the record exists), `ifqs:E4` attested (the run is kept on the `quality` branch, chained, signed and linked to its commit, FR-016 to FR-018) and `ifqs:E5` observed (a probe of the system in operation reports it); a requirement's grade MUST be the highest grade of its fresh evidence.
- **FR-022**: The proof register of a specification kit (the enforcement register, 0003-mizan FR-005) MUST be shown with the grade and the day of the evidence of each row, generated from the evidence and never written by hand.
- **FR-023**: A harness MUST report its review debt (`ifqs:ReviewDebt`) as a number: the count of requirements whose best fresh evidence is `ifqs:E1` or `ifqs:E2`, counted at a stated revision; it MUST be shown beside every count of proved requirements, and it MUST NOT grow from one revision of the default branch to the next without a Decision.
- **FR-024**: WHERE a review (`ifqs:E2`) is made by an agent, the record MUST say that it was an agent's, and it MUST be graded no higher than `ifqs:E2`.

## Freshness

- **FR-025**: A proof MUST be `ifqs:Fresh`, `ifqs:Due` or `ifqs:Stale` (`ifqs:FreshnessState`): by time, as 0007-grc FR-011 judges evidence against a cadence, and by change, being stale where a file in the requirement's trace chain (its text, term, code or test, 0020-ifccm FR-014) changed after the revision of the run; a stale proof MUST open a nonconformance (FR-007) and MUST NOT count at its grade.

## Nonconformance and CAPA

- **FR-026**: A nonconformance MUST carry its requirement, the evidence it arises from, its reason, who opened it (the system or a role) and its state (`ifqs:NonconformanceOpen` or `ifqs:NonconformanceClosed`), and MUST be linked to a Problem change request (0020-ifccm FR-021).
- **FR-027**: A nonconformance MUST be closed only through a CAPA that is closed (FR-030), never by editing its state.
- **FR-028**: A corrective and preventive action (`ifqs:Capa`) MUST state the corrective action, MUST name the test that verifies it (a test that exists and proves the requirement) and MUST be in one state of `ifqs:CapaOpen`, `ifqs:CapaVerified` and `ifqs:CapaClosed`, in that order.
- **FR-029**: WHEN the test a CAPA names passes in a run at a revision that holds the last commit of the corrective change (the revision after it, or that commit itself, whose code is the corrected code), the CAPA MUST become `ifqs:CapaVerified`, and its verification MUST NOT be recorded in any other way.
- **FR-030**: A CAPA MUST become `ifqs:CapaClosed` only from `ifqs:CapaVerified` and only by the approval of a named person, recorded as a Decision with the person and the day; an automated run closes the verification step and a person closes the CAPA, and where 0020-ifccm FR-020 applies the person MUST NOT be the author of the corrective change.
- **FR-031**: A nonconformance and its CAPA MUST appear in the index and on the public page (0022-trust) from the moment they are opened, and a nonconformance that closed MUST stay in the record with its CAPA.

## Objectives

- **FR-032**: A success criterion MUST be a quality objective (`ifqs:QualityObjective`): a metric named as OpenTelemetry names a metric (0006-signals FR-013), a target, a unit, an error budget and the window it is spent in; its measure MUST be computed from the evidence and MUST NOT be typed in.
- **FR-033**: WHEN an objective's error budget is spent within its window, the system MUST open a nonconformance (FR-007); WHILE budget remains, the remaining budget MUST be shown with the objective.
- **FR-034**: A harness SHOULD declare objectives for the share of its requirements at `ifqs:E3` or above, its review debt, its count of `not_run` cases, the age of its oldest open nonconformance and the number of its stale proofs.

## Rung 9

- **FR-035**: Stored evidence (the `quality` branch, its notes and what reads them) MUST be the Evidence rung (rung 9) of `0016-ladder`: it reads the rungs it proves, and no code of another rung MUST read evidence to decide what it does, so that evidence does not feed back into behaviour.

## Tiers

- **FR-036**: A harness MUST state the tier it claims (`ifqs:QualityTier`), `ifqs:Tier0` (evidence exists: FR-013 to FR-020), `ifqs:Tier1` (the system reports itself: FR-021 to FR-034) or `ifqs:Tier2` (people see and prove: FR-037 to FR-041), and MUST claim a tier only where every requirement of it and of the tiers below it is met.
- **FR-037**: WHERE a harness claims `ifqs:Tier2`, a quality console MUST show, from the index, each requirement with its grade, freshness, last run, open nonconformances, CAPA and objectives, failures first, and each figure MUST link to the evidence file it comes from.
- **FR-038**: WHERE a harness claims `ifqs:Tier2`, a person's attestation MUST be a recorded sample: what was sampled, the rule and seed that chose it, the result of each, the role and the day, signed.
- **FR-039**: WHERE a harness claims `ifqs:Tier2`, a test plan MAY be pre-registered, committed and signed before the run it governs, naming its cases and acceptance criteria; the run MUST then report each case not in the plan, and each planned case not run as `ifqs:NotRun`.
- **FR-040**: WHERE a harness claims `ifqs:Tier2`, a run MAY mutate the code that a test proves and record whether the test failed, and the strength of a proof that results MUST be shown beside its grade.
- **FR-041**: WHERE a harness claims `ifqs:Tier2`, an agent MAY perform a review mechanism, graded as FR-024 says, and a person MUST sample the agents' reviews (FR-038) at a rate the harness states.

## The grade of kept evidence

- **FR-042**: A file MUST claim no more than `ifqs:E3` for itself (`ifc.quality.grade`), because what makes it `ifqs:E4` is what happens to it after it is written; the grade of kept evidence MUST be the one its note gives, which MUST be `ifqs:E4` only where the commit that keeps the file is signed, the chain verifies and the note matches the file's SHA-256, `ifqs:E3` where the file is kept and any of these is not so but nothing is broken, and `ifqs:E0` where the chain does not verify or the note does not match its file; a note MUST be the lines `path`, `sha256` and `grade`, one such paragraph for each run kept for the commit, the last being the newest.

## Where Tier 1 keeps what it records

- **FR-043**: The records of Tier 1 (a nonconformance opened, linked and closed, a CAPA opened, verified and closed, and a statement, a review or a probe's typed result kept as evidence) MUST each be one new file `quality/records/NNNNNN-<kind>.json` on the `quality` branch, in a commit that only appends, redacted as FR-020 asks and chained to the file before it by its digest (64 zeros for the first) as FR-017 chains the evidence files, so that a file changed, removed or inserted is found by the branch's verifier; a state MUST be the fold of its events and MUST NOT be a field that is edited, so that no event closes a nonconformance but the one that follows a closed CAPA.
- **FR-044**: A proof MUST be held to a cadence by its kind of evidence (FR-025), by default 30 days for a run, 7 days for a probe, 90 days for a statement and a year for a review, and a harness MAY state its own.

## Acceptance scenarios

1. **Given** a requirement whose only test did not run for lack of network, **When** the run is recorded, **Then** its case is `not_run` with that reason and the requirement is unproven, per FR-005 and FR-014.
2. **Given** a requirement proved by a passing run kept on the `quality` branch, **When** its commit's note is read, **Then** it names the file, its SHA-256 and the grade `E4`, per FR-018 and FR-021.
3. **Given** a file of the `quality` branch changed by one byte, **When** the chain is verified, **Then** the first file that does not match is named, per FR-017.
4. **Given** a requirement whose code changed after its last run, **When** freshness is judged, **Then** the proof is stale and a nonconformance is opened by the system, per FR-007 and FR-025.
5. **Given** a CAPA whose named test passed after the corrective change, **When** the run is recorded, **Then** the CAPA is verified and not closed, per FR-029 and FR-030.
6. **Given** a verified CAPA and the approval of a named person other than the author, **When** the Decision is recorded, **Then** the CAPA is closed and its nonconformance with it, per FR-027 and FR-030.
7. **Given** a count of requirements proved, **When** it is rendered with no grade, **Then** the rendering is refused, per FR-006.
8. **Given** a revision whose review debt is higher than its parent's and no Decision, **When** the debt is judged, **Then** it fails, per FR-023.
9. **Given** a run of the changes check on plain Git, **When** its strict cases cannot ask a host, **Then** they are recorded `not_run` with that reason and not passed, per FR-005 and FR-015.

## Out of scope

- The public page and the assessor pack: `0022-trust`.
- How a test is captured, run and rendered: `0008-test-evidence`; the signals it travels as: `0006-signals`.
- Validation of the tools themselves beyond recording their versions (0008-test-evidence).
- Harness-private stores of evidence (a database, a console, production probes): a harness keeps them, and reads and writes the record this specification states.

## Edge cases

- A planned case that a runner skipped on purpose with a reason: `skip`, not `not_run`; `not_run` is for what never started, per FR-005 and FR-014.
- A test killed in the middle of a run: `cancelled` by 0008, and the requirement unproven, per FR-014.
- A requirement with a note that names a file whose SHA-256 differs from the file: the evidence is broken and the grade falls to `E0` until a new run, per FR-018.
- A commit with no note: no evidence, `E0`, per FR-018.
- A branch force-pushed to drop a failing run: refused, and the chain would not verify, per FR-016 and FR-017.
- A correction to a record: a new run that supersedes it, and the first stays, per FR-016.
- A file that holds an e-mail address: redacted before the commit, per FR-020.
- A requirement of high risk with only an `E3` run: not counted proved, per FR-011.
- A review made by an agent: `E2` at most, and said to be an agent's, per FR-024.
- An `E2` review that is a person's sample of agents' reviews: recorded as a sample, per FR-038.
- A proof fresh by time and changed since: stale, per FR-025.
- A CAPA named for a test that does not exist: refused, per FR-028.
- A CAPA whose named test failed again: stays open, and the nonconformance stays open, per FR-029.
- An automated run that tries to close a CAPA: refused, per FR-030.
- An objective with its budget spent: a nonconformance opened by the system, per FR-033.
- Evidence read by the code it proves, to decide its behaviour: found by the layers check, per FR-035.
- A harness that claims `Tier1` with a requirement of `Tier0` not met: the claim is refused, per FR-036.
- A crosswalk row naming a requirement this specification lacks: the test of FR-008 fails, per FR-008.

## Assumptions

- OpenTelemetry's test attributes are in development (0008-test-evidence), CTRF's schema may change, and both are renderings or record bodies that change in one function.
- `ifc.test.characteristic`, `ifc.quality.previous.sha256` and the notes of FR-018 are names of this specification, not of OpenTelemetry; no OpenTelemetry convention names them today.
- A signed commit is signed with a key the harness trusts (a harness lists them); how the key is held is the harness's.
- Where evidence is graded `E5`, the probe is the harness's own and its record is made as FR-013 says.
- Mutation testing (FR-040) is not yet an ISO or IEEE standard's requirement of a test record; its results are a record attribute until one names them.
- Standards are cited by identifier and clause only; their text is not copied (0018-standards-first FR-007).

## Open questions

- **OQ-1**: Whether the grade needed for "proved" (`E3`, or `E4` for high risk, FR-011) is higher for a regulated harness once it declares production.
- **OQ-2**: Whether the `quality` branch is one per repository, or one per harness across its repositories.
- **OQ-3**: How long a harness keeps evidence on the branch before it is archived, given that a branch is append-only (0016-ladder lifecycle).
- **OQ-4**: Whether review debt of agents' reviews (FR-024) is counted apart from a person's.

## Key entities

- **Test run** and **test case** - what ran, and each case of it, with its outcome.
- **Evidence** and **evidence file** - the record of a run as kept on the branch, with its grade.
- **Evidence grade** - `E0` to `E5`, how much a piece of evidence is worth.
- **Nonconformance** and **CAPA** - a failure the system opened and the corrective action that closes it.
- **Quality objective** - a metric with a target and an error budget.
- **Review debt** - the number of requirements held at `E1` or `E2`.
- **Tier** - how much of the system a harness claims.

## Success criteria

- **SC-001**: Every claim of proof on the page of a harness can be followed to an evidence file whose chain verifies.
- **SC-002**: A failure appears as a nonconformance without a person having to notice it.
- **SC-003**: No figure of proof is shown without its grade and its review debt.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
