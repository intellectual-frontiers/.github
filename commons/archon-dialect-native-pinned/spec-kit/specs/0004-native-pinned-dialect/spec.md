# Feature Specification: Native-pinned dialect

**Spec ID:** 0004-native-pinned-dialect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The dialect itself: its guarantees as data, the observation of what is installed (the store first, then the PATH where the policy allows, asking each program its version with a limit of time), the plan file it renders, and the program that checks or applies it. It follows the port of Archon (commons archon 0004-archon-dialects) and the resolution of Toolchain (commons toolchain 0003-toolchain-logical). Applying twice changes nothing the second time.

## Requirements

- **FR-001**: The dialect MUST declare its guarantees as data: the kind `tool`, subjects of the classes machine and workstation, a faithful plan (what it would do is found without the network), idempotence proven by its tests, and that it can destroy; and as a dialect of tools that it pins exactly, checks by hash, installs in the user scope, reaches the five platforms, takes the download of a pin and never builds from source.
- **FR-002**: `observe` MUST find each tool wanted: first in the store (a copy whose install record is there and whose program is there too; the files are compared with the record by `installDrift`, which a caller that verifies uses), then, where the policy allows a system copy, on the PATH under the program's name and then each of its other names; it MUST ask each program its version with the tool's arguments and a limit of five seconds, and a program that cannot be asked (a hang, a crash) MUST be reported as found and unreadable and never end the run.
- **FR-003**: `render` MUST give the plan file of the tools that change something as generated output (it says so, never edited), holding for each tool its name, version, program, other names, scope, minimum and source (the address, the SHA-256, the format and the folder, or the pin and the reason it has none), and MUST NOT hold a secret; and `steps` MUST give the step that applies it and the step that checks it, each naming the digest of what was rendered in the path `.archon/<digest>/native-pinned/plan.json`.
- **FR-004**: In `check` mode the program MUST change nothing and MUST say, tool by tool, `none`, `install` or `replace`, ending with a status that says whether something would change; in `apply` mode it MUST do it, and a second `apply` of the same plan MUST change nothing.
- **FR-005**: Before it acts the program MUST say, for each tool, which program it is and where it was found or that it was not; every failure MUST name the tool, the step (`lock`, `download`, `checksum`, `unpack`, `switch`), what the step saw and the one action that is next.
- **FR-006**: A tool that is as pinned in the store MUST be answered with no network and no write, so that a caller that asks for a tool only when it needs it pays nothing for one that is there.
- **FR-007**: A tool whose pin has no download on the platform MUST be reported as such with the ontology's reason and MUST NOT be installed.

## Acceptance scenarios

1. **Given** the dialect, **When** its guarantees are read, **Then** they are the ones of FR-001 and the dialect of tools meets the control `exact-hashed`.
2. **Given** a tool installed by the dialect, **When** it is observed, **Then** it is found in the store at its version, per FR-002.
3. **Given** a program on the PATH that hangs when asked its version, **When** it is observed, **Then** it is reported unreadable within the limit and the run goes on, per FR-002.
4. **Given** a plan, **When** `check` runs, **Then** nothing is written and the status says something would change, per FR-004.
5. **Given** a plan, **When** `apply` runs twice, **Then** the second run changes nothing, per FR-004.
6. **Given** a tool that is installed as pinned, **When** it is asked for, **Then** no connection is made and nothing is written, per FR-006.
7. **Given** a pin with no download on the platform, **When** it is asked for, **Then** the reason is told and nothing is installed, per FR-007.

## Out of scope

- Installing the Archon way (an order and a plan of many requirements): the plan file holds only the tools; Archon orders them, per FR-003.
- The manager dialects: packages of their own.

## Edge cases

- A program on the PATH at a version below the minimum: it does not count, per FR-002.
- A store copy whose file was changed: it does not count and the tool is replaced, per FR-002.

## Assumptions

- Archon's plan says `create`, `update` or `none` for a tool requirement by comparing its desired state with what `observe` gives; `observe` gives the desired state itself for a tool that is installed as pinned.

## Open questions

- None.

## Key entities

- **Dialect** - the value of the port.
- **Plan file** - the generated list of tools the program checks or applies.

## Success criteria

- **SC-001**: A tool that is there costs nothing to ask for.
- **SC-002**: The dialect never installs a byte that is not the pinned artifact.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
