# Feature Specification: The Actors ontology

**Spec ID:** 0007-actor-terms
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The terms that commons 0048-actors uses, stated once as typed TypeScript in the namespace `act:`: the act and the actor that takes part in it, the roles the actor holds, the three kinds of actor, the directive an act is done under, the tasking that lets an agent be used, the qualification of an agent's configuration, the review canary, the seven rules whose breach makes a nonconformance, the four levels of tasking and the four meanings of a signature.

## Requirements

- **FR-001**: The library MUST state the ontology `act:` in `src/actor/` as typed values over the library `rdf`, with the namespace `https://www.intellectualfrontiers.com/ontology/actor#`, the version `1.0.0` with its version IRI, and a description that names the act, the actor, the directive and the signature meanings.
- **FR-002**: The ontology MUST hold the classes `act:Act`, `act:Actor`, `act:Directive`, `act:Tasking`, `act:Qualification`, `act:NonconformityRule`, `act:ReviewCanary`, `act:Role`, `act:ActorKind`, `act:TaskingLevel` and `act:SignatureMeaning`, and the properties `act:initiatedBy`, `act:preparedBy`, `act:assistedBy`, `act:executedBy`, `act:reviewedBy`, `act:approvedBy`, `act:underDirective`, `act:brokeRule` and `act:directiveDigest`, each with a definition; the role properties MUST have the domain `act:Act` and the range `act:Actor`.
- **FR-003**: The ontology MUST hold these closed code lists, each member with a label and a definition: six roles (initiator, preparer, assistant, executor, reviewer, approver), three kinds of actor (person, system, agent), four tasking levels (T0 to T3), four signature meanings (review, approval, responsibility, authorship) and seven rules whose breach is a nonconformance (undirected, outside tasking, unqualified, regulated verb refused, review skipped, reviewed by the preparer, vocabulary breach); the member names MUST be unique across the lists.
- **FR-004**: Every class of the ontology MUST have a record of its basis (commons 0018-standards-first FR-003), each specializing a term of PROV-O or SKOS that the library `rdf` holds, none `unaligned`; `act:Actor` MUST specialize `prov:Agent` and `act:Act` MUST specialize `prov:Activity`; no IRI MUST be written that was not read; the modules MUST import only `core`, `rdf` and the ontology library.

## Acceptance scenarios

1. **Given** the ontology, **When** its namespace and version are read, **Then** they are `act:` and 1.0.0 with the version IRI, per FR-001.
2. **Given** the ontology, **When** its classes and properties are read, **Then** the eleven classes and nine properties are there with definitions, and the role properties run from an act to an actor, per FR-002.
3. **Given** the code lists, **When** their members are counted, **Then** there are 6 roles, 3 kinds, 4 levels, 4 meanings and 7 rules, with no member name used twice, per FR-003.
4. **Given** every class, **When** the audit is read, **Then** each has a record that specializes a PROV-O or SKOS term, per FR-004.

## Out of scope

- Which kind of actor may hold which role: that is a rule of the library of actors, in types (commons 0048-actors FR-011), not of the vocabulary.
- The evidence side (source class, lineage, prepared marker): it is specified in `quality` (commons 0001-quality-evidence) and uses the grades of `ifqs:`.

## Edge cases

- Per FR-004, the word `agent` is the PROV word for every actor and our word for an AI actor. `act:Actor` specializes `prov:Agent`; the kind `act:Agent` names the AI case only (commons 0048-actors `definitions.md`, section 1 and the collision audit in `reuse-audit.md`).
- Per FR-003, a nonconformance is the record of the quality ontology (`ifqs:Nonconformance`); this ontology adds only the rules whose breach makes one, so that no second record exists.
- Per FR-003, the ontology `plan:` (planning) holds a list of three kinds of actor of its own (person, agent, tool). The reuse audit of 0048-actors (row A3) decides that `act:ActorKind` is the one list and that planning adopts it.

## Assumptions

- The four meanings of a signature are those that 21 CFR 11.50 names; the roles are our own and no standard publishes them.

## Open questions

- None.

## Key entities

- **Actor** - a person, a system or an agent that takes part in an act.
- **Directive** - a controlled instruction an act is done under.
- **Tasking** - a person's signed authority to use an agent configuration.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Standards first (commons 0018-standards-first, read in this repository) | A term rests on a standard's term where one names it and is `unaligned` only by a Decision of the owner; no IRI is written that was not read | The specification itself |
| PROV-O and SKOS, the terms the library `rdf` holds (read 2026-11-26, see 0048-actors `definitions.md`, section 1) | An actor is a `prov:Agent`, an act a `prov:Activity`, the rest `prov:Entity`; each code list is a `skos:Concept` | The library `rdf` and the PROV-DM and PROV-O texts |
| 21 CFR 11.50 | The four meanings of a signature | Read |
| NIST AI RMF 1.0 (Govern 3.2), EU AI Act (Articles 14, 26) | That roles and responsibilities for human and AI configurations and for oversight are defined and differentiated | Read in part |
| SPDX 3.0 AI profile (`autonomyType`) | The nearest published name for what a tasking level says | Read in part |

## Success criteria

- **SC-001**: Every requirement of 0007-actor-terms is proved by a test of the library, with no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
