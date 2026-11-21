# Feature Specification: Estate fleet store

**Spec ID:** 0006-estate-fleet-store
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The store an estate is kept in: a store of AnyFS (a host reached by SSH) is the system of record, and replicas (a branch of a Git repository, a bucket, a folder) are mirrors of it. Every write states what it expects, so that two operators who change the same asset are one winner and one conflict, and what the logical layer judges is read from the documents in the shapes its functions take.

## Requirements

- **FR-001**: `openFleetStore` MUST read the manifest of the store: a store with none MUST be refused as `no-manifest` unless it is opened with `create`, in which case the manifest MUST be made once (expecting that none is there), and two openers that make it at the same time MUST end with one manifest and both succeed.
- **FR-002**: A store kept at a newer schema than the code reads MUST be refused as `newer-schema`, one kept in another layout as `other-layout`, and one that is another fleet than the one asked for as `other-fleet`, each with the facts, and nothing MUST be written to such a store.
- **FR-003**: An asset MUST be written with the expectation the caller states (`absent`, the revision read, or `any`), MUST come back with its revision, and an update MUST read the asset, call the function given with it and write the result expecting the revision read, beginning again where another writer changed it first, so that two operators who change the same asset are one winner and one conflict and a retried update succeeds.
- **FR-004**: An observation MUST be written once: the same observation again MUST be `created: false`, a different one at the same instant MUST be refused as `exists`, and the observations of an asset MUST come back in the order of their instants, within a range where one is given, with the latest one answered without reading the others.
- **FR-005**: What is declared of an asset MUST be written with the expectation the caller states, and a risk MUST be accepted only as the logical layer's rule allows (a policy, a person, a reason of ten characters and a day after today within a year); accepting a risk of a policy that already has one MUST replace it, and the accepted risks MUST be changed by a write that expects the revision it read.
- **FR-006**: `snapshot` MUST read the assets, the declarations, the accepted risks and the observations (the latest of each asset, or all) in the shapes the logical layer takes; it MUST begin again, up to the attempts it is given, when a document it read changed while it read, and it MUST say whether it ended stable.
- **FR-007**: `assessSnapshot` MUST give the operational truth of every asset, the violations of the invariants an estate checks and the status of every policy result with the accepted risks taken into account, by the functions of the logical layer, and the answer for a snapshot read from a store MUST be the answer for the same data made in memory.
- **FR-008**: What a fleet store cannot do MUST be one of a closed list of problems, each with the facts and a sentence: a document or the store below it, no manifest, a newer schema, another layout, another fleet, a refusal with every reason, an observation that exists, the mirror, no mirror, and no history.
- **FR-009**: What is in a folder and is not a good document of it (a file no layout names, a document that cannot be decoded, a document of a newer version) MUST be a finding that comes back beside the good documents, and MUST never fail a listing, a snapshot or a query of observations.
- **FR-010**: With replicas, a write MUST go to the primary and MUST be queued for the replicas; a replica that cannot be reached MUST never fail a write; `settle` MUST bring the replicas up to the primary and `status` MUST say, for each, whether it is in sync, behind or diverged; a replica changed by someone else MUST be left as it is; `promote` MUST make a replica the primary as the bridge allows it; and every write and every change of the mirror MUST be an event a subscriber is told.
- **FR-011**: A fleet store for development MUST be opened with the same function over a store in memory or in a folder with no replicas, so that everything the estate does with stored data works before a host is named, and its `status` MUST be empty and its `settle` a success that did nothing.
- **FR-012**: The configuration of an example fleet MUST be written as code: the store of a host reached by SSH is the primary, a branch of a Git repository and a bucket are its replicas, a replica deletes nothing and a settlement is made when it is asked for; the names are examples and the same code is pointed at a fleet's own host, repository and bucket.

## Acceptance scenarios

1. **Given** an empty store and no `create`, **When** it is opened, **Then** it is refused as having no manifest, per FR-001.
2. **Given** a store written at schema 2, **When** it is opened, **Then** it is refused and nothing is written, per FR-002.
3. **Given** two handles on one primary that update one asset at once, **When** both write, **Then** one wins and the other begins again and wins, per FR-003.
4. **Given** the same observation recorded twice, **When** the second is written, **Then** it is not created again, per FR-004.
5. **Given** an estate read from a store and the same estate in memory, **When** both are assessed, **Then** the answers are the same, per FR-007.
6. **Given** a Git replica and a primary that is lost, **When** the replica is promoted and the store opened on it, **Then** the data is intact and the estate's truth is unchanged, per FR-010.

## Out of scope

- Migrating the evidence stores of grc to AnyFS: a later task.
- Signing the manifest or the documents: the interface is for later.
- Which host is the primary: the fleet's configuration names it.

## Edge cases

- A snapshot of a store that changes all the while ends with `stable: false` and the last reading, per FR-006.
- A store opened twice with `create` at the same time has one manifest, per FR-001.

## Assumptions

- The primary has `cas`, so a revision can be expected: the type of the configuration says so and a store without it is a compile error.

## Open questions

- None.

## Key entities

- **Fleet store** - an estate kept in a store of AnyFS: a primary that is the system of record and replicas that mirror it.
- **Snapshot** - everything the logical layer judges, read from the documents in the shapes its functions take.

## Success criteria

- **SC-001**: Two operators who change one asset at once never lose a change silently: one wins and the other is told.
- **SC-002**: The estate's truth read from a store is the estate's truth of the same data made in memory.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
