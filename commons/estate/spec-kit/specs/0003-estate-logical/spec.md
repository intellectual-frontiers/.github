# Feature Specification: Estate: logical

**Spec ID:** 0003-estate-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The life of an asset (moves between states), the ownership of its capabilities (a capability moves between systems only when its acceptance test passed), operational truth (what is declared against what is observed, how old and from what source the observation is, and the alignment of the two in the words of the Operational Truth Ontology), the assets nobody declared, accepted risk and the status of a policy, and the invariants of that ontology an estate can check. All of it is pure.

## Requirements

- **FR-001**: `moveState` MUST give the asset in another state only where the move is allowed (0002-estate-governance FR-003: adoption, release and taking over; the last needs the approval that the requirement of taking over below states), MUST keep the owners it had for what the new state still offers and give up the rest, MUST take the owners of the capabilities that are new from its argument, MUST keep the origin of the asset, and MUST refuse, naming it, a missing owner, a move to the state it is in and a move of a managed asset.
- **FR-002**: `moveCapability` MUST give the asset with one capability owned by another system only where the capability is offered, is owned by another system, and an acceptance record is given for this asset, this capability and the system that takes it; any other case MUST be refused with the reason.
- **FR-003**: `operationalTruth` MUST give, for an asset, the instant of the observation, its currency (`fresh`, `due`, `stale` by the duration it is good for, or `never-observed`), the difference between the keyed records declared and observed (what was added, removed and changed, naming the path), whether they agree, the source the observation is attributed to and the alignment (`aligned`, `drifted` or `not-observed`, the states of the ontology `oto:AlignmentState`); it MUST give no difference for a discovered asset (nothing is declared) or an asset never observed, an asset never observed or discovered MUST be `not-observed` and MUST NOT agree.
- **FR-004**: `unexpectedAssets` MUST give the assets seen that nobody declared and the assets declared that were never seen, each in order.
- **FR-005**: `acceptRisk` MUST give an accepted risk (the policy, the reason, who accepts and until when) only where the policy and the person are named, the date is a day after today and at most 366 days away, and the reason is at least ten characters; every other case MUST be refused with every reason (Stolos 067-adopt FR-013).
- **FR-006**: `judgePolicy` MUST give a policy the status `waiting` where its machine was never observed or the policy is unknown (never a failure and never a warning), `pass` for a pass, `accepted` for a failing or warning policy with an accepted risk whose date has not passed, and the policy's own status, saying the acceptance ended, after the date (Stolos 117-adopted-in-status).
- **FR-007**: `checkInvariants` MUST give every violation, in order, of the three invariants of the Operational Truth Ontology an estate can check (commons ontology 0002-oto FR-003): an offered capability with no owning system (`NoUnownedResponsibilities`), an observation that names no source (`NoEvidenceWithoutAttribution`) and a policy result that names no control (`NoComplianceWithoutTraceability`); and it MUST say, for each of the six invariants, whether it is checked, so that none is silently dropped.
- **FR-008**: `moveState` MUST take an adopted asset over (to managed) only with an approval, the person who approved and the hash of the plan they approved (`sha256:` and 64 hexadecimal digits), MUST keep its origin so that it is `inherited`, and MUST refuse an owner for `provision`, which an inherited asset does not offer (0002-estate-governance FR-007).
- **FR-009**: `parseNeighbors` MUST read the devices of a neighbor table (`ip neigh show` or `arp -an`), leaving out an entry with no hardware address, a broadcast or multicast address, and giving a device once by its hardware address; `unexpectedDevices` MUST give the devices seen that no asset declares (by hardware address, or by address where an asset declares none) and the assets that declare an address or a hardware address and were not seen; nothing here scans a network (0002-estate-governance FR-002).

## Acceptance scenarios

1. **Given** a discovered asset, **When** it is adopted and then released, **Then** it takes the owners of observe and verify and gives them up again, and a managed asset is refused a move, per FR-001.
2. **Given** a capability owned by one system, **When** it is moved with no acceptance record, **Then** it is refused, per FR-002.
3. **Given** an adopted asset whose observed state differs from its declaration, **When** its truth is told, **Then** the difference names each path and the observation's currency, per FR-003.
4. **Given** a device seen on the network that no declaration expects, **When** the assets are compared, **Then** it is unexpected, per FR-004.
5. **Given** a failing policy with an accepted risk, **When** it is judged before and after the date, **Then** it is accepted and then failing again, and a machine never observed is waiting, per FR-005 and FR-006.
6. **Given** an observation with no source and a policy result with no control, **When** the invariants are checked, **Then** each is a violation, per FR-007.

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
