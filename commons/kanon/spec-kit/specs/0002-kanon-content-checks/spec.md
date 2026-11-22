# Feature Specification: Kanon content checks

**Spec ID:** 0002-kanon-content-checks
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The library `@intellectual-frontiers/kanon` gains what commons 0033-kanon FR-025 to FR-033 ask of it so that a body of content can be built in the three layers: a vocabulary that a host declares, relations between elements of one layer, the findings that hold them, the membership of an extension of another scope, and a pure verification of a published bundle. The checks stay pure: files and text in, findings out; the file system is read in the `host` entry only (0001-kanon-checker FR-007). Ticket: intellectual-frontiers/.github#22.

## The vocabulary and the relations

- **FR-001**: The library MUST give, as types only, `Relation` (a `from` and a `to` element id and a `kind`) and `ModelVocabulary` (the kinds of element for each layer, the kinds of relation and the names of annotation), and `LayeredModel` MUST take them as the optional readonly fields `relations` and `vocabulary`, so that a model made before them is still a `LayeredModel` and every consumer of the type compiles as it did (commons 0033-kanon FR-013, FR-028, FR-029).
- **FR-002**: The library MUST give a pure function from a model to findings (`modelFindings`) that finds, in the order of the model: two elements with one id (`kanon/duplicate-id`, for every model); where the model has a vocabulary, an element whose kind its layer's list does not hold (`kanon/kind`), a relation whose kind the vocabulary's list of relation kinds does not hold (`kanon/kind`) and an annotation of an element of Governance whose name the vocabulary does not list (`kanon/annotation`); and, for every relation, an end that is no element of the model (`kanon/dangling`) and ends in two layers (`kanon/relation-layer`). A relation between elements of one layer that is cyclic is not a finding.
- **FR-003**: Each finding of FR-002 MUST be in the form of the others (a code, a file and line of the element or of the relation's `from`, one sentence, a key a baseline can hold) and the codes MUST be members of the closed union of codes with a summary and a group for each, so that a `switch` over them is exhaustive (0001-kanon-checker FR-009).

## Members of another scope

- **FR-004**: The table's `family` MUST take the optional `scope`, `own` (where absent) or `any`, and the table of an extension MUST take the optional `role`: a dialect (with its `name` and the unit it is an instance of, `instanceOf`) or a plugin (with its `noun`). A table with `role` and no `extends` MUST be refused, and a host (a table with `family`, `instances` or `plugins`) MUST NOT have `role` (commons 0033-kanon FR-020, FR-027).
- **FR-005**: `classify` MUST, where the rule's `scope` is `any`, read a package name of any scope by its base name against the rule's templates with the host's base, and where it is `own` MUST be as it was (a package of another scope is no member). `memberPackage` MUST still make a name in the host's scope.
- **FR-006**: `extensionFindings` MUST take the role of an extension of another scope from its own table where the host's family has scope `any`, and refuse it (`family/name`) where the host's scope is `own`, where it has no role, where the role's name or noun is not the one its package name reads as by the rule, and where a dialect's `instanceOf` names no unit of the host that has instances; the checks of the imports of an extension (`layers/private`, `layers/above`, `layers/around`, `instances/sibling`, `plugins/undeclared`, `plugins/contract`) MUST then hold as for any member. An extension of the host's own scope MUST still take its role from the host's table, so that no table that passed before fails now.
- **FR-007**: The `host` entry MUST read the table of a package that has no `library.ts` from its manifest `kanon.ts` (the export `kanon`, a literal in the form of 0001-kanon-checker FR-010), and MUST say which of the two files it read; a package with both uses `library.ts`.

## The bundle

- **FR-008**: The library MUST give `makeBundle`, from a model, the files of its bundle as text by path and its manifest: `model.json` (the name, library, title, summary, layers, instances and vocabulary), `elements.json`, `trace.json`, `relations.json` and `dispositions.json`, each with its keys and its arrays in a fixed order, two spaces of indent, LF and one final newline, so that the same model gives the same bytes; and `manifest.json`, which lists every other file with `path`, `sha256` (lower-case hexadecimal of its bytes) and `size`, in the order of the paths, and not itself (commons 0033-kanon FR-026).
- **FR-009**: The library MUST give `verifyBundle`, from the text of a manifest and the bytes of each file found in the bundle (a map from path to bytes), as a pure function that reads no file, no clock and no network and evaluates nothing: it MUST return the faults of the whole bundle, each of a closed union (`changed`: the bytes differ from the manifest's digest or size; `missing`: listed and not found; `extra`: found and not listed; `manifest`: the manifest is not JSON of the form, lists a path twice, lists a path that is absolute or has `..`, or a digest that is not 64 lower-case hexadecimal digits; and `form`, which FR-010 gives) with its path and one sentence, in the order of the paths, and no other; and where there is a fault it MUST return none of the files.
- **FR-010**: WHERE there is no fault, `verifyBundle` MUST return the verified files and the model decoded from them (`LayeredModel`, with ids as `ElementId`s made by `parseElementId`), or the fault `form`, one sentence naming what in a verified file is not the form (a decoder at the boundary, FR-018 of commons 0033-kanon), and then no file is returned; the loaded model MUST equal the model that `makeBundle` was given, element for element, trace edge for trace edge, relation for relation and disposition for disposition.
- **FR-011**: The bundle code MUST import only `core`, `crypto` (the digest) and the library's own modules (Kanon is in layer 2 of commons 0032-libraries-by-concern and `grc` is in the same layer, so its bundle code is not importable); the library MUST add `crypto` to its dependencies as `link:../crypto`, and its package entries MUST export `makeBundle` and `verifyBundle` from `.`, with the file system in `./host` only (`readBundle`, which reads a folder into the map of FR-009 and writes nothing).

## Acceptance scenarios

1. **Given** a model with two elements of one id, **When** it is checked, **Then** `kanon/duplicate-id` names the id, per FR-002.
2. **Given** a relation whose `to` is no element, and another between a Governance element and a Logical one, **When** the model is checked, **Then** `kanon/dangling` and `kanon/relation-layer` name them, per FR-002.
3. **Given** a model with a vocabulary and an element of a kind it does not list, a relation kind it does not list and an annotation it does not list, **When** it is checked, **Then** `kanon/kind` twice and `kanon/annotation` once, per FR-002; **Given** the same model with no vocabulary, **Then** none of the three, per FR-001.
4. **Given** two elements that relate to each other in both directions, **When** the model is checked, **Then** there is no finding, per FR-002.
5. **Given** a package of another scope with a dialect `role` and a host whose family has scope `any`, **When** it is classified and checked, **Then** it is a member and its imports are judged, per FR-005 and FR-006; **Given** scope `own`, **Then** `family/name`, per FR-006.
6. **Given** a role whose noun is not the one the package name reads as, **When** it is checked, **Then** `family/name`, per FR-006.
7. **Given** a package with `kanon.ts` and no `library.ts`, **When** its table is read, **Then** it is the table of `kanon.ts`, per FR-007.
8. **Given** a bundle in which one file has changed, one is missing and one is extra, **When** it is verified, **Then** the faults are `changed`, `missing` and `extra`, each with its path, and no file is returned, per FR-009.
9. **Given** a manifest that lists `../x` and lists one path twice, **When** it is verified, **Then** `manifest` names each, per FR-009.
10. **Given** a model made into a bundle and verified, **When** it is loaded, **Then** it equals the model, and the same model made twice gives the same bytes, per FR-008 and FR-010.

## Out of scope

- The content host (`content`), its collector, its instances and its web surface: drafted apart, not built.
- A signature of the manifest and a ledger of bundles (the library `grc` has them): this requirement checks a manifest of digests only.
- Orphans, broken external links and chains of redirects: they belong to the content host (commons 0033-kanon FR-029).

## Edge cases

- An empty model: its bundle has the five files, each with an empty array or the fixed keys, and verifies, per FR-008 and FR-009.
- A file in the bundle named like the manifest: `extra` (the manifest does not list itself and is not among the files), per FR-009.
- A digest in capitals: `manifest`, so that two spellings of one digest never exist, per FR-009.

## Assumptions

- A bundle is small enough to be read whole into memory, as the model of a library is.

## Open questions

- **OQ-1**: Whether the manifest of a bundle is signed, and by what (the library `grc` signs its evidence manifests with DSSE); this requirement checks digests only, and a signature is a requirement of its own once a consumer asks for one.

## Key entities

- **Relation** - a link between two elements of one layer, with a kind of the model's vocabulary.
- **Vocabulary** - what a host declares: element kinds, relation kinds, annotation names.
- **Bundle** - the files of a model and the manifest of their digests.

## Success criteria

- **SC-001**: A claim whose annotation no instance expresses, carries or names unexpressed is found by the check and shown as a dropped cell of the matrix, for a body of content as for a library.
- **SC-002**: A bundle that differs from its manifest in any file is refused whole, with each fault named, before anything of it is read.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
