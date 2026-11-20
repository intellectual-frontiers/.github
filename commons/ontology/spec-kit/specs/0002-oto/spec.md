# Feature Specification: The Operational Truth Ontology

**Spec ID:** 0002-oto
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The Operational Truth Ontology (OTO) of operationaltruth.org, stated once as typed TypeScript in the namespace `oto:`: its nine domains and their entities, its six invariants, its three pillars, five principles and four maturity levels, and, from the discipline of Operational Acceptance Testing (OAT), what an acceptance run expects and observes. "Operational Truth" is a trademark of Netspective Communications LLC; this ontology states the model its public site publishes and is built from that site alone, for no formal schema was available. `oto:` is the ontology only: the framework, its pillars and the discipline of OAT are terms inside it, and the prefix does not name the concept. The quality system's grade E5 (`ifqs:E5`, "a probe of the system in operation reports the requirement met") is the evidence grade of the same idea (commons 0021-ifqs).

## The ontology

- **FR-001**: The library MUST state the ontology `oto:` in `src/oto/` as typed values over the library `rdf`, with its namespace, its version and a description that names the Operational Truth Ontology, the trademark and the source (operationaltruth.org), and that says it was built from the published site alone.
- **FR-002**: The ontology MUST hold the nine domains of OTO as a code list of `oto:Domain`, each with its number, its name, the entities the source lists for it and the libraries of commons that realize it today (none, where none does).
- **FR-003**: The ontology MUST hold the six invariants of OTO as a code list of `oto:Invariant`: no orphan policies, no unowned responsibilities, no unenforced critical controls, no evidence without attribution, no authority without scope, and no compliance without traceability; each MUST say that its violation is a system error and not an audit finding.
- **FR-004**: The ontology MUST hold the three pillars, the five principles and the four maturity levels (numbered 1 to 4) of OTO as code lists, each member with the source's sentence.
- **FR-005**: The ontology MUST hold `oto:Alignment`, the measurable alignment between intent, structure, execution and evidence, as a class with the state `aligned`, `drifted` or `not-observed`; the three states are not on the source's site and come from the estate library (estate 0003-estate-logical) and Stolos (067-adopt, 117-adopted-in-status), where a machine never observed is waiting and never a failure.
- **FR-006**: The ontology MUST hold `oto:AcceptanceRun`, a run of Operational Acceptance Testing, as a specialization of `ifqs:TestRun`, with the outcome expected, the outcome observed and the dimension tested (stability of outcomes, acceptable ranges of behavior, trustworthiness, and failure modes and recovery).

## Audit and boundaries

- **FR-007**: Every class of the ontology MUST have a record of its basis (commons 0018-standards-first FR-003); a class no standard names MUST be unaligned with the candidates examined and the decision pending, and no IRI MUST be invented for a standard.
- **FR-008**: The ontology MUST import only `core`, `rdf` and the ontologies of this library by relative path.

## Acceptance scenarios

1. **Given** the ontology, **When** its domains are read, **Then** there are nine, numbered 1 to 9, per FR-002.
2. **Given** the ontology, **When** its invariants are read, **Then** there are six and each says its violation is a system error, per FR-003.
3. **Given** the pillars, principles and maturity levels, **When** they are read, **Then** there are three, five and four, the levels numbered 1 to 4, per FR-004.
4. **Given** the class of alignment, **When** its states are read, **Then** they are aligned, drifted and not-observed, per FR-005.
5. **Given** the class of an acceptance run, **When** it is read, **Then** it specializes the test run of IFQS and has the dimensions of OAT, per FR-006.
6. **Given** every class of the ontology, **When** the audit is read, **Then** each has a record and none carries an invented standard IRI, per FR-007.
7. **Given** the modules of the ontology, **When** their imports are read, **Then** none is outside `core`, `rdf` and the library, per FR-008.

## Out of scope

- The executable checks of the invariants over an estate and over grc's documents (the libraries that hold those models).
- The framework's reference architecture and its marketplace.

## Edge cases

- A domain that no library of commons realizes today lists none, per FR-002; it is a gap and is not hidden.
- The states of alignment are a choice of this repository and say so, per FR-005.

## Assumptions

- The public site is the source until a formal schema is published; where the site is silent, the ontology is silent.

## Open questions

- Whether a formal OTO schema exists beyond the website, and if so, where.

## Key entities

- **Domain** - one of the nine areas of the organization the ontology models.
- **Invariant** - a condition whose violation is a system error.
- **Alignment** - whether intent, structure, execution and evidence agree.
- **Acceptance run** - a run of Operational Acceptance Testing, with what it expected and what it observed.

## Success criteria

- **SC-001**: The terms of the website's ontology are in one typed module with their source named, and nothing the website does not say is stated as its own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
