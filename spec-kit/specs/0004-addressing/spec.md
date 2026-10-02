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

## Resolving a request

- **FR-004**: A request for a URL path MUST be resolved against the public
  root's content. If no document matches there, it MUST then be resolved
  against the private vault's content.
- **FR-005**: Resolution MUST apply the same audience check
  (0001-eidolon-architecture FR-011 – FR-014) to a matched document
  regardless of which repository it came from. No matched document is
  served to a requester without this check.
- **FR-006**: A requester who does not satisfy any audience listed on a
  matched document MUST receive a response indistinguishable from no
  document existing at that URL. The response MUST NOT reveal that a
  restricted document exists there.
- **FR-007**: If no document matches a requested URL in either repository,
  the response MUST be the same as FR-006's — one not-found response, not
  two different ones a requester could use to tell "doesn't exist" apart
  from "exists but you may not see it."

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
  against an audience. FR-005 and FR-006 describe what must happen once
  that mechanism exists, not how to build it.

## Key entities

- **A URL path** — the public address a content document resolves to,
  derived deterministically from its file path, never assigned separately.
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

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (a specific web framework, a specific hosting
      setup) — those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
