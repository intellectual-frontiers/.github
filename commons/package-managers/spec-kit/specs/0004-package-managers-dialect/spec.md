# Feature Specification: Package managers: dialect

**Spec ID:** 0004-package-managers-dialect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The dialect made from a manager's data and the commands of the ontology: its guarantees as data, the plan file it renders from an order and a plan, one step that runs the program of the kit on the plan file it rendered (the file names the digest, and only the commands in it are run), the runner that asks a program under a limit of time, and the observation that gives Archon what is installed.

## Requirements

- **FR-001**: The dialect MUST declare its guarantees as data: the kind `tool`, subjects of the classes machine and workstation, a plan that is `partial` where a check can be made and `none` where it cannot, idempotence `unproven` until a suite has run the real manager, and that it cannot destroy; and as a dialect of tools the guarantees and the manager of the data it was made from.
- **FR-002**: `render` MUST give the plan file of the tools that change something, as generated output, with the commands in it, and MUST refuse with every reason where a command cannot be made; a requirement of another dialect or another manager MUST NOT be in it.
- **FR-003**: `steps` MUST give one step that applies and checks the tools that change through the program of the kit, each naming the digest of what was rendered in the path `.archon/<digest>/<dialect>/plan.json`, with the status 2 as the status that means something would change; the tools it covers MUST be those of the plan file that change, and a plan that changes nothing, or has none of this dialect's tools, MUST have no step.
- **FR-004**: The runner MUST give a program a limit of time and answer with its exit status and what it printed, or with nothing where it could not be run or did not answer in time, and MUST answer at the limit even where the program has started others that keep its output open.
- **FR-005**: `observeRequirements` MUST give Archon the desired state itself for a tool installed at the version asked (or any version where none is asked), a state with the version found and `installedFrom` `manager` for a tool at another version, and nothing for a tool that is absent, cannot be asked, or whose answer holds no version.
- **FR-006**: The program that raises the rights MUST come from the options of the dialect and be put before only the commands of a manager that needs rights; where none is given none is put.
- **FR-007**: The program MUST run only the commands of the plan file it is given and refuse a file that is not one; `check` MUST change nothing and end with 2 where a package is missing or cannot be asked; `apply` MUST install what is missing and, where the manager can be asked, MUST leave an installed package alone, so that a second `apply` changes nothing; and a failure MUST name the tool, the step, what it saw and the one action that is next.

## Acceptance scenarios

1. **Given** the data of a manager with a known missing status, **When** the guarantees are read, **Then** the plan is `partial`; with no known status it is `none`, per FR-001.
2. **Given** an order with a tool of this manager, a tool of another dialect and a tool by download, **When** it is rendered, **Then** only the first is in the plan file, per FR-002.
3. **Given** a plan, **When** the steps are made, **Then** one step runs the program on the plan file that names the digest, per FR-003.
4. **Given** a program that hangs and a program that starts another that keeps its output, **When** each is run with a limit, **Then** the answer is nothing at the limit, per FR-004.
5. **Given** a manager that says a package is at the version asked, at another version, and not installed, **When** the requirements are observed, **Then** the answers are as FR-005 says.
6. **Given** a program that raises the rights in the options, **When** the steps are made for a manager that needs rights and for one that does not, **Then** it is in front of the first only, per FR-006.

7. **Given** a plan file, **When** `check` runs with a package missing, installed and unaskable, **Then** it changes nothing and ends with 2; **When** `apply` runs twice, **Then** the second changes nothing, per FR-007.
8. **Given** an install that fails and a check that answers with another status, **When** the program runs, **Then** each failure names the tool, the step and the next action, per FR-007.

## Out of scope

- Reading the commands from the ontology: the source of commands is a function the dialect is given.
- Proving idempotence on a real manager: the conformance suite of each dialect on a machine that has it.

## Edge cases

- A manager whose check is not known is installed again by `apply` (managers install what is there as a no-op), and `check` says it would install, per FR-007.

## Assumptions

- The manager's own command is what installs, and the manager's own verification (signatures of a repository, the hash of a bottle) is what it guarantees; the dialect states it as data and never claims more.

## Open questions

- None.

## Key entities

- **Manager spec** - the data a dialect is made from.
- **Dialect** - the value of the port.

## Success criteria

- **SC-001**: A dialect of a manager is its data and a call.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
