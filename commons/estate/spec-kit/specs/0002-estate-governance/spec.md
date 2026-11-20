# Feature Specification: Estate: governance

**Spec ID:** 0002-estate-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The identities, the three states of an asset and what each offers, the moves between states, the asset (every capability an owner or a reason) and the typed estate, whose references are derived from the data so that an unknown asset is an error the editor shows.

## Requirements

- **FR-001**: An asset id MUST be lower case words and digits joined by hyphens or dots, starting with a letter, at most 100 characters; an asset kind and a system id MUST be lower case words joined by hyphens; each MUST be made only by its parser and a text that is not one MUST be refused with the rule it broke.
- **FR-002**: An asset MUST be `discovered`, `adopted` or `managed`, and a discovered asset MUST offer only `observe`, an adopted asset `observe`, `verify` and `access`, and a managed asset every capability (`provision`, `identity`, `plan`, `converge`, `verify`, `observe`, `update`, `access`, `backup`, `retire`); a capability a state does not offer MUST have a reason.
- **FR-003**: An asset MUST move only from discovered to adopted, adopted to managed, managed to adopted and adopted to discovered.
- **FR-004**: An asset MUST say, for every capability in the order of the closed list, that it is offered and by which system, or that it is not offered and why, so that no capability is silently dropped.
- **FR-005**: `defineAsset` MUST refuse, with every reason, an asset that names an owner for a capability its state does not offer, that leaves an offered capability with no owner, or whose identity, kind or owner is not well formed.
- **FR-006**: `defineEstate` MUST take the assets by key (the key is the id) and the links between them, MUST make each asset by FR-005, MUST refuse a link whose end is not an asset or whose ends are the same, and the link MUST be written so that an end that is not a key of the assets does not compile.

## Acceptance scenarios

1. **Given** the text `Olympia`, **When** it is parsed as an asset id, **Then** it is refused naming the rule, per FR-001.
2. **Given** a discovered asset, **When** its capabilities are read, **Then** `observe` is offered and each of the others carries the reason, per FR-002 and FR-004.
3. **Given** an adopted asset that names an owner for `converge`, **When** it is defined, **Then** it is refused, per FR-005.
4. **Given** a link to an asset that is not in the estate, **When** the estate is written, **Then** the compiler reports it, and `defineEstate` refuses it as data, per FR-006.

## Out of scope

- What is declared of an asset: its own data, kept with it.

## Edge cases

- An asset with the same id twice cannot occur: the key of the estate is the id (FR-006).

## Assumptions

- The closed lists of states and capabilities are the ones of the library; a kind of asset is open, because a fleet names its own kinds.

## Open questions

- None.

## Key entities

- **Asset** - an identity, a kind, a state and a line for each capability.

## Success criteria

- **SC-001**: A reference to an asset that does not exist is a compile error in the editor.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
