# Kanon for content: what changed, what is unverified, and the contract for the first consumer

The approved [Content collector](../../../content/spec-kit/specs/0001-content-collector/spec.md) now implements the initial slice as a decoded-data bundle. The notes below record the state when the draft was handed over.

Written for intellectual-frontiers/.github#22. This is a note for the owner, not a Decision: a Decision authorizes, and none is made here. The name of Kanon (OQ-4 of 0033-kanon) stays with the owner; nothing is aliased or blocked.

## What changed

- **commons 0033-kanon** (Draft) gained FR-025 to FR-033: data modules as a Governance unit; a published bundle; members of another scope; a vocabulary a host declares; relations; the widened Surface with surface, instance and generated artifact kept apart; the ontology classes Relation and Bundle; the records that `docs` is not classified and that a consumer's ladder and Kanon's layers are kept apart; the reservation of `content` and `content-*`. Seven acceptance scenarios were added. Nothing was renumbered.
- **kanon 0002-kanon-content-checks** is new and is implemented in `commons/kanon`: `modelFindings` (`kanon/kind`, `kanon/annotation`, `kanon/dangling`, `kanon/relation-layer`, `kanon/duplicate-id`), the optional `relations` and `vocabulary` of `LayeredModel` (a model made before them is unchanged), `family.scope` (`own` or `any`) and the `role` of an extension in its own table, `classify` and `extensionFindings` for a package of another scope, the consumer manifest `kanon.ts`, `makeBundle`, `verifyBundle` (a pure check of a manifest of SHA-256 and sizes that refuses the whole bundle and names each `changed`, `missing`, `extra`, `manifest` and `form` fault) and `readBundle` in the host entry. `bun run verify` is green in `commons/kanon` (64 tests).
- **The ontology `kanon`** has twelve classes (Relation and Bundle added, each a specialization of `prov:Entity` with its record of basis) and three properties for relations; the generated files were regenerated.
- **The names `content` and `content-*`** are held as data in `libraries/src/family.ts` and in 0027 FR-024.
- **The spec kit of the library `content`** is drafted in `commons/spec-kit/drafts/content/` (five drafts and this note). The folder `commons/content` does not exist.

## Premises of the brief that the code contradicted

- Element kinds were not closed unions: `ModelElement.kind` is a string and nothing checked it. `kanon/kind` is new, and applies only where a model declares a vocabulary.
- `kanon/dropped` and the requirement-by-instance matrix already existed and did what the payoff asks; the new test shows it for a body of content.
- The Kanon library spec 0001-kanon-checker is `Draft`, not in force.
- Cross-scope membership needed three changes, not one flag: `classify`, where the role of an extension is found (it was found in the host's own table, which would have made the host name a consumer), and the manifest a consumer has (`library.ts` was the only one read).

## What could not be verified

- No standard was read in this work. BagIt (RFC 8493), RO-Crate, and the SKOS `related` property are candidates in the alignment table of 0033-kanon and are marked not verified; the ontology rests on `prov:Entity` only, as the classes Matrix and Instance already do. `Vocabulary` and `Data module` are marked `unaligned` and need a Decision of the owner before they are terms of the ontology (OQ-5).
- Whether the documentation generator reads a `LayeredModel` with `relations` or `vocabulary`. The fields are optional and the generator was not changed or run here.
- Any consumer. Nothing was built or tested against the first consumer; its pattern was used for the design only.
- Node 26: only Bun ran the tests in this sandbox.

## The contract the first consumer builds against

1. **Manifest.** The consumer's package has `kanon.ts` exporting `kanon`: its table, `extends` (the host `@intellectual-frontiers/content`) and its `role` (a dialect with its `name` and the host unit it is an instance of). It runs `kanon check` in its own `verify`. The host's family must have `scope: any`; the package name is `<its scope>/content-rendition-<name>`.
2. **Governance** is typed `.ts` data modules that export data and import nothing of Logical or Physical.
3. **The bundle** is `model.json`, `elements.json`, `trace.json`, `relations.json`, `dispositions.json` and `manifest.json`, where the manifest lists every other file with its path, SHA-256 (lower-case hex) and size and does not list itself. The same model gives the same bytes. The consumer's own content modules travel beside them and are listed too.
4. **The loader** calls `verifyBundle` with the manifest text and the bytes of every file found in the folder; it gets either every fault or the verified files and the decoded model. It runs no module before the check passes and reads nothing from the folder afterwards.
5. **The finding** `kanon/dropped` is given where a claim's annotation (for example `evidence`) is accounted for by no instance, expressed, carried or unexpressed with a reason; the matrix shows the cell as dropped. Until 2027-01-31 it warns as a `commons/planning` issue which must be reviewed; after January nothing changes by itself and the owner may decide, by the typed dated policy `CONTENT_GATE_POLICY` (0039-content-method FR-014), to make it fail the build.

## The content method (0039-content-method), added for intellectual-frontiers/.github#26

- The generic method (books first, renditions after), the closed typed vocabulary of annotations, relations and element kinds, the authoring grammar (structured comments and `{{key}}` source keys resolved by `.sources.txt`), the instance contracts of the web for people and for agents, and the first matrix are in `commons/spec-kit/specs/0039-content-method/spec.md`. The softened rule is the typed dated policy of its FR-014 and of 0033-kanon FR-034.
- Read: DCMI Metadata Terms, W3C PROV-O, W3C Web Annotation (names only), RFC 8493, and the schema.org terms Question, Answer, ClaimReview and Dataset. Not read: the values of `license` and `voice`, and any standard for the dates of a fact's validity.
- Measured, uncommitted, over four books of the first consumer (drafts only): 32 chapter files, 1,106 prose blocks, 515 with a source key, 97 with a date and no key, 429 source entries of which 403 carry a date read, 300 say what they establish and 211 what they do not; 102 `// OPINION` marks parse with no problem. No claim ids exist, so the collector would mint them all. One book has no source keys at all and 50 dated blocks.
- State of the books (reported by the session that keeps them): no book has passed the audit gate, so content status is `not-audited`; the voice sweep is a function and not a command (a gap, a finding); the claims ledger covers only claims needing a second check and is stale; volatile facts have a 90-day rule and no companion pages yet; no product-and-proof book, buyer's guide, glossary or customer-evidence book is planned.
- Kept off a product site (0039 FR-005): the allegation about one vendor unless its denial is beside it, comparison content unless documented facts counsel approved, any claim that a book is audited, statements about the product itself, and anything that relies on the vendor fact-check (not done).

## What is still the owner's

Whether the `// CLAIM` proposal is approved, and whether the session that keeps the books agrees (0039 OQ-3); whether Kanon A (0033-kanon, Draft) and Kanon B (kanon 0001 and 0002, Draft) are put in force so that `commons/content` is made (0039 OQ-4; it is not made here); the values of `license` (0039 OQ-1); the name (OQ-4); the unaligned rows (OQ-5); whether the signature of the manifest is wanted (kanon 0002 OQ-1); the values of `license`, the voice names and what counts as evidence (draft 0002); whether the typed content modules travel in the bundle as code or as decoded data (draft 0003 OQ-1); and the release of Kanon with these changes, which this work did not make (no version was raised).
