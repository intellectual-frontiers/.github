# Feature Specification: GRC catalog data packages

**Spec ID:** 0008-grc-catalogs
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** The content of a catalog (NIST SP 800-53, FedRAMP baselines, the Secure Controls Framework, an organization's own policy set) is data, not code, and is not in this library. It will be published as separate data packages that hold only documents of the kinds of 0002-grc-governance. This specification gives the shape of such a package; the loader (`readCatalogPackage`) is built, and no package is built here.

## The package

- **FR-001**: A catalog package MUST hold a manifest, a document of kind `grc.catalog-package` (`id`, `schema`, `version`, `title`, `source` with the publisher's name, edition and URL, `licence` as an SPDX identifier or a statement, `redistributable`, `sources`, `holds`: the list of its documents with each one's kind, id and digest), and the documents themselves (`grc.framework`, `grc.crosswalk`, and optionally `grc.policy`, `grc.check` and `grc.evidence-policy`) as JSON files.
- **FR-002**: A package MUST hold no code and no executable input; the loader MUST read each file through the registry of kinds (0004), check its digest against the manifest, and refuse a package with a document of a kind or a schema this release does not know.
- **FR-003**: The controls of a package MUST be addressed by the URN of 0002 under the package's framework slug and the edition's version, and a package of a newer edition MUST be a new package version, never a change of one already published.
- **FR-004**: Every package MUST record its licence and source, and a package whose content may not be redistributed MUST say so in the manifest and MUST hold only identifiers and mappings.

- **FR-005**: A package MUST record where its content came from as data: the publisher's URL or commit, the edition and the SHA-256 of each source file it was made from, so that a change of the source is found; sources the package reads are an OSCAL catalog or profile, a workbook of the Secure Controls Framework, the rules of a regulator's programme (FedRAMP's), and a schema pin of an exchange format.
- **FR-006**: What a person writes (policies as Markdown with front matter, acknowledgments, risks, vendors, roles, engagement records) MUST be read as data and never executed: a literal file is read by its literals, so that its past versions read the same from Git.

## Scenarios

- **Given** a manifest that lists a framework whose digest differs, **When** the package is loaded, **Then** the loader refuses the package and names the file, per FR-002.

## Out of scope

- Building any package; the licences of any catalog (checked by the person who publishes it).

## Edge cases

- A package with a crosswalk to a framework it does not hold: valid, the other end is found when both are loaded, per FR-003.

## Assumptions

- A package is published to npm or as files in Git; the loader reads folders.

## Open questions

- **OQ-1**: The naming of packages (`grc-catalog-<name>`).

## Key entities

- **Catalog package**, **Manifest**.

## Success criteria

- **SC-001**: A catalog is added by installing data, with no change to this library.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
