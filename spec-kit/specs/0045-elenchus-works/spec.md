# Feature Specification: Elenchus works

**Spec ID:** 0045-elenchus-works
**Status:** Draft

**Input:** The monthly work in which the company tries to refute its own
claim to be compliant. Every control in every compliance boundary's baseline
(0028-compliance-controls) is put to a control test, and what fails is
reported as an exception, a finding and a plan of action. The tests are written
before the remedies exist, so a control nobody has yet made operate shows red
until someone does. The month's
outcomes are kept as a work package (0015-work-packages), and the same
outcomes are rendered as reports, a yearly bound volume and a dashboard.
Elenchus is the pattern, a methodology held as a Noema: a claim is tried by trying to refute it. Operational
Truth® is the company's productized implementation of that pattern, which
compares intent that is code with evidence collected from the operation itself,
and which a family of the company's products carries out. This spec states the
pattern as a work kind: how such a work is named, what it tests with, what its
outcomes are, how it is closed, and what it may be rendered into. Which
controls, boundaries and probes exist, which products carry the
implementation out, and what any month found, are ontology facts and the
work's own records, not stated here.

## The kind and its name

- **FR-001**: A work that tests, once a calendar month, whether each control
  in every compliance boundary's baseline operates, and reports each one that
  does not, MUST be a work of kind `elenchus` (`ifcore:ElenchusKind`). Its
  rules are additive: they MUST NOT modify or impose requirements on any
  other work kind. An Elenchus is not a Press work, and 0016-press-production
  does not govern it.
- **FR-002**: A record, a command or a report of this kind MUST use these
  eight terms for these meanings, and no other term for them:
  - **Elenchus**: the pattern, and one month's trial of every control in
    scope, and the work that holds it;
  - **Control test**: one test of whether one control operates in one
    boundary, together with the probe that carries it out (FR-003);
  - **Test plan**: every control test the company has written and not
    retired (FR-010);
  - **Verdict**: the outcome each control in each boundary reached in one
    Elenchus (FR-016);
  - **Finding**: the written account of one exception or one not-tested
    outcome (FR-024);
  - **Kalendarium**: the twelve Elenchi of one year bound as a single volume
    (FR-030);
  - **Truth gap**: a control whose expected operation the observed evidence
    does not show, which is an exception or a not-tested outcome (FR-016);
  - **Unmanaged risk**: a system observed in operation that no boundary
    expects (FR-038).

The name is the point of the kind. *Elenchus* (Greek ἔλεγχος) is
cross-examination whose purpose is refutation: a claim is tested by trying to
make it fail, and it stands only if it survives. That is the discipline here.
The claim is "this control operates", and a control test tries to refute it
with evidence. A claim the evidence does not support is an exception, and a
control no test tries is not tested, so the burden is the company's, not the
assessor's. *Control test*, *test plan*, *exception*, *finding* and *plan of
action* are the words auditors, SOC 2 and NIST already use, so a record an
assessor reads needs no translation. The house words are the pattern, the
verdict and the yearly volume. *Kalendarium* is the Roman account book, kept
because debts and interest fell due on the Kalends, the first of each month: a
ledger of what is owed, turned at every month's start. The year's twelve
monthly accounts are bound as one.

*Elenchus* is the broad idea and *Operational Truth®* is one specific way of
carrying it out. Elenchus is a methodology, so a Noema; a deployed workflow
that carries it out is an Ergon related to it by `operationalizes`
(0048-noemas FR-007). Operational Truth® is that Ergon: a solution
(0049-platforms FR-004) built on the Opsfolio platform that operationalizes
the Elenchus methodology. The expected side of
the comparison is the test plan, intent held as code. The observed side is
evidence gathered from the operation by machine, and the difference between
them is the truth gap. A system that is observed but expected by no one is
the other kind of difference, unmanaged risk. The products that gather the
evidence, hold the inventory and run the tests are ontology facts.

- **FR-040**: The mark is written *Operational Truth®* where it names the
  company's implementation of this pattern, and *operational truth*, in
  lowercase and without the mark, where it names the general idea. A record
  that names the implementation MUST NOT write the mark in lowercase, and a
  record about the general idea MUST NOT write it with the mark.

## Control tests

- **FR-003**: A control test MUST be an ontology fact (`ifcore:ControlTest`)
  in the repository that holds the boundary it applies to, and MUST declare
  its audience (0001-eidolon-architecture FR-012). It MUST state:
  - the control it concerns, as `<catalog notation>:<control notation>`
    (0028-compliance-controls FR-001);
  - the boundary or boundaries it applies to, by `schema:about`;
  - its probe kind and its probe (FR-006);
  - its cadence, the longest period a passing result stays good;
  - its severity;
  - the role that owns the control;
  - its fixture (FR-008).
- **FR-004**: A control test MUST concern exactly one control. One control
  test MAY apply to every boundary whose baseline selects that control, and is
  then run separately in each, so a rule is stated once and the control is
  tested once for each boundary.
- **FR-005**: A control test MUST NOT carry text that a control's publisher
  holds copyright in (0028-compliance-controls FR-002), and MUST NOT carry or
  describe information that 0028-compliance-controls FR-019 covers.
- **FR-006**: A probe MUST be one of four kinds:
  - `check`: a command of a repository's orchestrator that verifies and
    changes nothing tracked (0041-command-line FR-014), showing the control
    operated when it succeeds;
  - `ledger`: a query of the evidence ledger
    (0028-compliance-controls FR-014) for an entry of a named run whose
    outcome was a pass, made within the control test's cadence;
  - `review`: a review done by a named role and recorded in the ledger
    (0028-compliance-controls FR-018) within the control test's cadence;
  - `reference`: an `ExternalRecordReference` whose `dcterms:valid` date has
    not passed.
- **FR-007**: A probe MUST only read. It MUST NOT change the thing it probes.
  A probe against a system that holds information
  0028-compliance-controls FR-019 covers MUST return only its outcome and a
  digest of its output, and that output MUST stay in the system that holds it.
- **FR-008**: A control test MUST name a fixture, a stated condition in which
  its probe returns an exception (FR-009), and the repository's check MUST run
  the probe against it. A probe that cannot return an exception is not
  evidence of anything, and what states it is not a control test.
- **FR-009**: A control test MUST end in an exception unless its probe, run in
  the period, showed that the control operated. A probe that did not run, that
  errored, or whose evidence is older than the control test's cadence MUST end
  in an exception. The absence of evidence MUST NOT show that a control
  operated.

## The test plan

- **FR-010**: The test plan MUST be kept as ontology data under version
  control, each control test with its history. A control test that has been
  retired MUST remain as a retired record naming the `Decision` that retired it
  (FR-013). Each Elenchus MUST pin the commit of the test plan it was run
  against, and the Verdict MUST say which.
- **FR-011**: Every control in a boundary's baseline MUST have at least one
  control test for that boundary, unless a disposition covers it
  (0028-compliance-controls FR-012). A control with neither MUST be reported,
  in every Elenchus, as not tested, and counted with the exceptions.
- **FR-012**: Writing a control test MUST NOT require a `Decision`, and
  anyone, including an AI, MAY propose one. A control test added after an
  Elenchus opens takes effect in the next Elenchus to open.
- **FR-013**: A change that makes a control test easier to pass MUST be
  recorded as a `Decision` that names the control test by `schema:about`,
  before the change is made. The changes are retiring the control test,
  lengthening its cadence, lowering its severity, narrowing the boundaries it
  applies to, and replacing its probe or fixture with a weaker one. Making a
  control test harder to pass needs no `Decision`.

## The trial and the Verdict

- **FR-014**: Each run of a probe MUST be recorded in the evidence ledger
  (0028-compliance-controls FR-014 through FR-016), naming the control test
  and the test plan commit it ran under.
- **FR-015**: A Verdict MUST be computed from the test plan, the ledger, the
  dispositions and the control maps, and never from a copy of any of them.
  A run MUST be deterministic and MUST NOT call an AI.
- **FR-016**: For each control in each boundary's baseline, an Elenchus MUST
  state exactly one outcome:
  - `no exception`: every control test for the control in the boundary showed
    the control operated;
  - `exception`: at least one such control test ended in an exception;
  - `not tested`: no control test applies to the control in the boundary
    (FR-011);
  - `excused`: a disposition for the control in the boundary was in force on
    the date the Elenchus closed (0028-compliance-controls FR-012). A
    lapsed disposition does not excuse, and a control with a disposition in
    force is excused whatever its control tests ended in. The outcomes of the
    control's own control tests MUST still be reported beside it.

  A framework whose catalog forbids a plan of action
  (0028-compliance-controls FR-013) MUST NOT have a control it selects
  excused except as not applicable.
- **FR-017**: A control whose outcome in the previous Elenchus was
  `no exception`, and whose outcome in this one is `exception` or `not tested`,
  MUST be reported as a regression, ahead of any control that has never had a
  `no exception` outcome.
- **FR-018**: At close, every exception and every not-tested outcome MUST have
  a remedy, or MUST be named as unremedied in the closing `Decision`
  (FR-027). A remedy is a planned-remediation disposition, which is a plan of
  action and milestones item (0028-compliance-controls FR-012) or, where
  0028-compliance-controls FR-013 forbids one, a `Decision` that commits to a
  fix by a stated date.
- **FR-019**: The Elenchus MUST rank the exceptions and the not-tested
  outcomes by how many controls their fix would reach. For each, the count is
  the number of controls in any boundary's baseline that have an exception or
  are not tested and that are addressed by a requirement that also addresses
  it (0028-compliance-controls FR-005). A fix that clears controls in several
  frameworks therefore ranks above one that clears a single control.
- **FR-020**: The Elenchus MUST report each boundary's compliance debt: for
  each exception and each not-tested outcome, its severity multiplied by the
  number of consecutive Elenchi in which it has been without a `no exception`
  outcome, and the total. It MUST report the trend of the total over the last
  twelve closed Elenchi.
- **FR-021**: An Elenchus MUST NOT omit a gap or an untested control that the
  compliance status report (0028-compliance-controls FR-025) lists for the
  date it closed, and MUST NOT state one that report does not.
- **FR-022**: An Elenchus MAY name a focus, a control catalog or a family of
  controls in one. A control in the focus MUST have every `review` probe of its
  control tests done afresh in that period, whatever its cadence.
- **FR-038**: Where the evidence ledger holds an inventory of the systems
  observed in operation during the period, an Elenchus MUST report each
  observed system that is part of no boundary
  (0028-compliance-controls FR-009) as unmanaged risk, and each system a
  boundary includes that no inventory observed as unobserved. An Elenchus
  whose period holds no inventory MUST say so, rather than report none.
- **FR-039**: A Verdict MUST state, for each catalog, how many `no exception`
  outcomes rest on `check`, `ledger` or `reference` probes, which are
  evidence collected from the operation, and how many rest only on `review`
  probes, which are a person's attestation.

## The package, its source and its life

- **FR-023**: There MUST be one Elenchus for each calendar month, at
  `works/elenchus/<YYYY-MM>/`, its slug the month (0015-work-packages
  FR-004). It covers every boundary that exists on the day it opens. A
  boundary created or retired during the month enters or leaves the next
  Elenchus.
- **FR-024**: The live source of an Elenchus is `findings.adoc`, in AsciiDoc
  (0015-work-packages FR-009), one finding for each exception and each
  not-tested outcome: what the probe found, the cause, the remedy and the role
  that owns it. The Verdict, in a file named `verdict.auto.json`, MUST be
  generated (0015-work-packages FR-008), MUST be reproducible from the test
  plan and the ledger, and MUST use the shape of an OSCAL assessment result
  (0019-controlled-vocabulary FR-001).
- **FR-025**: A finding MUST say what was probed, what was found, what is
  owed and by whom. It MUST NOT describe an exception or a not-tested outcome
  as partial, nearly met, in progress or mitigated, and MUST NOT carry
  promotion. An AI MAY draft a finding. It MUST NOT change an outcome, which
  is the probe's alone.
- **FR-026**: An Elenchus occupies the lifecycle stages of
  0007-work-and-assets FR-017, each advance recorded as a `Decision` as
  0015-work-packages FR-023 requires:
  - Intake: the period, its closing date and the pinned test plan commit are
    fixed;
  - Research: the probes are run and the Verdict is generated;
  - Review: the findings are written, remedies are named and the decision
    authority reviews them;
  - Prep: the renditions are built;
  - Deploy: the Elenchus is closed (FR-027);
  - Distribute: the renditions are delivered to the audiences granted.

  An Elenchus MUST NOT enter Commercialize.
- **FR-027**: Closing an Elenchus, its advance to Deploy, MUST be a
  `Decision` by the decision authority in effect
  (0001-eidolon-architecture FR-029) that names the Elenchus by `schema:about`
  and states the pinned test plan commit, the digest of the Verdict, the number
  of exceptions and not-tested outcomes, and each outcome it leaves unremedied
  (FR-018). Neither an AI nor a check MAY close one. A closed Elenchus MUST NOT
  be edited. An error found in one MUST be corrected in the findings of the
  next Elenchus, naming the one corrected.
- **FR-028**: An Elenchus MUST state, by `dcterms:valid`, the date by which it
  closes. One still open after that date MUST be reported to the decision
  authority in effect as overdue.

## What it is rendered into

- **FR-029**: A report, a Kalendarium and a dashboard MUST each be a rendition
  built deterministically from the Verdict and the findings
  (0015-work-packages FR-013 through FR-016). None MAY state what they do not
  carry, and none MAY be tracked in Git as a binary.
- **FR-030**: A Kalendarium MUST be built only from closed Elenchi, in the
  house's book design, and MUST list any month of its year that is not closed
  as not closed. It MUST NOT be a work of kind `book`, MUST NOT carry an ISBN,
  and MUST NOT be delivered through a retail or distribution channel. Its
  audience MUST NOT be broader than the narrowest audience of an Elenchus
  bound in it.
- **FR-031**: A dashboard MUST show, at least: each control's outcome by
  month; every open exception and not-tested outcome with its age and its rank
  (FR-019); the trend of compliance debt (FR-020); and, for each outcome that
  reached `no exception` after an exception, the time it took. It reports and decides
  nothing.
- **FR-032**: An Elenchus's audience MUST default to the most restrictive
  available (0015-work-packages FR-024) and MUST NOT be Public. A summary that
  carries only the counts of each outcome for each catalog, naming no control
  and no system, MAY be derived as its own presentation, by a `Decision`
  (0015-work-packages FR-025).
- **FR-033**: An outside assessor MUST see an Elenchus only through the
  access 0028-compliance-controls FR-022 states. The view MAY be limited to
  the one boundary the engagement names.
- **FR-034**: No control test, Verdict, finding or rendition MAY carry a sensitive
  literal (0001-eidolon-architecture FR-016), a credential, or information
  that 0028-compliance-controls FR-019 covers. A system that holds such
  information MUST be named only by its `RestrictedDataReference`.
- **FR-035**: An Elenchus is the company's own examination. It MUST NOT be
  presented as an assessment by a party independent of the people who run the
  controls (0040-security-program-policy FR-007), and MUST NOT be held as an
  assessment under 0028-compliance-controls FR-023.

## Kept in place without remembering

- **FR-036**: The shape of control tests, the test plan and each Elenchus
  MUST be checked offline on every change to the repository that holds them.
  The check MUST fail on:
  - a control test that lacks a field FR-003 requires, or concerns more than
    one control (FR-004);
  - a fixture that does not make its probe return an exception (FR-008);
  - a control in a baseline with neither a control test nor a disposition,
    unless the Elenchus reports it as not tested (FR-011);
  - a retired record naming no `Decision` (FR-010);
  - a slug that is not a month (FR-023);
  - a `verdict.auto.json` that regenerating it does not reproduce (FR-024).
- **FR-037**: Opening an Elenchus, running its probes, generating its Verdict
  and closing it MUST each be a command of the repository's orchestrator
  (0041-command-line FR-008), running offline when asked
  (0041-command-line FR-004). Running probes is a `record` command, generating
  the Verdict a `generate` command, and closing a `decision` command
  (0041-command-line FR-014). Beyond what each records, no command here MAY
  change a control test, a disposition or a control map.

## Out of scope

- Which control tests exist, which boundaries are tried, and what any month
  found. These are vault facts and the work's own records.
- How a probe is carried out for a given control. Each control test states
  its own.
- Where the evidence ledger is kept (0028-compliance-controls OQ-1).
- The independent assessment of a boundary (0040-security-program-policy
  FR-007) and the report it produces (0028-compliance-controls FR-023).
- The book design of the Kalendarium: the house's book design system.

## Edge cases

- A control addressed only by a requirement enforced by `none`, with no
  control test: it is not tested, per FR-011 and FR-016, and also appears as
  untested in the status report, per FR-021.
- A control test written the day before an Elenchus closes: it takes effect in
  the next Elenchus, per FR-012.
- A probe whose command errors, or that cannot reach what it probes: the
  control test ends in an exception, per FR-009.
- Evidence that was good last month and is older than the cadence now: the
  control test ends in an exception, per FR-009.
- A CMMC Level 1 practice that is not met: it is an exception and cannot be
  excused, and its remedy is a `Decision` that commits to a dated fix, per
  FR-016 and FR-018.
- A check that always passes: it is not a control test, because its fixture
  cannot make it fail, per FR-008.
- A cadence lengthened so that an old passing result still counts: a
  `Decision` comes first and the control test keeps its history, per FR-010
  and FR-013.
- A boundary created mid-month: it enters the next Elenchus, per FR-023.
- A probe against the system that holds federal contract information: only
  its outcome and a digest are kept, per FR-007 and FR-034.
- A year in which one month never closed: the Kalendarium lists it as not
  closed, per FR-030.
- A drafted finding that calls a failed control "mostly compliant": it is
  rewritten to state what was found and what is owed, per FR-025.
- A mistake found in a closed Elenchus: the next Elenchus's findings correct
  it, per FR-027.
- An assessor who asks for a copy of the Kalendarium: access is given only
  through a time-limited grant, per FR-033.
- A control that has an exception but is covered by an unexpired
  accepted-risk disposition: it is excused, and its own control tests'
  outcomes are still reported beside it, per FR-016.
- A system an inventory observed that no boundary includes: it is reported as
  unmanaged risk, per FR-038.
- A period in which no inventory of observed systems was recorded: the
  Elenchus says so, and does not report no unmanaged risk, per FR-038.
- A control with no exception in every Elenchus by a person's review alone: its
  outcome is `no exception`, and the Verdict shows that it rests on
  attestation, per FR-016 and FR-039.
- A page about operational truth in general that writes the mark: it is
  rewritten in lowercase without the mark, per FR-040.

## Assumptions

- Every control can be given at least one probe of the four kinds. One that
  cannot stays not tested and visible, per FR-011.
- The evidence ledger can be queried by run, by control test and by period
  (0028-compliance-controls OQ-1).
- The compliance status report and the Elenchus read the same ontology and
  control maps, so that FR-021 can hold.
- A month is a calendar month.

## Open questions

- **OQ-1**: Whether a catalog's generic control tests, those that do not
  depend on one entity's systems, are public, with only each boundary's
  parameters kept in the vault, or whether every control test is held in the
  vault.
- **OQ-2**: What severity scale a control test uses, how many levels it has, and how
  FR-020 weighs them.
- **OQ-3**: Whether each requirement in the enforcement register whose
  mechanism is `check` or `gate` implies a control test, which would let
  control tests be derived for the controls it is mapped to.
- **OQ-4**: Whether a red Elenchus gates anything beyond its own close, such as
  a release or the annual program review (0040-security-program-policy
  FR-003).
- **OQ-5**: How the monthly Elenchi serve as evidence across the observation
  period of a SOC 2 Type 2 examination, and whether the month's boundaries are
  taken in UTC.
- **OQ-6**: The date a Kalendarium is built and closed each year, and whether
  a year's volume may be built while a month is still open.
- **OQ-7**: Whether surveilr's evidence store can be the evidence ledger. It
  is a local-first SQLite database, but the documentation read does not state
  that its records are tamper-evident in the sense of
  0028-compliance-controls FR-015, nor its license, nor that it runs offline
  as 0041-command-line FR-004 requires of a command.
- **OQ-8**: Which inventory FR-038 reads, and how it relates to the system
  inventory that 0028-compliance-controls OQ-3 leaves open. Fleetfolio
  reconciles expected assets with observed ones, which is the same
  comparison.
- **OQ-9**: Whether a control test's probe may be a Qualityfolio test case or a
  Spry executable document, and which of the two is then the one source of the
  test, given that a control test is an ontology fact
  (0001-eidolon-architecture FR-019).
- **OQ-10**: Whether evidence from a system that a company under common
  ownership operates counts as independent of the people who run the controls
  it shows. An Elenchus is not an independent assessment (FR-035), but the
  question decides how far a Verdict can be relied on.

## Key entities

- **An Elenchus**: one month's trial of every control in scope, held as a
  work package.
- **A control test**: one test of whether one control operates in one
  boundary, and the probe that carries it out.
- **The test plan**: every control test written and not retired, with the
  retired records of those that were.
- **A Verdict**: the outcome of one control in one boundary in one Elenchus:
  no exception, exception, not tested or excused.
- **A finding**: the written account of one exception or one not-tested
  outcome.
- **The Kalendarium**: the year's Elenchi bound as one volume.
- **A truth gap and unmanaged risk**: the two ways expected and observed
  differ: a control the evidence does not show operating, and a system the
  evidence shows that no boundary expects.

## Success criteria

- **SC-001**: A control in a baseline with no control test and no disposition
  appears in the next Elenchus as not tested.
- **SC-002**: No control test is made easier to pass, and none retired,
  without a `Decision`.
- **SC-003**: Every exception and every not-tested outcome at close has a
  remedy or is named in the closing `Decision`.
- **SC-004**: The Verdict regenerates, byte for byte, from the test plan and
  the ledger it names.
- **SC-005**: One Verdict yields the report, the Kalendarium and the dashboard
  with nothing written twice.
- **SC-006**: No system that an inventory observed in the period sits in no
  boundary without being reported as unmanaged risk.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details)
      beyond what a work kind must state (0015-work-packages FR-011)
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
