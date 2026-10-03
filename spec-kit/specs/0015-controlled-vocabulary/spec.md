# Feature Specification: Controlled vocabulary

**Spec ID:** 0015-controlled-vocabulary
**Status:** Draft

**Input:** How a new ontology term earns its place: reusing an established
vocabulary wherever one already names the concept, treating a genuinely
novel term as a decision rather than a default, and keeping the ontology
from accumulating an invented term that a later review could have caught
sooner.

## Reuse before invention

- **FR-001**: A new `owl:Class`, `owl:ObjectProperty`, or `owl:DatatypeProperty`
  MUST reuse an established vocabulary's term for the concept it names wherever
  one already exists. PROV-O and standard asset-management categories
  (ISO 55000, GAAP/IFRS) are already in use for exactly this reason, per
  0007-work-and-assets; schema.org, Dublin Core, and SKOS are already declared
  and used in the core ontology too. An already-declared `ifcore:`, `ifweb:`,
  or `ifpriv:` term takes priority over all of them.
- **FR-002**: Reuse MUST extend to specializing an established class via
  `rdfs:subClassOf` wherever the concept is genuinely a kind of something
  standard already names, rather than declaring an unrelated new class beside
  it — the asset hierarchy (`ifcore:TangibleAsset`, `ifcore:IntangibleAsset`,
  and their GAAP/IFRS-aligned children) is the existing pattern this follows.
- **FR-003**: A term's label or definition reading more distinctively, more
  concisely, or more on-brand than the established equivalent MUST NOT, by
  itself, justify declaring it instead of reusing that equivalent.

## The novel-vocabulary exception

- **FR-004**: A term with no established equivalent MUST be justified by a
  `Decision` individual, per 0008-decision-records, recording what was
  considered and why no established term fits — the same discipline
  0008-decision-records FR-005 already asks of any significant decision's
  rejected alternatives.
- **FR-005**: A term justified under FR-004 MUST be the company's own
  original concept, framework, or research — not an established idea
  restated under different wording. `ifcore:NativeAlpha`'s own documented
  provenance (its origin as a specific person's authored research and
  thesis, per 0009-press) is the model a justification follows.
- **FR-006**: Once justified, a term's exception MUST stand until a later
  Decision supersedes it, per 0008-decision-records FR-008. It MUST NOT be
  re-justified every time the ontology is reviewed under FR-007.

## Reconsidering vocabulary over time

- **FR-007**: The ontology MUST be reviewed, on a recurring, bounded
  cadence, for a term that could now be replaced by an established one —
  including a term that had no obvious established equivalent when it was
  declared but does now.
- **FR-008**: A review under FR-007 MUST only flag a candidate; it MUST NOT
  rename or remove a term by itself. Acting on a flagged candidate follows
  the same spec-before-ontology-before-implementation order as any other
  ontology change, per 0001-eidolon-architecture FR-037.
- **FR-009**: A change introducing a term with neither an established
  equivalent (FR-001–FR-003) nor a Decision justifying it (FR-004) MUST be
  prevented from reaching the ontology, caught before the change is
  accepted — not left for FR-007's review to find afterward.

## Out of scope

- Which established vocabularies exist to check a term against (FR-001's
  list is illustrative, not closed), and how a review tells a genuine
  exception from an unjustified invention, are matters of judgment applied
  at review time, not fixed by this spec.
- FR-007's recurring review and FR-009's point-of-change gate are
  requirements on what MUST happen; their schedule, the mechanism that
  carries either out, and any tooling involved are implementation detail,
  per 0001-eidolon-architecture's standard for what a spec does not fix.
- Renaming a term that FR-007 surfaces as a current candidate is a decision
  to make when it happens, not restated here.

## Open questions

- **OQ-1**: No rule yet states how a candidate FR-007 flags is surfaced to
  whoever holds decision authority over it, as distinct from that judgment
  happening informally today.
- **OQ-2**: Whether FR-009's gate applies to every Eidolon repository, or
  only the ones that commit ontology files directly — a venture's own
  ontology extension, for instance — is not yet decided.

## Key entities

- **A novel vocabulary term** — an ontology class or property with no
  established equivalent, justified by a `Decision` under FR-004 rather
  than tracked in a separately maintained exemption list.
- **An established vocabulary** — a term's source of definition outside
  Intellectual Frontiers' own ontology (schema.org, PROV-O, Dublin Core,
  SKOS, an accounting or legal standard among them), or a term already
  declared elsewhere in the Eidolon's own ontology.

## Success criteria

- **SC-001**: Every ontology class and property declared after this spec
  either maps to an established vocabulary, directly or via
  `rdfs:subClassOf`, or carries a `Decision` justifying it.
- **SC-002**: No term already justified by a standing Decision is
  re-justified by a new one (FR-006).
- **SC-003**: A recurring review identifies, for any term lacking both an
  established mapping and a Decision, exactly that gap — no more, no
  fewer.
- **SC-004**: No change introducing an unjustified novel term reaches the
  ontology without being caught first (FR-009).

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, schedules, hosting details)
      — those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
