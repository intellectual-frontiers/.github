# Feature Specification: Package managers: logical

**Spec ID:** 0003-package-managers-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The command of an operation as an argument vector (the words of the ontology's template with the names put where they go, never through a shell), the exact version written as the manager writes it, the job a requirement of kind tool asks of a manager, the plan file that names the commands, and the reading of the version a manager prints. All of it is pure.

## Requirements

- **FR-001**: `commandArgv` MUST give the words of the template with the one place for names (`{packages}` or `{package}`) replaced by the names, each as one argument; a template with no such place, with more than one, or with a place this library does not fill MUST be refused, and a `{package}` template MUST be refused for more than one package.
- **FR-002**: An exact version MUST be written as the manager's versioning says: joined to the first package (`pkg=1.2.3`, `pkg@1.2.3`), as flags for one package (and refused for more), or refused with the manager's reason; without a version the names are as given.
- **FR-003**: A name or a version that is not safe (0002-package-managers-governance FR-003) MUST be refused, naming it.
- **FR-004**: The form that asks nothing of a person MUST be used unless the interactive form is asked for; the environment a command needs MUST be the `env` program with it before the command; and the program that raises the rights MUST be put first only for a command of a manager that needs them, and never otherwise.
- **FR-005**: `jobOf` MUST give a job only for a requirement of kind `tool` whose desired state names this dialect, a source of packages and this manager, with at least one package; for any other requirement it MUST give nothing.
- **FR-006**: The plan file MUST say it is generated, hold for each tool the version, the packages, the command that installs it, the command that checks it (or none) and the status of the check that means missing, and whether the manager needs administrator rights and whether its command was tried, in a fixed order; `readPlanFile` MUST refuse what is not such a file (a check with no missing status, an install command that is not a list of words), and `planLines` MUST give every reason a command cannot be made rather than the first.
- **FR-007**: `versionIn` MUST give the first version in what a manager prints without its epoch (`1:2.43.0-1` gives `2.43.0-1`); `sameVersion` MUST say an installed version is the one asked for where they are the same or the one asked for is followed by a packager's revision (`-`, `+` or `~`), and not where it is only a prefix of another number (`2.4` is not `2.43.0`).

## Acceptance scenarios

1. **Given** the template `apt-get install -y {packages}` and the names `git` and `curl`, **When** the argument vector is made, **Then** it is `apt-get install -y git curl`, per FR-001.
2. **Given** a version and each way of writing it, **When** the argument vector is made, **Then** it is as each manager writes it, and refused where the manager cannot, per FR-002.
3. **Given** the name `-rf`, **When** the argument vector is made, **Then** it is refused, per FR-003.
4. **Given** a manager that needs an environment and rights, **When** the argument vector is made, **Then** `env` and the program that raises the rights are in front, and for a manager that needs no rights the latter is not, per FR-004.
5. **Given** a requirement for another dialect, another manager or a download, **When** `jobOf` is asked, **Then** it gives nothing, per FR-005.
6. **Given** two jobs of which two commands cannot be made, **When** the plan lines are made, **Then** both reasons are given, per FR-006.
7. **Given** `1:2.43.0-1ubuntu7` and `2.4`, **When** they are read and compared with `2.43.0`, **Then** the first is the same and the second is not, per FR-007.

## Out of scope

- Running a command: Physical.

## Edge cases

- A template whose words include a brace that is no place for names is refused, per FR-001.
- A version that is given for a manager that cannot write one is refused, not dropped, per FR-002.

## Assumptions

- The first package of a binding is the tool's own, and the others are what it needs; the version of the binding is the first's.

## Open questions

- None.

## Key entities

- **Job** - what a tool asks of a manager.
- **Plan file** - the generated record of the commands a render names.

## Success criteria

- **SC-001**: No command is made from text a shell could read as more than one word.
- **SC-002**: A command that needs rights has them raised only where the manager needs them.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
