# Feature Specification: Controlled vocabulary

**Spec ID:** 0019-controlled-vocabulary
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

- **FR-007**: The ontologies MUST be audited every week for a term that an
  established one could replace, including a term that had no established
  equivalent when it was declared but has one now. The audit is an AI Audit:
  it follows the procedure in `spec-kit/audits/vocabulary-drift.md`, starts from the
  deterministic scan (`agora check vocabulary`), checks each candidate against
  its source, and reports to the decision authority by email and by a written
  report kept in `spec-kit/audits/vocabulary-drift/`.
- **FR-008**: An audit under FR-007 MUST only flag a candidate; it MUST NOT
  rename or remove a term by itself. Acting on a flagged candidate follows
  the same spec-before-ontology-before-implementation order as any other
  ontology change, per 0001-eidolon-architecture FR-037. A person decides
  each candidate: replace the term, map it to the established term, or record
  an exception Decision.
- **FR-009**: A term with neither an established equivalent (FR-001 to FR-003,
  FR-010) nor a Decision justifying it (FR-004, FR-011) is a finding of the
  next audit. The scan lists it as unmapped. A term is mapped when it
  specializes or declares itself a match of an established term (a
  parent such as `prov:Entity` or `skos:Concept` is too general to count), and
  it is excepted when a Decision names it with `dcterms:subject`. The scan is
  a report and never stops a change; the audit and its report are the control.

## The rule

- **FR-010**: A term MUST NOT be invented when an existing term will work. An
  existing term works when it names the same concept, or a concept the new one
  is a kind of, in an established vocabulary, in a recognized standard, or in
  the ordinary professional usage of the field the term serves (for example a
  standard of ISO, NIST, W3C, the AICPA or a regulator; PROV-O, schema.org,
  SKOS, Dublin Core, ODRL, the W3C Organization Ontology). The rule covers
  every class, property, concept scheme and concept of every ontology the
  company keeps, in the public root and in every vault, including the
  ontologies of the platforms and products it sponsors or builds (Physia and
  the Opsfolio platform among them), and every name those ontologies give a
  module, a scheme or a stage.
- **FR-011**: The exception for the company's own named concepts is narrow.
  A term is the company's own concept only when it comes from the company's
  own research, differs in meaning from any standard business or technical
  term, and a Decision under FR-004 says so. `Native Alpha`, `Acquired Alpha`
  and the three kinds of reflection (`Eidolon`, `Ergon`, `Noema`) are the
  standing examples. A name chosen for distinctiveness, brand or brevity is
  not a reason (FR-003). A name borrowed from another language or field
  (for example from Greek) is not original for that reason.

## Out of scope

- Which established vocabularies exist to check a term against (FR-001's
  list is illustrative, not closed), and how a review tells a genuine
  exception from an unjustified invention, are matters of judgment applied
  at review time, not fixed by this spec.
- The audit's day and hour, the mail service it uses, and the scan's
  implementation are implementation detail, per 0001-eidolon-architecture's
  standard for what a spec does not fix.
- Renaming a term that FR-007 surfaces as a current candidate is a decision
  to make when it happens, not restated here.

## Edge cases

- An `ifcore:` term already names the concept and so does schema.org: the
  `ifcore:` term is reused, per FR-001.
- A concept that is a narrower kind of something a standard names: it is
  declared as a subclass of the standard class, not beside it, per
  FR-002.
- A proposed term whose only advantage is a more on-brand label: that is
  not a reason to declare it, per FR-003.
- A justified novel term coming up again at a later review: it is not
  re-justified, and it stands until a later Decision supersedes it, per
  FR-006.
- A review that finds a newly established equivalent for an existing
  term: it flags the term and renames nothing; any rename follows the
  spec, then ontology, then implementation order, per FR-008.

## Assumptions

- The established vocabularies a term is checked against stay published
  and stable enough to reference by IRI.
- A `Decision` individual can name the term it justifies, so a reviewer
  can find the justification from the term.
- Whoever reviews a change can recognize an established equivalent when
  one exists.

## Open questions

- None open.

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
- **SC-003**: The weekly audit lists, for any term lacking both an
  established mapping and a Decision, exactly that gap — no more, no
  fewer.
- **SC-004**: Every week a report exists in `spec-kit/audits/vocabulary-drift/`
  and has been mailed to the decision authority (FR-007).

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, schedules, hosting details)
      — those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
