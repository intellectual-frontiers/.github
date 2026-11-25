# Feature Specification: The Workload ontology

**Spec ID:** 0004-workload-terms
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The terms that the library Workload (commons 0040-workload-pattern, and the specifications of `commons/workload`) uses, stated once as typed TypeScript in the namespace `wl:`: a workload, a form and a trigger. A dialect stays what Kanon says it is, a projection for a harness or a person, and is not a form.

## Requirements

- **FR-001**: The library MUST state the ontology `wl:` in `src/workload/` as typed values over the library `rdf`, with the namespace `https://www.intellectualfrontiers.com/ontology/workload#`, the version `1.0.0` with its version IRI, and a description that names the workload, the forms and the triggers.
- **FR-002**: The ontology MUST hold the classes `wl:Workload`, `wl:Form` and `wl:Trigger`, each with a label and a definition, the definition of a workload saying that it is a unit of operated work and not running software, and the properties `wl:workloadId`, `wl:workloadForm`, `wl:workloadTrigger` and `wl:formStatus`.
- **FR-003**: The ontology MUST hold these closed code lists, each member with a label and a definition: four forms (runbook, reconcile, graph, campaign), each with its status `built` or `reserved`, and four triggers (manual, schedule, event, alert); and neither a dialect nor a trigger MUST be a member of the list of forms.
- **FR-004**: Every class of the ontology MUST have a record of its basis (commons 0018-standards-first FR-003), each specializing a term of PROV-O or SKOS that the library `rdf` holds, none `unaligned`; the modules MUST import only `core`, `rdf` and the ontologies of this library by relative path, the ontology MUST be published like the others (Turtle, SHACL shapes, SSSOM, code lists) by `bun commons/libraries/src/generate-ontology.ts`, and no IRI MUST be written that was not read.

## Acceptance scenarios

1. **Given** the ontology, **When** its namespace and version are read, **Then** they are `wl:` and 1.0.0 with the version IRI, per FR-001.
2. **Given** the ontology, **When** its classes and properties are read, **Then** the three classes and four properties are there with definitions, and a workload is not running software, per FR-002.
3. **Given** the code lists, **When** their members are counted, **Then** there are 4 forms (two built, two reserved) and 4 triggers, and no member is a dialect, per FR-003.
4. **Given** every class, **When** the audit is read, **Then** each has a record that specializes a PROV-O or SKOS term, per FR-004.

## Out of scope

- The Kanon vocabulary of a dialect: it is `kanon:Instance` and 0033-kanon's.

## Edge cases

- A class of a node, a verb or an effect is not in this ontology: those are terms of the library and of its specifications, and are added when a consumer outside the library needs to name them, per FR-002.

## Assumptions

- The names of the forms are the ones of the registry of the library, and the ontology follows it.

## Open questions

- None.

## Key entities

- **Workload** - a unit of operated work, not running software.
- **Form** - what kind of work it is and how it executes.
- **Trigger** - what starts a workload.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Standards first (commons 0018-standards-first, read in this repository) | A term of an ontology of commons rests on a standard's term where one names it (`specializes`) and is `unaligned` only by a Decision of the owner; no IRI is written that was not read | commons 0018-standards-first FR-003 and FR-005 |
| PROV-O and SKOS, the terms the library `rdf` holds (read 2026-11-25, see 0003-planning-terms) | A workload is a `prov:Entity`; the form and the trigger are code lists, `skos:Concept` | The library `rdf`, as for the Planning ontology |
| The Kanon ontology of this library (`src/kanon/kanon.ts`, read in this repository) | A dialect is an instance of a unit kind of a host (`kanon:Instance`), so this ontology adds no class for it and does not make it a form | The file itself |

## Success criteria

- **SC-001**: Every requirement of 0004-workload-terms is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
