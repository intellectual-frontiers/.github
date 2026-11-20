# Feature Specification: The ontologies of commons

**Spec ID:** 0001-ontologies
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The ontologies of Intellectual Frontiers Commons (Mizan, IFCCM, IFQS, IFR, the audit of packaging and the software supply chain) are stated once as typed TypeScript and read by Mizan, by the quality system, by the generators and by the repository's own checks. This library is where they are, so that each reads them by package name.

## The ontologies

- **FR-001**: The library `ontology` MUST hold the ontologies of commons as typed values over the library `rdf`: Mizan (`mz`), IFCCM, IFQS, IFR, the audit of packaging and the software supply chain, each a folder of `src/` with a `mod.ts`, and the data of the standards they cite.
- **FR-002**: Every class, property and code list of an ontology MUST be stated once in its module, and the generators of Turtle, RDF/XML, SHACL and JSON Schema MUST be made from those values, not from a copy (commons 0012-ontology).
- **FR-003**: The ontologies MUST import only `core` and `rdf` by package name and each other by relative path, so that an ontology is read without a harness.
- **FR-004**: The library MUST be published to npm as compiled modules with their declarations, one entry for the package (`.`, which names the ontologies as namespaces) and one for each module.

## Acceptance scenarios

1. **Given** the ontology of IFCCM, **When** a test reads its classes and properties, **Then** each is a value of the library, per FR-001 and FR-002.
2. **Given** the modules of the library, **When** their imports are read, **Then** none is outside `core`, `rdf` and the library itself, per FR-003.

## Out of scope

- The generators of the ontologies and the register (`libraries`), and the decisions about kept-unaligned terms, which are the repository's.

## Edge cases

- An ontology that extends another (IFR extends IFQS, which extends Mizan's) imports it by relative path, per FR-003.

## Assumptions

- The decision to publish the ontologies as one library is 0032-lifting-libraries FR-008: the ontology of IFR extends the one of IFQS, which extends Mizan's, so no one of them could be a file of the library that uses it without a cycle.

## Open questions

- None.

## Key entities

- **Ontology** - a set of classes, properties and code lists stated as TypeScript values.

## Success criteria

- **SC-001**: Every library of commons reads an ontology of commons by package name.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
