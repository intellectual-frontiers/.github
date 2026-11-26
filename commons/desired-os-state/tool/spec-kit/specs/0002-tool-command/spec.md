# Feature Specification: Desired OS State tool command

**Spec ID:** 0002-tool-command
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The verbs of `desired-os-state tool`, over what a fleet gives the plugin (its catalog, its dialects, its policy): `list`, `show`, `ensure`, `doctor` and `clean`. A change is planned before it is made, with a hash a person can approve, and it is made by each tool's dialect through Headless; a tool that no dialect can carry out under the fleet's policy is told with the reason of each dialect.

## Requirements

- **FR-001**: `toolPlugin(config)` MUST give the plugin `<program>-tool` (`desired-os-state-tool` unless the configuration names another program) that contributes the branch `tool` with the commands `list`, `show`, `ensure`, `doctor` and `clean`, or every problem of its definition as a value, and it MUST hold no catalog, dialect or pin of its own: all are in `config`, and the commands it suggests as fixes MUST name the program it extends.
- **FR-002**: `tool list` MUST list each declared tool with its phases, its pin policy and the dialect and version it resolves to under the policy (or that it is unresolved), `--phase` MUST select the tools of a phase, a word that is not a phase MUST end the run as a usage error, and it MUST only read.
- **FR-003**: `tool show NAME` MUST say what is declared of the tool, the dialect that carries it out and at which version, what is installed, and, where no dialect can carry it out, each dialect and the reason it was not chosen; a name not in the catalog MUST be refused naming the catalog.
- **FR-004**: `tool doctor` MUST say for each selected tool whether it is as asked, missing or differs, with the command that fixes each, MUST end as pending where any is not as asked and as ok where all are, and MUST change nothing.
- **FR-005**: `tool ensure` MUST make the plan and say its hash; in `--dry-run` it MUST write and run nothing; in `--check` it MUST run only the checks of the steps and end as pending where something would change; in apply mode it MUST have each dialect carry out its steps, a second run MUST change nothing, and a plan hash given with `--plan-hash` that is not the plan's MUST refuse before anything is run.
- **FR-006**: `tool clean` MUST be destructive: it MUST remove nothing in `--dry-run` or without the person's confirmation, MUST ask each dialect to clean (with `--programs` also the installed tools) only when confirmed, and MUST say what was removed.
- **FR-007**: Every command MUST read what it needs from `config` and its dialects, so that a different fleet configuration gives a different result with the same plugin, and a failure to resolve, observe or render MUST be a problem with the reason and never an exception.

## Acceptance scenarios

1. **Given** a configuration, **When** the plugin is made and assembled, **Then** the verbs are `desired-os-state tool clean|doctor|ensure|list|show`, per FR-001.
2. **Given** tools of two phases, **When** `list --phase dev` runs, **Then** only the tools of that phase are listed; with a word that is not a phase it ends with 2, per FR-002.
3. **Given** a tool no dialect can carry out, **When** `show` runs, **Then** each dialect and its reason are told, per FR-003.
4. **Given** missing tools, **When** `doctor` runs, **Then** each is said to be missing with its fix and the run ends as pending; after `ensure` it ends as ok, per FR-004.
5. **Given** a plan, **When** `ensure` runs in `--dry-run`, `--check` and apply mode, **Then** nothing is written, only checks are run, and the tools are installed, in that order; the second apply changes nothing, per FR-005.
6. **Given** a wrong `--plan-hash`, **When** `ensure` runs, **Then** it is refused and nothing is run, per FR-005.
7. **Given** a configuration, **When** `clean` runs with and without `--yes`, **Then** nothing is removed without it, per FR-006.

## Out of scope

- Installing a tool: the dialects.
- Choosing the catalog and the preference of dialects: the fleet.

## Edge cases

- A catalog with no tool of the phase asked: `list` says no tool is declared, and `ensure` has nothing to do, per FR-002 and FR-005.
- A phase and names given together: the names win, per FR-002.

## Assumptions

- The approval of an `ensure` is the fleet's assurance profile: where a profile asks for a signed plan hash, the fleet passes the hash it approved with `--plan-hash`.

## Open questions

- None.

## Key entities

- **Runtime** - a dialect the fleet chose, with how it is observed and cleaned.
- **Plan hash** - the hash of the plans of all dialects of an `ensure`, which a person can approve.

## Success criteria

- **SC-001**: A person sees what would change, with a hash, before anything is installed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
