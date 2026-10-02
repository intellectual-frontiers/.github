# Feature Specification: Content format

**Spec ID:** 0002-content-format
**Status:** Draft

**Input:** What a content document is, independent of any specific business
content type: a single HTML5 file, strictly parsed, typed against the
ontology, and carrying its own confidentiality declaration per
0001-eidolon-architecture's facts and audience model.

## What a content document is

- **FR-001**: A content document MUST be a single, complete HTML5 document.
- **FR-002**: A content document MUST parse with zero errors under the
  standard HTML5 parsing algorithm. A parser error MUST fail the document,
  not be silently corrected.
- **FR-003**: A content document MUST begin with `<!doctype html>` and carry
  `<html lang>`.
- **FR-004**: `<head>` MUST contain `<meta charset="utf-8">`, a non-empty
  `<title>`, and a non-empty `<meta name="description">`.

## Typing

- **FR-005**: `<head>` MUST contain exactly one
  `<script type="application/ld+json">` block. Its `@context` MUST resolve
  to the `ifweb:` namespace, and its `@type` MUST name a shape declared in
  the ontology.
- **FR-006**: Every property in the JSON-LD block MUST conform to the named
  shape. An unknown property, a missing required property, or a malformed
  value MUST fail the document.
- **FR-007**: A content kind MUST exist in the ontology — per
  0001-eidolon-architecture FR-037 — before any document may declare that
  `@type`. A document MUST NOT invent a type the ontology does not define.
- **FR-008**: A content document's `<title>` and `<meta name="description">`
  (FR-004) MUST be derived from the same fact(s) its JSON-LD block asserts.
  Neither MAY be independently authored text that could drift from it —
  0001-eidolon-architecture FR-019's single-source-of-truth rule applies to
  a document's own metadata, not only to business facts.

## Confidentiality

- **FR-009**: A content document is a Fact under 0001-eidolon-architecture
  and MUST declare its audience via `ifcore:hasAudience` in its JSON-LD
  block, per that spec's FR-011 through FR-014.
- **FR-010**: A content document MUST NOT resolve a `RestrictedDataReference`
  value into its body, per 0001-eidolon-architecture FR-027. It MAY state
  that the fact exists and how to request it.
- **FR-011**: A content document that displays a resolved
  `ExternalRecordReference` value MUST display the date it was resolved as
  of, visibly, per 0001-eidolon-architecture FR-026.

## Body

- **FR-012**: `<body>` MUST contain only an explicit allowlist of elements
  and attributes. Inline `<script>`, inline `<style>`, a `style` attribute,
  an event-handler attribute, and `<iframe>` are forbidden.
- **FR-013**: Every `<img>` MUST carry `alt`, `width`, and `height`.
- **FR-014**: Every link with `target="_blank"` MUST also carry
  `rel="noopener"`.
- **FR-015**: A URL anywhere in a content document MUST use one of: a
  site-relative path, a fragment, `https:`, `http:`, or `mailto:`.

## Authoring

- **FR-016**: Content authored as a content document MUST be authored
  directly as HTML5. Markdown, AsciiDoc, or any other markup language
  MUST NOT be used as the authoring format of a hand-authored content
  document. This rule governs content documents only: the source format
  of a work held as a work package is governed by
  0015-work-packages, not by this spec.
- **FR-017**: A content document MAY be generated from a work package's
  source (0015-work-packages) instead of being authored directly. A
  generated content document is exempt from FR-016 and from nothing
  else: FR-001 through FR-015 apply to it unchanged. Its JSON-LD block
  MUST declare `prov:wasDerivedFrom` naming the Substantial Work it
  renders, and it MUST satisfy the reproducibility and audience rules of
  0015-work-packages for generated content documents.

## Out of scope

- How a content document's path maps to a URL, and how it is served, is
  addressing — a separate, future spec.
- Composable layouts, includes, and reusable page fragments are
  templating — a separate, future spec.
- The source formats, layout, and lifecycle of a work whose text is not
  authored directly as a content document are work packages, a separate
  spec (0015-work-packages).
- Which specific content kinds exist beyond the minimal `Page` shape this
  spec establishes is deferred to the specs that establish those business
  concepts, per FR-007.

## Open questions

- **OQ-1**: The full allowlist of permitted body elements and attributes
  (FR-011) is not yet enumerated exhaustively; it will be refined as real
  content is authored against it.

## Key entities

- **A content document** — a single, complete HTML5 file, typed by a
  JSON-LD block naming an ontology shape, carrying its own audience
  declaration.
- **`Page`** — the minimal content kind: a content document with no
  properties beyond the ones every document already carries.
- **A generated content document** — a content document produced
  deterministically from a work package's source rather than authored
  directly, otherwise indistinguishable from an authored one.

## Success criteria

- **SC-001**: A content document that fails to parse, lacks a required head
  element, declares an undeclared type, or violates its named shape is
  rejected, naming the document and the specific failure.
- **SC-002**: No content document contains an inline script, an inline
  style, or a disallowed element or attribute.
- **SC-003**: No content document resolves a `RestrictedDataReference`
  value into its body.
- **SC-004**: Every content document rendering a cached
  `ExternalRecordReference` value shows its resolved-as-of date.
- **SC-005**: No content document's `<title>` or `<meta name="description">`
  states a fact its own JSON-LD block doesn't also assert.
- **SC-006**: No generated content document lacks `prov:wasDerivedFrom`
  naming the Substantial Work it renders; no content document is
  hand-authored in any markup other than HTML5.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (a specific parser, a specific hosting setup)
      — those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
