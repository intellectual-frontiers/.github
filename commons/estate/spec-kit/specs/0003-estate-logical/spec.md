# Feature Specification: Estate: logical

**Spec ID:** 0003-estate-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The life of an asset (moves between states), the ownership of its capabilities (a capability moves between systems only when its acceptance test passed), operational truth (what is declared against what is observed, and how old the observation is) and the assets nobody declared. All of it is pure.

## Requirements

- **FR-001**: `moveState` MUST give the asset in another state only where the move is allowed (0002-estate-governance FR-003), MUST keep the owners it had for what the new state still offers and give up the rest, MUST take the owners of the capabilities that are new from its argument, and MUST refuse, naming it, a missing owner or a move to the state it is in.
- **FR-002**: `moveCapability` MUST give the asset with one capability owned by another system only where the capability is offered, is owned by another system, and an acceptance record is given for this asset, this capability and the system that takes it; any other case MUST be refused with the reason.
- **FR-003**: `operationalTruth` MUST give, for an asset, the instant of the observation, its currency (`fresh`, `due`, `stale` by the duration it is good for, or `never-observed`), the difference between the keyed records declared and observed (what was added, removed and changed, naming the path), and whether they agree; it MUST give no difference for a discovered asset (nothing is declared) or an asset never observed, and an asset never observed MUST NOT agree.
- **FR-004**: `unexpectedAssets` MUST give the assets seen that nobody declared and the assets declared that were never seen, each in order.

## Acceptance scenarios

1. **Given** a managed asset, **When** it is released to adopted, **Then** it keeps the owners of observe, verify and access and gives up the rest, per FR-001.
2. **Given** a capability owned by one system, **When** it is moved with no acceptance record, **Then** it is refused, per FR-002.
3. **Given** an adopted asset whose observed state differs from its declaration, **When** its truth is told, **Then** the difference names each path and the observation's currency, per FR-003.
4. **Given** a device seen on the network that no declaration expects, **When** the assets are compared, **Then** it is unexpected, per FR-004.

## Out of scope

- Observing: the dialects and connectors give an observation.

## Edge cases

- A duration or an instant that is not one is an error value, never a guess, per FR-003.

## Assumptions

- The keyed records of an asset (packages, services, files) are what grc's drift compares.

## Open questions

- None.

## Key entities

- **Acceptance record** - a passed test of a capability of an asset for the system that takes it.
- **Truth** - what is declared, what is observed, what differs, and how old it is.

## Success criteria

- **SC-001**: A capability never changes hands without a passed test.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
