# Feature Specification: Workload harness

**Spec ID:** 0007-workload-harness
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A workload never names a harness. A harness is a dialect, and the set of dialects is open: a harness added later is one dialect registered and no change to any workload. A dialect is a harness projection and is never a form (0003-workload-forms). Which dialect a fleet, a person, a workload or a form uses is a policy, data the fleet owns, and the choice is held to the dialects that can carry the workload.

## Requirements

- **FR-001**: A workload and a node MUST NOT name a harness: the dialects (`claude-code`, `codex` and `human` today) MUST be a registry typed in governance, each with an id, a holder (`agent` or `human`) and the kinds of requirement of the workbench it can express, and a dialect MUST be added by registering one entry and its renderer, with no change to any workload; the word dialect MUST NOT name a form.
- **FR-002**: A `HarnessPolicy` MUST be typed data a fleet owns with a `default` dialect, a `perWorkload` choice (by the id of a workload), a `perForm` choice (by a form that has code) and a `perOperator` preference of a person, and MUST be decoded on entry into that type or refused with every reason.
- **FR-003**: The choice of a dialect for a run MUST resolve in this order: the explicit choice made at run time, then the operator's preference, then the choice for the workload, then the choice for its form, then the fleet's default; the first that names a dialect decides, and the default is always present, so a run always has a dialect to be judged.
- **FR-004**: A dialect MUST be chosen only where the matrix of the workbench (the requirements of the workload by dialect) shows no `dropped` and no `no-person` finding for that workload; otherwise the choice MUST be refused with the code `E-WL-HARNESS-UNSUITABLE`, whose fixer is a person, naming the dialect and each requirement it lacks, and the run MUST NOT fall back to another dialect by itself; each form says which requirements its workload has of its dialect.
- **FR-005**: The library MUST project a workload for every registered dialect from the one source, and the autonomy derived for each node MUST be the same for every dialect and for every form: switching the dialect changes the skill files, the allow, ask and deny rules (and the entry of a tool server where the harness's format is verified, which none is today), and never the nodes, the effects or the autonomy.
- **FR-006**: The projections MUST be the same bytes for the same workload and dialect, and a dialect whose format could not be verified MUST be the conservative one (0004-workload-projections FR-007).
- **FR-007**: A dialect's renderer MUST take the options of a projection after the views (0004-workload-projections FR-011), so that a dialect registered later receives the verb command of its host with no change to any workload, and `projectAll` MUST refuse a command that is not words and a path with `E-WL-HARNESS-COMMAND-INVALID` before any dialect renders.

## Acceptance scenarios

1. **Given** the starter workload, **When** it is serialized, **Then** it names no harness, and a dialect registered later changes nothing of it, per FR-001.
2. **Given** a policy as plain data, **When** it is decoded, **Then** it is a typed policy or every reason it is not one, per FR-002.
3. **Given** a policy and a request, **When** the dialect is resolved, **Then** the order is the explicit, the operator, the workload, the form and the default, per FR-003.
4. **Given** a workload that needs a credential and a dialect that cannot express it, **When** it is chosen, **Then** it is refused with its code and what it lacks and the run is not moved, per FR-004.
5. **Given** every dialect, **When** a workload is projected, **Then** each says the same autonomy for each node, per FR-005.
6. **Given** the same workload twice, **When** it is projected, **Then** the bytes are the same, per FR-006.
7. **Given** a dialect registered by a host and the option `verbCommand`, **When** the workload is projected, **Then** the renderer receives the options and an invalid command is refused before it renders, per FR-007.

## Out of scope

- Writing a harness's files into its folder, and the configuration of a harness's approvals, which a person sets.

## Edge cases

- An operator who prefers a dialect that cannot carry the workload is refused, never silently moved to the workload's dialect: the refusal is the finding, per FR-004.
- A requirement of kind `authority` is expressed by a human dialect and needs a person for an agent dialect, so a workload with a gate and no human dialect in the registry has `no-person`, per FR-004.

## Assumptions

- The place of the form's choice between the workload's and the default is this specification's decision: the order is the explicit choice, the operator, the workload and then the form, and the form is the more general of the two.
- A person's `human` dialect always carries a workload, and an agent dialect lacks what the registry says it cannot express.

## Open questions

- None.

## Key entities

- **Dialect** - how one kind of operator, a harness or a person, receives a workload.
- **HarnessPolicy** - the fleet's data that chooses a dialect.
- **Fleet** - the owner of a policy: a group of workshops and operators.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| The matrix of requirement by dialect of the workbench (`commons/workbench/src/logical/matrix.ts`, read in this repository) | Each dialect answers every requirement as expressed, carried or unexpressed with a reason; a cell no dialect answers is `dropped`; an agent dialect that needs a person for a requirement no human dialect expresses is `no-person` | The file itself |
| Claude Code skills and settings; Codex `AGENTS.md` (read 2026-11-25, see 0004-workload-projections) | What each of the two harnesses reads; no other harness is named, and a harness added later is one registered dialect | As in 0004-workload-projections |
| W3C PROV-O (read 2026-11-25) | The operator's choice of a harness is a choice of the agent that is associated with the activity, and does not change the activity | Section 4.1 |

## Success criteria

- **SC-001**: Every requirement of 0007-workload-harness is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
