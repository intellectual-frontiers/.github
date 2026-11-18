# Feature Specification: Governance

**Spec ID:** 0003-governance
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** Governance is the first layer of IFC data (0001-layers): a business domain and what must be true of its data, in terms that name no database. A domain is made of concepts (with attributes, the attributes that identify them, and relationships to other concepts), code lists, and annotations on any of them. The annotations are typed values of kinds that vocabularies define (documentation, requirements, privacy, security, ownership, quality and lifecycle), a vocabulary is also what an extension can add, and lint says, as data, where the domain falls short of its own vocabularies. Every element has an identity that follows its names, so that the logical and the physical layers can link back to it and the trace graph can be drawn from a concept to a column to a table.

## The model

- **FR-001**: A domain MUST be made of concepts, code lists and the annotations on them, in terms that name no database: a concept has a name, a definition, attributes (each a business datatype that is required, optional or many), the attributes, or the relationships, that identify it, and relationships to other concepts, each with a cardinality (one, optional or many). A concept identified by a relationship of cardinality one is a specialization: its identity is the identity of what it points to, as a person is a party. The constructors (`concept`, `attribute`, `relationship`, `codeList`) MUST be total, and `domain` MUST return the domain or all its errors, as values.
- **FR-002**: A business datatype MUST be one case of a tagged union (text, integer, decimal, boolean, date, instant, identifier, code, structured, binary) that a `switch` matches exhaustively; `code` names a code list; no case names a type of a database.
- **FR-003**: The attribute names, the relationship names and the identifying members of a concept MUST be literal types, so that an identifying attribute or relationship the concept does not have does not compile.
- **FR-004**: `domain` MUST find, and return together, each name that is not lower camel case (`[a-z][a-zA-Z0-9]*`, 0005-naming FR-001), each duplicate name (two concepts, two code lists, or an attribute and a relationship of a concept with one name), each relationship to a concept that is not in the domain, each attribute of a code list that is not in the domain, each concept with no identifying member, each identifying attribute that is not required and each identifying relationship whose cardinality is not one, and each annotation on an element it may not be on.

## Identity and the trace graph

- **FR-005**: Every element MUST have an identity made of its names and no more: the domain `d`, a concept `d/c`, an attribute `d/c.a`, a relationship `d/c>r`, a code list `d/list:l` and a code `d/list:l.k`; `elementsOf` MUST list every element, in a fixed order (the domain, then each concept with its attributes and relationships, then each code list with its codes), with its identity, kind, name, definition, parent and annotations.
- **FR-006**: `traceGraph` MUST give the elements as nodes and as edges (`contains`, from an element to what it holds; `identifies`, from a concept to its identifying attributes and relationships; `references`, from a relationship to the concept it points to and from an attribute of a code list to the list), as data.

## Annotations, vocabularies and lint

- **FR-007**: An annotation kind MUST be a typed, named value (`annotationKind<T>(name, about)`) that says which kinds of element it may be on; `annotate(kind, value)` MUST type the value by the kind, so that a value of another type does not compile, and `annotationsOf(element, kind)` MUST read the annotations of a kind back, typed.
- **FR-008**: A vocabulary MUST be a value of annotation kinds and lint rules; the contribution point `governance.vocabulary` of the engine MUST let an extension add one, and `vocabulariesFrom` MUST give the vocabularies of a composition in its order.
- **FR-009**: `lint` MUST return its findings as data (the rule, the element's identity, one sentence and a severity), those of the core rules first and then those of each vocabulary in the order given; the core rules find an element with no definition and an annotation of a kind that no vocabulary given has.

## The vocabularies

- **FR-010**: A documentation vocabulary (`docs`) MUST give the kinds `synonym`, `example` and `note`, which say what a definition does not.
- **FR-011**: A requirements vocabulary MUST give the kind `requirements.cites`, a list of citations in the form `NNNN-slug FR-nnn`; `requirementsOf` MUST give, for each citation of a domain, the elements that cite it; its rules find a concept that cites none (a warning) and a citation that is not in the form (an error).
- **FR-012**: A privacy vocabulary MUST give the kind `privacy.personal` for a concept or an attribute that holds personal data, which MAY name a category of the Personal Data extension of the W3C Data Privacy Vocabulary (DPV-PD) by its term and the purposes it is held for; `dpvClassOf` MUST give a category's class in DPV (personal data, sensitive personal data or a special category) and `dpvIri` its IRI; its rules find personal data with no category and with no purpose (warnings).
- **FR-013**: The terms of DPV-PD MUST be the vocabulary's own: `tools/generate-dpv.ts` MUST write `governance/vocabularies/dpv.auto.ts` from the vocabulary's CSV at the pinned version, which it MUST refuse where its SHA-256 is not the pinned one, and its `--check` MUST fail where the file is not what the CSV makes; no term is written by hand.
- **FR-014**: A security vocabulary MUST give the kinds `security.classification` (public, internal, confidential or restricted), `security.access` (the roles that may read and the roles that may write), `security.scope` (an attribute that partitions a concept's data, which access is filtered by) and `security.mask` (redact, hash or partial); its rules find a concept with more than one scope (an error), restricted data with no access (a warning), and personal data that is not classified confidential or restricted (a warning).
- **FR-015**: An ownership vocabulary MUST give the kinds `ownership.owner` and `ownership.steward`, roles that answer for a domain, a concept or a code list; its rule finds a concept with no owner where the domain has none (a warning).
- **FR-016**: A quality and lifecycle vocabulary MUST give the kinds `quality.pattern`, `quality.range`, `quality.retention` and `quality.deprecated`; `quality.default` (the value an attribute takes where none is given), `quality.unique` (attributes or relationships of a concept that are unique together), `quality.differs` (a named rule that two attributes or relationships of a concept must differ), `quality.audited` (a domain or a concept keeps who made, changed and removed each record and when, and removes by marking or for good) and `quality.openness` (a code list is open, the business adds codes of its own, or closed, only the model changes it); its rules find a pattern that is not a regular expression, a range whose minimum is above its maximum, a retention that is not a positive number of days, a default that does not fit its datatype or is not a code of its list, and a member named in `unique` or `differs` that the concept lacks (each an error), and an element deprecated with no replacement (a warning).
- **FR-017**: A usage vocabulary MUST give the kind `usage.lookup`, the attributes or relationships of a concept by which its records are usually found; its rule finds a member the concept lacks (an error).

## Out of scope

- What becomes of governance in a logical or a physical schema: 0004 and later specifications.
- Renaming an element and keeping its identity: an identity follows its names (OQ-1).
- A graphical or textual syntax for a domain: a domain is TypeScript.

## Edge cases

- `concept("Party", ...)` and `concept("party_role", ...)`: `domain` returns an invalid name, a capital first and an underscore, per FR-004.
- Two concepts named `party`: a duplicate, per FR-004.
- A concept with an attribute and a relationship both named `kind`: a duplicate, per FR-004.
- A relationship to a concept not in the domain's list: unresolved, per FR-004.
- A relationship given as a thunk (`() => party`) so that two concepts may refer to each other: resolved by `domain`, per FR-001 and FR-004.
- A concept identified by an optional attribute, or by none: returned, per FR-004.
- A `security.scope` on a concept: refused (it is for an attribute), per FR-004 and FR-014.
- An annotation of a kind no vocabulary given has: a finding, not an error, per FR-009.
- `identifiedBy: ["nope"]` where the concept has no attribute `nope`: does not compile, per FR-003.
- A DPV CSV whose SHA-256 is not the pinned one: the generator refuses and writes nothing, per FR-013.
- A person identified by its relationship to a party of cardinality one: allowed, a specialization; identified by a relationship of cardinality many: returned, per FR-004.
- A `quality.unique` naming `party` and `kind` where the concept has that relationship and that attribute: allowed; naming `nope`: an error, per FR-016.
- A `quality.default` of `"yes"` on a boolean attribute, or of `"x"` on a code attribute whose list has no such code: an error, per FR-016.
- A personal attribute with no category: a warning, per FR-012; with a category that is not a term of DPV-PD: does not compile, per FR-012.

## Assumptions

- An identity is the path of names, so a renamed element is a new element; a way to carry identity across a rename (`was`) is not built (OQ-1).
- Indexes, views, routines and the names of constraints are not governance: a lookup says how data is found and a later layer chooses what serves it (0001-layers FR-002, FR-003).
- The vocabularies of this specification are the library's own starting set, held in `governance/vocabularies/`; a project adds others by extension (FR-008).
- DPV 2.3 is the version pinned, and its terms are used under the vocabulary's licence (CC BY 4.0), with the source and its digest in the generated file.

## Open questions

- **OQ-1**: How an element keeps its identity across a rename, and what the trace graph says of a retired element.

## Key entities

- **Domain**, **Concept**, **Attribute**, **Relationship**, **CodeList** - the elements of the model.
- **ElementId** - the identity of an element, from its names.
- **Annotation** and **AnnotationKind** - a typed value of a kind a vocabulary defines, on an element.
- **Vocabulary** - annotation kinds and lint rules.
- **Finding** - what lint says, as data.

## Success criteria

- **SC-001**: A domain written once says what its data is, who answers for it, how private and how secure it is, and what requirement it serves, in one typed value that the next layers read.
- **SC-002**: A mistake in a domain is returned as data that names the element, and never as an exception.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
