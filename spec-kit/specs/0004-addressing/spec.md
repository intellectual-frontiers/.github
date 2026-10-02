# Feature Specification: Addressing

**Spec ID:** 0004-addressing
**Status:** Draft

**Input:** How a content document's file path becomes a URL, and how a
request for that URL is resolved across the Eidolon's public root and
private vault, given persistence stays Git-backed with no live
network-mounted source (0001-eidolon-architecture FR-005).

## Path to URL

- **FR-001**: A content document's file path, relative to its repository's
  content root, MUST be its URL path exactly, with the `.html` extension
  removed.
- **FR-002**: A file named `index.html` MUST map to the URL path of its
  containing directory, not to a path ending in `/index`.
- **FR-003**: No two content documents, across the public root and the
  private vault combined, MAY map to the same URL path.
- **FR-004**: A repository's content root MUST be a directory named
  `content/` at that repository's root — `content/` in the public root for
  content whose audience is Public, `content/` in the private vault for
  all other content, including the content of every work whose package the
  vault holds. No other directory in either repository MAY hold a content
  document. A work package's source files are not content documents
  (0015-work-packages). The vault's content root MAY hold a document whose
  audience is Everyone; such a document is resolved and served exactly as
  a public-root document is, under FR-005 through FR-008.

## Resolving a request

- **FR-005**: A request for a URL path MUST be resolved against the public
  root's content. If no document matches there, it MUST then be resolved
  against the private vault's content.
- **FR-006**: Resolution MUST apply the same audience check
  (0001-eidolon-architecture FR-011 – FR-014) to a matched document
  regardless of which repository it came from. No matched document is
  served to a requester without this check.
- **FR-007**: A requester who does not satisfy any audience listed on a
  matched document MUST receive a response indistinguishable from no
  document existing at that URL. The response MUST NOT reveal that a
  restricted document exists there.
- **FR-008**: If no document matches a requested URL in either repository,
  the response MUST be the same as FR-007's — one not-found response, not
  two different ones a requester could use to tell "doesn't exist" apart
  from "exists but you may not see it."

## Consumers

- **FR-009**: A web property that serves Eidolon content MUST obtain it
  from the content roots of both repositories, vendoring it at the
  property's own build time, and MUST apply FR-005 through FR-008 to
  everything it serves. A consumer MUST NOT serve a file from a work
  package (0015-work-packages) except as a content document or as a
  delivered rendition under FR-010.
- **FR-010**: A consumer that serves a delivered rendition (0015-work-packages)
  MUST apply the audience declared on that rendition's own delivery
  record, per 0001-eidolon-architecture FR-011 through FR-015, and MUST
  NOT serve it to a requester who does not satisfy that audience. Where a
  consumer retrieves renditions from storage outside both repositories,
  and when it retrieves them, is the consumer's own decision and is
  recorded in the consumer's own spec, not here.

## Out of scope

- How a requester proves membership in an audience — authentication,
  sessions, what satisfies "a specific named agreement" — is a separate,
  future spec. This spec defines what gets checked, not how the check is
  answered.
- Composable layouts, includes, and reusable fragments remain templating,
  out of scope per 0002-content-format.
- A live, network-mounted content source remains out of scope per
  0001-eidolon-architecture FR-005; addressing here is defined entirely
  over Git-backed content.

## Open questions

- **OQ-1**: No mechanism yet exists for actually authenticating a requester
  against an audience. FR-006 and FR-007 describe what must happen once
  that mechanism exists, not how to build it.

## Key entities

- **A URL path** — the public address a content document resolves to,
  derived deterministically from its file path, never assigned separately.
- **A consumer** — a web property that vendors content from both
  repositories at its own build time and applies the resolution and
  audience rules of this spec to what it serves.
- **A not-found response** — the single response shape for both "no
  document here" and "a document is here but you may not see it."

## Success criteria

- **SC-001**: Requesting a document's exact file-path-derived URL returns
  that document.
- **SC-002**: Requesting a URL with no matching document, and requesting a
  URL whose matching document's audience the requester doesn't satisfy, are
  indistinguishable from outside.
- **SC-003**: No two content documents across both repositories ever
  resolve to the same URL.

- **SC-004**: No consumer serves a document or a delivered rendition
  without the audience check; no consumer serves a work package's source
  file directly.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (a specific web framework, a specific hosting
      setup) — those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
