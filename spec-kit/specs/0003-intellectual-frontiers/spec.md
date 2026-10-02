# Feature Specification: Intellectual Frontiers

**Spec ID:** 0003-intellectual-frontiers
**Status:** Draft

**Input:** The behavioral rules governing Intellectual Frontiers as a company:
how units relate to each other and to a claimed advantage, how an advantage
is tested before it is treated as real, and how the company sources
capability and judges when to build something itself. What the company's
units actually are — their names, jobs, and questions — is ontology data,
not restated here.

## Units

- **FR-001**: A unit MUST have exactly one job and one question it exists to
  answer. A unit's actual job and question are ontology data (`ifcore:Unit`),
  not asserted in this or any other spec.
- **FR-002**: A unit MAY have its own spec for operating detail deeper than
  this one covers. That spec MUST inherit this one and
  0001-eidolon-architecture without redefining either.
- **FR-003**: A unit's output MUST NOT be treated as sufficient proof for
  another unit's decision. In particular: a patent MUST NOT be treated as
  proof an investment should follow; a publication MUST NOT be treated as
  proof of market demand; a prototype or experiment MUST NOT be treated as
  proof it has earned funding; an investment MUST NOT be treated as buying
  control over how its subject is represented; an introduction MUST NOT be
  treated as a completed reference.
- **FR-004**: A finding from any unit MUST be able to revise what another
  unit currently believes about a shared claim. Evidence MUST NOT be treated
  as flowing one-directionally from one unit to the next.

## Native Alpha

- **FR-005**: A claimed advantage MUST NOT be treated as real until it has
  changed an actual decision. Its full definition is ontology data
  (`ifcore:NativeAlpha`), not restated here.
- **FR-006**: Evidence offered in support of a claimed advantage MUST cost
  the party providing it something real — money, time, access, data,
  reputation, or a changed decision. Expressed interest or a compliment
  alone MUST NOT count as evidence.

## The method

- **FR-007**: An opportunity MUST move through an ordered sequence of stages
  before it is treated as proven. The stages themselves are ontology data
  (`ifcore:MethodStage`).
- **FR-008**: Skipping a stage in that sequence MUST NOT be treated as
  satisfying it. A later stage's outcome does not retroactively excuse an
  earlier one that was never run.

## Sourcing capability

- **FR-009**: Legal, finance and accounting, compliance, and general
  operations MUST be routed through one consistent approach across every
  unit. No unit MAY build its own internal version of a function that
  another unit already sources externally.
- **FR-010**: A function MUST NOT move from an outside provider to a
  full-time hire unless the work is steady, strategically important,
  financially sound, and supported by at least eighteen months of runway.
- **FR-011**: Before committing to build something new, a credible existing
  effort already pursuing the same thesis MUST be searched for. If one
  exists and its evidence is as strong as or stronger than the company's
  own, backing it MUST be preferred over building a competing effort
  internally.

## Decisions

- **FR-012**: Every decision made under this spec MUST resolve to one of the
  decision-checkpoint outcomes already defined in 0001-eidolon-architecture
  (`ifcore:DecisionOutcome`). This spec MUST NOT define a second, parallel
  decision model.

## Open questions

- **OQ-1**: No individual unit lead is named, distinct from the founder.

## Key entities

- **A unit** — a part of the company with exactly one job and one question,
  defined as data in the ontology.
- **Native Alpha** — a claimed advantage, treated as real only once it has
  changed an actual decision; its full definition lives in the ontology.
- **A method stage** — one step in the ordered sequence an opportunity moves
  through before being treated as proven; the stages are ontology
  individuals, held in sequence.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (a unit's name, job, or question; Native Alpha's exact
      definition) is asserted here — all of it is ontology data
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
