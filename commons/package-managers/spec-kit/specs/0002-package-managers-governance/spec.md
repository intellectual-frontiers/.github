# Feature Specification: What a package manager is to the kit, as data: the operations a dialect uses, the command of an operation as the packaging ontology states it, how a manager writes an exact version, and the form a name and a version must have to be put in a command.

**Spec ID:** 0002-package-managers-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** 

## Requirements

- **FR-001**: The operations MUST be `Install`, `QueryInstalled`, `QueryVersion` and `Refresh`, and a command of one MUST carry the manager, the executable, the environment where there is one, whether it needs administrator rights, the template, the form that asks a person nothing where there is one, and whether the ontology carries a date and a place it was tried.
- **FR-002**: A manager MUST write an exact version in one of three ways: joined to the name with `=` or `@`, as flags after the name (the flags before it, the flags that make it exact, and the flag of the version), or not at all, with the reason.
- **FR-003**: A package name MUST be safe only if it starts with a letter or a digit (never a dash, so that it cannot be taken for an option), has no `..` and uses letters, digits and `+ . _ @ : / -`; a version MUST be safe only if it starts with a letter or a digit and uses letters, digits and `+ . _ : ~ -`.

## Acceptance scenarios

1. **Given** the names `xz-utils`, `Vendor.Tool` and `aqua:org/tool`, **When** they are judged, **Then** they are safe, per FR-003.
2. **Given** the names `-rf`, `a;b`, `a b`, `a/../b` and the empty name, **When** they are judged, **Then** none is safe, per FR-003.

## Out of scope

- Reading the data from the ontology: its reader.

## Edge cases

- A name of more than 200 characters is not safe, per FR-003.

## Assumptions

- A name that passes is never taken by a manager for an option, and no shell reads it, because a command is an argument vector.

## Open questions

- None.

## Key entities

- **Command spec** - one command of a manager.
- **Versioning** - how a manager writes an exact version.

## Success criteria

- **SC-001**: No name or version that begins with a dash or holds a shell character reaches a command.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
