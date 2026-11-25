A workload here is a unit of operated work, not running software.

# Workload

A restore drill is a workload. So is the converge of a fleet toward its declared state, a game day, or a periodic collection of evidence. Each is work that a person or an agent operates and that must leave a record an auditor can read. None is a program that stays up. The library `workload` states what such work is, once, so that every kind of it shares one core of safety and differs only in how it executes. This page says how it is built. The [forms](workload-forms.auto.md) page says which forms there are.

## Four things that are not the same

- **Form**: what kind of work it is and how it executes. Two forms have code: a **runbook** (an ordered procedure of steps) and a **reconcile** (a loop toward a desired state). Two are reserved with no code: a **graph** (a graph of jobs with freshness, for an integration runner) and a **campaign** (a collection over a period with sampling).
- **Runner**: how a plan is carried out. The **native** runner is the TypeScript of the library: it interprets the plan, is interactive and is the default. An **integration** runner compiles the plan into a script (modern Bash or modern PowerShell) that a foreign system runs and then hands off, so that the library keeps the plan, the policy and the evidence and not the run. A fleet's policy chooses the runner and a workload never names it; what a workload needs (an ask, a judge, a gate, an undo or a destroy of a durable store) keeps it on the native runner, and the autonomy of every node is the same under every runner. [The runners](workload-runners.auto.md) page says which runner can carry which workload.
- **Dialect**: how a harness or a person receives a workload. Claude Code, Codex and a person are dialects. A dialect is a projection of the same workload, never a form, and switching it changes only the files that are written, never the steps, the effects or the autonomy.
- **Trigger**: what starts a workload: by hand, on a schedule, on an event or on an alert. A trigger is a field of a workload and never a form. A drill is a runbook with a schedule trigger and an expected outcome.

## One core, a form for each kind of work

Everything that is true of every form is stated once in the governance core:

- **Effects**: each verb says the store it touches, the class of the store (ephemeral, transactional, durable, git or external) and the mode (read, append, mutate or destroy). **Autonomy** follows from the effect by one table and is never declared: a read is autonomous, a mutation of a durable store is a proposal, a destroy is a person's. The same effect gives the same autonomy in every form.
- **Gates** only move control toward a person. Approving and tagging are a person's at every level, and an agent that meets a gate stops and hands back.
- **Verbs** are the only way anything is changed. A verb is a deterministic operation of a pinned package, called by its id and never by a command built from text. A **judge** is a bounded judgement of an agent: its output is typed, it has no effect and it only proposes.
- **Runs** are recorded as events on a planning work order, and what a run is, is the fold of its events, never a stored fact.
- **Problems** have a closed catalog: the core's codes are `E-WL-...` and each form has its own. [The catalogs](workload-errors.auto.md) are generated from the code.

A form is a module over that core with a closed sum of node kinds, a static check, a dry run, a fold of run events and a native runner behind a port. A form never imports another form, and the core never imports a form: the table of layers in the manifest says so and the shared checker of [Kanon](concept-kanon.md) holds it.

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
