# Feature Specification: Estate Iac: drift

**Spec ID:** 0004-estate-iac-drift
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The difference between what the code says and what a read-only connector shows of a cloud.

## Requirements

- **FR-001**: The comparison MUST match the cloud resources of the code with the resources a connector showed by provider and identifier, and say each difference as one of: `not-in-cloud` (in the code, the cloud does not show it), `not-in-code` (the cloud shows it, no code says it), `region-differs` (in both, in different regions) and `no-identifier` (in the code with no identifier, as a plan has none, so nothing can be compared).
- **FR-002**: A resource of the cloud of a provider and type that the code does not cover MUST NOT be reported as `not-in-code`, unless the whole cloud is asked for; and a comparison of nothing with nothing MUST be no difference.

## Acceptance scenarios

1. **Given** a state with an instance the cloud no longer shows, **When** they are compared, **Then** it is `not-in-cloud`, per FR-001.
2. **Given** a bucket in the cloud and code that only has instances, **When** they are compared, **Then** the bucket is not reported, per FR-002.

## Out of scope

- Listing the cloud: a read-only connector of the integrations library.

## Edge cases

- Two resources of one identifier in different providers are different, per FR-001.

## Assumptions

- The identifier a state holds (an ARN, an identifier of the cloud) is the one the connector lists.

## Open questions

- None.

## Key entities

- **Drift**, **Observed resource**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
