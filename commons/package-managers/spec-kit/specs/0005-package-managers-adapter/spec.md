# Feature Specification: Package managers: adapter

**Spec ID:** 0005-package-managers-adapter
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The operating system package managers are one table-driven adapter, keyed by the package manager fact (`apt`, `dnf`, `yum`, `zypper`, `apk`, `pacman`, `brew`, `winget`, `mise`), and no longer one library for each manager (the former `archon-dialect-apt`, `-homebrew`, `-mise` and `-winget`, which differed only in data). A row is the data of a manager; the commands are the ontology's; the steps are `ArgvStep`s of core: words, never a shell string (commons archon 0004-archon-dialects FR-007).

## Requirements

- **FR-001**: The table MUST have one row for each of the keys `apt`, `dnf`, `yum`, `zypper`, `apk`, `pacman`, `brew`, `winget` and `mise`, each row the data of a manager (what it guarantees as a dialect of tools, how it writes an exact version, and the exit status that means a package is missing where one is known), and `specOf` MUST refuse a key that is not in the table, naming the keys.
- **FR-002**: Each row MUST agree with the packaging ontology: the way it joins a version to a package MUST be the way the ontology states for the manager, and the exit status of a missing package MUST be the ontology's where it states one.
- **FR-003**: `installSteps` MUST give, for each tool of the requirements that the manager installs, an install step and, where the manager can be asked, a check step, each an `ArgvStep` of core with the identity `root` where the manager needs the administrator and `user` where it does not, with no elevation program in its words and the exit status of a missing package expected by the check; and it MUST refuse, with every reason, a command that cannot be made (a version for a manager that cannot install one, a name unsafe in a command).
- **FR-004**: `packageDialect` MUST make the dialect of a manager of the table by its key, the dialect of the kit made from its row, and MUST refuse a key that is not in the table.
- **FR-005**: No step that `installSteps` gives MUST be a shell string: `argvFindings` of core MUST find nothing in any step of any manager of the table.

## Acceptance scenarios

1. **Given** a tool with a package for `dnf`, **When** the steps are made, **Then** the install is `dnf install -y` as `root`, per FR-003.
2. **Given** the key `emerge`, **When** it is looked up, **Then** it is refused naming the nine keys, per FR-001.
3. **Given** `pacman` and a tool with a version, **When** the steps are made, **Then** they are refused with the reason of the manager, per FR-003.

## Out of scope

- Running the steps: the executor of headless and the jobs of the ssh-server library.
- Packages that are not of a package manager: the dialect of pinned native tools.

## Edge cases

- A manager with no query command, or a query whose template has a place the kit does not fill (the status of `dpkg-query`): its steps have no check, per FR-003.

## Assumptions

- The commands are the ontology's and are given as a source of commands (`commandsFromOntology`).

## Open questions

- None.

## Key entities

- **Row** - the data of one package manager.
- **Package step** - the install and the check of one tool, as steps of core.

## Success criteria

- **SC-001**: Adding a package manager is adding a row and a test.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
