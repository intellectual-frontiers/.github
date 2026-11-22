# Feature Specification: Content governance (draft)

**Spec ID:** 0002-content-governance
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Governance of a body of content says what is claimed, to whom, on what evidence, in whose voice and under what license, stated once as typed data modules (commons 0033-kanon FR-025) and never copied into a rendition.

## Requirements

- **FR-001**: A **page** MUST be a typed value with an id (`page:<slug>`), a title, a summary, the ids of the claims it makes, the ids of the records it shows, and its annotations; a **claim** a value with an id (`claim:<slug>`), the sentence, and its annotations; a **record** a value with an id (`record:<kind>/<slug>`) and its fields (a customer, a product, a price, a case), as data and never as markup.
- **FR-002**: The annotations MUST be `audience` (one of the audiences the body of content declares), `evidence` (the list of sources a claim rests on: a document, a measurement, a customer record, each by an id), `voice` (the voice a text is in, by the name of a voice guide the owner keeps) and `license` (under which terms a text and its media may be reused), and an annotation MUST be a property of the element so that it must end, for each instance, expressed, carried or unexpressed with a reason (0033-kanon FR-005, FR-022).
- **FR-003**: Pages, claims and records MUST relate by relations of the vocabulary (`links`, `cites`, `supersedes`, `related`), never by a field that names a page by its address: an address is the instance's.
- **FR-004**: A Governance module MUST import nothing of the library's Logical or Physical units and no instance (`layers/above`, 0033-kanon FR-004), and MUST export data only, so that the collector can read it without running a rendition.
- **FR-005**: A claim MUST have an `evidence` annotation, possibly empty with a reason that says why none exists (a statement of intent, a price list); a claim with neither is a finding of the collector (draft 0003), and the owner decides what counts as evidence for each audience.

## Acceptance scenarios

1. **Given** a claim with no `evidence`, **When** the content is collected, **Then** the collector reports it, per FR-005.
2. **Given** a page that names another page by an address, **When** the module is checked, **Then** it is refused, per FR-003.

## Out of scope

- The values of `license` and `voice` (OQ-1, OQ-2); the audiences of any company.

## Open questions

- **OQ-1**: The vocabulary of `license` values: an SPDX expression for software and a Creative Commons identifier for text are candidates and neither is read in this work; the owner decides, and a standard not read is not cited.
- **OQ-2**: Whether a voice is named by a file of the owner's voice guides or by a typed record.
- **OQ-3**: The evidence kinds and what is evidence for a regulated claim (a claim that a regulation is met is one the owner decides).
