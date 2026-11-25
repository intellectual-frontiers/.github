# Feature Specification: Form graph

**Spec ID:** 0013-form-graph
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The reserved form `graph` (0003-workload-forms FR-007), stated as a slot and built where its criterion is met. A graph is a directed acyclic graph of jobs with freshness, projected to an integration runner (0010-workload-runners): a foreign system executes it and the library keeps the plan, the policy and the evidence. Its first consumer will be CI/CD and the GitHub workflows that are generated from typed definitions today; the emitter of GitHub Actions is the next integration runner and is not built here.

## Requirements

- **FR-001**: The form `graph` MUST stay a reserved slot of the registry of forms with its criterion and MUST have no code, no folder, no entry of the package and no source that names it but the registry, until a second concrete user besides CI/CD needs the same graph of jobs with freshness for an integration runner.

## Acceptance scenarios

1. **Given** the registry, the folders and the sources, **When** they are read, **Then** `graph` is reserved with its criterion and nothing else names it, per FR-001.

## Out of scope

- Everything else: the nodes, the freshness, the projection to GitHub Actions and the check of the graph are specified when the form is built.

## Edge cases

- A graph of two jobs with one user is a runbook, per the rule of two (0003-workload-forms) and FR-001.

## Assumptions

- The runner axis (0010-workload-runners) is what makes a graph carried by a foreign system; the form says what the work is and the runner says how it is carried.

## Open questions

- Whether the emitter of GitHub Actions is built before or with the form `graph`: decided when the first consumer is chosen.

## Key entities

- **Graph** - a reserved form: jobs with freshness, in a directed acyclic graph.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| GitHub Actions workflow syntax (named from practice) | A workflow is jobs with `needs` order that a platform executes from YAML | Not read in this session, so no section is cited; the slot is built after it is read |

## Success criteria

- **SC-001**: The requirement of 0013-form-graph is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
