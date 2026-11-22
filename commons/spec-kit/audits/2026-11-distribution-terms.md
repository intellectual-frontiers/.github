# Decision record (proposed): the terms of the distribution of a package of commons

**Status:** Proposed on 2026-11-22; the owner accepted the recommendation in conversation the same day ("accept all recommendations"), pending the signature of the owner. The ontology records the Decision of the three `unaligned` terms with that date (0018-standards-first FR-005: due within 90 days of the commit that adds the term, 2027-02-20); the signature below is the owner's alone to give.

**Specifications:** 0002-packaging FR-030 and FR-031; 0036-distribution FR-023, FR-031 to FR-034 and OQ-1.

## The terms and what the audit says of each

| Term | Basis in the audit | Why |
|---|---|---|
| `pm:ContentPolicy` | `unaligned` | Commons' own term for what a published package may and may not hold. |
| `pm:SizeBudget` | `unaligned` | Commons' own term for the limits the packer's inspection enforces. |
| `pm:UsageReport` | `unaligned` | Commons' own term for what a consumer imports of a package and what that reaches. |
| `pm:PeerDependency` | `maps` (`closeMatch`) to SPDX 3.0.1 `hasProvidedDependency` | npm's `peerDependencies`: a dependency not in the artifact and assumed to be provided. |
| `pm:OptionalPeer` | `maps` (`closeMatch`) to SPDX 3.0.1 `hasOptionalDependency` | npm's optional peers, and the field `ifcOptionalPeers`. |

## What was examined

- SPDX 3.0.1 model (`https://spdx.org/rdf/3.0.1/spdx-model.ttl`) for the IRIs of the two relationship types, and the pages of the SPDX 3.0.1 specification for the vocabularies `RelationshipType` and `LifecycleScopeType` (entries `build`, `design`, `development`, `other`, `runtime`, `test`).
- SPDX 2.3.1, clause 11, relationship types `PROVIDED_DEPENDENCY_OF` and `OPTIONAL_DEPENDENCY_OF` (the same ideas in the earlier version, read and not mapped).
- All read on 2026-11-22 from the pages of the SPDX project.

## What was not examined

- The rest of the SPDX 3 model (the Software, Build and Security profiles), CycloneDX and the Package URL specification, for the three `unaligned` terms.
- Whether the mapping of a class to a relationship type (an individual of a vocabulary) is the best form. It is a judgement a person reviews: a peer is both provided and, if optional, optional, and SPDX names those as two relationship types.

## Proposed decision

Keep `pm:ContentPolicy`, `pm:SizeBudget` and `pm:UsageReport` as commons' own terms, `unaligned`, because no standard examined names them; revisit if a standard that names a package's content policy or size limit is found. Keep the two peer terms mapped to SPDX 3.0.1 as written.

**Signed by the owner:** ______________________  **Date:** ____________
