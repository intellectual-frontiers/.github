# Feature Specification: The Boundaries ontology

**Spec ID:** 0005-boundary-terms
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The terms that commons 0045-boundaries uses, stated once as typed TypeScript in the namespace `bnd:`: a boundary and the kinds of boundary a regime defines, the realm it is not, the enclave, the interconnection, the external system and the inheritance, the categorization and its impacts, the disposition of an asset, the categories of the CMMC rule, the roles of parties in the processing of personal data, the jurisdiction and the classes of data. The definitions are in our own words; the sources of each regime's definitions and what was not read are in commons 0045-boundaries `definitions.md`.

## Requirements

- **FR-001**: The library MUST state the ontology `bnd:` in `src/boundary/` as typed values over the library `rdf`, with the namespace `https://www.intellectualfrontiers.com/ontology/boundary#`, the version `1.0.0` with its version IRI, and a description that names the boundary, the dispositions and the interconnections.
- **FR-002**: The ontology MUST hold the classes `bnd:Boundary`, `bnd:Realm`, `bnd:Enclave`, `bnd:Interconnection`, `bnd:ExternalSystem`, `bnd:Inheritance`, `bnd:ProcessingActivity`, `bnd:Categorization`, `bnd:Jurisdiction`, `bnd:BoundaryKind`, `bnd:Disposition`, `bnd:Impact`, `bnd:CmmcAssetCategory`, `bnd:PartyRole` and `bnd:DataClass`, each with a label and a definition, the definition of a boundary saying that it is not a realm and that of a realm saying that it is where assets are found, and the properties `bnd:boundaryId`, `bnd:boundaryKind`, `bnd:categorizedAs` and `bnd:residentIn`.
- **FR-003**: The ontology MUST hold these closed code lists, each member with a label and a definition: ten kinds of boundary (authorization boundary, CUI environment, ePHI environment, cardholder data environment, SOC 2 system, privacy boundary, organizational boundary, network zone, trust boundary, engagement scope), five dispositions (in scope, inherited, external, out of scope, undecided), three impacts (low, moderate, high), five categories of asset of the CMMC rule (CUI asset, security protection asset, contractor risk managed asset, specialized asset, out-of-scope asset), two roles of a party in the processing of personal data (controller, processor) and twelve classes of data; the member names MUST be unique across the lists, and neither a realm nor a disposition MUST be a kind of boundary.
- **FR-004**: Every class of the ontology MUST have a record of its basis (commons 0018-standards-first FR-003), each specializing a term of PROV-O or SKOS that the library `rdf` holds, none `unaligned`; no IRI MUST be written that was not read; the modules MUST import only `core`, `rdf` and the ontology library.

## Acceptance scenarios

1. **Given** the ontology, **When** its namespace and version are read, **Then** they are `bnd:` and 1.0.0 with the version IRI, per FR-001.
2. **Given** the ontology, **When** its classes and properties are read, **Then** the fifteen classes and four properties are there with definitions, and a boundary is not a realm, per FR-002.
3. **Given** the code lists, **When** their members are counted, **Then** there are 10 kinds, 5 dispositions, 3 impacts, 5 categories, 2 roles and 12 classes of data, with no member name used twice, per FR-003.
4. **Given** every class, **When** the audit is read, **Then** each has a record that specializes a PROV-O or SKOS term, per FR-004.

## Out of scope

- The role words of each privacy regime and the legal bases of each: they are data of the estate library (commons 0045-boundaries FR-003), not terms of the ontology.
- A mapping of the roles to the Data Privacy Vocabulary: its IRIs were not read here.

## Edge cases

- The kind `privacy` is one kind with a regime, not one kind for each law (commons 0045-boundaries FR-003).
- The `bnd:Enclave` is a class of its own because standards name it; as a kind of boundary it is a network zone with one security domain, per FR-002.

## Assumptions

- The names of the kinds, dispositions and impacts are the ones of the library `estate` (estate 0010-estate-boundaries), and the ontology follows it.

## Open questions

- None.

## Key entities

- **Boundary** - the accountability scope of one kind that a regime defines.
- **Realm** - where assets are found; not a boundary.
- **Disposition** - the decision about one asset in one boundary.
- **Interconnection**, **External system**, **Inheritance** - what crosses a boundary and what it relies on.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Standards first (commons 0018-standards-first, read in this repository) | A term of an ontology of commons rests on a standard's term where one names it (`specializes`) and is `unaligned` only by a Decision of the owner; no IRI is written that was not read | The specification itself |
| PROV-O and SKOS, the terms the library `rdf` holds (read 2026-11-25, see 0003-planning-terms) | A boundary is a `prov:Entity`; each code list is a `skos:Concept` | The library `rdf`, as for the Planning ontology |
| NIST SP 800-37, SP 800-18, FIPS 199, 32 CFR 170.19, 45 CFR Parts 160 and 164, the PCI SSC glossary, GDPR | The meanings of the terms, in our own words | commons 0045-boundaries `definitions.md`; none publishes a vocabulary with IRIs that was read |

## Success criteria

- **SC-001**: Every requirement of 0005-boundary-terms is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
