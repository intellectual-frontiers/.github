# Feature Specification: Workload runners

**Spec ID:** 0010-workload-runners
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The runner axis. A runner is how a plan is carried out, and it replaces the executor port of the form contract (0003-workload-forms). There are two kinds. A **native** runner is our TypeScript, which interprets the plan on Bun or Node; it is interactive, it is the default and it records the events of a run directly. An **integration** runner compiles the plan into an artifact that a foreign system runs and then hands off: we keep the plan, the policy and the evidence, and we do not keep the run. The choice of a runner is a policy and never part of a workload, the autonomy derived for every node is the same under every runner, and an artifact is only a sequence of calls to pinned verbs, so that all meaning stays in typed TypeScript. The runners are the fourth axis beside the form, the dialect (0007-workload-harness) and the trigger. The word for the user is `runner`; where this library names the machines of GitHub it calls them **hosts**, so that the two are not confused.

## Requirements

- **FR-001**: The runners MUST be a registry typed in the core, each with an id, a kind of the closed list `native` and `integration`, a title and the capabilities it declares from the closed list `calls`, `fan-out`, `interactive`, `judge`, `approval`, `logic`, `compensate` and `destroy`; a runner MUST be added by registering one entry (and, for an integration runner, one emitter), with no change to any workload. The runners of the commons are `native`, `bash` and `pwsh`.
- **FR-002**: The native runner MUST be the port a form's run goes through, the former executor renamed and its behavior kept: one `NativeRunner` for each form that has code, which interprets the plan of the workload, holds each node to its derived autonomy, parks for a person, attaches and detaches stores, compensates and records every fact as an event of the run. The native runner MUST declare every capability, and it MUST be the default of every policy.
- **FR-003**: An integration runner MUST compile the plan of a workload into an artifact that a foreign system runs, and MUST hand it off: the library keeps the plan, the policy and the evidence, and keeps none of the run. An integration runner MUST declare only what its artifact can carry; the emitters of the commons are `bash` (0011-runner-bash) and `pwsh` (0012-runner-powershell), and GitHub Actions is a later emitter that this specification does not build.
- **FR-004**: A form MUST say what its workload needs of a runner, as a list of needs each from the closed list of capabilities and each naming the node that has it, derived from the nodes and never declared: a call of a verb or a check needs `calls`; an `each` needs `fan-out`; an `ask` needs `interactive`; a `judge` needs `judge`; a `gate` or an approval needs `approval`; a `branch`, a diff or a plan needs `logic`; an `undo` needs `compensate`; a destroy on a durable, git or external store needs `destroy` unless a gate or an approval guards it, and then needs `approval`; and any other node that is `human-only` once the gates are applied and that no gate guards needs `interactive`. A workload that needs `interactive`, `judge`, `logic`, `compensate` or `destroy` MUST be run by the native runner.
- **FR-005**: A `RunnerPolicy` MUST be typed data a fleet owns with a `default` runner (`native` unless the fleet says another), a `perWorkload` choice (by the id of a workload), a `perForm` choice (by a form that has code) and a `perOperator` preference of a person, MUST be decoded at the boundary into that type or refused with every reason, and a workload and a node MUST NOT name a runner.
- **FR-006**: The choice of a runner for a run MUST resolve in this order: the explicit choice made at run time, then the operator's preference, then the choice for the workload, then the choice for its form, then the default of the policy; the first that names a runner decides, and the default is always present, so a run always has a runner.
- **FR-007**: A runner MUST be chosen only where it declares every capability the workload needs (FR-004); otherwise the choice MUST be refused with `E-WL-RUNNER-UNSUITABLE`, whose fixer is a person, naming the runner and each capability it lacks and the node that needs it, and the run MUST NOT fall back to another runner by itself.
- **FR-008**: The autonomy derived for each node MUST be the same under every runner and for every form: handing a plan off MUST NOT change a node, an effect or its autonomy, the hand-off MUST carry the derived autonomy of each node in the artifact, and a node that is `human-only` or whose control a gate raises MUST NOT be carried by a runner that lacks the capability that keeps it so.
- **FR-009**: A run MUST gain two planning events in the envelope `workload.event/1` of the form of the workload: `handoff`, with the plan hash and the id of the runner, and `receipt`, with the plan hash, the reference of the external run, its exit status and the digest of its log. Each MUST be decoded at the boundary into a closed union or refused, a receipt MUST be pulled by ingest and written by the library (no inbound network), and the events of the form's own fold MUST NOT change because of them.
- **FR-010**: The state of a hand-off MUST be a fold of its events, never stored: the same events in any arrival order and with a repeat give the same state; a receipt whose plan hash no hand-off has MUST be refused (`E-WL-RUNNER-RECEIPT-UNMATCHED`); the outcome of a hand-off MUST be said in the three words of every form (`completes` for the exit status 0, `fails` for any other, nothing while there is no receipt); and an approval a receipt carries MUST count only where the actor who recorded it is a person (`E-WL-RUNNER-APPROVAL-NOT-PERSON`), so that an agent never approves.
- **FR-011**: An artifact MUST obey the thin emit rule: it is only a sequence of calls to pinned CLI verbs by their verb id, `each` over a fixed list and the order of the steps; it MUST hold no expression, no inline logic, no `eval` and no command built from a string, no value computed at run time, and no secret, only the names of the credentials it needs, read from the environment by the verb. A node outside the closed subset (`verb`, `check` and `each` of those) MUST be refused with `E-WL-RUNNER-EMIT-UNSUPPORTED`.
- **FR-012**: A value that an artifact would hold MUST be printable ASCII with no control character, or the emit MUST be refused with `E-WL-RUNNER-VALUE-UNSAFE`; an `each` MUST name a source that is a literal naming a fixed list the caller gives, or the emit MUST be refused with `E-WL-RUNNER-EACH-UNLISTED`.
- **FR-013**: The plan hash MUST be the SHA-256 of the canonical text of the plan that is emitted (the workload, its version, the calls, the lists and the autonomy of each step), the same for every emitter, so that two artifacts of the same plan carry the same hash and a plan that changed has another; the artifact MUST carry the hash and the handoff event MUST carry it.
- **FR-014**: An artifact MUST be checked by regenerating it and comparing: the check MUST find a difference as `E-WL-RUNNER-DRIFT`, and a hand-edited artifact, an artifact of a changed plan and an artifact of another runner MUST each fail it. The generated artifacts of the library MUST be written by `bun commons/workload/tools/runners.ts`, whose `--check` writes nothing and says which differ, like every generator of this repository.
- **FR-015**: The runner catalog MUST be part of the closed catalog of the core: every code of the concept `runner` MUST be `E-WL-RUNNER-<KIND>` with its fixer, its fix and whether it is a safety rule, and a hand-off MUST be refused where its workload has a finding.
- **FR-016**: The runners MUST keep the layers of the library: the native runner of a form is in the physical layer behind its port, each emitter is an instance of the unit `src/physical/runners/` and imports no other emitter, the shared closed subset (the plan of calls) is of the core, and the core imports nothing from a form; a form MAY say how its workload lowers to calls, and a form that cannot MUST be refused by the emit.
- **FR-017**: The first consumer MUST be the runbook `synthetic-bootstrap-01` (an install check, one verb and one `each`), emitted to both artifacts, and a golden test MUST hold that the two artifacts sequence the same verbs.

## Acceptance scenarios

1. **Given** the registry, **When** it is read, **Then** it holds `native`, `bash` and `pwsh` with their kinds and capabilities, and a runner added later is one entry, per FR-001.
2. **Given** the runner of each form that has code, **When** its keys and its form are read, **Then** it is the port the executor was and runs as before, per FR-002.
3. **Given** the bootstrap runbook, **When** it is emitted, **Then** an artifact exists that the library does not run, per FR-003.
4. **Given** the starter workloads and the bootstrap runbook, **When** their needs are derived, **Then** an ask, a judge, a branch, an undo and an ungated destroy of a durable store need the native runner and a plain list of calls does not, per FR-004.
5. **Given** a policy as plain data, **When** it is decoded, **Then** it is a typed policy with `native` as the default or every reason it is not one, and no workload names a runner, per FR-005.
6. **Given** a policy and a request, **When** the runner is resolved, **Then** the order is the explicit, the operator, the workload, the form and the default, per FR-006.
7. **Given** a workload with a judge and the runner `bash`, **When** it is chosen, **Then** it is refused with its code, what `bash` lacks and the node, and the run is not moved, per FR-007.
8. **Given** each starter and each runner, **When** the autonomy of each node is derived, **Then** it is the same for every runner and for both forms, and the artifact carries it, per FR-008.
9. **Given** a hand-off and a receipt, **When** they are encoded and decoded, **Then** each is the same event and the fold of the form is unchanged, per FR-009.
10. **Given** the events in two orders with a repeat and an unmatched receipt, **When** they are folded, **Then** the state is the same, the unmatched one is refused and an approval of an agent does not count, per FR-010.
11. **Given** an artifact, **When** it is read, **Then** it holds only calls, a loop over a fixed list and no secret, and a step outside the subset is refused, per FR-011.
12. **Given** a value with a control character and an `each` with no list, **When** they are emitted, **Then** each is refused with its code, per FR-012.
13. **Given** two emitters and one plan, **When** they are emitted, **Then** the hash is the same, and a changed plan has another, per FR-013.
14. **Given** an artifact edited by hand, **When** it is checked, **Then** it fails with the drift, per FR-014.
15. **Given** the catalog, **When** the codes of the runner concept are read, **Then** each is closed and has its fixer and its fix, per FR-015.
16. **Given** the manifest and the sources, **When** the shared checker runs, **Then** the emitters are instances and the core imports no form, per FR-016.
17. **Given** the bootstrap runbook, **When** it is emitted to `bash` and `pwsh`, **Then** both sequence the same verbs, per FR-017.

## Out of scope

- The GitHub Actions emitter (a later slice), and the form `graph` (0013-form-graph).
- Running an artifact: a foreign system does, and the library only compiles it, hands it off and ingests its receipt.
- Any POSIX `sh` subset, Windows PowerShell 5.1 and any legacy or backward compatibility: the emitters target modern Bash 5 and PowerShell 7.

## Edge cases

- A workload with a judge or an ask is never handed off; it is run by the native runner, and a policy that names an integration runner for it is refused with `E-WL-RUNNER-UNSUITABLE`, per FR-007.
- A gate can be mapped to the approval of a platform only by a runner that declares `approval` and only where the approval comes back as evidence recorded by a person, per FR-004 and FR-010; no runner of the commons declares it today.
- A receipt that arrives before its hand-off is kept in the fold and matched when the hand-off arrives, because the fold orders the events by their ids, per FR-010.
- An `each` with an empty list is a loop over nothing, and it is a list the caller gave, per FR-012.

## Assumptions

- The hosts that run an artifact bind the verb command (a program of the pinned packages) by its name, as the host of a native run binds the verbs; the artifact never installs it.
- The plan hash is the SHA-256 of `@intellectual-frontiers/crypto`, as the plan hash of the reconcile form is (0009-form-reconcile FR-008).

## Open questions

- None.

## Key entities

- **Runner** - how a plan is carried out: native or integration, with the capabilities it declares.
- **RunnerPolicy** - the fleet's data that chooses a runner.
- **Hand-off** - the event that says a plan went to an integration runner, by its hash.
- **Receipt** - the event that says what the external run did, pulled by ingest.
- **Plan of calls** - the closed subset an artifact is made from.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| W3C PROV-O (as read for 0005-workload-runs) | The choice of a runner is the choice of the agent that is associated with the activity and does not change the activity; a receipt is a record of an activity that another system performed | Section 4.1, as cited by 0005-workload-runs |
| The workbench matrix (`commons/workbench/src/logical/matrix.ts`, read in this repository) | A choice is held to what the chosen party can express; what it cannot is named and the choice is not moved | The file itself; 0007-workload-harness FR-004 uses it for dialects |
| SHA-256 through `@intellectual-frontiers/crypto` (`commons/crypto/src/sha256.ts`, read in this repository) | A digest is 64 lower case hexadecimal digits | The file itself |
| Plan then apply with an approval by the hash of the plan (0009-form-reconcile) | What is handed off is identified by its hash, and a result that names another hash is not the result of this plan | The specification itself |

## Success criteria

- **SC-001**: Every requirement of 0010-workload-runners is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
