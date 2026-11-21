# Feature Specification: The Planning ontology

**Spec ID:** 0003-planning-terms
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The terms that the library Planning (commons 0037-planning) uses, stated once as typed TypeScript in the namespace `plan:` before the specification that uses them: ten classes (item, event, actor, observation, locator, trace, link, patch, preview, source), twelve closed code lists (the kinds of item, the states, the reasons for closing, the severities, the verdicts, the kinds of link, the capabilities of a source, the authorities of a field, the origins, the kinds of actor, the kinds of locator and the types of event) and the properties that join them. Where another standard names a value, the value is a plain name in a property that says whose it is; no IRI of a standard that was not read is written.

## The ontology

- **FR-001**: The library MUST state the ontology `plan:` in `src/planning/` as typed values over the library `rdf`, with the namespace `https://www.intellectualfrontiers.com/ontology/planning#`, the version `1.0.0` with its version IRI, and a description that names the seven kinds of item, the events, the observations and the patches.
- **FR-002**: The ontology MUST hold the classes `plan:Item`, `plan:Event`, `plan:Actor`, `plan:Observation`, `plan:Locator`, `plan:Trace`, `plan:Link`, `plan:Patch`, `plan:Preview` and `plan:Source`, each with a label and a definition, and the class of each code list of FR-003.
- **FR-003**: The ontology MUST hold these closed code lists, each member with a label and a definition: seven kinds of item (issue, task, todo, roadmap item, question, decision, finding), four states (proposed, open, in progress, closed), three close reasons (completed, not planned, duplicate), three severities (error, warning, note), four verdicts (accept, minor revision, major revision, reject), five kinds of link (blocks, same as, relates to, parent of, derived from), seven capabilities (read, create, append event, edit, close, assign, delete), four authorities of a field (source, store, latest, person), three origins (declared, derived, inferred), three kinds of actor (person, agent, tool), four kinds of locator (file span, URL, row, commit) and fourteen types of event.
- **FR-004**: A value that another standard names (the SARIF level of a severity, the iCalendar status of a state, the Web Annotation motivation of a kind of item, the reason a Git host gives for closing) MUST be a name in a property of the member that says whose it is, and its definition MUST say `(to verify)` until the standard's own text has been read; the ontology MUST NOT write an IRI of a standard that was not read.

## Audit and boundaries

- **FR-005**: Every class of the ontology MUST have a record of its basis (commons 0018-standards-first FR-003), each specializing a term of PROV-O or SKOS that the library `rdf` holds, and none is `unaligned`.
- **FR-006**: The modules MUST import only `core`, `rdf` and the ontologies of this library by relative path, and the ontology MUST be published like the others (Turtle, SHACL shapes, SSSOM, code lists) by `bun commons/libraries/src/generate-ontology.ts`.

## Acceptance scenarios

1. **Given** the ontology, **When** its classes are read, **Then** the ten classes of the model and the twelve classes of the code lists are there, per FR-002.
2. **Given** the code lists, **When** their members are counted, **Then** there are 7, 4, 3, 3, 4, 5, 7, 4, 3, 3, 4 and 14, per FR-003.
3. **Given** the severity `Error`, **When** its SARIF level is read, **Then** it is the name `error` and the property's definition says `(to verify)`, per FR-004.
4. **Given** every class, **When** the audit is read, **Then** each has a record that specializes a PROV-O or SKOS term and none is `unaligned`, per FR-005.
5. **Given** the modules of the ontology, **When** their imports are read, **Then** none is outside `core`, `rdf` and the library, per FR-006.

## Out of scope

- What the terms mean for a program: commons 0037-planning.
- Terms of the sources (a Markdown task list, a code comment, a Git host): their own specifications, when they are built.

## Edge cases

- A name from a standard that was not read: kept as a name with `(to verify)`, and the audit's basis stays PROV-O or SKOS, per FR-004 and FR-005.
- The kind `Decision` and the verdicts: the kind says what the item is, the verdict says how a decision item ended; they are two lists, per FR-003.

## Assumptions

- The standards named in FR-004 could not be fetched when the ontology was written; their names are those the first dataset (the issue files of the company's monorepo) already uses.

## Open questions

- **OQ-1**: Whether `plan:` is the right prefix, or whether `planning:` reads better beside `kanon:` and `oto:`.

## Key entities

- **Item** - a piece of planning content of one of seven kinds.
- **Observation** - what one source saw in one place.
- **Patch** - a change to write back to one source.

## Success criteria

- **SC-001**: Every term the specification commons 0037-planning uses is in this ontology, with its basis, before the specification names it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
