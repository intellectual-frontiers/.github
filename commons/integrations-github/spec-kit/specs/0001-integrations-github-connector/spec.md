# Feature Specification: Integrations GitHub connector

**Spec ID:** 0001-integrations-github-connector
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A vendor connector is its own package: it imports Integrations by name, writes against the read port that cannot write, declares its governance as data and is proved by the conformance suite of Integrations over recorded, made-up answers. This is the reference connector for the posture of one GitHub organization.

## Requirements

- **FR-001**: The governance of the connector MUST be read-only (the contract says never, every grant is `read`), name the host the transport may reach, hold the credential as a reference to a vault store, and be valid under the governance checks of Integrations.
- **FR-002**: The connector MUST pass `conformConnector` over a recorded fixture of made-up answers with no finding.
- **FR-003**: The posture of an organization MUST be a set of facts judged by policies of GRC's vocabulary (two-factor required, no public repository, repositories present); an organization that does not require two-factor MUST fail its policy, and an unreadable list of administrators MUST be a gap and not a failure.
- **FR-004**: No personal or secret field of a repository or a member MUST be kept in the observation.

## Acceptance scenarios

1. **Given** the synthetic fixtures of the suite, **When** the conformance suites of Integrations run over this plugin, **Then** they find nothing, per FR-001.

## Out of scope

- Everything the plugin does not list above: Planned, and specified in commons integrations 0007-integrations-standards where it is a standard.

## Edge cases

- A fixture that would be real data: never, every fixture is made up, per FR-001.

## Assumptions

- All answers in the tests are made up; no real organization, person or token is anywhere in this repository.

## Open questions

- None.

## Key entities

- **Integrations GitHub** - the plugin.

## Success criteria

- **SC-001**: The plugin passes the conformance suite of Integrations.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
