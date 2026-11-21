# Feature Specification: AnyFS: logical

**Spec ID:** 0003-anyfs-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The operations of a store as data, the store type whose capabilities are in the type, the laws every store keeps, attenuation that can only narrow, mounts that make one namespace of many stores, and the effect each operation has on the world.

## Requirements

- **FR-001**: An operation MUST be data, one of the closed union `read`, `write`, `stat`, `list`, `delete`, `batch`, `rename`, `history`, `rangeRead`, `append` and `search`, and an outcome MUST be the result of one operation, tagged by it; `capabilityOf` MUST give each operation the capability it needs, and `effectOf` MUST give it its effect, one of `read`, `mutate` or `destructive`, so that a caller can hold a store to a consent class.
- **FR-002**: `makeStore` MUST make a store from its id, its place, its consistency, its traits, its capabilities and one handler of operations; the store MUST have exactly the methods of its capabilities and a `capabilities` set that names them, and a function that needs capabilities `C` MUST accept a `Store<C>` and refuse, at compile time, a store without one of them; `supports` MUST narrow a store to more capabilities where its set has them.
- **FR-003**: Every store MUST keep the laws: a read after a write of the same path returns the bytes and the revision the write returned; a write with `absent` over a path that exists, and a write or a delete with a revision that is not the current one, is a `conflict` that changes nothing; a write with `any` makes or replaces; deleting a path that is absent with `any` succeeds and says it did not exist; a revision changes when and only when the bytes change; a list is in the order of the paths, and its pages together are the whole of it with no path twice.
- **FR-004**: `readOnly` MUST give a store with none of the capabilities that change anything (`write`, `delete`, `batch`, `rename`, `append`, `lock`); `sub` MUST give a store whose every path is below a prefix, so that no operation reaches a path outside it; `only` MUST give a store with the named capabilities and no other; and no attenuation MUST give a store a capability its argument did not have.
- **FR-005**: A namespace MUST mount stores by prefix, refuse two mounts of one prefix, and resolve a path to the store of the longest prefix that holds it, with the path below the prefix; `asStore` MUST give the namespace as one store of the capabilities all its mounts have, listing across mounts in the order of the paths and refusing an operation that would cross two mounts.
- **FR-006**: `guarded` MUST give a store that refuses, with the reason `consent`, every operation whose effect is above the effect it is given, and none below it.

## Acceptance scenarios

1. **Given** a store of `read` alone, **When** a function that needs `write` is given it, **Then** the compiler reports it, per FR-002.
2. **Given** a write of `a` and a second write of `a` with `absent`, **When** both have run, **Then** the second is a conflict and the first bytes remain, per FR-003.
3. **Given** a store with a prefix `fleet/`, **When** an operation names a path, **Then** the store below it receives `fleet/` and the path, and it cannot name `..`, per FR-004.
4. **Given** mounts at `fleet/` and `fleet/secrets/`, **When** `fleet/secrets/a` is resolved, **Then** the second store receives `a`, per FR-005.
5. **Given** a store guarded to `read`, **When** a write is made, **Then** it is refused as `consent`, per FR-006.

## Out of scope

- Reaching a place and the layers that wrap a store: `0004-anyfs-middleware` and the backends.

## Edge cases

- `watch` and `lock` are capabilities with no operation: a layer does not carry them unless it says so (FR-001, FR-004).

## Assumptions

- A store is a facade of its handler, so that every store, layer and attenuation is a function of operations.

## Open questions

- None.

## Key entities

- **Store**, **Operation**, **Outcome**, **Namespace**.

## Success criteria

- **SC-001**: The handler of a store is the only place a backend does work, so a layer cannot bypass an attenuation.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
