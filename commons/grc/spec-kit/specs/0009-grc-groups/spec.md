# Feature Specification: GRC groups of entities

**Spec ID:** 0009-grc-groups
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** A group of entities defines its controls once and scopes them to each entity. Each entity has its own ledger, evidence store, signing keys and secrets, which the group never reads: the group reads only a statuses-and-digests snapshot that each entity gives through a reader function it owns. The model names no storage layout: an entity is an opaque identifier, its ports are references the host resolves, and no function needs the data of two entities in one place.

## Identities and ports (governance)

- **FR-001**: An entity identifier MUST be a branded `EntityId` made only by the smart constructor `entityId` (a stable id of 0001-grc-layers FR-009) or by its decoder; a port reference MUST be a branded `PortRef` and a secret reference a branded `SecretRef` (`secret:` followed by a stable path), each with its own constructor that returns an error value for text of another shape; no document of this library MUST hold a secret's value, and a value where a `SecretRef` is expected MUST be a decode error.
- **FR-002**: The document of kind `grc.entity-group` MUST hold a title and its entities, each with an `EntityId`, a title and its ports as references only: `ledger`, `store`, `keys` and `secrets`; the host MUST resolve a reference to a port of that entity alone.
- **FR-003**: The document of kind `grc.control-scope` MUST hold, for the group, rules that name a control URN and an entity selector, a closed union of `all`, `only` (a list of entities) and `except` (a list of entities); a control no rule names MUST apply to every entity, and `applicability(group, scope, controls)` MUST give, for every control and every entity of the group, `applies` or `not-applicable`, in the order of the controls and of the entities.
- **FR-004**: `scopeProblems(group, scope, controls)` MUST find as data a rule that names an entity the group does not hold, a control that is not one of `controls`, a control named by two rules, an entity listed twice in a selector, and an entity held twice by the group.
- **FR-005**: An exception of a control for an entity MUST be a `grc.exception` of 0002-grc-governance whose `subjects` match the entity identifier; it MUST expire like any exception, and `exceptionApplies` decides it at the instant of the view.

## The reading (logical)

- **FR-006**: What an entity gives the group MUST be a document of kind `grc.entity-snapshot`: the entity, the instant, the head of its ledger and, for each control, its status, coverage, severity, the instant it was last observed and the digests of the results behind it, and nothing else; `snapshotOf` MUST make it from the entity's own frameworks, crosswalks, checks, results and exceptions with `newestResults`, `applyExceptions` and `coverage`, and MUST carry no evidence payload and no secret.
- **FR-007**: An entity's reader MUST be a function `(at) => Promise<Result<EntitySnapshot, ReadFault>>` the host makes for that entity; `ReadFault` MUST be the closed union `unreachable`, `denied` and `malformed`; `readGroup(group, readers, at)` MUST call the reader of each entity with nothing but the instant, MUST turn a reader that rejects, throws or gives a snapshot of another entity into a fault, MUST rebuild each snapshot from its known fields so that an extra field never passes through, and MUST give an entity without a reader the fault `unreachable`.
- **FR-008**: `groupView` MUST be a pure function of the group, the scope, the controls, the readings, the exceptions and the instant, giving a cell for every control and entity: `not-applicable` where the scope says so; `pending` where the entity could not be read; `gap` where the entity was read and gives no state for an applicable control; otherwise the entity's status, with `fail` and `warn` made `accepted` where an exception of FR-005 applies; an entity that cannot be read MUST NEVER give `pass`.
- **FR-009**: The view MUST roll up by control (the join of its cells with `join`, and the worst coverage in the order `covered`, `accepted`, `stale`, `partial`, `untested`, `unknown`, `failing`, `gap`, with `unknown` for an entity that could not be read), by entity (the join of its cells), and overall with `rollup` over the cells made results; the view MUST be the same for any order of the readings, of the controls and of the entities.

## Isolation

- **FR-010**: Nothing in this model MUST assume how an entity's data is stored or kept apart from another's: no function MUST take the data of two entities from one store, and the group MUST learn of an entity only through its reader.
- **FR-011**: A conformance suite `groupConformance` MUST run a host's way of making readers against per-entity ports that cannot see each other (each entity's ports throw where used while another entity's reader runs), and MUST check that every entity is read, that a view is the same as the one made from the snapshots alone, that an entity that cannot be read is `pending` and the others are unchanged, and that no reader touches another entity's ports; it returns each failure as data.

## Scenarios

- **Given** a control scoped to `only` one of two entities, **When** the group view is made, **Then** the other entity's cell is `not-applicable`, per FR-003, FR-008.
- **Given** an entity whose reader rejects, **When** the group view is made, **Then** its cells are `pending`, its coverage `unknown`, the others are as they were, per FR-007, FR-008.
- **Given** a value in a `secrets` list, **When** the group is decoded, **Then** the decode error names the path, per FR-001.
- **Given** a reader that reads another entity's ledger, **When** `groupConformance` runs, **Then** it reports the entity and the port, per FR-011.

## Out of scope

- How an entity's data is stored, and the resolving of a reference to a port, a key or a secret: the host's; a platform on this library gives the readers.

## Edge cases

- An empty group: a view with no cells and the status `not-applicable`, per FR-009.
- A control no entity applies to: `not-applicable` for the control, per FR-009.

## Assumptions

- The controls of the group are the controls of its frameworks, defined once.

## Open questions

- **OQ-1**: Whether a group of groups is needed.

## Key entities

- **Entity**, **Group**, **Scope**, **Snapshot**, **Reader**, **Group view**.

## Success criteria

- **SC-001**: A group reads many entities by their readers alone and never assumes a pass for one it cannot read.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
