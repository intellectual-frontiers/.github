# Feature Specification: The content method, websites are renditions of books

**Spec ID:** 0039-content-method
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0033-kanon

**Input:** A body of content is written once as books and then carried out in renditions (a website for people and for agents, a Markdown twin, a feed, print). The books hold the claims, their evidence and their dates; a rendition never holds a fact the books do not. This specification states the method, the authoring grammar that lets a collector read the books, the typed vocabulary of the annotations and relations, the contracts of the instances, and the first requirement-by-instance matrix. It is generic: it names no company, product or site, and the first consumer is a site series.

## The method

- **FR-001**: A body of content MUST be made as a **series** of **books** and never as pages: a series has a **series bible** (a decision table, shared terms, the claim labels of FR-006, the dated facts, the source discipline, a register of the companies and people named, the fact-check protocol, a register of research debt, a corrections log, the 90-day re-verification of FR-009 and the editions), and each book has one declared **role** (market research, a fieldbook of regimes and facts with source keys, a questions book of sourced questions and answers, a practice book); a rendition is made from books and MUST NOT be edited by hand to say what no book says.
- **FR-002**: A book MUST have a status of the closed union `AUDIT_STATES` (`not-audited`, `audited`), and a book MUST be `not-audited` until the audit the series bible names (its claim pass, its heading pass and its cold-auditor brief, and the gate of the production line) has been recorded as passed; a rendition MUST NOT say, and a page MUST NOT claim, that a book is audited while its status is `not-audited`.
- **FR-003**: The production line of a book MUST be a voice sweep, then an audit by readers who did not write the book, then the gate; where a step cannot be run as a command today (the voice sweep of the first consumer is a function with no command), the gap MUST be a finding of this method and not an assumption that the step ran.
- **FR-004**: The books MUST be the only source of a fact in a rendition: the collector reads books and writes typed content and a bundle (draft 0003), and a service of a rendition serves only what the bundle holds (draft 0003 FR-004).
- **FR-005**: A body of content MUST say which kinds of content it keeps off a public surface, as typed data of its series bible (the `disclosure` and `legalBoundary` annotations of FR-007): at least an allegation about a named party unless its denial is beside it, a comparison that rests on anything but documented facts that counsel approved, any claim that a book is audited (FR-002), any statement about a product itself, and anything that relies on a fact-check not yet done (`FACT_CHECK_STATES`).

## The vocabulary

- **FR-006**: The element kinds, the claim labels, the volatilities, the audit and fact-check states, the sensitivities and the decision statuses MUST be closed unions written once as data (`vocabulary.ts` of the library `content`, below) and never as free text; a name outside a union is a finding (`kanon/kind` of 0033-kanon FR-026 where the vocabulary is declared).
- **FR-007**: The annotations MUST be those of `ANNOTATIONS` below, each with the element kinds it applies to, the type of its value and whether it is required; each is a property of the element and MUST end, for each instance, expressed, carried or unexpressed with a reason (0033-kanon FR-005, FR-022).
- **FR-008**: The relations MUST be those of `RELATION_KINDS` below, each with the kinds it may join; a relation MUST be held as a relation of Kanon (0033-kanon FR-029) and never as a field that names an address.
- **FR-009**: A fact that can change (a date, a rule, a price, a version, a count) MUST carry `volatility` `volatile` or `dated`, an `asOf` day and a `reverifyBy` day; a volatile fact not re-read within 90 days of its `asOf` MUST be a finding of the collector and, until the policy of FR-014 is changed by the owner, a warning of the form of FR-014. The companion pages that state such facts on their own do not exist yet and MUST NOT be assumed.

```ts
// The closed vocabulary of the content method. Typed data, read by the collector.
export const ELEMENT_KINDS = ["series", "book", "chapter", "entry", "claim", "source", "record", "page"] as const;
export const LABELS = ["evidence", "vendor-documentation", "inference", "hypothesis", "opinion", "illustration"] as const;
export const VOLATILITY = ["static", "dated", "volatile"] as const;
export const AUDIT_STATES = ["not-audited", "audited"] as const;
export const FACT_CHECK_STATES = ["not-requested", "requested", "replied", "done"] as const;
export const DECISION_STATUS = ["proposed", "decided", "open"] as const;
// ANNOTATIONS (name: on which kinds, value, required): audience (claim, page: a declared audience, required),
//   label (claim: LABELS, required), evidence (claim: list of source keys, required, may be empty with a reason),
//   asOf (claim, source: a day), reverifyBy (claim, source: a day), volatility (claim: VOLATILITY),
//   voice (chapter, page: the name of a voice guide), license (book, page: OQ-1), disclosure (claim, page),
//   legalBoundary (claim, page), invented (claim: a note, for an illustration), sensitivity (record),
//   status (book: AUDIT_STATES; claim: DECISION_STATUS), audit (book: AUDIT_STATES, default not-audited),
//   factCheck (claim, book: FACT_CHECK_STATES, default not-requested).
// RELATION_KINDS (from -> to): supports (source -> claim), contradicts (claim -> claim), answers (entry -> claim),
//   cites (claim, page -> source), supersedes (claim, page -> claim, page), derived-from (page -> book, chapter, entry).
```

The block is the contract; the typed module is its implementation and is written when the library exists (OQ-2).

## The authoring grammar

- **FR-010**: A chapter MUST be AsciiDoc with structured comments that the collector reads and a renderer ignores: `// CLAIM: id=<id> label=<label> evidence=<keys> asof=<day> reverify=<day> volatility=<volatility> audience=<audience>` binds to the block that contains the comment or, where that block is only comments, the next block; `// OPINION: <note>` lists a passage an AI wrote as opinion for the owner to review; `// INVENTED: <note>` marks an illustration. A comment that cannot be read (a marker with no block, an attribute with no value, an unknown label, a malformed or repeated id, a malformed day, an unknown volatility) MUST be a finding with its line and MUST NOT be skipped.
- **FR-011**: A **source key** `{{key}}` MUST be resolved for each chapter by the file `<chapter>.sources.txt`, one entry for each line, `key | text | address`, where the text may hold the day the source was read and what it does and does not establish; the notes MUST be numbered by first use in the chapter, entries with the same address MUST be merged, no book-level registry exists, and a key with no entry, an entry no chapter uses, a repeated key and a line that cannot be read MUST be findings.
- **FR-012**: A claim id MUST be minted by the collector where the author gave none, as `<chapter>/m<ordinal>` and flagged `minted`, because the books carry none today; the marker `// CLAIM` is a proposal of this specification, it is not in the books and MUST NOT be added to them before the owner approves it and the session that keeps them agrees (OQ-3).
- **FR-013**: The grammar MUST be a pure function of text (no file, no network, no clock): the prototype is `parseSource`, `parseSources` and `mintIds`, tested against the cases of this specification before the library exists (the scenarios below).

## The softened rule

- **FR-014**: A claim whose evidence no instance accounts for MUST NOT fail a build before the day the owner sets. The policy MUST be the typed dated value `CONTENT_GATE_POLICY` and the decision a pure function `contentGateDecision(day)`, in the form of `RELEASE_POLICY` of `commons/libraries/src/ci/policy.ts` (0038-build-policy FR-010): until `2027-01-31` such a claim MUST be a warning that is a planning issue of `commons/planning` (0037-planning) which the owner or a reviewer reviews, and the matrix MUST show it; after that day nothing changes by itself, the policy MUST record a finding `content-gate-review-due` that asks the owner, and only a decision recorded in the policy by `shah` on a day turns the warnings into build failures from that day.

```ts
export type ContentGatePolicy = {
  readonly mode: "warn-as-planning-issues";
  readonly until: string; // a day, YYYY-MM-DD
  readonly reviewedOn?: string;
  readonly decision?: { readonly by: "shah"; readonly on: string; readonly mode: "fail-build" };
};
export const CONTENT_GATE_POLICY: ContentGatePolicy = { mode: "warn-as-planning-issues", until: "2027-01-31" };
// contentGateDecision(day, policy): "fail-build" only where policy.decision.by === "shah" and day >= decision.on;
// otherwise "warn" and, where day > until and no reviewedOn, one finding code "content-gate-review-due",
// severity "error", module "repository", which holds nothing.
```

- **FR-015**: A finding of Kanon MUST be a finding, and what it does to a build MUST be the decision of its host (0033-kanon FR-034); this specification fixes the decision of the library `content` only by FR-014.

## The instances

- **FR-016**: The **web** instance for people MUST serve each page as answer-first HTML (the answer in the first sentence under the heading), each with its claims' evidence, its `asOf` day and the audit status of its book, and MUST show no claim that is `not-audited` as audited.
- **FR-017**: The **web** instance for agents MUST serve a **Markdown twin** of each page at a stable address, a sitemap and a robots policy that is typed data and not hand-written, a feed of changes, and a **tool server** that answers a question of the corpus ("ask the corpus") with the claims and sources that answer it and nothing the bundle does not hold.
- **FR-018**: Every instance MUST be a Physical element made from the Logical model by code (0033-kanon FR-002) and read the bundle only after `verifyBundle` has passed (draft 0003 FR-004); **print** or PDF follows the web instance, and applications later; an instance added later adds a column of the matrix of FR-019.

## The matrix

- **FR-019**: The requirement-by-instance matrix of the first consumer MUST begin as the table below, a row for each annotation and a column for each instance, and each cell MUST be one of `expressed`, `carried`, `unexpressed` (with a reason) or `dropped`; a `dropped` cell is the warning of FR-014.

| Annotation | Web (human) | Markdown twin | Tool server | Feed | Print |
|---|---|---|---|---|---|
| audience | expressed | carried | carried | carried | unexpressed: one audience for each edition |
| label | expressed | expressed | carried | carried | expressed |
| evidence | expressed (notes) | expressed (notes) | carried | carried | expressed |
| asOf, reverifyBy | expressed | carried | carried | expressed | expressed |
| volatility | carried | carried | carried | carried | unexpressed: a printed edition is dated |
| voice | carried | carried | unexpressed: answers are not prose | unexpressed | carried |
| license | expressed | expressed | carried | expressed | expressed |
| disclosure, legalBoundary | carried | carried | carried | carried | carried |
| audit | expressed | expressed | carried | carried | expressed |
| factCheck | carried | carried | carried | carried | carried |

## Acceptance scenarios

1. **Given** a chapter whose comment `// CLAIM` has attributes and a following paragraph that holds `{{key}}`, **When** it is parsed, **Then** the claim is bound to that paragraph and the key is collected, per FR-010 and FR-011.
2. **Given** a marker with no block, an attribute with no value, an unknown label and a repeated id, **When** it is parsed, **Then** one finding is given for each with its line, per FR-010.
3. **Given** a chapter whose claims carry no id, **When** the ids are minted, **Then** they are `<chapter>/m<ordinal>`, flagged minted, in the order of the text, per FR-012.
4. **Given** a name outside a union of the vocabulary, **When** the vocabulary is checked, **Then** it is a finding, per FR-006.
5. **Given** the day 2027-01-31 and the policy of FR-014, **When** the decision is made, **Then** it is `warn`; **Given** the day 2027-02-01 and no `reviewedOn`, **Then** it is `warn` with the finding `content-gate-review-due`; **Given** a decision of `shah` on 2027-02-10, **Then** the day 2027-02-10 is `fail-build` and the day before is `warn`, per FR-014.
6. **Given** a claim whose evidence a third instance does not account for, **When** the assembly runs before the end of January 2027, **Then** the build passes, the claim is a planning issue and the cell of the matrix is `dropped`, per FR-014 and FR-019.
7. **Given** a book with no recorded audit, **When** a rendition is made, **Then** it shows `not-audited` and none says audited, per FR-002 and FR-016.
8. **Given** a fact with `volatility` `volatile` and an `asOf` of more than 90 days ago, **When** the content is collected, **Then** a finding is given, per FR-009.
9. **Given** a page of the web instance for agents, **When** its Markdown twin is asked for, **Then** it is at the stable address and holds the same claims, per FR-017.
10. **Given** a rendition whose bundle has a changed file, **When** the service starts, **Then** it refuses the whole folder and serves nothing, per FR-018.

## Out of scope

- The books themselves and any claim they make; a site, a brand or a company; the library `content` (it does not exist; it is made only after Kanon A and B are in force and the owner says so); a product-and-proof book, a buyer's guide, a glossary and a customer-evidence book (none is planned).

## Edge cases

- A claim with no `evidence` and a reason: kept, per draft 0002 FR-005; the empty list without a reason is a finding, per FR-007.
- A source key used in two chapters: resolved in each by its own `.sources.txt`; no book-level registry, per FR-011.
- The claims ledger of the books covers only the claims that need a second check and is stale: it MUST NOT be read as the list of claims, per FR-012.

## Assumptions

- Kanon A (0033-kanon with FR-025 to FR-034) and Kanon B (kanon 0001-kanon-checker and 0002-kanon-content-checks) are Draft, not in force, as of 2026-11-22.
- The books are AsciiDoc with `.sources.txt` beside each chapter.

## Standards considered

| Term | Standard and term | Relation | Verified |
|---|---|---|---|
| Source, cites | DCMI Metadata Terms: `dcterms:references`, `dcterms:source` | `closeMatch` | read: the names are on the page of the terms |
| Supersedes | DCMI Metadata Terms: `dcterms:replaces`, `dcterms:isReplacedBy` | `closeMatch` | read |
| License | DCMI Metadata Terms: `dcterms:license` | `exactMatch` for the property, the values are OQ-1 | read |
| Derived-from | W3C PROV-O: `prov:wasDerivedFrom` | `closeMatch` | read |
| Claim, supports, contradicts | W3C Web Annotation: an annotation with a body, a target and a motivation | `broadMatch`: the vocabulary's own terms are not copied | read for the names `hasTarget`, `hasBody`, `motivation`; the full model not read |
| Questions book entry | the schema.org vocabulary `Question` and `Answer` (`acceptedAnswer`) | `closeMatch` for the shape of a question with one accepted answer | read |
| Claim, review of a claim | the schema.org vocabulary `ClaimReview` (`claimReviewed`, `reviewRating`) | `broadMatch`: an audit is not a review of a claim by a third party | read |
| Dataset of the bundle | the schema.org vocabulary `Dataset` | `broadMatch` | read |
| Bundle | RFC 8493 (BagIt): a payload manifest of digests | `closeMatch` | read: the table of contents and the manifest sections; the manifest of a Kanon bundle is its own form |
| Source label values, audit states, claim labels | none found | `unaligned` | a Decision of the owner is needed before they are terms of an ontology (0018-standards-first FR-005) |

A standard not read here is not cited. The nearest for facts with a validity period (the dates of a source) were not examined.

## Open questions

- **OQ-1**: The values of `license` (candidates are an SPDX expression for software and a Creative Commons identifier for text; neither was read for this specification).
- **OQ-2**: Whether the typed vocabulary module is made now in scratch form or only when `commons/content` exists (the owner says so).
- **OQ-3**: Whether the owner approves the proposal `// CLAIM` and the session that keeps the books agrees; until both, the books are not edited and the collector mints ids (FR-012).
- **OQ-4**: Whether Kanon A and B are put in force so that `commons/content` may be made with `bun run repoctl new library content`; the owner is asked before it is created.

## Key entities

- **Series, book, chapter, entry, claim, source, record, page** - the element kinds of FR-006.
- **Annotation, relation** - FR-007 and FR-008.
- **Content gate policy** - FR-014.
- **Instance, matrix** - FR-016 to FR-019.

## Success criteria

- **SC-001**: Every sentence of a rendition can be followed to a claim of a book with its evidence and its day, and no rendition says a book is audited that is not.
- **SC-002**: The collector reads the grammar over the whole of the books with no unreadable comment unreported.
- **SC-003**: Until 2027-01-31 no build is stopped by a missing account and each is a planning issue, after which nothing changes without a decision of the owner.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
