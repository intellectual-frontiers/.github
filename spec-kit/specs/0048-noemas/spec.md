# Feature Specification: Noemas: reflections of what is conceived

**Spec ID:** 0048-noemas
**Status:** Draft

**Input:** How the Eidolon represents an abstract intellectual construct. A Noema
is the third kind of digital reflection (0047-digital-reflections): where an
Eidolon reflects what exists and an Ergon what is created, a Noema reflects
what is conceived: a concept, a hypothesis, a theory, a principle, a
framework, a methodology, a research question, a finding, an agenda. Such an
idea may be uncertain, contested or false, so this spec adds to the shared
model only what an idea needs: a subtype, the claims it states, an epistemic
state assessed over time and kept apart from any publication or lifecycle
state, evidence for and against it, relationships to other ideas, to the made
things that carry it out and to the people and organizations that engage with
it, an optional and evidence-bound path toward commercial use, the boundary
with intellectual property, and the rules by which an AI agent may propose
but never promote. The terms live in the ontology (`ifcore:Noema`,
`ifcore:IntellectualConstruct` and the schemes that follow it).

## The Noema

- **FR-001**: A Noema MUST reflect an abstract intellectual construct that is
  conceived or understood: an abstract concept, hypothesis, theory, research
  question, methodology, principle, framework or other idea. Its subject is
  neither an independently existing real-world entity nor a deliberately
  built operational solution. Its record MUST state the idea
  (`skos:definition`): what it means.
- **FR-002**: A Noema MUST use the mechanisms of `ifcore:DigitalReflection`
  (0047-digital-reflections) for identity, the subject (`ifcore:reflects`),
  audience, stewardship, assertions, relationships, provenance, review and
  history, and MUST NOT define a parallel mechanism for any of them.
- **FR-003**: A Noema MUST be told apart from the representation that holds it.
  An idea kept in a document, a database row or a software object remains a
  Noema, and the document, the row or the object is neither the Noema nor an
  Ergon (0047-digital-reflections FR-037). A research note or a paper is the
  document that sets out an idea; the idea is the subject.
- **FR-004**: A Noema's record MUST be able to carry, with the mechanisms of
  this spec, what the idea is and means, what motivated it, what it assumes,
  what supports and contradicts it, what would falsify or weaken it, what
  follows if it is correct, what could be built or tried from it, and how
  understanding of it has changed.

## Kinds of idea

- **FR-005**: The kind of idea MUST be a subtype, a concept of
  `ifcore:NoemaTypeScheme` carried by the subject as `dcterms:type`. The
  scheme MUST include concept, hypothesis, theory, principle, framework,
  methodology, research question, research finding, research agenda,
  taxonomy, ontology, design pattern and business model. A subject MAY carry
  several subtypes. A new subtype MUST be a new concept and not a schema
  change. A subject typed `ifcore:IntellectualConstruct` MUST carry at least
  one, and every `dcterms:type` it carries MUST be one.
- **FR-006**: A Noema that contains other ideas (a framework of hypotheses,
  principles and methodologies; an agenda of questions) MUST relate them by
  `dcterms:hasPart`. A contained idea is a Noema of its own, with its own
  state and evidence.
- **FR-007**: An abstract methodology MUST be a Noema, and a deployed workflow
  that carries it out MUST be an Ergon related to it by `operationalizes`. A
  made thing that realizes an idea in its design MUST be related by
  `implements`, and an idea that shaped a made thing's design by
  `informsDesignOf`. Neither stands for the other.

## Claims

- **FR-008**: A claim, a statement that something is the case, MUST be a
  `schema:Claim` of kind `other` and MUST NOT be given a reflection. A Noema
  MUST relate the claims it puts forward by `states`. A subject of subtype
  hypothesis or research finding MUST state at least one claim. Stating a
  claim is not asserting that it is true.
- **FR-009**: A claim, an assertion and a Noema MUST be kept as three things.
  A Noema is the construct and its history. A claim is one statement that
  one or several Noemas state, or that a legal instrument, such as a patent,
  contains. An assertion is what a record says about its subject, with its
  label, source and review (0047-digital-reflections FR-022). A patent claim
  is a claim of its instrument and is not the idea the patent describes.
- **FR-010**: Whether a claim holds MUST be judged on the Noema that states it,
  by evidence relationships and assessments; evidence about one claim of a
  Noema MAY name the claim by `ifcore:concerning`. A claim MUST NOT carry an
  epistemic state, a review state or evidence of its own.

## Epistemic state

- **FR-011**: A Noema's epistemic state MUST be one of the concepts of
  `ifcore:EpistemicStateScheme`: proposed, under investigation, supported,
  contested, falsified, superseded. A Noema with no accepted assessment is
  proposed.
- **FR-012**: A state MUST be assessed, not stored on the record: an
  `ifcore:EpistemicAssessment` about the Noema's subject, with one
  `ifcore:assessedState`, the date it holds from (`schema:validFrom`) and a
  label. The current state on a date MUST be that of the latest accepted
  assessment in force. A candidate, reviewed or rejected assessment MUST NOT
  change it. An assessment of a subject whose kind is not Noema MUST be
  refused.
- **FR-013**: Epistemic state MUST be kept apart from editorial, publication,
  approval and operational lifecycle states (`ifcore:WorkLifecycleStage`
  among them). No lifecycle concept MUST be an epistemic state, and none MUST
  be read from or written into the other. A published theory MAY be
  contested, and an approved hypothesis MAY be falsified.
- **FR-014**: There MUST be no state for proven or true. A supported Noema is
  one the identified evidence favors, and it can still be challenged.
- **FR-015**: An assessment of supported, contested or falsified MUST name its
  basis (`dcterms:source`). An assessment of superseded MUST be matched by a
  `supersedes` relationship to the Noema from its successor.
- **FR-016**: Evidence MUST be represented as relationships (`supports`,
  `contradicts`, `challenges`, `tests`, `generatesEvidenceFor`,
  `providesEvidenceFor`) that each carry their own source, label,
  confidence and dates (0047-digital-reflections FR-019), and not as one
  unexplained confidence score. Supporting and contradicting evidence MUST be
  able to coexist for one Noema, and neither MUST remove the other. That a
  Noema is contested is assessed, not computed.
- **FR-017**: The assumptions, testable predictions, falsification criteria,
  experimental designs, known limitations, open questions, counterarguments
  and practical consequences of an idea MUST be assertions about its subject
  with an `ifcore:aspect` of `ifcore:AspectScheme`, so that each has a label,
  a source and a review state. A hypothesis SHOULD have a falsification
  criterion; the check MUST warn when it has none.
- **FR-018**: A revision or a retraction MUST be an assertion with that aspect,
  derived (`prov:wasDerivedFrom`) from the assertion it changes. The assertion
  revised or retracted MUST stay.
- **FR-019**: A falsified or superseded Noema MUST keep its identifier, its
  record, its evidence, its relationships and its history, and MUST NOT be
  deleted or have its identifier reused. A relationship to something built on
  it MUST be closed by `schema:validThrough` and not removed.

## AI-proposed knowledge

- **FR-020**: A Noema record, an assertion or a relationship proposed by an
  AI agent, by extraction or by inference, MUST be attributed to the agent
  (`prov:wasAttributedTo`) and MUST be a candidate until a person reviews it
  (0047-digital-reflections FR-038). Only accepted records MUST count toward
  a Noema's current state or its research stage. An agent MUST NOT be named
  as a reviewer.

## Relationships

- **FR-021**: The relationship scheme (0047-digital-reflections FR-017) MUST
  also define, between ideas: `buildsOn`, `refines`, `generalizes`,
  `specializes`, `supersedes`, `supports`, `contradicts`, `challenges`,
  `tests`, `explains`, `motivatedBy`; between an idea and a claim or a
  document: `states`, `describes`; between an idea and a made thing:
  `informsDesignOf`, `operationalizes`, `generatesEvidenceFor`; and between
  an idea and the people and organizations that engage with it: `proposes`,
  `researches`, `adopts`, `providesEvidenceFor`. `dependsOn`, `evolvesFrom`
  and `implements` MUST also accept a Noema.
- **FR-022**: A type MUST NOT be added that duplicates one the scheme has or one
  that Dublin Core or PROV already names. How an idea was derived from
  another is `buildsOn` or `evolvesFrom`; how a record was derived from
  another record is `prov:wasDerivedFrom`, which is not a relationship type.
- **FR-023**: Proposing, researching, adopting, challenging, citing,
  describing, implementing, operationalizing or informing the design of an
  idea MUST NOT be read as owning it, inventing it, having it assigned or
  licensing it, or holding any right in it.
- **FR-024**: Each type MUST declare the kinds its ends may have. `owns`,
  `assignsTo` and `licensesTo` MUST NOT end at a Noema: rights are held in
  instruments and things, not in ideas. A type MUST be refused between ends
  whose resolved kinds it does not allow.

## Toward commercial use

- **FR-025**: The path from an observation to a compounding advantage MUST be
  derived from the records, never stored or required: observation,
  conception, investigation, relevance, experimentation, operationalization,
  validation and compounding. A stage is reached only by accepted records,
  the candidates are listed apart, and a Noema MAY reach none beyond
  conception. Commercialization is one possible consequence of research and
  not a condition of a Noema's existence.
- **FR-026**: The optional commercial parts of an idea (the problem addressed,
  intended beneficiaries, potential buyers, relevant existing workflows,
  candidate product wedges, commercial hypotheses, demand evidence,
  competing approaches, adoption obstacles, rights and licensing
  considerations, potential sources of Native Alpha) MUST be assertions with
  an aspect of `ifcore:AspectScheme`, and so labelled, sourced and reviewed.
- **FR-027**: Demand evidence MUST name the identifiable Eidolons it comes from
  (`ifcore:demonstratedBy`, each a subject whose kind is Eidolon), MUST be
  labelled observation or evidence, and MUST be accepted before it reaches
  the validation stage. A commercial hypothesis MUST NOT be labelled
  observation or evidence.
- **FR-028**: Novelty, citations, patentability, technical elegance and
  interest MUST NOT be recorded or counted as demand. Intellectual interest
  and demonstrated commercial usefulness are different assertions.

## Intellectual property

- **FR-029**: A patent, a patent application, a publication, an agreement, a
  claim, a legal right and an evidence artifact MUST be modeled as the
  existing types for them (0007-work-and-assets) and be of kind `other`; none
  MUST be made a Noema. A Noema describes the underlying construct. An
  instrument that sets it out MUST be related to it by `describes`.
- **FR-030**: None of the following MUST be inferred, and the ontology MUST
  hold no relationship from which it could be: that inventorship implies
  ownership; that a patent's issuance implies it is enforceable; that
  ownership implies freedom to operate; that publication implies the public
  domain; that an idea's existence establishes patentability; that a product
  implementing an idea holds the rights to all intellectual property around
  it. A statement about any of them is an assertion with its own source.

## Research operations

- **FR-031**: An AI agent MAY propose Noemas, relationships, assertions and
  assessments, each as FR-020 requires, and MAY extract candidates from
  documents, find evidence for and against, propose experiments and
  falsification tests, connect ideas to Eidolons and to possible Ergons, and
  summarize with sources. It MUST NOT change a review state, a state of an
  assessment already accepted, or a record that a person accepted.
- **FR-032**: The repository MUST give an agent or a person deterministic
  reads, with no AI behind them: `agora reflection list` (the reflections of
  a kind, filtered by epistemic state or review state, the candidates
  awaiting review, the possible duplicates, and the audit of FR-035) and
  `agora reflection show` (one reflection, with its current state, claims,
  evidence for and against, assumptions, falsifiers, open questions, research
  stage and reasons to reexamine it, each with its source).
- **FR-033**: Two Noema subjects that share a normalized label MUST be reported
  as possible duplicates, to be merged or told apart by a person. They MUST
  NOT be merged by a tool.
- **FR-034**: A Noema MUST be reported as warranting another look when
  contradicting or challenging evidence became valid after its latest accepted
  assessment, when an assessment of it awaits review, or when a hypothesis
  has no falsification criterion.

## Compatibility and migration

- **FR-035**: Eidolon and Ergon records, identifiers, relationship types, rules
  and checks MUST keep working. The change MUST be additive except that
  abstract subjects, once kind `other`, are now kind `noema`, and that
  `dependsOn`, `evolvesFrom`, `implements` and `inventorOf` accept a Noema. A
  classification audit MUST list, for any repository, each resolved kind with
  its counts by type, each reflection whose kind disagrees with its subject's,
  and the subjects whose kind changed to `noema`. It MUST change nothing.
- **FR-036**: A record of an abstract subject made as an Eidolon or an Ergon
  MUST be reported as needing review and MUST NOT be reclassified by a tool.
  A person's reclassification MUST follow 0047-digital-reflections FR-032: a
  new Noema record of the same subject, derived from the old one, which stays
  and points to it. A change to rules and a move of records MUST be separate
  commits (0047-digital-reflections FR-033).
- **FR-037**: A further kind of reflection MUST be addable without changing
  the three: a subclass of `ifcore:DigitalReflection`, a concept of
  `ifcore:ReflectionKindScheme` that names it by `ifcore:reflectionClass`, and
  its rules. The checks MUST read the kinds from the ontology.

## Checking

- **FR-038**: `agora check ontology` MUST fail on a Noema without a statement
  of the idea; an intellectual construct without a valid subtype; a hypothesis
  or finding that states no claim; a reflection of a claim; an assessment
  without one state of the scheme, without a date, without a basis where
  FR-015 requires one, of a subject that is not a Noema, or of superseded with
  no successor; an epistemic state that is a lifecycle or proven state; an
  aspect that is not one of the scheme, a revision or retraction derived from
  nothing, demand evidence that fails FR-027 and a commercial hypothesis
  labelled as evidence; a review that breaks 0047-digital-reflections FR-038;
  and a relationship type between ends it does not allow. It MUST warn on a
  hypothesis without a falsification criterion and on possible duplicates. It
  MUST also check the worked examples beside this spec.

## Out of scope

- How an agent finds candidates in documents; that is a prompt a person
  copies, and no command here calls an AI.
- The search index, ranking and retrieval of Noemas; this spec fixes the
  identifiers, kinds and types a retrieval convention keys on.
- Which of a repository's existing subjects are given a Noema, and the
  subtype of each; that is a person's review, subject by subject, under
  FR-036.

## Edge cases

- A framework that contains a hypothesis, a principle and a methodology: four
  Noemas, the framework holding the others by `dcterms:hasPart`, per FR-005
  and FR-006.
- A methodology and the workflow that carries it out: the methodology is a
  Noema and the workflow an Ergon, related by `operationalizes`, per FR-007.
- A theory published in a book and still contested: its publication stage and
  its epistemic state are two facts, per FR-013.
- One claim stated by two ideas, or a patent claim that reads like a research
  claim: one `schema:Claim` each, stated by the idea or contained in the
  instrument, never a Noema, per FR-008 and FR-009.
- Evidence for and evidence against arrive for one hypothesis: both stay, and
  the state changes only when a person accepts an assessment, per FR-016 and
  FR-012.
- An AI agent reads a late counterexample and assesses a principle contested:
  that is a candidate and the state is unchanged, but the principle is flagged
  for another look, per FR-020 and FR-034.
- A hypothesis is falsified and a product was built on it: the Noema, its
  evidence and the relationship stay, the relationship closed by its end date,
  and a successor may build on it, per FR-019.
- An idea cited a thousand times and patentable: neither is demand, per FR-028.
- A patent that describes an idea and is owned by a company whose employee
  invented it: the invention is a Noema, the patent is kind `other`, and
  `inventorOf`, `owns` and `describes` are three relationships, per FR-029 and
  FR-030.
- A company adopts a principle and buys a product that implements it: `adopts`
  and `purchases` are two relationships, the first to a Noema and the second to
  an Ergon, per FR-023.
- An idea with no commercial use: it has no commercial aspects and needs none,
  per FR-025 and FR-026.
- Two research notes that define the same term: reported as possible
  duplicates and left for a person, per FR-033.

## Assumptions

- A person reviews candidates, and a reviewer's name on a record is a person's
  accountability for it (0047-digital-reflections FR-038).
- The subtype and the kind of an existing subject can be stated by a person
  from its definition, which a tool can only suggest.
- A claim can be put in words that two ideas can share.

## Open questions

- **OQ-1**: Whether a claim that several Noemas state differently needs its own
  state when they disagree about it. FR-010 holds the state on the Noema; a
  claim shared across Noemas is judged separately on each.
- **OQ-2**: Which of the about fifteen hundred concepts, notes and named tools
  of the repositories become Noema records, and with which subtype. FR-036
  leaves it to review; none is made today.
- **OQ-3**: Whether a note or a paper is a Noema of the finding it sets out or
  only a document that describes one. The rules treat `ifcore:Note` as a
  Noema; a paper is more often a document of kind `other` that `describes`
  the finding.
- **OQ-4**: Whether the research stage (FR-025) should also be a recorded
  decision at each stage, as a Substantial Work's lifecycle is
  (0007-work-and-assets FR-018), or stay derived.
- **OQ-5**: Whether the label set for an epistemic assessment needs a judgment
  label. An assessment is an inference a person made; the closed set
  (0017-spoken-and-research-works FR-021) has none.

## Key entities

- **A Noema** (`ifcore:Noema`) - a digital reflection of what is conceived.
- **An intellectual construct** (`ifcore:IntellectualConstruct`) - the class of
  subjects a Noema reflects, with one or more subtypes.
- **A subtype** - a concept of `ifcore:NoemaTypeScheme`, carried by
  `dcterms:type`.
- **A claim** (`schema:Claim`) - a statement a Noema states; not a Noema.
- **An epistemic assessment** (`ifcore:EpistemicAssessment`) - a dated, sourced
  judgment of how well an idea stands.
- **An epistemic state** - one of proposed, under investigation, supported,
  contested, falsified, superseded.
- **A review state** - candidate, reviewed, accepted or rejected
  (0047-digital-reflections FR-038).
- **An aspect** - what an assertion about an idea is: an assumption, a
  falsification criterion, demand evidence, and the rest of
  `ifcore:AspectScheme`.
- **The research stage** - how far an idea has travelled, derived from the
  accepted records.

## Success criteria

- **SC-001**: Eidolon, Ergon and Noema are three distinct kinds with one
  parent, and an abstract idea can be represented without becoming a product or
  an organization.
- **SC-002**: Supporting and contradicting evidence coexist for one Noema, and
  its epistemic state differs from its publication state.
- **SC-003**: A falsified hypothesis keeps its identity, evidence, history and
  relationships, and its state can be read at any earlier date.
- **SC-004**: An AI-proposed record is a candidate on every read until a person
  accepts it.
- **SC-005**: An idea can be traced from an observation to a made thing and to
  demand from named Eidolons, and a stage is not reached by a guess, a
  citation or a candidate.
- **SC-006**: No right is derived from an intellectual relationship.
- **SC-007**: Eidolon and Ergon records and checks work as before.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
