# Feature Specification: Boot plugin: the commands

**Spec ID:** 0002-boot-command
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What the plugin does for `archon boot prepare|arm|disarm|status|serve` over what a fleet gives it: the function that says, for an asset, what to render and where (or why it may not be installed), the two dialects, and the boot server's view of the fleet.

## Requirements

- **FR-001**: The plugin MUST contribute the branch `boot` with the verbs `prepare`, `arm`, `disarm`, `status` and `serve` to the program it is given (`archon` by default); the variables it reads MUST be the program's name in capitals with `_BOOT_STATE`, `_BOOT_ASSETS` and `_SECRETS`, the state file defaulting to a file in the person's own configuration folder named for the program (never in a repository).
- **FR-002**: `prepare` and `arm` MUST ask the fleet for the asset first and, where the fleet refuses it (an asset that is adopted, or that another system installs), MUST end with the exit the fleet gave and name its code and words, and MUST write and arm nothing.
- **FR-003**: `prepare` MUST render the install with the install dialect and the playbook with the playbook dialect, each from the requirements it carries, as generated files in the folder the fleet names that hold no secret and are the same text every time, and say each file written.
- **FR-004**: `arm` MUST record that the asset's next network boot may install it, with a token, and that it may erase a disk that holds data only if `--confirm-destroy yes` was given, in a state file readable by its owner alone; `disarm` MUST take it out; `status` MUST show what is armed, what installed, the latest progress and the boot files that are missing or do not match their pins.
- **FR-005**: `serve` MUST run the TFTP and HTTP boot server over the pinned files with the fleet's provider and the secrets folder, and MUST NOT start where a boot file is missing or does not match its pin (ending with 3 and saying how to get the files).
- **FR-006**: `arm`, `status` and `serve` MUST take the boot profile of the distribution to serve (`--profile`, the fleet's default or Ubuntu 26.04 where none is given), MUST serve its pinned files, and MUST refuse a profile that does not exist with the profiles there are and the usage exit; `arm` MUST refuse, with the usage exit, a profile whose installer cannot run the blank-disk guard unless `--confirm-destroy yes` says that the install may erase a disk.

## Acceptance scenarios

1. **Given** an asset the fleet refuses, **When** `arm` is run, **Then** nothing is armed and the fleet's words are said, per FR-002.

## Out of scope

- Which assets there are, their requirements and who may install them: the fleet's.

## Edge cases

- A machine whose disks hold data is stopped by the guard of `netboot` unless it was armed with `--confirm-destroy yes`, per FR-004.

## Assumptions

- The pinned boot files are fetched with `--fetch yes` and each is checked against its pin, per FR-005.

## Open questions

- None.

## Key entities

- **Install**, **Arming**, **Boot server**.

## Success criteria

- **SC-001**: A blank machine is installed from a render that holds no secret, only when an owner armed it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
