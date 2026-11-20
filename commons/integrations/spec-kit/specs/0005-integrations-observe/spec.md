# Feature Specification: Integrations observe

**Spec ID:** 0005-integrations-observe
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The OBSERVE family: the observation record, its entities, the Connector contract with `describe`, `probe` and `observe` as methods, governance enforced on what a connector returns, posture policies as structural data, freshness, persisted documents with `kind` and `schema`, and a registry that pins connectors by tag or commit with the SHA-256 of what was taken.

## The observation

- **FR-001**: An observation MUST be `{at, provider, account, assets, posture, gaps, entities?, records?}`, with gaps typed (`denied`, `unavailable`, `partial`, `entity-kind-not-declared`) and posture values scalar.
- **FR-002**: A record MUST be `{label, ocsf_class_uid, native_id, display_name, props, unmapped?}`, and entities MUST be people, accounts, devices and repositories as typed products.
- **FR-003**: A `Connector` MUST have `describe`, `probe` and `observe` as methods and `check` for its policies; `describe` MUST be derived from the governance so that it cannot differ, and MUST hold no credential value.
- **FR-004**: `defineConnector` MUST refuse governance with a problem and a policy id twice, and MUST wrap `observe` so that governance is enforced on what any connector returns.
- **FR-005**: Enforcement MUST remove from every record's properties and unmapped data each field the denylist denies, and MUST remove an entity kind the connector did not declare and name it as a gap, whatever the connector returned.
- **FR-006**: A posture policy MUST be data in the vocabulary of GRC (`@intellectual-frontiers/grc`): an `id`, a `title`, the `fact`, an `Expectation` and a `Severity` of GRC, the status a miss has, the control urns it bears on and a fix; `evaluatePolicy` MUST be total and give a GRC `Status`: `pending` where the fact was not observed, else GRC's own evaluation (a pass, the status of a miss, or `error`).
- **FR-007**: Every connector MUST have the policy `observation-fresh`, failing where the observation is older than its cadence allows.
- **FR-008**: A persisted observation MUST be a document with `kind` and `schema`; reading one of another kind or schema, or a field of the wrong type, MUST be an error with its path.

## The registry

- **FR-009**: A source MUST be pinned to `https://...@<tag or 40-hex commit>` and a branch MUST be refused; a registry entry MUST hold the id, title, pinned source, SHA-256, the contract version and when it was added.
- **FR-010**: The lock MUST be a persisted document (`kind` and `schema`) whose entries are in the order of their ids, and reading it MUST refuse an id twice, an id or digest that is not one, and a contract version that is not this one.
- **FR-011**: `verifyCopy` MUST accept a copy whose digest is the pin and refuse any other, naming both digests, and an id the registry does not have.

## Acceptance scenarios

1. **Given** a connector that returns a record with a `salary` property, **When** it is observed, **Then** the property is not in the observation, per FR-005.
2. **Given** a source `https://example.test/c@main`, **When** it is pinned, **Then** it is refused as a branch, per FR-009.

## Out of scope

- Planned: the stolos connectors (31) as plugin packages; the fixtures of a registry entry run at load.
- The reference connector `integrations-github` is its own package.

## Edge cases

- A connector that returns an entity kind it did not declare: removed and named as a gap, per FR-005.

## Assumptions

- A connector reads through a `ReadPort`; credentials are applied at the edge.

## Open questions

- None.

## Key entities

- **Observation** - what a connector saw at one moment.
- **Connector** - governance and the three methods.
- **Registry entry** - a pinned source.

## Success criteria

- **SC-001**: Whatever a connector does, what it returns obeys its governance.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
