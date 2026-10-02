# Feature Specification: Decision records

**Spec ID:** 0008-decision-records
**Status:** Draft

**Input:** How a significant decision gets recorded, reusing the
Architecture Decision Record pattern (title, context, decision,
consequences, status) rather than inventing a new shape — and how that
record's confidentiality follows the same rules as any other fact.

## Recording a decision

- **FR-001**: A significant decision MUST be recorded as a `Decision`
  individual, per 0001-eidolon-architecture FR-031. Routine operational
  activity still does not require one.
- **FR-002**: Every `Decision` MUST state who made it
  (0001-eidolon-architecture `decidedBy`). A decision record with no
  accountable person is not a complete record.
- **FR-003**: A `Decision` MUST record exactly one coherent choice. A
  decision bundling multiple distinct choices MUST be split into multiple
  `Decision` individuals, not represented as one with mixed outcomes.
- **FR-004**: `hasOutcome` is required only when the decision resolves a
  Native Alpha thesis question (0001-eidolon-architecture FR-031). A
  significant decision outside that shape MAY omit it and rely on its
  rationale alone.

## Evidence and rationale

- **FR-005**: A `Decision` SHOULD link to the facts that informed it via
  `ifcore:consideredEvidence`, where that evidence is itself a tracked
  Fact. Where the informing context was never formalized as a tracked
  Fact, a plain-text rationale via `dcterms:description` MUST be used
  instead — the absence of a trackable Fact does not excuse recording no
  reasoning at all.
- **FR-006**: A `Decision` SHOULD record the alternatives considered and
  rejected, each with a brief reason, not only the option chosen.
- **FR-007**: What a decision caused to exist afterward MAY be linked back
  to it via `prov:wasGeneratedBy` on the resulting fact, rather than
  restated on the `Decision` itself.

## Currency and supersession

- **FR-008**: Whether a `Decision` has been superseded MUST be represented
  by `dcterms:isReplacedBy`, pointing at the specific decision that
  supersedes it, independent of either decision's own `hasOutcome`.
  `hasOutcome` and `isReplacedBy` MUST NOT be conflated — one states what
  was chosen, the other states whether the record is still current.
- **FR-009**: A superseding decision MUST fully replace the one it points
  at, per FR-003's one-coherent-choice rule. A decision that needs only
  partial revision was scoped too broadly and MUST be split, not partially
  superseded.

## Confidentiality

- **FR-010**: A `Decision`'s audience classification defaults to the most
  restrictive available, per 0001-eidolon-architecture FR-012, unless
  deliberately classified otherwise.
- **FR-011**: Where a decision's outcome is shareable but its rationale is
  not, the outcome and the rationale MUST be represented as two separate,
  linked facts with their own audiences, rather than one `Decision` with
  mixed-sensitivity content.
- **FR-012**: A public `Decision` MUST NOT carry a visible link to a
  private companion fact. Where a private rationale exists for a public
  decision, the connection is recorded only on the private side, pointing
  outward — the public record never discloses that a restricted companion
  exists.
- **FR-013**: If a `Decision`'s audience is found to need tightening after
  it was recorded with a broader one, 0001-eidolon-architecture FR-036
  applies in full, including the history rewrite and any credential
  rotation that rule requires. Loosening a decision's audience over time
  carries no such requirement — only tightening does.

## Scope boundary

- **FR-014**: A decision that changes the Eidolon's own specs or ontology —
  amending a rule, changing a confidentiality default — is governed by the
  spec-amendment process (0001-eidolon-architecture FR-034, FR-035), not
  represented as a `Decision` individual. The two mechanisms are not
  interchangeable.

## Out of scope

- A multi-role decision framework (a distinct recommender, approver, or
  input-giver) is not modeled; 0001-eidolon-architecture FR-029's single
  default authority covers this until a second decision-maker actually
  exists.
- Sequential decision numbering (as flat-file ADRs use) is not adopted — a
  `Decision` is addressed by its own identity and `decidedAt`, which a
  graph doesn't need an artificial counter for.
- Where ongoing decision data should live relative to the core vocabulary
  file as volume grows is not decided here (OQ-2).

## Open questions

- **OQ-1**: No process addresses a conflict of interest between the
  founder's personal interests and the company's, for a decision that
  isn't simply about a wholly-owned asset — 0001-eidolon-architecture
  FR-033 only covers the wholly-owned case.
- **OQ-2**: As recorded decisions accumulate, whether they should live in a
  separate location from the core vocabulary they're typed against is
  undecided. Today both live in the same file.

## Key entities

- **A decision** — one coherent, recorded choice; a `Fact` and a
  `prov:Entity`.
- **Considered evidence** — a tracked fact that informed a decision,
  linked by `ifcore:consideredEvidence`, distinct from `prov:used` because
  a `Decision` is a `prov:Entity` and PROV-O declares `Entity` and
  `Activity` disjoint — `used`'s domain is `Activity`, so a `Decision`
  cannot carry it directly without a logical conflict.
- **An alternative** — an option considered and rejected, with its own
  stated reason.

## Success criteria

- **SC-001**: Every recorded `Decision` states who made it.
- **SC-002**: No `Decision` carries more than one coherent choice or a
  mixed outcome.
- **SC-003**: No `Decision` outside a Native Alpha thesis question is
  missing for lack of a forced categorical outcome.
- **SC-004**: No decision's currency is inferred from its `hasOutcome`
  value rather than stated by `isReplacedBy`.
- **SC-005**: No public decision record links visibly to a private
  companion fact.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No novel vocabulary invented where an established term already fits —
      the Architecture Decision Record pattern for shape, PROV-O and
      Dublin Core for relationships; `consideredEvidence` is minted only
      because PROV-O's own disjointness rules block reusing `prov:used`
      directly
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
