# Feature Specification: Intellectual Frontiers Network

**Spec ID:** 0006-if-network
**Status:** Draft — first pass
**Created:** 2026-09-13
**Decision authority:** Shahid N. Shah, for the company-wide reason
tracked as OQ-5 on `0001-intellectual-frontiers` — no unit, Network
included, has a named individual lead distinct from the founder yet.
**Input:** Specify IF Network in spec-kit's spec shape, deepening
`context/units/network.md` into testable requirements, the way the prior
four unit specs deepened their own charters. Network's charter was itself
freshly deepened for this spec from the live site's source repository
(`src/content/network.ts`, commit `adf0aef`), since it carries
substantially more than the original doctrine-only distillation did. No
new policy invented here.

## Why this document exists

`context/units/network.md` now states Network's charter in full: the
twelve-stage search lifecycle, eight doctrine rules, an explicit
measurement discipline, and the evidence-packet schema. This spec restates
the checkable parts of that charter as requirements. Where 0001 already
states a rule that covers Network (FR-015, FR-016), this spec cites it
rather than restating it.

This is not an implementation plan. It does not say what sourcing tools
Network uses, who staffs a hunt, or what any specific hunt currently
running is looking for.

## Clarifications

None yet.

## Primary scenario

A hunt begins with a written thesis — who would have to exist for a piece
of work to succeed, and what would make that person unusual — before
anyone looks at a single candidate. Discovery surfaces a small set of
candidates from public signals, each treated as a clue rather than proof.
Every candidate gets an evidence packet: sourced claims, named unknowns,
a confidence level, and a next action. A person, never a score, reads the
packet and decides whether to make contact. What holds up in conversation
either validates the thesis or corrects it, and either way the outcome —
including a failure — is recorded so the next hunt starts further along.

### Acceptance scenarios

1. **Given** a new hunt, **when** it starts, **then** its thesis is
   written before discovery of any candidate begins.
2. **Given** a signal is found (a talk, a filing, a roster, a piece of
   writing), **when** it's evaluated, **then** it is treated as a reason
   to look closer, not as proof of anything about the person, until
   validated.
3. **Given** an evidence packet is produced, **when** it's published,
   **then** every claim in it names a source, and every unknown is listed
   as an unknown rather than omitted.
4. **Given** a candidate's evidence packet exists, **when** a decision to
   contact them is made, **then** a person makes that decision by reading
   the packet — it is never delegated to a computed score.
5. **Given** a hunt reports its results, **when** it does, **then**
   profile counts, registrations, page views, and messages sent are not
   used as measures of the hunt's success.
6. **Given** a hunt or an experiment concludes, **when** the outcome is
   known, **then** the outcome — including a failed one — is recorded,
   and the hunt's thesis is corrected before the next related search.
7. **Given** someone offers an introduction, **when** it's evaluated,
   **then** it is not treated as a reference, and a reference is not
   treated as evidence. (0001 FR-016.)
8. **Given** a hunt or packet describes an illustrative or composite
   subject rather than a real person, **when** it's published, **then**
   it is clearly labeled as illustrative — never presented as an actual
   candidate or search.

### Edge cases

- A hunt surfaces an unusually large number of candidates: per doctrine,
  that is read as a sign the thesis wasn't sharp enough, not as
  thoroughness.
- A packet's confidence level (Low, Medium, High) needs to be assigned:
  no stated rubric distinguishes the three levels.
  `[NEEDS CLARIFICATION: no stated criteria for Low vs. Medium vs. High
  confidence on an evidence packet]`
- A candidate is surfaced with strong signals but no conversation has
  happened yet: the Native Alpha hypothesis about them stays unvalidated
  regardless of how strong the signals look.

## Requirements

**Thesis and discovery**

- **FR-001**: Network MUST write a hunt's thesis — who would have to
  exist for the work to succeed, and what would make them unusual —
  before beginning discovery of candidates.
- **FR-002**: Network MUST treat every signal as a reason to look closer,
  not as proof of anything about the person, until it is validated.
- **FR-003**: Network MUST NOT treat the size of a surfaced candidate
  list as a measure of a hunt's quality.
- **FR-011**: A candidate's Native Alpha hypothesis MUST NOT be treated as
  validated until a conversation or a small piece of real work confirms
  it. Surfacing alone MUST NOT count as validation.

**Evidence packets**

- **FR-004**: Every evidence packet MUST state, for each claim, a named
  source, and MUST list every unknown separately rather than omitting it.
- **FR-009**: An evidence packet MUST separate what is known, what is
  inferred, and what is missing, as distinct categories. (Restates 0001
  FR-015.)
- **FR-010**: A published hunt or evidence packet describing an
  illustrative or composite subject MUST be clearly labeled as
  illustrative — never presented as if it described a real candidate or
  search.

**Judgment and measurement**

- **FR-005**: The decision to contact a candidate MUST be made by a person
  reading their packet; it MUST NOT be delegated to a computed score.
- **FR-006**: Network MUST NOT report profile counts, registrations, page
  views, or messages sent as a measure of a hunt's success. It MUST
  instead track hunts with a written thesis, candidates judged worth
  contacting, conversations that changed the thesis, experiments started,
  and outcomes, including failures.
- **FR-007**: Network MUST record a hunt's or experiment's outcome,
  including a failed one, and MUST correct the hunt's thesis based on
  that outcome before the next related search.
- **FR-008**: Network MUST NOT treat an introduction as a reference, or a
  reference as evidence. (Restates 0001 FR-016.)

**Network runs through the whole system**

- **FR-012**: Network MUST NOT be treated as a stage a signal passes
  through once; any unit MUST be able to draw on Network at the point it
  needs a person, not only when a pipeline reaches a "find people" step.
- **FR-013**: Network's search remit MUST include sourcing LPs and
  investors for IF Capital, not only operators, founders, and specialists.
- **FR-014**: When a hunt surfaces that someone outside the firm is
  already pursuing a thesis the firm is evaluating, Network MUST report
  that finding to the relevant unit rather than treating it as
  irrelevant to the search it was asked to run.

## Key entities

- **A hunt** — a search with a written thesis, the Native Alpha it's
  looking for, qualifying and disqualifying criteria, watched signals,
  running counts, and what it has learned so far.
- **An evidence packet** — the record on one candidate: who they are,
  why they surfaced, the signals, the Native Alpha hypothesis, sourced
  evidence, relationship path, named unknowns, next action, a confidence
  level, and a status.
- **The twelve-stage lifecycle** — Thesis → Discovery → Surfaced →
  Evidence → Human judgment → Contact → Conversation → Validation → Match
  → Experiment → Outcome → Learning.
- **Relationship memory** — the compounding record of who did what and
  how it turned out, queried in plain language through Ask Network.
- **The intelligence layer** — Network's role relative to the internet:
  the internet is the database of public information about people; Network
  is what knows whom to find, when, and why they matter to a specific
  thesis.

## Success criteria

- **SC-001**: Every hunt has a written thesis recorded before its first
  surfaced candidate.
- **SC-002**: Every claim in every published evidence packet names a
  source; every unknown is listed, not omitted.
- **SC-003**: No contact decision is traceable to an automated score
  rather than a named person's judgment.
- **SC-004**: Reported hunt metrics never include profile, registration,
  page-view, or message counts as success measures.
- **SC-005**: Every hunt that has run to an outcome records at least one
  correction to its original thesis.
- **SC-006**: No illustrative hunt or packet is published without an
  explicit illustrative or composite label.
- **SC-007**: A finding that someone outside the firm already pursues an
  evaluated thesis is recorded and routed to the relevant unit, not
  dropped because it fell outside the original search request.

## Out of scope

- The specific sourcing tools or databases Discovery uses are operational
  detail, not spec-level.
- Compensation or fee arrangements for an introduction or placement are a
  business-terms decision, not this spec's to make.
- The actual roster of hunts currently running, and their real counts, is
  operational content this spec does not assert either way — the source
  content itself is explicitly illustrative, not a live index.

## Open questions

- **OQ-1**: No individual IF Network lead is named, distinct from Shahid
  N. Shah. Tracked company-wide as OQ-5 on `0001-intellectual-frontiers`
  rather than repeated here.
- **OQ-2**: No rubric distinguishes Low, Medium, and High confidence on
  an evidence packet. This may be a deliberate judgment call, in the same
  spirit as Studios' binary independence test, but unlike that test, the
  doctrine never says so explicitly here.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation detail — sourcing tools, staffing, and current
      hunt rosters are out of scope
- [x] Every requirement traces to `context/units/network.md` or
      `0001-intellectual-frontiers/spec.md`
- [x] Ambiguities are marked `[NEEDS CLARIFICATION]`, not silently
      resolved
- [x] Public-safe: no confidential information, no unverified number
      stated as settled fact, and every illustrative example inherited
      from the source is still labeled as illustrative here

## Traceability

| Requirement | Source |
| --- | --- |
| FR-001 – FR-003, FR-011 | `context/units/network.md` (How a search runs; Doctrine) |
| FR-004, FR-010 | `context/units/network.md` (The evidence packet) |
| FR-005, FR-006 | `context/units/network.md` (What Network measures; How a search runs) |
| FR-007 | `context/units/network.md` (How a search runs, stages 11–12) |
| FR-008 | `0001-intellectual-frontiers/spec.md` FR-016 |
| FR-009 | `0001-intellectual-frontiers/spec.md` FR-015 |
| FR-012, FR-014 | `context/units/network.md` ("Network runs through the whole system"); `spec-kit/memory/constitution.md` §6 |
| FR-013 | `context/units/network.md` ("Network runs through the whole system"); `context/units/capital.md` ("Capital sources") |
| SC-001 – SC-007 | Derived directly from FR-001 – FR-014 above |
