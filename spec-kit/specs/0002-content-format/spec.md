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

## Confidentiality

- **FR-008**: A content document is a Fact under 0001-eidolon-architecture
  and MUST declare its audience via `ifcore:hasAudience` in its JSON-LD
  block, per that spec's FR-011 through FR-014.
- **FR-009**: A content document MUST NOT resolve a `RestrictedDataReference`
  value into its body, per 0001-eidolon-architecture FR-027. It MAY state
  that the fact exists and how to request it.
- **FR-010**: A content document that displays a resolved
  `ExternalRecordReference` value MUST display the date it was resolved as
  of, visibly, per 0001-eidolon-architecture FR-026.

## Body

- **FR-011**: `<body>` MUST contain only an explicit allowlist of elements
  and attributes. Inline `<script>`, inline `<style>`, a `style` attribute,
  an event-handler attribute, and `<iframe>` are forbidden.
- **FR-012**: Every `<img>` MUST carry `alt`, `width`, and `height`.
- **FR-013**: Every link with `target="_blank"` MUST also carry
  `rel="noopener"`.
- **FR-014**: A URL anywhere in a content document MUST use one of: a
  site-relative path, a fragment, `https:`, `http:`, or `mailto:`.

## Authoring

- **FR-015**: Content MUST be authored directly as HTML5. Markdown,
  AsciiDoc, or any other markup language MUST NOT be used as an authoring
  format for content documents.

## Out of scope

- How a content document's path maps to a URL, and how it is served, is
  addressing — a separate, future spec.
- Composable layouts, includes, and reusable page fragments are
  templating — a separate, future spec.
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

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (a specific parser, a specific hosting setup)
      — those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
