# Decisions on Kanon (2026-11-22)

**Status:** recorded for the owner to sign. The owner gave these decisions in the session of 2026-11-22; an agent recorded them and has not signed them. Specification: `commons/spec-kit/specs/0033-kanon` (OQ-4, OQ-5, FR-026). Ticket: intellectual-frontiers/.github#22.

## D-1: the name stays Kanon

- **Decision:** keep the name Kanon for the pattern and the library.
- **What was checked:** the registries (npm `kanon`, PyPI `kanon`, crates.io `kanon` are held by unrelated projects; the packages here are scoped, so they do not collide); GitHub (small unrelated projects); a web search of trademark records (one KANON Madrid designation in classes 6, 7 and 37, near-homophones such as KAON in software classes, and the sound of CANON).
- **What could not be checked:** a search of the USPTO's trademark database or any other register in classes 9, 35 and 42.
- **Condition:** before the name is used as an external product name, a trademark attorney or that search checks classes 9, 35 and 42.
- **Fallback:** Strata, with the name changed once in the specification, the ontology namespace and the library, and no alias kept.
- Signed by: ______  Date: ______

## D-2: `Vocabulary` is a term of commons' own

- **Term:** the element kinds, relation kinds and annotation names that a host declares for its model (0033-kanon FR-007, FR-028).
- **Basis:** `unaligned`. Searched for a standard that names it and none was found (0033-kanon, the alignment table).
- **Decision:** accepted as commons' own term. It is not an ontology class yet; when it becomes one it carries this Decision as its record (0018-standards-first FR-005).
- Signed by: ______  Date: ______

## D-3: `Data module` is a term of commons' own

- **Term:** a typed `.ts` module of a Governance unit whose exports are data (0033-kanon FR-007, FR-025).
- **Basis:** `unaligned`, as D-2.
- **Decision:** accepted as commons' own term, on the same terms as D-2.
- Signed by: ______  Date: ______

## D-4: the bundle manifest is not signed in the first version

- **Decision:** the manifest of a published Kanon bundle (0033-kanon FR-026) lists the files with their SHA-256 and sizes, and that is the whole check in this version.
- **Later:** a signature may be added as an optional field, as a DSSE envelope over the manifest with the library `crypto`, without changing the rules of FR-026.
- Signed by: ______  Date: ______
