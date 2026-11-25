# Feature Specification: Runbooks harness

**Spec ID:** 0007-runbooks-harness
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A runbook never names a harness. A harness is a dialect, and the set of dialects is open: a harness added later is one dialect registered and no change to any runbook. Which dialect a fleet, a person, a skill or a workload uses is a policy, data the fleet owns, and the choice is held to the dialects that can carry the runbook.

## Requirements

- **FR-001**: A runbook, a step and a skill MUST NOT name a harness: the dialects (`claude-code`, `codex` and `human` today) MUST be a registry typed in governance, each with an id, a holder (`agent` or `human`) and the kinds of requirement of the workbench it can express, and a dialect MUST be added by registering one entry and its renderers, with no change to any runbook.
- **FR-002**: A `HarnessPolicy` MUST be typed data a fleet owns with a `default` dialect, a `perSkill` choice, a `perOperator` preference of a person and a `perWorkload` choice, and MUST be decoded at the boundary into that type or refused with every reason.
- **FR-003**: The choice of a dialect for a run MUST resolve in this order: the explicit choice made at run time, then the operator's preference, then the skill's choice, then the workload's, then the fleet's default; the first that names a dialect decides, and the default is always present, so a run always has a dialect to be judged.
- **FR-004**: A dialect MUST be chosen only where the matrix of the workbench (the needs of the runbook by dialect) shows no `dropped` and no `no-person` finding for that runbook; otherwise the choice MUST be refused with the code `E-RB-HARNESS-UNSUITABLE`, whose fixer is a person, naming the dialect and each requirement it lacks, and the run MUST NOT fall back to another dialect by itself.
- **FR-005**: The library MUST project a runbook for every registered dialect from the one source, and the autonomy derived for each step MUST be the same for every dialect: switching the dialect changes the skill files, the allow, ask and deny rules (and the entry of a tool server where the harness's format is verified, which none is today), and never the steps, the effects or the autonomy.
- **FR-006**: The projections MUST be the same bytes for the same runbook and dialect, and a dialect whose format could not be verified MUST be the conservative one (0004-runbooks-projections FR-007).

## Acceptance scenarios

1. **Given** a runbook and the registry, **When** the runbook is read for a harness name, **Then** none is found and a new dialect registered changes no runbook, per FR-001.
2. **Given** a policy as plain data with an unknown dialect, **When** it is decoded, **Then** it is refused with the reason, per FR-002.
3. **Given** a policy with all five choices, **When** the dialect of a run is resolved, **Then** the explicit choice wins, then the operator's, the skill's, the workload's and the default, per FR-003.
4. **Given** a dialect that cannot express a credential and a runbook that needs one, **When** it is chosen, **Then** it is refused with `E-RB-HARNESS-UNSUITABLE`, a person fixes it and the credential is named, per FR-004.
5. **Given** the starter runbook and every registered dialect, **When** they are projected, **Then** each gives files and every dialect says the same autonomy for each step, per FR-005.
6. **Given** the same runbook and dialect twice, **When** they are projected, **Then** the bytes are the same, per FR-006.

## Out of scope

- Writing a harness's files into its folder, and the configuration of a harness's approvals, which a person sets.

## Edge cases

- An operator who prefers a dialect that cannot carry the runbook is refused, never silently moved to the skill's dialect: the refusal is the finding, per FR-004.
- A requirement of kind `authority` is expressed by a human dialect and needs a person for an agent dialect, so a runbook with a gate and no human dialect in the registry has `no-person`, per FR-004.

## Assumptions

- The place of the workload's choice between the skill's and the default is this specification's decision; the owner gave the order explicit, operator, skill, default and the workload sits between the last two.
- A person's `human` dialect always carries a runbook, and an agent dialect lacks what the registry says it cannot express.

## Open questions

- None.

## Key entities

- **Dialect** - how one kind of operator receives a runbook.
- **HarnessPolicy** - the fleet's data that chooses a dialect.
- **Fleet** - the owner of a policy: a group of workshops and operators.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| The matrix of requirement by dialect of the workbench (`commons/workbench/src/logical/matrix.ts`, read in this repository) | Each dialect answers every requirement as expressed, carried or unexpressed with a reason; a cell no dialect answers is `dropped`; an agent dialect that needs a person for a requirement no human dialect expresses is `no-person` | The file itself |
| Claude Code skills and settings; Codex `AGENTS.md` (read 2026-11-25, see 0004-runbooks-projections) | What each of the two harnesses reads; no other harness is named, and a harness added later is one registered dialect | As in 0004-runbooks-projections |
| W3C PROV-O (read 2026-11-25) | The operator's choice of a harness is a choice of the agent that is associated with the activity, and does not change the activity | Section 4.1 |

## Success criteria

- **SC-001**: Every requirement of 0007-runbooks-harness is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
