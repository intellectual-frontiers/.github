# Feature Specification: Content physical (draft)

**Spec ID:** 0004-content-physical
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Physical is one instance for each rendition (commons 0033-kanon FR-019, FR-030). An instance reads the model and writes generated artifacts; it is declared in its own package named by the family's rule and accounts for each annotation of Governance.

## Requirements

- **FR-001**: An instance MUST be a package `<scope>/content-rendition-<name>` that declares `extends` (the host) and its role as a dialect, with `kanon.ts` as its manifest (0033-kanon FR-027), runs the check of Kanon in its own `verify`, and imports the host only through its public exports (0033-kanon FR-006).
- **FR-002**: An instance MUST give, as typed data, its **account**: for each annotation of each kind of element of Governance, one of `expressed` (with the element of the instance that enforces it), `carried` (with the element that passes it on as data) or `unexpressed` (with a reason), so that the host builds the dispositions of the model from the accounts of the instances (0033-kanon FR-005, FR-022).
- **FR-003**: An instance MUST write only generated artifacts (0033-kanon FR-030) into a folder it is given, MUST NOT write into the bundle or a source, and MUST be the same bytes for the same bundle.
- **FR-004**: The **web** instance MUST write, for each collected page, one HTML document at the address its route rule makes from the page's id, with its title, its summary, its claims and, where a claim has evidence, a citation that is visible and linked (an `expressed` evidence); a canonical address for each page; and a document that needs no script to be read. Its account MUST say, for `audience`, `voice` and `license`, how each is expressed or carried (a license in the page's machine-readable data), or unexpressed with a reason.
- **FR-005**: The **feed**, **llms**, **markdown** and **jsonld** instances MUST each write their artifacts from the same model and give their own account, so that an annotation expressed on the web and dropped by another instance is found by the check (draft 0005).

## Acceptance scenarios

1. **Given** the web and llms instances where the web expresses a claim's evidence as a citation and llms carries it as data, **When** a third instance gives no account of it, **Then** the check names that instance, per FR-002 and draft 0005.
2. **Given** the same bundle twice, **When** an instance writes, **Then** the bytes are the same, per FR-003.

## Out of scope

- Email, print and slides (later instances); a content delivery network, caching and headers of a service.

## Open questions

- **OQ-1**: The route rule (page id to address) is each instance's or one rule of the host; the draft makes it the instance's and requires a canonical address.
