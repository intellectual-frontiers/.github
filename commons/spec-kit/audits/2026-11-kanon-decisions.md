# Decisions on Kanon (2026-11-22)

**Status:** D-2 and D-3 are signed by the owner on 2026-11-22 (he instructed an agent to record his signature; the signature lines say so). D-1 is signed (the owner's statement of 2026-11-22). D-4 is the owner's decision of the same session and is recorded but not yet signed. The owner gave these decisions in the session of 2026-11-22. Specification: `commons/spec-kit/specs/0033-kanon` (OQ-4, OQ-5, FR-026). Ticket: intellectual-frontiers/.github#22.

## D-1: the name stays Kanon, as an internal working name

- **Decision:** keep the name Kanon for the pattern and the library, as an internal working name (owner, 2026-11-22: "trademark: not necessary, Kanon is internal working name").
- **Trademark and registry clearance:** not needed. The packages here are scoped (`@intellectual-frontiers/commons/kanon`), so the names `kanon` on npm, PyPI and crates.io (held by unrelated projects) do not collide; no trademark search was made, and none is required while the name stays internal.
- **If the name ever becomes external** (a product or a brand outside the company), the owner decides again then; the fallback is Strata, with the name changed once in the specification, the ontology namespace and the library, and no alias kept.
- Signed by: Shahid N. Shah (login `shah`)  Date: 2026-11-22. Recorded by an AI agent on his explicit statement in the session "IFC & Erga Assistant" (https://claude.ai/code/session_01Juu3CorghZXkPDS1x3r3eW). This records the owner's decision; it is not a cryptographic signature.

## D-2: `Vocabulary` is a term of commons' own

- **Term:** the element kinds, relation kinds and annotation names that a host declares for its model (0033-kanon FR-007, FR-028).
- **Basis:** `unaligned`. Searched for a standard that names it and none was found (0033-kanon, the alignment table).
- **Decision:** accepted as commons' own term. It is not an ontology class yet; when it becomes one it carries this Decision as its record (0018-standards-first FR-005).
- Signed by: Shahid N. Shah (login `shah`)  Date: 2026-11-22. Recorded by an AI agent on his explicit instruction ("Sign the four Decisions") in the session "IFC & Erga Assistant" (https://claude.ai/code/session_01Juu3CorghZXkPDS1x3r3eW). This records the owner's decision; it is not a cryptographic signature.

## D-3: `Data module` is a term of commons' own

- **Term:** a typed `.ts` module of a Governance unit whose exports are data (0033-kanon FR-007, FR-025).
- **Basis:** `unaligned`, as D-2.
- **Decision:** accepted as commons' own term, on the same terms as D-2.
- Signed by: Shahid N. Shah (login `shah`)  Date: 2026-11-22. Recorded by an AI agent on his explicit instruction ("Sign the four Decisions") in the session "IFC & Erga Assistant" (https://claude.ai/code/session_01Juu3CorghZXkPDS1x3r3eW). This records the owner's decision; it is not a cryptographic signature.

## D-4: the bundle manifest is not signed in the first version

- **Decision:** the manifest of a published Kanon bundle (0033-kanon FR-026) lists the files with their SHA-256 and sizes, and that is the whole check in this version.
- **Later:** a signature may be added as an optional field, as a DSSE envelope over the manifest with the library `crypto`, without changing the rules of FR-026.
- Signed by: ______  Date: ______
