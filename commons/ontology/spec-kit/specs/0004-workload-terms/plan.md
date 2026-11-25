# Plan: 0004-workload-terms

**Spec:** 0004-workload-terms. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Standards first (commons 0018-standards-first, read in this repository) | A term of an ontology of commons rests on a standard's term where one names it (`specializes`) and is `unaligned` only by a Decision of the owner; no IRI is written that was not read | FR-003 and FR-005 of the specification |
| PROV-O and SKOS, the terms the library `rdf` holds (read 2026-11-25, see 0003-planning-terms) | A workload is a `prov:Entity`; the form and the trigger are code lists, `skos:Concept` | The library `rdf`, as for the Planning ontology |
| The Kanon ontology of this library (`src/kanon/kanon.ts`, read in this repository) | A dialect is an instance of a unit kind of a host (`kanon:Instance`), so this ontology adds no class for it and does not make it a form | The file itself |

## What is built and what is reused

Reused: the library `rdf` (classes, code lists, schemas), the audit of Mizan (`bases`) and the generator of the ontologies. New: the module `src/workload/` and its publication.
