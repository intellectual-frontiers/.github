# Feature Specification: Dossier core

**Spec ID:** 0002-dossier-core
**Status:** Active
**Owner:** if
**Domain:** commons
**Governed by:** commons 0046-dossiers

**Input:** The model and the first physical parts of a dossier (commons 0046-dossiers): sources with hashes, selections, lenses and their compositions, plates, the print-shaped AsciiDoc and its writer, the build that gives the same bytes for the same inputs, the manifest and its hash of inputs, the diff by meaning, the files, the offline verify and the seal. The lenses of a purpose are plugins of the family; the renditions made by pinned tools and the commands that render a dossier for a person are later specifications.

## Requirements

- **FR-001**: A source MUST be made with `sourceOf` from an id, a kind, an instant, a body, and optionally a class, a signer, boundaries and tags; its hash MUST be the SHA-256 of the canonical form of its body, its class MUST be `internal` where none is given, and an id or an instant of another form MUST be refused. `checkSources` MUST refuse a set in which a source's hash is not the hash of its body (`E-DOSSIER-SOURCE-HASH`) or an id has two different contents (`E-DOSSIER-SOURCE-CONFLICT`), and MUST hold an id given twice with the same content once. (commons 0046-dossiers FR-001, FR-005)
- **FR-002**: `select` MUST give the sources that meet a selection and were observed at or before an instant, in the order of their ids, the same list for the same sources in any order; a source with no boundary MUST meet no selection of a boundary; `intersect` MUST give the selection that a source meets only if it meets both; and `instantOf` MUST give the instant of the dossier itself, or for `latest` the newest instant among the sources selected and the epoch where there are none, never the clock. (commons 0046-dossiers FR-006, FR-010, FR-011)
- **FR-003**: The classes of disclosure MUST be `public`, `internal`, `cui` and `restricted` in that order; `Disclosed<C, T>` MUST keep the class of a value in its type and `show` MUST take only a value of a class at most its ceiling, so that a value of a higher class is a compile error where the classes are known. (commons 0046-dossiers FR-033)
- **FR-004**: A lens MUST have an id, a version, a title, the kinds of source it reads, a ceiling, a decoder of its parameters and a plate function; a plate's slug MUST be the words of its title unless one is given, its citations MUST be sorted and without a repeat, a lens whose inputs are empty MUST give a plate that says what is absent, and a statement of fact MUST be able to say how old its evidence is as of the date of the dossier. (commons 0046-dossiers FR-020, FR-022, FR-030, FR-031, FR-032)
- **FR-005**: Lenses MUST compose: `restrict` (a lens that reads only the sources that meet a selection, and gives a plate with no error where none does), `redact` (a lens whose ceiling is lowered and that is given only sources at most that class), `unionOf` (the plates of many in order, whose blocks are the same however the union is grouped) and `rollup` (one plate with the counts of each group and a section for each). (commons 0046-dossiers FR-021)
- **FR-006**: The AsciiDoc of a dossier MUST be written from blocks and inlines with every value made safe by the rules of `@intellectual-frontiers/formats/asciidoc`, with only the attributes of the fixed list, with lines ended by `\n`, none ending in a space and one final newline; a citation MUST be a reference to the entry of its source in the evidence; and the document MUST be refused where two anchors are one (`E-DOSSIER-ANCHOR`) or a plate cites a source the dossier does not hold (`E-DOSSIER-LENS-CITE`). (commons 0046-dossiers FR-050, FR-051, FR-052, FR-053)
- **FR-007**: `build` MUST give, for a declaration, the lenses and the sources, a dossier that is the same bytes for the same inputs; it MUST give each lens only the sources of the kinds it reads and of a class at most its ceiling, MUST replace a plate whose lens has a ceiling above the class of the reader by a plate that says only the class, MUST NOT run that lens, and MUST give no dossier, with a stable code, where a lens is unknown, its parameters are not accepted, its kinds are not in the selection, it refuses, it cites what it was not given, or its plate is above its ceiling; and raising the class of the reader MUST NOT remove a plate that a lower class shows and the dossier of a lower class MUST differ from that of a higher only in the plates withheld. (commons 0046-dossiers FR-003, FR-004, FR-005, FR-022, FR-034, FR-035)
- **FR-008**: A build MUST write a manifest of the dossier's id, instant, class, lenses with their versions and parameters, selection, each source it holds (id, kind, instant, hash, class, signer) and none above the class of the reader, the plates withheld, the hash of the inputs and the hash of each rendition, as canonical JSON; the hash of the inputs MUST change when and only when a source a reader may see, a lens, its parameters, the selection, the instant or the class changes; and `isDue` MUST say whether a build is due by comparing it with the hash of the last build. (commons 0046-dossiers FR-060, FR-100, FR-101, FR-102, FR-103)
- **FR-009**: `diffDossiers` MUST give the sources and the plates added, removed and changed between two dossiers by id and by hash (plates by their slug and the hash of their blocks), and `sincePlate` MUST write the difference as a plate. (commons 0046-dossiers FR-064)
- **FR-010**: `writeDossier` MUST write the AsciiDoc, the manifest with the hash of each rendition, the declaration, and where asked the sources, each file whole or not at all, and MUST refuse a file outside the folder. (commons 0046-dossiers FR-062, FR-121)
- **FR-011**: `verifyFolder` MUST work from the folder alone: it MUST check each rendition against the manifest, name the one that differs or is missing, rebuild from the carried sources where the lenses are given and say whether the bytes are the same, and say that the rebuild is not possible where the sources are not carried; it MUST reach no network. (commons 0046-dossiers FR-061)
- **FR-012**: `sealManifest` MUST sign the digest of a manifest with a key in the namespace `ifc-dossier`, naming the person, the role and the date; `verifySeal` MUST refuse a seal whose manifest has changed, a signature that does not verify, and a signature of other words than the seal states. (commons 0046-dossiers FR-063)

## Acceptance scenarios

1. **Given** the same sources, lenses and declaration, **When** a dossier is built twice, **Then** the AsciiDoc is the same bytes, per FR-007.
2. **Given** a source of class `cui` and a reader of class `public`, **When** the dossier is built, **Then** its value is in no output and the plate says only that it is withheld, per FR-007.
3. **Given** a built dossier written to a folder, **When** a rendition's byte changes, **Then** the verify names the rendition, per FR-011.
4. **Given** a manifest sealed by a key, **When** the manifest changes, **Then** the seal is refused, per FR-012.
5. **Given** the inputs of the last build, **When** a build is asked, **Then** it is not due, per FR-008.

## Out of scope

- The lenses of a purpose and of a framework: the plugins of the family.
- Renditions made by pinned tools, the commands and the triggers of a product.

## Edge cases

- A set with the same id and the same content twice holds it once, per FR-001.
- A dossier with no sources gives plates that say nothing is there, per FR-004.
- A selection that no source meets gives no plate and no error, per FR-005.

## Assumptions

- `ssh-keygen` is on the machine that tests the seal.

## Open questions

- None.

## Key entities

- **Source**, **Selection**, **Lens**, **Plate**, **Manifest**, **Seal**.

## Success criteria

- **SC-001**: The same evidence gives the same dossier on every platform, and no reader sees more than their class allows.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the requirements of commons 0046-dossiers it proves
