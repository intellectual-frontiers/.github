A workload here is a unit of operated work, not running software.

# Workload

A restore drill is a workload. So is the converge of a fleet toward its declared state, a game day, or a periodic collection of evidence. Each is work that a person or an agent operates and that must leave a record an auditor can read. None is a program that stays up. The library `workload` states what such work is, once, so that every kind of it shares one core of safety and differs only in how it executes. This page says how it is built. The [forms](workload-forms.auto.md) page says which forms there are.

## Four things that are not the same

- **Form**: what kind of work it is and how it executes. Three forms have code: a **runbook** (an ordered procedure of steps), a **reconcile** (a loop toward a desired state) and a **graph** (nodes with edges that say which comes after which, which an integration runner such as GitHub Actions carries). One is reserved with no code: a **campaign** (a collection over a period with sampling).
- **Runner**: how a plan is carried out. The **native** runner is the TypeScript of the library: it interprets the plan, is interactive and is the default. An **integration** runner compiles the plan into a script (modern Bash or modern PowerShell) that a foreign system runs and then hands off, so that the library keeps the plan, the policy and the evidence and not the run. A fleet's policy chooses the runner and a workload never names it; what a workload needs (an ask, a judge, a gate, an undo or a destroy of a durable store) keeps it on the native runner, and the autonomy of every node is the same under every runner. [The runners](workload-runners.auto.md) page says which runner can carry which workload.
- **Dialect**: how a harness or a person receives a workload. Claude Code, Codex and a person are dialects. A dialect is a projection of the same workload, never a form, and switching it changes only the files that are written, never the steps, the effects or the autonomy.
- **Trigger**: what starts a workload: by hand, on a schedule, on an event or on an alert. A trigger is a field of a workload and never a form. A drill is a runbook with a schedule trigger and an expected outcome. A schedule is a cadence (hourly to yearly) and a slot in UTC, and it is realized by the runner that carries the workload: `on.schedule` in a GitHub workflow, or a cron line and a systemd timer with its service on Linux for the Bash and PowerShell scripts (Windows Task Scheduler is not supported yet). An event or an alert trigger is not realized by any runner yet: it is a statement of the specification.

## One core, a form for each kind of work

Everything that is true of every form is stated once in the governance core:

- **Effects**: each verb says the store it touches, the class of the store (ephemeral, transactional, durable, git or external) and the mode (read, append, mutate or destroy). **Autonomy** follows from the effect by one table and is never declared: a read is autonomous, a mutation of a durable store is a proposal, a destroy is a person's. The same effect gives the same autonomy in every form.
- **Gates** only move control toward a person. Approving and tagging are a person's at every level, and an agent that meets a gate stops and hands back.
- **Verbs** are the only way anything is changed. A verb is a deterministic operation of a pinned package, called by its id and never by a command built from text. A **judge** is a bounded judgement of an agent: its output is typed, it has no effect and it only proposes.
- **Runs** are recorded as events on a planning work order, and what a run is, is the fold of its events, never a stored fact.
- **Problems** have a closed catalog: the core's codes are `E-WL-...` and each form has its own. [The catalogs](workload-errors.auto.md) are generated from the code.

A form is a module over that core with a closed sum of node kinds, a static check, a dry run, a fold of run events and a native runner behind a port. A form never imports another form, and the core never imports a form: the table of layers in the manifest says so and the shared checker of [Kanon](concept-kanon.md) holds it.

## The graph form: GitHub as the executor

A graph is a set of nodes with `after` edges (a directed acyclic graph), with the same verbs, effects and derived autonomy as the other forms. It is checked for a cycle, for an edge to a node that is not there, for a node that no result depends on, for an effect above the limit the graph gives itself and for permissions above what its effects need. The runner `github-actions` writes it as a workflow: each step one call of a pinned command by verb id, `needs`, a matrix over a fixed list, the least `permissions`, an environment that a person approves for a gate, references to the names of secrets and actions pinned to a tag or a commit. The library hands the workflow off by the hash of its plan, and ingests what the run did (its address, its conclusion, the conclusion of each job and the digest of its log) as a receipt matched to the hand-off, counting an approval only where a person gave it. The repository's own generated workflows are not made this way yet: the [runners](workload-runners.auto.md) page says what the emitter writes, and the specification `0016-ci-on-graph` of the library records why each workflow stays on its typed definition, byte for byte.

## The reconcile form: approval by the hash of the plan

A reconcile observes the state the world is in and the state it should be in, diffs them, plans the changes and hashes the plan. A person approves the plan by that hash, so a plan that changed since it was approved is not approved. It is level-triggered: each pass starts from what is observed now, so a missed trigger is repaired by the next pass, and a pass with nothing to change applies nothing. [The starter loop](workload-converge-settings.auto.md) shows its skill, checklist and rules.

## Try it

```sh
bun run workload check            # the static check of every starter workload
bun run workload plan restore-drill
bun run workload forms            # the forms, built and reserved
bun run workload runners          # the runners and what each can carry
bun run workload needs restore-drill
bun run workload emit synthetic-bootstrap-01 bash
bun run workload project --dialect codex
```

[The restore drill](workload-restore-drill.auto.md) and [the harnesses and dialects](workload-harness.auto.md) are generated from the code. The specifications are in `commons/workload/spec-kit/`, and the pattern is stated in `commons/spec-kit/specs/0040-workload-pattern`.
