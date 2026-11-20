# Feature Specification: Intellectual Frontiers Capabilities Configuration Management

**Spec ID:** 0020-ifccm
**Status:** Active
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** Intellectual Frontiers Capabilities Configuration Management (IFCCM; colloquially "Capabilities Configuration") is how a harness of Intellectual Frontiers controls change: the unit of change is a capability, every commit names the issue it serves, each requirement can be followed from its issue to the test run that proved it, and what a specification binds, a Decision authorizes, a check verifies and an issue only plans are kept apart. It is written in Mizan (`0003-mizan`), the specifications and ontology strategy, and its terms are in the `ifccm:` ontology (`commons/ontology/ifccm/`). The abbreviation "CCM" is never used alone: it is also the name of the Cloud Security Alliance's Cloud Controls Matrix. The quality records that a change leaves are IFQS's (`0021-ifqs`), and the check that holds this specification is `commons/ts/mizan/changes.ts`.

## Capabilities and their issues

- **FR-001**: The unit of change MUST be a capability (`ifccm:Capability`): one ability of a harness that can be named, specified, built, proved and released; a tracker, a commit message, a specification or a generated view MUST NOT call a unit of change a feature, an epic or a product (what Spec Kit calls a feature is a capability here).
- **FR-002**: A harness MUST plan each body of work (a capability, a book, a change) as one change request, and MUST NOT open a second change request, a sub-issue or one change request for each task for it unless a person asks; its tasks and subtasks MUST be checkbox items (`- [ ]`) in the body of that change request, and its notes and results MUST be comments on it.
- **FR-003**: A capability's change request MUST have the sections `Why`, `Today`, `Scope` and `Done when`, in that order, saying why it is wanted, what is true today, what it changes and what it leaves alone, and how it is decided to be done; `Done when` MUST name each requirement the capability adds or changes (`NNNN-slug FR-nnn`) and the check, test or review that decides it.
- **FR-004**: A minor task, a step too small to have a proof of its own, MUST be a checkbox item (`- [ ]`) in the body of its capability's change request and MUST NOT be an issue of its own; the capability MAY be closed only when every item is ticked and each of its `Done when` is met.

## Every commit names its issue

- **FR-005**: Every commit's message MUST name at least one change request on a line of its own, as `Refs #N` while the capability is in progress or as `Closes #N` on the commit that finishes it (`ifccm:IssueReferenceKind`: `ifccm:Refs`, `ifccm:Closes`); a change request of another repository is named `owner/repo#N`.
- **FR-006**: `Closes #N` MUST be on the commit that finishes N, where every checkbox item of N is ticked and each of its `Done when` checks passes, and MUST NOT be on any other commit.
- **FR-007**: WHEN a commit names no change request, the `changes` check MUST report it as `changes/no-issue` with its revision; a merge commit that only joins commits that each name one MUST be exempt.
- **FR-008**: IF a commit names a change request by a keyword the Git host reads as closing it other than `Closes` (such as `Fixes` or `Resolves`), THEN the check MUST report `changes/closing-keyword`, so that only the commit that finishes a capability closes it.
- **FR-009**: WHEN the check runs with `--strict`, it MUST ask the Git host (FR-028) for each change request a commit names and report `changes/unknown-issue` where it does not exist and `changes/closed-issue` where a `Refs` names one that is already closed; without `--strict` it MUST use no network, so that the network never fails the offline check (0018-standards-first FR-017).

## Phased enforcement

- **FR-010**: A harness MUST state in typed data its declaration (`ifccm:HarnessDeclaration`): the regulated domains it claims (`ifccm:RegulatedDomain`: `ifccm:FederalSecurity`, `ifccm:DeviceQuality`, `ifccm:ElectronicRecords`, `ifccm:DeviceSoftware`, `ifccm:TrustServices`) and, as `ifccm:productionDeclaredOn`, the day (`YYYY-MM-DD`) it declares production; a harness that claims a regulated domain MUST state that day, and a harness that states neither is read as not regulated and not in production.
- **FR-011**: WHILE a harness has not declared production (it states no day, or the day is after today), the findings of the `changes` check MUST be warnings (`ifccm:Warn`) held by a baseline that only shrinks (0018-standards-first FR-012); from the declared day on, every finding MUST fail whatever the baseline holds (`ifccm:Gate`).
- **FR-012**: IF a declaration's day is moved later after it has passed, or a regulated domain is dropped from it, THEN the check MUST report `changes/gate-relaxed`, which only a Decision (FR-018) clears.
- **FR-013**: WHERE a harness claims a regulated domain, its declaration MUST be the one source from which `0016-ladder` FR-011 decides which rungs it requires of that harness from the declared day.

## The trace chain

- **FR-014**: The chain from a change to its proof MUST run through these stages, in this order (`ifccm:TraceStage`): the change request (`ifccm:StageIssue`), the requirement (`ifccm:StageRequirement`, an `mz:Requirement`), the ontology term it is defined in (`ifccm:StageTerm`, an `mz:OntologyTerm` whose `mz:definedBy` names the requirement), the code (`ifccm:StageCode`, a `// Spec:` line, 0015-trace FR-005), the test (`ifccm:StageTest`, `proves`, 0015-trace FR-006) and the quality run (`ifccm:StageRun`, a run of `0021-ifqs`); a stage MUST be linked by the annotation it already has and MUST NOT need a new one.
- **FR-015**: WHEN the check is asked for the chain of a change request, it MUST name, for each requirement its `Done when` names, the first stage with no link (no term, no code, no test, or no passing run at the revision), so that the report ends where the chain breaks.
- **FR-016**: A capability MUST state the rungs it touches (`ifccm:touchesRung`, each an `mz:Rung`), and commons MUST generate from them the view of the capabilities that touch each rung, between the markers `<!-- capabilities:begin -->` and `<!-- capabilities:end -->` of a harness's document, whose `--check` MUST fail where the document differs; the view is an axis across the ladder and no rung of it.
- **FR-017**: WHILE a rung a capability touches has no passing run of that rung's checks (`mz:provedBy`) at the capability's last revision, the view MUST show the capability as open on that rung (0016-ladder FR-003).

## The authority boundary

- **FR-018**: Authority MUST be kept in four functions (`ifccm:AuthorityFunction`): a specification binds (`ifccm:Binds`), a Decision (`mz:Decision`) authorizes (`ifccm:Authorizes`) a departure, a waiver, an exception, a baseline or a release, a check verifies (`ifccm:Verifies`), and an issue only plans and traces (`ifccm:Plans`).
- **FR-019**: A comment, label, assignment or state of an issue MUST NOT waive, accept or authorize anything; a departure from a specification MUST be a Decision that names the role that approved it, and MAY name the issue as its record (`mz:record`).
- **FR-020**: WHERE a harness claims a regulated domain, a Decision that authorizes a change MUST be approved by a role other than the author of the change, and a check MUST NOT accept, waive or close its own finding: nothing authorizes itself.

## Change records

- **FR-021**: A change request (`ifccm:ChangeRequest`) MUST have a kind (`ifccm:ChangeRequestKind`), `ifccm:CapabilityRequest` (a request to add or change a capability) or `ifccm:Problem` (a report that something departs from what is specified or required, opened by a person or by the system from a nonconformance of `0021-ifqs`), a state (`ifccm:ChangeRequestState`: `ifccm:Open` or `ifccm:Closed`) and the kind of Git host that holds it (`ifccm:hostedOn`, one of `ifccm:GitManagerKind`: FR-027).
- **FR-022**: A change (`ifccm:Change`) MUST be the work done under one or more change requests, with the revisions it made and the change request it implements (`ifccm:implementsRequest`); a configuration item (`ifccm:ConfigurationItem`) MUST be anything a change may alter that is under control (a specification, an ontology file, a source file, a test, a generated file, a pin); and a baseline (`ifccm:Baseline`) MUST be the configuration items at one revision, established by a Decision.
- **FR-023**: The terms of FR-021 and FR-022 MUST rest on standards (0018-standards-first FR-003): a change request specializes OSLC Change Management's `ChangeRequest`, whose `Problem` kind corresponds to OSLC's `Defect` (a mapping stated here, not a term), a change is a `prov:Activity` that used its change request, a configuration item a `prov:Entity` and a baseline a `prov:Collection`, each with its `mz:OntologyTerm` record.

## Controls and the crosswalk

- **FR-024**: The capability MUST satisfy these NIST SP 800-53 Rev. 5 controls, cited by their OSCAL identifiers: cm-2 (baseline configuration: the baseline of FR-022), cm-3 (configuration change control: FR-005 to FR-009 and FR-018 to FR-020), cm-4 (impact analysis: the capability's rungs and chain, FR-014 to FR-017), cm-5 (access restrictions for change: the authority boundary, FR-018 to FR-020) and cm-9 (configuration management plan: this specification). Controls: cm-2, cm-3, cm-4, cm-5, cm-9.
- **FR-025**: The crosswalk of this specification to the standards below MUST be stated as mapping statements, each a standard, a clause cited by its identifier and never copied (0018-standards-first FR-007), one of the relations `closeMatch`, `broadMatch` or `narrowMatch` (SSSOM's words), and the requirements that serve the clause, and MUST NOT define a term for a clause; every requirement it names MUST exist.
- **FR-026**: WHERE a harness claims `ifccm:DeviceQuality`, its change records (FR-021 to FR-023) MUST be kept so that they serve as the control of design and development changes that the Quality Management System Regulation, 21 CFR Part 820, which incorporates ISO 13485:2016 by reference, asks of the manufacturer. Authority: mzid:authority-21-cfr-820.

### The crosswalk

| Standard | Clause | Relation | Requirements |
| --- | --- | --- | --- |
| ISO 13485:2016 | 7.3.9, control of design and development changes | closeMatch | FR-005, FR-019, FR-021, FR-022 |
| ISO 9001:2015 | 8.5.6, control of changes | closeMatch | FR-005, FR-019, FR-021 |
| IEC 62304:2006+A1:2015 | clause 8, software configuration management process | closeMatch | FR-014, FR-021, FR-022 |
| FDA QMSR (21 CFR Part 820) | design and development changes, through ISO 13485:2016 | narrowMatch | FR-026 |
| SOC 2 Trust Services Criteria | CC8.1, change management | closeMatch | FR-018, FR-019, FR-020 |
| NIST SP 800-53 Rev. 5 | cm-2, cm-3, cm-4, cm-5, cm-9 | closeMatch | FR-024 |

## Git hosts

- **FR-027**: Where a harness is hosted on a Git host, the host MUST be one of `ifccm:Github`, `ifccm:Gitlab` or `ifccm:Git` (`ifccm:GitManagerKind`, the one list of Git host kinds, which `ifccm:hostedOn` ranges over); a typed term of this specification MUST NOT carry a host's own word, and a GitHub issue and a GitLab issue are the same change request.
- **FR-028**: The check MUST reach a Git host through one typed interface that answers, for a reference, whether the change request exists, its state, its kind, and its body (for its sections and checkbox items); no other code of the check MUST name a host's API, URL or term.
- **FR-029**: A pull request (GitHub) and a merge request (GitLab) MUST each be read as the part of a change that carries its commits, never as a change request; the reference `#N` MUST mean the issue on both hosts.
- **FR-030**: WHERE a harness's host is `ifccm:Git` (plain Git), there is no tracker to ask: references MUST be checked by their form alone, and `--strict` MUST report the check as `not_run` with the reason that there is no host API, and MUST NOT report it as passed.

## Evidence of the check

- **FR-031**: Each run of the `changes` check MUST leave a result in the record shape of `0021-ifqs`, with each rule's result as a case and each `--strict` case that could not ask the host as `not_run` with its reason.
- **FR-032**: The findings of the `changes` check MUST be Mizan findings (`changes/no-issue`, `changes/closing-keyword`, `changes/unknown-issue`, `changes/closed-issue`, `changes/gate-relaxed`), held by a baseline as `0003-mizan` FR-015 holds the rest, and the check MUST be run by `holdHarness` for every harness.

- **FR-033**: A commit that departs from a specification MUST say so on a line of its own as `Departs: NNNN-slug FR-nnn` and name the Decision that authorizes it on a line of its own as `Decision: <id>`; a harness MUST state its Decisions (each with its identifier, the role that approved it, and the requirements it authorizes or `gate-relaxed <revision>`) and the role of each author by email in the typed file that holds its declaration, read as data and never run; and the `changes` check MUST report, besides the findings of FR-032, `changes/early-close` (FR-006), `changes/issue-shape` (FR-003), `changes/no-decision` (FR-019), `changes/self-approved` (FR-020) and `changes/declaration` (FR-010), the last of them as a gate whatever the day, since a declaration wrong by itself is refused.
- **FR-034**: WHERE a repository has no Git host account, it MAY keep its change requests as a typed file in Git, read as data and never run, so that `--strict` has change requests to ask; such a file is the plain-Git counterpart of the host adapter of FR-028 and answers the same four questions.
- **FR-035**: WHERE a harness has no Git host account, `changes.ts --capability-trace --range A..B` MUST give, with no network and no host, for each capability the commits of the range serve (a change request that a `Refs #N` or `Closes #N` line names, FR-005) the requirements that concern it and the chain of each (FR-014): the requirements a commit's message names, those whose lines in a `spec.md` a commit added or edited, those of the change request's `Done when` where its body is given, and those a `Spec:` line cites or a `proves` call or `Proves:` line proves in a file a commit changed; a commit that names no change request of this repository (one that names only another repository's) MUST be listed apart and be in no capability (amended 2026-11-18).
- **FR-036**: The offline trace MUST read only files the harness keeps and the repository's Git: the change requests as a JSON file (`--issues`, a list of objects with `number` and, where kept, `title` and `body`), the citations of the ontology's terms (`--terms`, a JSON file, or a module loaded by the `file:` URL of its path so that it loads on Windows, that exports `terms` as objects with `term`, `cites` and `file` or as the records of an audit of terms; `commons` for commons' own ontologies), the rungs with their homes (`--rungs`, `export const rungs`, each with `id`, `label`, `provedBy` and, for the trace, `homes`), the cases of a quality record (`--runs`, 0021-ifqs) and the specifications (`--specs`); `--trace` MUST read `--terms` as well, so that the chain of a `Done when` follows a harness's own terms (amended 2026-11-18).
- **FR-037**: The offline trace MUST give, for each requirement of each capability, the stages of its chain, the first stage with no link (FR-015) and the specification, the terms, the code and the tests placed on the rung whose home matches each most specifically (0015-trace FR-009, `-` where none does), as a table of text by default or as JSON with `--format json`, the same text for the same input (sorted, with no clock, with LF), and written to a file with `--output FILE` (amended 2026-11-18).
- **FR-038**: WHERE `--document FILE` is given with `--capability-trace`, the command MUST derive the capabilities of the view of FR-016 from the commits (the rungs their changed files are on, and the last commit of each) and write the view between the document's markers, or with `--check` fail where the document differs; and the offline trace MUST exit with 1 where a capability that a commit says `Closes` has a requirement whose chain ends before its quality run (a capability that is not closed is in progress), 2 for a usage error and 3 where an input cannot be read (amended 2026-11-18).

## The Git host interface

- **FR-039**: The change-control check MUST reach Git hosts only through the one `GitHostClient` interface of the library `githost` (`@intellectual-frontiers/githost`, githost 0001-githost FR-001), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-040**: The change-control check MUST take the common capabilities of every kind of Git host, and those of GitHub and GitLab, from of the library `githost` (`@intellectual-frontiers/githost`, githost 0001-githost FR-002), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-041**: The change-control check MUST answer a capability a Git host kind does not list with a typed unsupported result, as of the library `githost` (`@intellectual-frontiers/githost`, githost 0001-githost FR-003), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-042**: The change-control check MUST authenticate a Git host adapter without writing a credential anywhere, as of the library `githost` (`@intellectual-frontiers/githost`, githost 0001-githost FR-004), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-043**: The change-control check MUST choose the kind of host for a remote (a self-hosted GitLab named, never guessed), as of the library `githost` (`@intellectual-frontiers/githost`, githost 0001-githost FR-005), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-044**: The change-control check MUST tell the depth a kind of host allows (`maxDepth`), as of the library `githost` (`@intellectual-frontiers/githost`, githost 0001-githost FR-006), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## Acceptance scenarios

1. **Given** a commit whose message ends with `Refs #10`, **When** the check runs, **Then** it reports nothing for the commit, per FR-005 and FR-007.
2. **Given** a commit with no reference and a harness that has not declared production, **When** the check runs, **Then** it reports `changes/no-issue` as a warning held by the baseline, per FR-007 and FR-011.
3. **Given** the same commit on the day the harness declared production, **When** the check runs, **Then** it fails whatever the baseline holds, per FR-011.
4. **Given** a commit that says `Fixes #10`, **When** the check runs, **Then** it reports `changes/closing-keyword`, per FR-008.
5. **Given** `--strict` and a commit that names `#999`, which the host does not have, **When** the check runs, **Then** it reports `changes/unknown-issue`, per FR-009.
6. **Given** a harness on plain Git, **When** the check runs with `--strict`, **Then** the strict cases are `not_run` with the reason that there is no host API, per FR-030 and FR-031.
7. **Given** a declaration whose production day was moved from last month to next month, **When** the check runs, **Then** it reports `changes/gate-relaxed` until a Decision clears it, per FR-012 and FR-019.
8. **Given** a requirement named in a `Done when` that has a term and code but no test, **When** the chain is asked for, **Then** it ends at the test stage, per FR-014 and FR-015.
9. **Given** an issue labelled `approved` and no Decision, **When** a change departs from a specification, **Then** the departure is not authorized, per FR-019.
10. **Given** a repository on plain Git whose commits say `Refs #3` and name a requirement, with a terms file, **When** `changes.ts --capability-trace --range A..B --terms FILE` runs, **Then** the chain of the requirement is printed on its rungs and ends at the first stage with no link, with no host asked, per FR-035 to FR-037.
11. **Given** the same range and `--document ARCH.md`, **When** the command runs and then runs with `--check`, **Then** the view is written between the markers and the check finds no difference, per FR-038.

## Out of scope

- Which issue tracker a company uses and how its boards are arranged: the adapter reads change requests and does not manage them.
- The quality records themselves (test runs, evidence, nonconformance, CAPA): `0021-ifqs`.
- The workspace where changes are made (issue-named branches, worktrees, hooks): a later specification of the workspaces.

## Edge cases

- A commit that names two issues, `Refs #10` and `Refs #12`: it serves both, per FR-005.
- A commit that names only `Refs owner/other#7`, in the offline trace: listed with the commits that name no change request, and in no capability, per FR-035.
- A terms file that does not exist, or a module that exports no `terms`: exit 3 with the reason, and no table, per FR-036 and FR-038.
- A `--terms` module in a folder whose name has a space, on Windows: loaded by its `file:` URL, per FR-036.
- A capability that a commit closes and whose requirement has no passing run: the trace exits 1; an open capability with the same chain exits 0, per FR-038.
- A commit that names `Refs intellectual-frontiers/.github#10`: read as that repository's change request, and `--strict` asks that repository's host, per FR-005 and FR-009.
- A merge commit whose two parents each name an issue: exempt, per FR-007.
- A revert commit with no issue: reported, because a revert is a change, per FR-007.
- A body that says `Closes #10` in prose in the middle of a line: it is not a line of its own and is not read, per FR-005.
- A capability with three tiny steps: three checkbox items and no new issues, per FR-004.
- A second change request, a sub-issue or one change request for each task opened for a body of work that has one: no rule reads it, and a person's review judges it, per FR-002.
- A harness that states `ifccm:DeviceQuality` and no production day: refused, per FR-010.
- A harness with no declaration: warnings only, per FR-010 and FR-011.
- A production day of today: the gate applies today, per FR-011.
- A regulated domain removed from the declaration the day after the gate: `changes/gate-relaxed`, per FR-012.
- A comment "approved" on an issue: authorizes nothing, per FR-019.
- A change authored and approved by the same role in a regulated harness: refused, per FR-020.
- An agent that runs the check and then waives its finding: refused, per FR-020.
- A requirement with a term and code but no test: the chain ends at the test, per FR-015.
- A GitLab merge request that names `#12`: read as issue 12, not merge request 12, per FR-029.
- `--strict` on a host that cannot be reached: the strict cases are `not_run` with the reason, never passed, per FR-030 and FR-031.
- A crosswalk row that names a requirement this specification lacks: the test of FR-025 fails, per FR-025.

## Assumptions

- Spec Kit's "feature" is the capability here; a harness that reads Spec Kit keeps its folder names and says capability in its trackers.
- The NIST SP 800-53 controls are named by their OSCAL identifiers; commons imports the Configuration Management slice (cm-2, cm-3, cm-4, cm-5, cm-9) from the NIST OSCAL catalog (0019-mizan-integrations FR-015), so that the identifiers are a typed code list and a misspelt one does not compile.
- The relations between a change request and a change are PROV-O's (`prov:used`, `prov:wasGeneratedBy`); OSLC Change Management is adopted where its resource fits and is not the model of an issue tracker's workflow.
- `mz:Decision` is not widened: it stays the authorization of an ontology term (why a term is unaligned). A departure, waiver or exception is authorized by an entry of the harness record file (FR-033), as built; this is revisited when a second kind of Decision appears (owner decision of 2026-11-17, issue #10).
- The kind of a change request is read from a host's label (`capability` or `problem`), as built; an issue type or a section is not read (owner decision of 2026-11-17, issue #10).
- This specification is Active from 2026-11-17: the requirements it does not yet prove say so in the enforcement register.
- Git hosts' own words (issue, pull request, merge request) differ and are mapped once, in the adapter.

## Open questions

None.

## Key entities

- **Capability** - the unit of change, with its rungs and its requirements.
- **Change request** - an issue that plans a capability or reports a problem.
- **Change** - the commits, and the pull or merge request, that implement a change request.
- **Configuration item** and **Baseline** - what is under control, and the set of it at one revision.
- **Declaration** - a harness's regulated domains and the day it declares production.
- **Trace stage** - one link of the chain from an issue to a quality run.

## Success criteria

- **SC-001**: Every commit of a harness that has declared production names an issue, and the check fails the day one does not.
- **SC-002**: A reviewer can follow any requirement from its issue to the run that proved it, and see where the chain breaks.
- **SC-003**: No departure from a specification is authorized by anything but a Decision.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
