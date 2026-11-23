# Feature Specification: Converge plugin: the commands

**Spec ID:** 0002-converge-command
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What the plugin does for `archon converge plan` and `archon converge apply` over what a fleet gives it: the dialect, where its render is kept on the machine, how the tool's version is read, the options of the fleet's own, and the function that says what must be true of an asset.

## Requirements

- **FR-001**: The plugin MUST contribute the branch `converge` with the verbs `plan` and `apply` to the program it is given (`archon` by default), take a dialect and a function that gives, for an asset and the options the person gave, what must be true of it and how to reach it, or a refusal with a code, an exit and the words; a refusal MUST end the command with that exit and name that code, and the options of the fleet's own MUST reach the function.
- **FR-002**: `plan` MUST observe the machine by reading only (never a change and nothing written on it), make the order, the plan and the render, say each change, name each requirement that no dialect carries (never leaving one out silently) and print the hash of the plan, ending with 4 where there is something to approve and 0 where the plan is empty.
- **FR-003**: `apply` MUST carry out exactly the plan of the hash it is given and refuse another (`the plan changed`) with nothing changed, refuse a plan that removes something unless `--allow-removal yes` is given, check that the tool on the machine is the version the dialect pins, put the render on the machine and run the steps with the executor of Headless.
- **FR-004**: After an apply the plan MUST be made again and, where it is not empty, the command MUST end with 1 and say so.
- **FR-005**: Every change of a machine MUST be by the steps of the plan that the hash covers; a change made by hand MUST be found again by the next plan, with the one change.
- **FR-006**: The subject MAY say the family of the machine and a dialect of its own (the family and the version of the tool of this machine, which the fleet gives from the platform it declares or reads, commons linux-observe 0004-linux-observe-platform): where it does, the observation MUST read each package by the program of the family and the render, the steps and the check of the version of the tool MUST be those of that dialect, so that one command converges machines of different families, each by what it is.

## Acceptance scenarios

1. **Given** a machine and its requirements, **When** `plan` is run and then `apply` with its hash, **Then** the machine is as declared and the next plan is empty, per FR-002 to FR-004.

## Out of scope

- Which machines there are, where the requirements are kept and who owns a machine's convergence: the fleet's.

## Edge cases

- A kind of resource that no dialect carries is named in the plan as not converged, per FR-002.

## Assumptions

- The tool of the dialect is on the machine already (the plugin installs nothing).

## Open questions

- None.

## Key entities

- **Convergence**, **Plan hash**, **Subject**.

## Success criteria

- **SC-001**: A machine is converged to what its requirements declare only by the plan that a person approved by its hash, and the next plan is empty.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
