# Feature Specification: GRC subtenants

**Spec ID:** 0012-grc-subtenants
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** An entity of a group (0009-grc-groups) may have one parent, so that the entities of a group form a forest of parents and subtenants. A control scoped to a parent reaches its subtenants unless an entity says otherwise, an exception is not inherited unless it says so, and the group view rolls the snapshot of a subtenant up into the status of its parent from statuses, coverage, severity and digests alone, never reading evidence. Nothing requires the data of two entities in one store.

## The tree of entities (governance)

- **FR-001**: An entity of a `grc.entity-group` MAY hold one `parent`, a branded `EntityId`; an entity MUST have at most one parent. The decoder of `grc.entity-group` MUST refuse a parent that the group does not hold and a parent chain that comes back to an entity (a self-parent is a cycle), naming the fault.
- **FR-002**: `entityTree(group)` MUST be the one smart constructor of `EntityTree`, an opaque value that exists only for a group with no entity held twice, no unknown parent and no cycle, and MUST give an error value of the closed union `duplicate-entity`, `unknown-parent` and `cycle` (the entities of the cycle, from the least identifier) for any other group. An `EntityTree` MUST give, for an entity, its parent, its children and its ancestors from the nearest, its descendants, and the roots, each in the order of the identifiers, so that the same group in any order of its entities gives the same tree.
- **FR-003**: `scopeProblems(group, scope, controls)` MUST find, as data, an entity whose parent the group does not hold (`entity/unknown-parent`) and a cycle of parents (`entity/parent-cycle`), for a group that was not made by the decoder.

## Inheritance of the scope

- **FR-004**: A rule of `grc.control-scope` MAY hold `for`, an `EntityId`, and `inherit`, a boolean that is true where it is absent. A rule without `for` is the rule of the group; a rule with `for` is the word of that entity on the control and ranges over that entity and its descendants. Within a rule, an entity named by its selector MUST stand for its descendants as well where `inherit` is true, and for itself alone where it is false.
- **FR-005**: `appliesTo(scope, tree, control, entity)` MUST decide by the nearest explicit rule: the rules that name the control are looked at on the chain of the entity, from the entity itself up through its ancestors (a rule of an ancestor counts only where its `inherit` is true) and then the rule of the group; the first that exists decides by its selector (`all` reaches every entity of its range, `only` reaches the entities it names and, where `inherit` is true, their descendants, `except` reaches every entity of its range but those); a control no rule on the chain names MUST apply to the entity. `applicability(tree, scope, controls)` MUST give the cell of every control and entity in the order of the controls and of the identifiers, with the same decision.
- **FR-006**: `scopeProblems` MUST also find a rule whose `for` the group does not hold (`scope/unknown-entity`), an entity a rule names outside the entities its `for` ranges over (`scope/outside-anchor`), and the same control scoped twice for the same `for` (`scope/duplicate-control`).
- **FR-007**: An exception MAY hold `inheritable`, a boolean that is false where it is absent. `exceptionCovers(exception, tree, entity, at)` MUST be true where `exceptionApplies` is true for the entity, and, only where `inheritable` is true, where it is true for an ancestor of the entity; an exception that is not inheritable MUST NOT excuse a subtenant of the entity it names.

## The roll-up (logical)

- **FR-008**: `groupView` MUST take the `EntityTree` of the group and, for each entity, give its place in the tree (parent, children, depth), its own status and own coverage (the join of its cells, as in 0009-grc-groups FR-009), and its rolled-up status and rolled-up coverage: the join, with `join` and `joinCoverage`, of its own and the rolled-up value of each of its children. The view MUST give the roots, and MUST be the same for any order of the entities of the group, of the readings and of the controls.
- **FR-009**: The roll-up MUST be made from the snapshots alone, which hold statuses, coverage, severity and digests and no evidence; a subtenant that cannot be read MUST give `pending` and `unknown` where a control applies to it and MUST NEVER give `pass`. Adding a subtenant whose status is `pass` MUST NOT make a parent worse than the worse of its status and `pass`; adding a subtenant that fails or cannot be read MUST NOT make any rolled-up status or coverage better; and the entities that are not ancestors of the added subtenant MUST be unchanged.
- **FR-010**: A subtenant that cannot be read MUST leave the cells, the own status and the rolled-up status of every entity that is not its ancestor unchanged.

## Isolation

- **FR-011**: Nothing in this model MUST need the data of two entities in one store, of a parent and a subtenant included: a reader MUST learn nothing of its parent, its siblings or its subtenants but through the snapshot each gives, and the roll-up MUST be computed by the group alone.
- **FR-012**: `groupConformance` MUST refuse, as a failure, a group that is not a tree (a cycle, an unknown parent, an entity held twice); for a tree MUST check that the roll-up of every entity is the join of its own and its descendants', that an entity of the tree that cannot be read is pending, never a pass for itself or an ancestor, and that the entities that are not its ancestors are unchanged; and MUST find a reader that touches the ports of its parent, a sibling or a subtenant, with each failure as data.

## Scenarios

- **Given** a control scoped to `only` a parent, **When** the scope is resolved, **Then** its subtenants apply, per FR-005.
- **Given** that control and a rule `for` one subtenant with the selector `only` and no entities, **When** the scope is resolved, **Then** that subtenant and its own subtenants are `not-applicable` and the others apply, per FR-004, FR-005.
- **Given** an exception of a control for a parent that is not `inheritable`, **When** the view is made, **Then** the failing subtenant is not excused, per FR-007.
- **Given** a parent that passes with a subtenant that fails, **When** the view is made, **Then** the parent's own status is `pass` and its rolled-up status is `fail`, per FR-008.
- **Given** a subtenant whose reader rejects, **When** the view is made, **Then** its cells are `pending`, its siblings are as they were and its parent's rolled-up status is at least `pending`, per FR-009, FR-010.
- **Given** a group whose entities are each other's parent, **When** it is decoded or `entityTree` is made, **Then** the fault is `cycle`, per FR-001, FR-002.

## Out of scope

- How an entity's data is stored, and a group of groups: the entities of one group are the unit; a tree of them is the whole of the hierarchy.
- The data of a subtenant being in the store of its parent: nothing forbids it and nothing requires it.

## Edge cases

- An entity with no parent is a root; a group with no parent anywhere gives a view whose rolled-up status equals the own status of each entity, per FR-008.
- A subtenant to which no control applies has own status `not-applicable`; it adds nothing to its parent's rolled-up status, per FR-008.

## Assumptions

- The entities of a group are known to the group by identifier, and the parent is a statement about the tenancy, which the host keeps true.

## Open questions

- None.

## Key entities

- **Entity tree**, **Parent**, **Subtenant**, **Anchor of a rule**, **Inheritable exception**, **Rolled-up status**.

## Success criteria

- **SC-001**: A control scoped to a parent reaches its subtenants, an entity's own word wins, and a parent's status is never better than what its subtenants show, without reading any evidence.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
