# Feature Specification: Work and assets

**Spec ID:** 0007-work-and-assets
**Status:** Draft

**Input:** How the company's work and what it produces or owns relate to
each other, reusing established vocabulary rather than inventing new
concepts: the W3C PROV ontology for work and its outputs, and standard
accounting and asset-management categories (ISO 55000, GAAP/IFRS) for
assets.

## Work

- **FR-001**: A bounded piece of work MUST be represented as a
  `prov:Activity`. A standing, open-ended line of inquiry (such as a
  research pillar) MUST NOT be represented as a `prov:Activity`; it MAY
  instead be represented as a `prov:Plan` that bounded activities are
  carried out under.
- **FR-002**: A thing produced by an activity MUST be represented as a
  `prov:Entity`, linked to the activity that produced it by
  `prov:wasGeneratedBy`.
- **FR-003**: A `prov:Activity` individual is not itself required to be
  tracked in the Eidolon. Only its outputs, once they cross the threshold in
  FR-004, need to be.

## What crosses into the Eidolon

- **FR-004**: A `prov:Entity` MUST become a tracked `ifcore:Fact` —
  carrying its own audience declaration per 0001-eidolon-architecture
  FR-011 — once it is the subject of a Note or has received a Disposition
  (0006-research-and-ip FR-003, FR-005). Before that point, it is not
  required to be represented in the Eidolon at all.
- **FR-005**: When a decision transforms one entity into a materially new
  one — a research finding into a patent filing, for instance — the result
  MUST be a distinct individual related to its origin by
  `prov:wasDerivedFrom`, not the same individual retyped.

## Assets

- **FR-006**: Something the company owns that has potential or actual value
  MUST be represented as an `Asset`, categorized as `TangibleAsset`,
  `IntangibleAsset`, or `FinancialAsset`.
- **FR-007**: `IntellectualProperty` (patents, trademarks, trade secrets,
  defensive disclosures) and `DigitalAsset` (a distinct, separately-valuable
  digital property — a domain and its deployment, a distinct software
  product, a distinct dataset) MUST be represented as kinds of
  `IntangibleAsset`. A `DigitalAsset` MUST NOT be created for an individual
  page or file within a larger property.
- **FR-008**: An asset's own literal properties MUST be limited to
  classifications Intellectual Frontiers itself is the authority on. Any
  property an external registry (a patent office, a trademark office) is
  authoritative over MUST be represented as an `ExternalRecordReference`
  per 0001-eidolon-architecture FR-022, granular to the individual asset —
  never aggregated into one reference for an entire register, and never
  duplicated as a literal on the asset itself.
- **FR-009**: An asset with no external registry — a common-law mark, a
  trade secret — MAY hold its own classifying facts as literals, per
  0001-eidolon-architecture FR-020, since Intellectual Frontiers is the
  authority on them.
- **FR-010**: A trade secret's substantive content MUST be classified as
  sensitive under 0001-eidolon-architecture FR-016 by default. Its public
  representation MUST NOT describe what the secret actually is.

## Patent family relationships

- **FR-011**: A patent family that shares a priority claim with another
  MUST be related to it by the specific relationship that holds —
  continuation, divisional, or continuation-in-part — not left as an
  unrelated filing or collapsed into a generic derivation.

## Out of scope

- Equity interests, securities, and other financial assets are Capital's to
  establish in its own future spec; `FinancialAsset` is named here and left
  otherwise empty.
- Joint ownership percentages, license exclusivity, field-of-use, and
  territorial terms are not modeled yet — today's model only states who the
  primary rights-holder is.
- Asset stewardship distinct from legal ownership is not modeled; the
  company's single decision authority (0001-eidolon-architecture FR-029)
  covers this until a second role actually exists.

## Open questions

- **OQ-1**: Whether a `prov:Activity` individual should ever be tracked
  directly — to resolve an inventorship question, for instance — is
  unresolved. Today's default is that only outputs are tracked, never the
  activity itself.

## Key entities

- **An activity** — a bounded piece of work (`prov:Activity`), not itself
  required to be tracked.
- **An entity** — a thing produced by work (`prov:Entity`); becomes a
  tracked Fact only once it crosses the FR-004 threshold.
- **An asset** — something owned that has potential or actual value,
  categorized as tangible, intangible, or financial.

## Success criteria

- **SC-001**: No `prov:Entity` is tracked in the Eidolon before it is the
  subject of a Note or has received a Disposition.
- **SC-002**: No asset individual duplicates a literal value that its own
  `ExternalRecordReference` already carries.
- **SC-003**: No `DigitalAsset` individual exists for a single page or file
  within a larger digital property.
- **SC-004**: No trade secret's public representation states what the
  secret actually is.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No novel vocabulary invented where an established term already fits —
      PROV-O for work and its outputs, standard asset categories for what
      is owned
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
