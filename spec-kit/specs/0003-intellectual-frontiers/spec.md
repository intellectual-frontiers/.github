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
- **FR-014**: A claimed Native Alpha MAY be evident or latent. It is
  evident when it already produces a result beyond a credible benchmark.
  It is latent when the subject's existing people, knowledge, assets,
  rights, data, relationships, or operating methods carry it, but only a
  reorganization or recombination of them (of units, companies, products,
  or services) would realize it. Both are Native Alpha because both
  originate in what the subject already has.
- **FR-015**: A latent claim MUST name the existing elements it draws on
  and the reorganization that would realize it. A claim that depends on a
  capability the subject does not have, and would have to acquire or build
  from scratch, MUST NOT be called Native Alpha. It MAY still be pursued
  as an opportunity on its own evidence.
- **FR-016**: A latent claim MUST be treated as a provisional thesis to
  test, not as an advantage, until the reorganization it names has been
  made and has changed an actual decision, per FR-005 and FR-006. A latent
  claim MUST NOT be presented as evident.
- **FR-017**: A core competency stated in general terms (innovation,
  customer focus, domain expertise) MUST NOT by itself be treated as Native
  Alpha, evident or latent. It is where a search for Native Alpha may
  start, not what the search finds.
- **FR-018**: Discovering Native Alpha (finding an evident advantage, or
  stating and testing a latent one) and presenting it MUST be treated as
  different work. Which units discover and which present is set by each
  unit's own spec. A unit that presents a claim MUST NOT be its only
  source.

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

## Public naming

- **FR-013**: A unit's formal name MUST be used in specs and governance
  contexts. A unit MAY declare one or more public-facing alternate names
  (`schema:alternateName`) for contexts where its formal name risks being
  misread. An alternate name MUST NOT redefine the unit's job or question —
  only how it is labeled.

## Edge cases

- A patent from one unit offered as the case for an investment: it is not
  sufficient proof on its own, per FR-003.
- Evidence that consists of a letter of interest: it cost the writer
  nothing real, so it does not count, per FR-006.
- A latent claim that depends on a capability the subject would have to
  acquire: it is not Native Alpha, but may still be pursued as an
  opportunity on its own evidence, per FR-015.
- A general core competency such as domain expertise: it is where a
  search for Native Alpha may start, not a finding, per FR-017.
- A later stage succeeding after an earlier stage was skipped: the
  earlier stage remains unsatisfied, per FR-008.
- A credible outside effort pursuing the same thesis on stronger
  evidence: backing it is preferred over building a rival internally, per
  FR-011.

## Assumptions

- The ontology holds each unit's job and question, Native Alpha's
  definition, and the method's stages, so this spec can refer to them
  without restating them.
- Whether an actual decision changed can be observed, so FR-005 can be
  applied.
- Shared functions such as legal and finance can be sourced from outside
  on terms that serve every unit alike.

## Open questions

- **OQ-1**: No individual unit lead is named, distinct from the founder.
- **OQ-2**: FR-011 sets no standard for judging whether an outside
  effort's evidence is as strong as the company's own.

## Key entities

- **A unit** — a part of the company with exactly one job and one question,
  defined as data in the ontology.
- **Native Alpha** — a claimed advantage, treated as real only once it has
  changed an actual decision; its full definition lives in the ontology.
- **Evident and latent Native Alpha** — an advantage already producing a
  result beyond a benchmark, and one that the subject's existing elements
  carry but that only a stated reorganization would realize. A latent
  claim stays a provisional thesis until it has changed a decision.
- **Discovery and presentation** — finding or testing a Native Alpha
  claim, and documenting or presenting one already discovered; different
  work, assigned by each unit's own spec.
- **A method stage** — one step in the ordered sequence an opportunity moves
  through before being treated as proven; the stages are ontology
  individuals, held in sequence.
- **A public-facing alternate name** — a unit's own name stated plainly, used
  where the formal name alone would mislead a reader about what the unit
  does.

## Success criteria

- **SC-001**: Every unit in the ontology has exactly one job and one
  question.
- **SC-002**: No claim is presented as Native Alpha before it has changed
  an actual decision, and no latent claim is presented as evident.
- **SC-003**: No evidence offered for a claimed advantage consists only of
  expressed interest or a compliment.
- **SC-004**: No opportunity is treated as proven while a stage of the
  method is unrun.
- **SC-005**: Every decision made under this spec resolves to a
  decision-checkpoint outcome.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (a unit's name, job, or question; Native Alpha's exact
      definition) is asserted here — all of it is ontology data
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
