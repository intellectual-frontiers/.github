# Feature Specification: Content layers (draft)

**Spec ID:** 0001-content-layers
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The library `@intellectual-frontiers/content` holds a body of public-facing content (marketing, sales, promotional, B2B and B2B2C) in Kanon's three layers (commons 0033-kanon), so that what is claimed is stated once, collected into a model, and carried out by one instance for each rendition: the web first, then a feed, a text file for models, Markdown twins and linked data, later a message, a print page and slides.

## Requirements

- **FR-001**: The library MUST be a Kanon host (commons 0033-kanon FR-010): its manifest declares a table whose units are `src/governance/` (Governance, data modules, FR-025 of 0033-kanon), `src/logical/` (the collector and the bundle) and `src/physical/rendition/` (the contract of an instance), and the check of Kanon is part of its `verify` (0033-kanon FR-014).
- **FR-002**: Its family MUST be `{host}-rendition-{name}` for an instance and `{host}-{name}` for a plugin, with `scope: any` (0033-kanon FR-027, FR-033), so that the renditions of a body of content live in the package of its owner and not in commons. The host MUST NOT name a consumer and MUST NOT import one.
- **FR-003**: The instances the library itself defines the contract for are `web`, `feed`, `llms`, `markdown` and `jsonld`; `email`, `print` and `slides` are later and each is a new instance and never a change of the host. An instance name is a lower-case word (0033-kanon FR-019).
- **FR-004**: The library MUST depend on `kanon`, `core`, `crypto` and `formats` and on no library above `kanon` in the layers of commons 0032-libraries-by-concern (a layer-3 library), and the names `content` and `content-*` stay held for it (0033-kanon FR-033).
- **FR-005**: The library MUST declare its vocabulary (0033-kanon FR-028): the element kinds `page`, `claim`, `record` for Governance, `collected-page` and `collected-claim` for Logical, one kind for each instance in Physical; the relation kinds `links`, `cites`, `supersedes` and `related`; and the annotations of draft 0002.

## Acceptance scenarios

1. **Given** the library's manifest, **When** the check of Kanon runs, **Then** it passes with the table of FR-001, per FR-001.
2. **Given** a package of another scope named `<scope>/content-rendition-web` that declares `extends` and its role, **When** it is classified by the host's family, **Then** it is a member, per FR-002.
3. **Given** the vocabulary of FR-005, **When** a model has a claim of kind `quote`, **Then** `kanon/kind` names it, per FR-005.

## Out of scope

- The collector, the content model and the bundle (draft 0003); the instance contract (draft 0004); the matrix (draft 0005).
- Any consumer, and the content host that serves a bundle.

## Open questions

- **OQ-1**: Whether `jsonld` is one instance or the annotation of another (a page carries its own structured data): the draft makes it an instance so that its accounting is explicit.
