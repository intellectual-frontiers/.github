# What consumers gain

This page has two parts. The first is a one-page brief for technical executives and architects, written so that it can be read, or shared, on its own. The second part goes through the benefits by reader: engineers, architects, executives and AI agents. Every benefit is labelled by what supports it: **measured** here, **shown** by code in this repository, or an **expectation** that you can measure in your own organization.

## Executive brief

**What Kanon is.** A way of building a software library so that a rule is stated once and carried into every other place by code, with a small program that checks the structure was followed. A library built this way has three layers (what a thing is and may do, the model a program reasons with, and what carries it out), imports that run one way, and an account of every promise the top layer makes.

**Why it matters now.** Software is increasingly written by people and AI agents together. The cost of an inconsistent system rises when many contributors, human and machine, each see only part of it, and when a machine can produce a plausible change in minutes. Kanon turns a structural expectation into a **checkable guardrail**: a contributor that reaches where it should not gets a finding with a code, a file and a line, within a second, whoever or whatever it is.

**What you get.**

1. **Less drift.** A fact stated in one place and derived everywhere else cannot quietly diverge. *Shown* by Headless, where a destructive command's hint on a tool server, its method in a REST service and its confirmation on the command line come from one fact.
2. **Guardrails for agents.** Constraints that a program checks keep an agent inside its task and tell it, specifically, when it leaves. *Shown* by the import check and its findings. *Expectation:* tasks that stay inside one layer or one package are less likely to need rework. Measure it.
3. **A tiny core with extensions.** For a library of medium or high complexity, a small host and many extension packages that reach it only through its public exports. *Measured:* in AnyFS and Archon the host holds about a fifth to a quarter of the family's source.
4. **Nothing silently lost.** Every promise at the top ends expressed, carried or named as not yet enforced, with a reason. *Shown* by the matrix and its `kanon/dropped` finding.

**What it costs.**

- More structure than a small library needs, and a vocabulary to learn.
- Indirection between a command and the statement that governs it.
- A set of checks to keep in the build, and a baseline to keep shrinking.
- The checker reads syntax, so it has known limits, and **green checks prove structure, not correctness**.

**Where it is a bad fit.** A small library with one implementation and no extensions. A prototype that will be thrown away. A team that will not keep the checks green. See [the decision guide](kanon-decision-guide.md).

**What to ask your teams.**

1. Which of our libraries carry one rule into several places, and where is that rule stated?
2. When a rule changes, how many places do we edit by hand, and how do we know we found them all?
3. What may an agent change without asking a person, and what stops it from reaching further?
4. Which promises of our top-level specifications does a lower layer ignore today, and who knows?
5. How many baseline lines do we carry, and how old is the oldest?

**What to measure.**

| Measure | Why | Status here |
| --- | --- | --- |
| Libraries declaring a table, and how many pass the check | adoption and health | measured below |
| Findings held by baselines, and their age | debt that is not being paid | none held today |
| Time the check takes | whether it is cheap enough to run on every change | measured below |
| Annotations that are unexpressed, and for how long | promises with no enforcement | tracked by the matrix |
| Host share of a family's source | whether the core is staying small | measured below |
| Rework caused by a boundary violation | the benefit for agents and people | not yet measured here |

**Status.** The pattern is specified in a draft specification. The checker, the trace graph, the matrix, the family rules and the bundle are built and run in this repository.

## What is measured here

These numbers were taken on 2026-11-24 from this repository. They show that the mechanism exists and runs. They do not show that it prevented any particular defect.

| Measurement | Result | How |
| --- | --- | --- |
| Library manifests that declare a Kanon table | 58 | a search of the manifests |
| Of those, passing the import check | 58, with none failing | the check run in each library |
| Baselines held by those libraries | none | no `kanon.baseline.txt` exists |
| Time for all 58 checks | 20 seconds in total | one run, one machine |
| Time for one check | 0.48 seconds (Headless) | `time bun ../kanon/src/check.ts` |
| Host share of a family's source | about 20% (AnyFS) and 24% (Archon) | non-test TypeScript lines under `src/` |
| Extensions of AnyFS and Archon | 12 and 12 | their manifests |

Two honest notes. First, these figures describe adoption inside one repository maintained by one organization, not a field study. Second, there is no record in this repository of a defect that the check caught that we can cite, so the evidence for fewer defects is structural, not statistical. If you adopt Kanon, the table in the brief is where to start collecting your own.

## For engineers

| Benefit | What it looks like | Status |
| --- | --- | --- |
| **You know where a change goes.** | Which layer a file is in, and what it may import, is in a table. | shown |
| **Fast, specific feedback.** | A violation is a code, a file, a line and a sentence in under a second. | measured (0.48 s) |
| **Fewer places to edit.** | Change the statement, and the projections follow. | shown (Headless) |
| **A boundary for extensions.** | An extension imports the host's exports, nothing else, and the check says when it does not. | shown |
| **Tests with a target.** | Projection tests compare each surface with the model. | shown |
| **Cheaper onboarding.** | A new contributor reads the table and the three layers. | expectation |

## For architects

| Benefit | What it looks like | Status |
| --- | --- | --- |
| **Architecture that is data.** | The layers and rules are a table the build reads, not a diagram that ages. | shown |
| **Traceability.** | From any physical element, walk up to the statement that says why it exists. | shown |
| **An accounting of promises.** | The matrix says which implementation honours which annotation, and why not. | shown |
| **A shape for growth.** | A tiny host and many extensions, each in its own package, released on its own. | shown (AnyFS, Archon) |
| **A policy seam.** | What a finding does to a build is a typed, dated decision of the host, not a property of the finding. | shown (content gate) |
| **Evolvability of the rule.** | A change to the rule is one change plus the tests that compare projections. | expectation |

## For executives

| Benefit | What it looks like | Status |
| --- | --- | --- |
| **Visible risk.** | A promise that no implementation enforces is a named, reasoned entry, not a surprise. | shown |
| **Cost control for agent work.** | Agents work inside a boundary that a machine enforces, so review effort goes to substance. | expectation |
| **Less key-person risk.** | The structure is written down and checked, so it does not live in one head. | expectation |
| **A measurable program.** | Adoption, debt and check time are numbers you can ask for each quarter. | measured |
| **Optionality.** | Adding a backend or a tool is an extension, not a change to the core. | shown |

## For AI agents and the people who run them

An agent is a contributor with a window, no memory between tasks and a high rate of output. Kanon is useful to it for reasons that do not depend on how good the agent is.

- **A short instruction can be a checked one.** Instead of "do not import the command line from the tool server" in a prompt, the table says it and the check enforces it.
- **The finding is the instruction.** `layers/around`, a file and a line tell the agent what to change, and it can run the check again at once.
- **The task is the size of a package.** Adding a backend is one extension against one contract. The agent does not need to read the other twelve.
- **The accounting tells it what it owes.** Adding an instance means accounting for every annotation of the requirement. The matrix lists them, and the check refuses a gap.

What Kanon does not do for an agent: it does not make the agent's logic correct, and it does not stop it from writing a projection function that restates the rule by hand. [The weaknesses page](kanon-weaknesses.md) covers both, with the practice that keeps them in check.

## A caution on reading the evidence

A pattern's benefits are easiest to believe where they are easiest to see, and the costs are easiest to miss where they are spread out. This page lists a cost for every benefit group on purpose. The next page does the same job from the other side.

Next: [weaknesses, and how to avoid them while keeping the strengths](kanon-weaknesses.md).
