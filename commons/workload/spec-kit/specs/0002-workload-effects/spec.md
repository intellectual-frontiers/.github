# Feature Specification: Workload effects

**Spec ID:** 0002-workload-effects
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a verb node does to the world, declared as data, the same in every form: the class of the store it touches, the mode, whether it can be undone and how, the stores a workshop attaches and detaches by capability, and the autonomy that follows from all of it. The table that derives autonomy from an effect is one, in the core, and every form calls it.

## Requirements

- **FR-001**: Each verb node MUST declare an effect `{store, class, mode, reversible, compensation?}`; the store class MUST be one of `ephemeral` (workshop scratch, an image), `transactional` (SQLite, Postgres), `durable` (a file or object store, versioned), `git` (append-only history) and `external` (a system of record), and the mode one of `read`, `append`, `mutate` and `destroy`.
- **FR-002**: WHERE the class of an effect is `external` and its mode is not `read`, the effect MUST carry an idempotency key, which is the name of an input of the node and never a value.
- **FR-003**: A workshop MUST own nothing durable: it MUST attach a store only by the capabilities it needs (the capabilities of AnyFS) and detach it when it is disposed, and whether a workshop is disposable MUST be computed from the stores attached (it is disposable where every store attached is `ephemeral`), and MUST NOT be a field anyone declares.
- **FR-004**: The autonomy of a node MUST be derived from its effect and never declared: a `read` is `agent-autonomous`; an `append` to `git` or to a `transactional` or `durable` store is `agent-acts-human-reviews`; a `mutate` of a `transactional` or `durable` store is `agent-proposes`, and a checkpoint step MUST precede it; an `append` or a `mutate` of an `external` store is `agent-proposes`; a `destroy` of a `durable`, `transactional` or `external` store, and any `mutate` or `destroy` of `git` (a rewrite of published history), is `human-only`; any effect on an `ephemeral` store is `agent-autonomous`.
- **FR-005**: A gate MUST only raise the control over a node, never lower it: the level of a guarded node is the less autonomous of its derived level and the level the gate demands, and no gate makes a node more autonomous than its effect makes it.
- **FR-006**: The actions `approve` and `tag` MUST be a person's at every level (the workbench's `PERSON_ONLY`), a gate MUST name one of `approve`, `tag` and `pentest-scope`, and a gate MUST be passed only by an actor that is a person.
- **FR-007**: The effect a node declares MUST NOT exceed the effect its verb is registered with: a node may declare less than the verb can do (a narrower mode) and never more, and the class MUST be the one the verb is registered with.

## Acceptance scenarios

1. **Given** a node that destroys a durable store, **When** its autonomy is derived, **Then** it is `human-only`, per FR-004.
2. **Given** a node that mutates a transactional store, **When** its autonomy is derived, **Then** it is `agent-proposes`, per FR-004.
3. **Given** a gate that demands `human-only` over a read, **When** the level is derived, **Then** it is `human-only`, per FR-005.
4. **Given** a gate that demands `agent-autonomous` over a destroy, **When** the level is derived, **Then** it stays `human-only`, per FR-005.
5. **Given** a workshop with a durable store attached, **When** its disposability is computed, **Then** it is not disposable until the store is detached, per FR-003.
6. **Given** a node on an external store with no idempotency key, **When** it is decoded, **Then** it is refused, per FR-002.
7. **Given** a node that declares a destroy of a verb registered as append, **When** it is checked, **Then** it is refused, per FR-007.
8. **Given** a gate named `deploy`, **When** it is decoded, **Then** it is refused, per FR-006.

## Out of scope

- Running a verb (0006-workload-split) and the checks that catch a missing checkpoint or a missing detach (0008-form-runbook).

## Edge cases

- A store of two classes is two stores, each with its own reference: a class belongs to a store, never to a node, per FR-001.
- A `mutate` of `git` is a rewrite and is `human-only` whether or not the history is published, because a workload cannot know who has fetched it, per FR-004.

## Assumptions

- The levels are the ones of the workbench and read from least to most an agent does alone; `raise` in FR-005 means raise the oversight, which lowers the autonomy.

## Open questions

- None.

## Key entities

- **Effect** - the declared mark a node leaves on a store.
- **Store class** - how a store keeps what is written to it.
- **Attachment** - a store given to a workshop by capability for the length of a run.
- **Autonomy** - how far an agent may go alone on a node, derived from the effect.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| The capability model of AnyFS (`commons/anyfs/src/governance/capability.ts`, read in this repository) | A store is attached by the capabilities it must offer (`read`, `write`, `append`, `history`, `cas` and the rest); a store that lacks one is refused with a reason, and the capability names are the ones of that closed union and no others | The file itself |
| The autonomy levels and the person-only actions of the workbench (`commons/workbench/src/governance/roles.ts`) | The four levels, from `human-only` to `agent-autonomous`, and the actions `approve` and `tag` which are a person's at every level | The file itself |
| Saga pattern (Garcia-Molina and Salem, 1987) | A step that cannot be taken back is paired with a compensation or guarded by a person | Named from the literature, not read in this session; no section or IRI is given |

## Success criteria

- **SC-001**: Every requirement of 0002-workload-effects is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
