# Decisions on Planning (2026-11-22)

**Status:** signed by the owner on 2026-11-22 (D-1, D-2). The owner accepted the recommendations of the open questions of `commons/spec-kit/specs/0037-planning` in the session of 2026-11-22 ("accept all recommendations") and then instructed an agent to record his signature; the signature lines say so. Ticket: intellectual-frontiers/.github#11.

## D-1: `plan:ConflictValue` is a term of the library's own

- **Term:** the value of a field where two sources disagree and the authority of the field does not settle it: each source's value, waiting for a person (0037-planning FR-017).
- **Basis:** `unaligned`. Searched for a standard that names it (SARIF, PROV-O, iCalendar, the Web Annotation Vocabulary) and none was found.
- **Decision:** accepted as the library's own term, a `prov:Entity` in the ontology.
- Signed by: Shahid N. Shah (login `shah`)  Date: 2026-11-22. Recorded by an AI agent on his explicit instruction ("Sign the four Decisions") in the session "IFC & Erga Assistant" (https://claude.ai/code/session_01Juu3CorghZXkPDS1x3r3eW). This records the owner's decision; it is not a cryptographic signature.

## D-2: `plan:OutboxEntry` is a term of the library's own

- **Term:** a patch that a source cannot carry out yet, kept with what it waits for: a capability, a person's confirmation, or a schema that cannot say it (0037-planning FR-033).
- **Basis:** `unaligned`, as D-1.
- **Decision:** accepted as the library's own term, a `prov:Entity` in the ontology.
- Signed by: Shahid N. Shah (login `shah`)  Date: 2026-11-22. Recorded by an AI agent on his explicit instruction ("Sign the four Decisions") in the session "IFC & Erga Assistant" (https://claude.ai/code/session_01Juu3CorghZXkPDS1x3r3eW). This records the owner's decision; it is not a cryptographic signature.

## Not a Decision

- `plan:BaselineClass` (new, unchanged, updated, absent) takes the values of SARIF 2.1.0's own property `baselineState` (section 3.27.24) and is a SKOS concept scheme like the other code lists: a standard's values need an entry and no Decision.
- `plan:tracePresent` is a property (whether the thing a trace names is present or absent) and the properties of the ontology are held by its baseline until the schemas require more.
