# Feature Specification: Intellectual Frontiers Network

**Spec ID:** 0012-network
**Status:** Draft

**Input:** The behavioral rules Network's search practice follows: what a
hunt must state before a search starts, what a candidate becomes evidence
through, the search lifecycle a hunt moves through, what relationship
memory may and may not disclose, and what Network is measured by. What
specific hunts, candidates, and relationships currently exist is private
vault and register data, not restated here.

## Starting a search

- **FR-001**: A hunt MUST state its thesis — who would have to exist, what
  would make them unusual, and what evidence would change the firm's mind
  — before any candidate is surfaced.
- **FR-002**: A hunt MUST name the unit or opportunity it searches for and
  the claimed advantage it tests, per 0003-intellectual-frontiers FR-005.

## Search lifecycle

- **FR-003**: A hunt MUST move through its stages in order. A later
  stage's result MUST NOT be treated as satisfying a stage that was
  skipped, per 0003-intellectual-frontiers FR-008. The stages themselves
  are ontology data (`ifcore:SearchStage`).
- **FR-004**: Every stage gate — surfacing a candidate, deciding to
  contact, deciding to match, recording an outcome — MUST be an explicit,
  written human judgment. No score or ranking MUST decide whether to
  contact a candidate.
- **FR-005**: A completed hunt, successful or not, MUST record what its
  thesis got wrong. That correction MUST inform the next hunt for a
  similar person.

## Evidence discipline

- **FR-006**: Network MUST NOT treat an introduction as a reference, or a
  reference as evidence. A claimed relationship or endorsement alone MUST
  NOT be recorded as evidence about a candidate, per
  0003-intellectual-frontiers FR-003 and FR-006.
- **FR-007**: Every claim in an evidence packet MUST cite the signal it
  came from. A signal MUST NOT be presented as more certain than its
  source supports.
- **FR-008**: An evidence packet MUST name what is unknown about a
  candidate explicitly, rather than dropping it once the candidate looks
  promising.
- **FR-009**: An illustrative or composite candidate example used in a
  public or training context MUST be labeled as such. It MUST NOT be
  presented as a real search outcome.

## Serving the other units

- **FR-010**: Network MUST apply the same evidentiary standard to a search
  request regardless of which unit it searches for.
- **FR-011**: Network MUST be the unit through which
  0003-intellectual-frontiers FR-011's search-before-build check is
  actually carried out for a Capital or Studios opportunity. A search's
  failure to find a credible existing effort MUST be recorded, not
  assumed.
- **FR-012**: An investor or LP introduced through Network and funded by
  Capital MUST be recorded as `ifcore:NetworkSourcedCapital`, per
  0010-capital FR-012 — not left as an unnamed source.
- **FR-013**: A Network-sourced candidate or introduction MUST NOT be
  treated as sufficient proof for another unit's hiring, partnering, or
  funding decision by itself — the unit-boundary rule in
  0003-intellectual-frontiers FR-003 applies here by name.

## Relationship memory and confidentiality

- **FR-014**: Nothing learned in a private conversation MUST appear on a
  public-facing page without the speaker's consent.
- **FR-015**: Network MUST NOT publish a public directory of people it has
  found or holds relationship memory about.
- **FR-016**: A relationship path to a candidate, where recorded, MUST
  carry the audience it is visible to explicitly, per
  0001-eidolon-architecture FR-011 — never left implicit from being
  recorded at all.

## What Network is measured by

- **FR-017**: Network MUST NOT be evaluated, or report its own
  performance, by profiles created, registrations, page views, or
  messages sent.
- **FR-018**: Network MUST be evaluated by hunts with a recorded thesis,
  candidates a person judged worth contacting, conversations that revised
  a thesis, experiments started, and outcomes — including a failed one.

## Out of scope

- The search lifecycle's exact stage names, and a hunt's current roster of
  candidates, counts, or outcomes, are ontology and private vault data,
  not restated here.
- How a packet's confidence level is assigned is operational judgment, not
  spec-level.
- Where hunt and packet data physically lives — which parts are Public
  versus held only in the private vault — is governed by
  0001-eidolon-architecture, not re-decided here.

## Open questions

- **OQ-1**: No individual Network lead is named, distinct from the
  founder — tracked company-wide per 0003-intellectual-frontiers OQ-1, not
  repeated here.
- **OQ-2**: No rule states how long relationship memory about a candidate
  who was never matched to anything is retained, or when it should be
  purged.

## Key entities

- **A hunt** — a search with a written thesis, naming what would have to
  be true about a person and what evidence would change the firm's mind.
- **A search stage** — one step in Network's ordered search lifecycle,
  held in sequence.
- **An evidence packet** — what a candidate becomes through signals,
  cited evidence, named unknowns, a confidence level, and a status; never
  a profile.
- **Relationship memory** — the compounding record of who did what and
  how it turned out; carries its own audience, never implicitly public.

## Success criteria

- **SC-001**: No candidate is surfaced without a hunt's thesis stated
  first.
- **SC-002**: No evidence packet is missing a cited source for a claim it
  makes, or omits a known unknown.
- **SC-003**: No illustrative candidate example appears without being
  labeled as such.
- **SC-004**: No hunt's search-before-build finding for Capital or Studios
  is assumed rather than recorded.
- **SC-005**: No investor or LP introduced through Network is left as an
  unnamed capital source.
- **SC-006**: No private conversation content appears on a public page
  without consent; no public person directory exists.
- **SC-007**: Network's own reporting cites hunts, judged candidates,
  thesis-revising conversations, and outcomes — never activity counts like
  profile or page-view totals.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (a hunt's actual thesis, a candidate's identity, the
      stage taxonomy) is asserted here — all of it is ontology or private
      vault data
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
