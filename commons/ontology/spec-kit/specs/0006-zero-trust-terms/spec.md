# Feature Specification: The Zero trust ontology

**Spec ID:** 0006-zero-trust-terms
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The terms that commons 0047-zero-trust uses, stated once as typed TypeScript in the namespace `zt:`: the architecture, the policy decision point with its engine and administrator, the policy enforcement point, the protect surface, the access decision and the posture signals it used, implicit trust, the zero trust activity, the maturity stage, and the tenets, pillars and sources of input that the primary sources name. The definitions are in our own words; the sources and what was not read are in commons 0047-zero-trust `definitions.md`.

## Requirements

- **FR-001**: The library MUST state the ontology `zt:` in `src/zerotrust/` as typed values over the library `rdf`, with the namespace `https://www.intellectualfrontiers.com/ontology/zerotrust#`, the version `1.0.0` with its version IRI, and a description that names the architecture, the access decision and implicit trust.
- **FR-002**: The ontology MUST hold the classes `zt:ZeroTrustArchitecture`, `zt:PolicyDecisionPoint`, `zt:PolicyEngine`, `zt:PolicyAdministrator`, `zt:PolicyEnforcementPoint`, `zt:ProtectSurface`, `zt:AccessDecision`, `zt:PostureSignal`, `zt:ImplicitTrust`, `zt:Activity`, `zt:MaturityStage`, `zt:Pillar`, `zt:Tenet` and `zt:DataSource`, each with a label and a definition, and the properties `zt:decidedBy`, `zt:enforcedAt`, `zt:onSurface` and `zt:policyHash`; the definition of an access decision MUST say that it is signed and names the policy by hash.
- **FR-003**: The ontology MUST hold these closed code lists, each member with a label and a definition: seven tenets, eight pillars (five areas and three themes) and eight sources of input; the member names MUST be unique across the lists. It MUST hold no member of the classes `zt:MaturityStage` and `zt:Activity`, and no name of a maturity stage or an activity, because the models that name them were not read.
- **FR-004**: Every class of the ontology MUST have a record of its basis (commons 0018-standards-first FR-003), each specializing a term of PROV-O or SKOS that the library `rdf` holds, none `unaligned`; no IRI MUST be written that was not read; the modules MUST import only `core`, `rdf` and the ontology library.

## Acceptance scenarios

1. **Given** the ontology, **When** its namespace and version are read, **Then** they are `zt:` and 1.0.0 with the version IRI, per FR-001.
2. **Given** the ontology, **When** its classes and properties are read, **Then** the fourteen classes and four properties are there with definitions, per FR-002.
3. **Given** the code lists, **When** their members are counted, **Then** there are 7 tenets, 8 pillars and 8 sources of input, with no member name used twice and no stage or activity, per FR-003.
4. **Given** every class, **When** the audit is read, **Then** each has a record that specializes a PROV-O or SKOS term, per FR-004.

## Out of scope

- The names of the maturity stages are in the catalog `catalog-zero-trust` (the model of the Cybersecurity and Infrastructure Security Agency, read), not in the ontology; the activities of the maturity models and the seven pillars of the Department of Defense are written when their sources are read (commons 0047-zero-trust FR-022).

## Edge cases

- Per FR-002, the word `trust` is not a class: the record of a decision is an access decision, and the enrollment trust and the boundary kind keep their own names (commons 0047-zero-trust `definitions.md`, section 7, and FR-002).

## Assumptions

- The pillars are the five areas and three themes that the federal strategy names from the maturity model of the Cybersecurity and Infrastructure Security Agency.

## Open questions

- None.

## Key entities

- **Access decision** - the signed record of one decision about one request.
- **Protect surface** - the smallest part of an estate that one access policy names.
- **Implicit trust** - access allowed without a decision.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Standards first (commons 0018-standards-first, read in this repository) | A term rests on a standard's term where one names it and is `unaligned` only by a Decision of the owner; no IRI is written that was not read | The specification itself |
| PROV-O and SKOS, the terms the library `rdf` holds (read 2026-11-25, see 0003-planning-terms) | A class is a `prov:Entity`; each code list is a `skos:Concept` | The library `rdf` |
| NIST SP 800-207, SP 800-207A, SP 1800-35 and OMB M-22-09 | The meanings of the terms, the seven tenets, the eight sources of input and the five areas with the three themes, in our own words | commons 0047-zero-trust `definitions.md`; none publishes a vocabulary with IRIs that was read |
| CISA Zero Trust Maturity Model 2.0 | The maturity stages, the pillars and the functions | Read; written in the catalog `catalog-zero-trust`, not in the ontology |
| DoD Zero Trust Strategy and activities | The activities and the DoD pillars | Not read; nothing of them is written |

## Success criteria

- **SC-001**: Every requirement of 0006-zero-trust-terms is proved by a test of the library, with no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
