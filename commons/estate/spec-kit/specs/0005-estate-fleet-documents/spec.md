# Feature Specification: Estate fleet documents

**Spec ID:** 0005-estate-fleet-documents
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a fleet keeps of an estate in a store of AnyFS, as typed documents: the assets, the observations of them, what is declared, the risks accepted, the references to evidence and the manifest of the store, each with a schema and a layout written as code, so that a document is read as what it is or is reported as what it is not.

## Requirements

- **FR-001**: The physical layer of Estate MUST be the folder `src/physical/`, exported as `@intellectual-frontiers/estate/physical`; it MUST import the governance and logical layers of Estate by package name, `core`, `crypto/sha256`, `grc`, `anyfs` and `anyfs-bridge` only at the subpaths its row of the table of Kanon names, and it MUST do no input or output of its own: every byte it reads or writes goes through a store it is given.
- **FR-002**: An asset MUST be kept as one document that holds its identity, kind, state, where it came from and the owner of each capability it offers, and it MUST be read back through `defineAsset`: a stored asset that breaks a rule of the estate (an owner for a capability its state does not offer, or none for one it does) MUST be a finding, never an asset.
- **FR-003**: Every document type MUST have a schema at a stated version, written with the field `$version`; a document written at a newer version than the code reads MUST be refused as `newer-version` and never read as the current one.
- **FR-004**: The documents MUST be named by layouts: the assets, the declarations and the accepted risks at `<folder>/<first character>/<asset>.json`, an observation at `observations/<asset>/<instant>.json` named by the instant with its hyphens and colons left out so that the names sort as the instants do, a reference to evidence at `evidence/<asset>/<digest>.json`, and the manifest at `fleet.json`; the layout of every folder MUST give back the key of every path it makes.
- **FR-005**: An identity that names a folder or a file MUST be made by `parseAssetId` before any path is made of it, so that an identity with a slash, a dot-dot, a space or a control character is refused as a value and no path leaves its folder.
- **FR-006**: An observation MUST carry the asset, a UTC instant that the calendar has, the source it is attributed to and the keyed records seen; an observation with no source MUST be refused (no evidence without attribution), and the results of the policies it carries MUST each name a status and the controls they give evidence for.
- **FR-007**: A reference to evidence MUST hold the digest of the evidence (64 hexadecimal digits), the store it is kept in, the asset it is about, its type and the instant it was observed, and it MUST NOT hold the bytes, which stay in the evidence stores of grc; the manifest MUST hold the name of the fleet, the schema and the layout it is kept at, and the instant it was made.

## Acceptance scenarios

1. **Given** each type of document, **When** it is written and read, **Then** the same value comes back, per FR-002, FR-006 and FR-007.
2. **Given** a stored asset that offers a capability with no owner, **When** the assets are listed, **Then** it is a finding and not an asset, per FR-002.
3. **Given** a document written at version 9, **When** it is read, **Then** it is refused as a newer version, per FR-003.
4. **Given** the identity `../../etc/passwd`, **When** a document is asked for, **Then** it is refused before any path is made, per FR-005.
5. **Given** an observation with no source, **When** it is recorded, **Then** it is refused, per FR-006.

## Out of scope

- The bytes of evidence and the stores that keep them: grc's.
- Signing a document or a manifest: the interface is designed, the signer is later.

## Edge cases

- A file in a folder that no layout of the folder names is a finding of the folder, per FR-004.
- An asset identity of one character has a place, because the shard is the first character, and one of a hundred characters is a document name; one longer is refused by `parseAssetId`, per FR-005.

## Assumptions

- A document name is at most 128 characters of letters, digits and `. _ ~ @ + = -`, as AnyFS's documents are.

## Open questions

- None.

## Key entities

- **Document** - one typed record of the estate in a store, with a schema, a layout and a revision.
- **Manifest** - what a store says it is: the fleet, the schema and the layout it is kept at.

## Success criteria

- **SC-001**: A document that breaks a rule of the estate, or that no layout names, never becomes a value of the estate: it is a finding.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
