# Feature Specification: Content collector

**Spec ID:** 0001-content-collector
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A public claim carries the evidence and dates declared in its source to each rendition, with an inspectable trace.

## Requirements

- **FR-001**: The library MUST declare its Kanon Governance, Logical and Physical units and the cross-scope `content-rendition-<name>` family. Its public entry points MUST expose the vocabulary, collector, and rendition contract.
- **FR-002**: The collector MUST accept blocks from a structural document parser with their source locations. It MUST resolve chapter source keys, mint stable ordinal IDs for unmarked sourced blocks, default audit status to `not-audited`, report malformed markers, duplicate IDs, unresolved evidence and stale dated claims, and omit restricted content.
- **FR-003**: The assembly MUST project validated claims through a Logical element to each rendition, compare observed evidence, date and audit status against the claim, and use Kanon to report dropped annotations and generate a matrix. It MUST write a deterministic Kanon data bundle and verify it before use.
- **FR-004**: The content gate MUST warn about missing rendition evidence until the owner records a dated decision. An unreviewed policy after 2027-01-31 MUST give the review-due finding; the date alone MUST NOT commence a hold.

## Acceptance scenarios

1. **Given** a sourced public block and a restricted block, **When** a chapter is collected, **Then** the public claim traces to its block and the restricted block is omitted, per FR-002.
2. **Given** two observed renditions of a claim and a missing citation in one, **When** the model is assembled, **Then** the matrix and finding name that rendition, per FR-003.
3. **Given** a date after 2027-01-31 with no recorded decision, **When** the gate runs, **Then** it warns and reports review due, per FR-004.

## Edge cases

- A malformed source note or unknown key produces a finding at its source location (FR-002).
- Two observations for the same claim and rendition are ambiguous and rejected (FR-003).

## Assumptions

- The consumer's parser identifies document blocks and supplies their disclosure and source location (FR-002).
- The day is supplied by the caller and the collector does not read the clock.

## Open questions

- The corpus continues to use the current chapter sources until the owner decides on the proposed author markers and licensing vocabulary.

## Key entities

- **Claim**: a public assertion and the resolved evidence and provenance that travel with it.
- **Observation**: what one rendition actually presents about a claim.

## Success criteria

- A reviewer can identify the exact source line and rendition when an output drops evidence.
- Bundle verification refuses a file that is changed after collection.

## Review & acceptance checklist

- [x] Requirements have acceptance scenarios and automated checks.
- [x] This specification cites the content method in commons 0039-content-method.
