# Feature Specification: Intellectual Frontiers Quality System

**Spec ID:** 0021-ifqs
**Status:** Active
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** The Intellectual Frontiers Quality System (IFQS; colloquially "Quality System") is based on Operational Truth: what is true of a system is what the system reports when it runs, kept as evidence anyone can check, with the grade of that evidence shown and a failure opened as a nonconformance by the system itself. It is written in Mizan (`0003-mizan`), and its terms are in the `ifqs:` ontology (`commons/ontology/ifqs/`). It builds on the test record of `0008-test-evidence` and the signals of `0006-signals`, and does not restate them: this specification adds what a run must leave behind (a stored, chained, immutable file), what the evidence is worth (a grade and its debt), what happens when a proof fails or goes stale (a nonconformance and a CAPA), and how a harness states what it aims for (objectives). Evidence is rung 9 of the ladder (`0016-ladder`). The change records that a quality failure leads to are IFCCM's (`0020-ifccm`), and the public page and the assessor pack are `0022-trust`.

## Principles

- **FR-001**: A fact about a system MUST be established by the system running (a test, a check, a probe or a production signal) and MUST NOT rest on a person's statement alone; a statement by a person or an agent MAY be recorded and MUST be graded below what a run gives (FR-021).
- **FR-002**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-011), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-003**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-012), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-004**: WHERE a harness's source is public, its quality evidence, failures and open nonconformances included, MUST be published (0022-trust); where it is private, it MUST be publishable in the same form to an assessor on request.
- **FR-005**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-013), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-006**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-014), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-007**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-015), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

## What it is held to

- **FR-008**: The quality system MUST be held to the standards of the crosswalk below as mapping statements, each a standard, a clause cited by its identifier and never copied (0018-standards-first FR-007), one of the relations `closeMatch`, `broadMatch` or `narrowMatch` (SSSOM's words), and the requirements that serve it, and MUST NOT define a term for a clause; every requirement it names MUST exist.
- **FR-009**: WHERE a harness claims `ifccm:DeviceQuality`, its design controls, verification and validation records, design history and corrective and preventive action records MUST be kept as the Quality Management System Regulation, 21 CFR Part 820, which incorporates ISO 13485:2016 by reference, asks of the manufacturer, and the test record of FR-013 MUST be what is kept as the objective evidence of verification. Authority: mzid:authority-21-cfr-820.
- **FR-010**: The quality system MUST satisfy these NIST SP 800-53 Rev. 5 controls, cited by their OSCAL identifiers: ca-2 (control assessments: the runs), ca-5 (plan of action and milestones: the CAPA), ca-7 (continuous monitoring: probes and objectives), sa-11 (developer testing and evaluation: the test record) and si-2 (flaw remediation: the nonconformance). Controls: ca-2, ca-5, ca-7, sa-11, si-2.
- **FR-011**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-016), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-012**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-017), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

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

- **FR-013**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-018), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-014**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-019), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-015**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-020), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

## Git is the evidence

- **FR-016**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-021), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-017**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-022), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-018**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-023), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-019**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-024), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-020**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-025), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

## The evidence ladder

- **FR-021**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-026), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-022**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-027), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-023**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-028), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-024**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-029), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

## Freshness

- **FR-025**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-030), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

## Nonconformance and CAPA

- **FR-026**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-031), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-027**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-032), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-028**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-033), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-029**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-034), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-030**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-035), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-031**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-036), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

## Objectives

- **FR-032**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-037), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-033**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-038), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-034**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-039), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

## Rung 9

- **FR-035**: Stored evidence (the `quality` branch, its notes and what reads them) MUST be the Evidence rung (rung 9) of `0016-ladder`: it reads the rungs it proves, and no code of another rung MUST read evidence to decide what it does, so that evidence does not feed back into behaviour.

## Tiers

- **FR-036**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-040), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-037**: WHERE a harness claims `ifqs:Tier2`, a quality console MUST show, from the index, each requirement with its grade, freshness, last run, open nonconformances, CAPA and objectives, failures first, and each figure MUST link to the evidence file it comes from.
- **FR-038**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-041), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-039**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-042), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-040**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-043), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-041**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-044), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

## The grade of kept evidence

- **FR-042**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-045), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

## Where Tier 1 keeps what it records

- **FR-043**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-046), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-044**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-047), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

## Where Tier 2 keeps what it records

- **FR-045**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-048), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-046**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-049), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-047**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-050), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.
- **FR-048**: The quality system requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-051), where it is specified and proved (0032-libraries-by-concern FR-010), and MUST NOT be specified here.

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
- Evidence is archived by a tag and never deleted (owner decision of 2026-11-17, issue #10): the retention period is the harness's to state in its record, never shorter than the longest retention that applies to its evidence; `quality archive` only adds a tag.
- A repository has one `quality` branch, never one for a harness across its repositories (owner decision of 2026-11-17, issue #10); a harness that wants the whole reads each repository's branch.
- This specification is Active from 2026-11-17: the requirements it does not yet prove say so in the enforcement register.

## Open questions

None.

## Key entities

- **Test run** and **test case** - what ran, and each case of it, with its outcome.
- **Evidence** and **evidence file** - the record of a run as kept on the branch, with its grade.
- **Evidence grade** - `E0` to `E5`, how much a piece of evidence is worth.
- **Nonconformance** and **CAPA** - a failure the system opened and the corrective action that closes it.
- **Quality objective** - a metric with a target and an error budget.
- **Review debt** - the number of requirements held at `E1` or `E2`, counted apart for what rests on a person and what rests on an agent.
- **Tier** - how much of the system a harness claims.

## Success criteria

- **SC-001**: Every claim of proof on the page of a harness can be followed to an evidence file whose chain verifies.
- **SC-002**: A failure appears as a nonconformance without a person having to notice it.
- **SC-003**: No figure of proof is shown without its grade and its review debt.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
