# Feature Specification: Form graph

**Spec ID:** 0013-form-graph
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The form `graph` (0003-workload-forms FR-007), built. A graph is a directed acyclic graph of nodes with edges that say which node comes after which, with the same nodes and the same effects as the other forms, the same autonomy derived from them, and no runner of its own: it is carried by an integration runner (0010-workload-runners) that a foreign system executes, GitHub Actions being the first (0014-runner-github-actions). The first consumer is CI/CD and the workflows that GitHub runs from YAML; the library keeps the plan, the policy and the evidence, and the platform keeps the run. The owner of the repository decided on ticket 29 to build it now, which replaces the rule of two that reserved it: the registry says `built` and the criterion is no longer in it.

## Requirements

- **FR-001**: The form `graph` MUST be built: the registry of forms of the core MUST say `built` for it, its logic MUST be an instance of the unit of the forms (`src/logical/forms/graph`, a form that imports no other form, 0003-workload-forms FR-003) with its native runner in `src/physical/forms/graph`, and the package MUST have the entries `./forms/graph` and `./runners/github-actions`; the core and the shared logical layer MUST import nothing of it.
- **FR-002**: A graph MUST be typed data of the form `graph`, decoded on entry into the type or every reason it is not one: a workload head, a `limit` (the greatest mode of effect any node may declare), `results` (the nodes whose outcome decides the run) and nodes of a closed sum of four kinds, `verb`, `check`, `each` and `gate`; every node but a gate MUST have `after`, the ids of the nodes it comes after (the `needs` of the jobs of GitHub; it is not called `needs` here because every node already has `needs`, the requirements of the workbench), and MAY have the permissions it asks for (a scope with `read` or `write`) and the minutes it may take.
- **FR-003**: The nodes and the effects of a graph MUST be those of the other forms (a verb with an effect on a declared store, a check that only reads, an each over a fixed list, a gate that guards nodes), and the autonomy of every node MUST be derived from its effect by the one table of the core and never declared: a verb has the autonomy of its effect, a check is autonomous, an each the least of its body, a gate is a person's, and a gate only raises the control over the nodes it guards; the runner that carries the graph MUST change none of it.
- **FR-004**: Every `after` MUST name a node of the graph that is a job (a gate is none) and not the node itself, or the check MUST refuse the graph with `E-GR-NEEDS-UNKNOWN`; the edges MUST NOT make a cycle, or the check MUST refuse it with `E-GR-EDGE-CYCLE` naming the cycle; and the order of the jobs MUST be a stable topological order, so that the same graph gives the same order.
- **FR-005**: Every job MUST be a result or be come after by a result, directly or not, or the check MUST refuse the graph with `E-GR-NODE-UNREACHABLE` naming the node: work that no result depends on is dead.
- **FR-006**: The check MUST refuse a graph that is not well formed with `E-GR-GRAPH-MALFORMED`: no node, no result, an id used twice, a result or a guarded node that is no job, a store a node names that the graph does not declare or declares in another class, an each with an empty body, an undo (a graph has none), and a value that one node reads from the output of another, because the edges of a graph order nodes and carry no value (a call that needs a value is a call of one verb).
- **FR-007**: An effect above the `limit` of the graph MUST be refused with `E-GR-NODE-EFFECT-OVER-LIMIT` (a safety rule whose fixer is a person); a node that asks for a scope with `write` and has no effect that is more than a read MUST be refused with `E-GR-PERMISSION-EXCESS`; a gate that guards nothing MUST be refused with the code of the core.
- **FR-008**: The checks every form shares MUST apply to the nodes of a graph and to the calls in the body of an each: a node cites a requirement or a control, a verb is registered, its inputs fit it, an effect is within its verb's, the needs of a verb are declared, a check uses a verb that only reads, an effect on a system of record names an idempotency key and a need names no installer.
- **FR-009**: The catalog of the form MUST be closed and its codes `E-GR-<CONCEPT>-<KIND>`: `E-GR-GRAPH-MALFORMED`, `E-GR-NEEDS-UNKNOWN`, `E-GR-EDGE-CYCLE`, `E-GR-NODE-UNREACHABLE`, `E-GR-NODE-EFFECT-OVER-LIMIT` and `E-GR-PERMISSION-EXCESS`, each with its concept, who may fix it, its one fix and whether it is a safety rule, and the catalogs of the library MUST include it.
- **FR-010**: The dry run of a graph MUST refuse a graph with a finding and otherwise give its nodes with the autonomy derived for each and what stops for a person, and evaluate the preconditions with the workbench only, as every form does.
- **FR-011**: A graph MUST say what it needs of a runner, derived from its nodes and never declared (0010-workload-runners FR-004): a verb or a check needs `calls`, an each `fan-out`, a gate `approval`, a destroy of a durable, git or external store `destroy` (or `approval` where a gate guards it), and a node that is `human-only` and not guarded `interactive`.
- **FR-012**: A graph MUST lower to a plan of calls with its jobs, each with its edges, the permissions it asks for (the least: `contents: read` where it asks for none), the gate that guards it as the environment a person approves, the credentials it reads by name and its one call or loop, and with the same calls in the order of the graph for a runner that has no jobs; two gates on one job, a source that is no literal and a list the caller did not give MUST be refused with `E-WL-RUNNER-EMIT-UNSUPPORTED` or `E-WL-RUNNER-EACH-UNLISTED`.
- **FR-013**: A run of a graph MUST be recorded as planning events in the envelope of the core (`started`, `done`, `failed`, `parked`, `answered`, `finished`) and its state MUST be their fold together with the fold of the hand-off, the same for the same events in any order and never stored; an answer to a gate by an actor who is not a person MUST be refused, and the outcome MUST be said in the three words every form shares: the native run's finish, or else the exit status of the receipt.
- **FR-014**: The starters and fixtures of the form MUST be synthetic (`synthetic-graph-01`, a graph that a schedule starts, with a loop and a gate, and `synthetic-graph-02`, the smallest, with a weekly schedule and no gate), MUST keep every rule of the check, and MUST be the workloads the integration runners and the schedule are proved with.
- **FR-015**: The native runner of the graph MUST run the nodes in the order of the edges by the verb runner of the host and record every fact, MUST park at a gate that a person has not approved (naming the gate and its approver) and fail at one a person declined, MUST NOT run again a node that is done, so that a run that is resumed goes on where it stopped, and MUST refuse a graph with a finding.
- **FR-016**: The graph form MUST be an instance of the unit of the forms in the table of layers of the manifest and the shared checker of Kanon MUST find no import of one form by another; the native runner of the graph MUST import no other form's runner.

## Acceptance scenarios

1. **Given** the registry and the package, **When** they are read, **Then** `graph` is built with its entries and its two folders, and the core imports nothing of it, per FR-001 and FR-016.
2. **Given** a graph as a value from outside, **When** it is decoded, **Then** the four kinds of node are read, `after` and the permissions are decoded and a value that is none is refused with every reason, per FR-002.
3. **Given** the starters, **When** the autonomy of each node is derived under each runner, **Then** it is the same, a gate lowers what it guards and never raises it, per FR-003.
4. **Given** a node that comes after a node that is not there, and a graph of two nodes that come after each other, **When** they are checked, **Then** the first is `E-GR-NEEDS-UNKNOWN` and the second `E-GR-EDGE-CYCLE`, and the order of a valid graph is stable, per FR-004.
5. **Given** a node that no result comes after, **When** it is checked, **Then** it is `E-GR-NODE-UNREACHABLE`, per FR-005.
6. **Given** a graph with an id twice, a value read from another node's output and an undeclared store, **When** it is checked, **Then** each is `E-GR-GRAPH-MALFORMED`, per FR-006.
7. **Given** an effect above the limit and a write permission over a node that only reads, **When** they are checked, **Then** they are `E-GR-NODE-EFFECT-OVER-LIMIT` and `E-GR-PERMISSION-EXCESS`, per FR-007.
8. **Given** a node with an unknown verb, no citation and a check that writes, **When** it is checked, **Then** the codes of the core are found, per FR-008.
9. **Given** the catalog, **When** it is read, **Then** each code is closed, has its fixer and fix, and the effect over the limit is a safety rule, per FR-009.
10. **Given** a graph with a finding and one without, **When** each is planned, **Then** the first is refused and the second gives its nodes with their autonomy, per FR-010.
11. **Given** the starters, **When** their needs are derived, **Then** the gate needs `approval` and the loop `fan-out`, per FR-011.
12. **Given** the starters, **When** they are lowered, **Then** the jobs have their edges, their least permissions, their environment and their credentials, and the refusals are the codes, per FR-012.
13. **Given** the events of a run in two orders, with an answer by an agent, **When** they are folded, **Then** the state is the same and the answer is refused, per FR-013.
14. **Given** the starters, **When** they are read, **Then** every name is synthetic and the check finds nothing, per FR-014.
15. **Given** a graph and fake verbs, **When** the native runner runs it, **Then** it runs in order, parks at the gate, goes on after a person approves, and does not run a done node again, per FR-015.

## Out of scope

- Freshness of a job (the older idea of this slot): no consumer needs it, and a graph that did would add a node kind, not a form.
- A graph run by the native runner in parallel: the native runner is sequential; parallelism is what a runner that has jobs adds.
- Passing a value from one node to another: the edges order nodes, and a call that needs a value is one call.

## Edge cases

- A graph of two jobs with one consumer is still a graph, because the rule of two no longer reserves the form (the owner's decision above), per FR-001.
- A gate guards jobs and is never a job: on GitHub the jobs it guards run in the environment a person approves, per FR-012.
- A job guarded by two gates is refused, because a job has one environment, per FR-012.

## Assumptions

- The runner axis (0010-workload-runners) makes a graph carried by a foreign system; the form says what the work is and the runner says how it is carried.
- GitHub environments with required reviewers are configured in the repository's settings, outside any file the library writes; the gate's `approver` names who the workload expects to approve.

## Open questions

- None.

## Key entities

- **Graph** - a workload of nodes with edges, a limit and results.
- **Edge** - the word `after` of a node, written `needs` by the platform.
- **Result** - a node whose outcome decides the run.
- **Limit** - the greatest mode of effect any node of the graph may declare.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| GitHub Actions workflow syntax (the JSON Schema of GitHub workflows that SchemaStore publishes, copied in `commons/libraries/src/workflows/schema/`) | A workflow is jobs with `needs` order, an `environment` that a person approves, `permissions`, a matrix and `concurrency`, which a platform executes from YAML | The emitted files are validated by that schema (0014-runner-github-actions FR-011); the documentation of the syntax was not fetched, so no section is cited |

## Success criteria

- **SC-001**: Every requirement of 0013-form-graph is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
