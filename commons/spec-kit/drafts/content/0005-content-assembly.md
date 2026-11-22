# Feature Specification: Content assembly (draft)

**Spec ID:** 0005-content-assembly
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The assembly puts the accounts of the instances beside Governance and shows the matrix of requirement by instance, and fails the build where an annotation ends in none (commons 0033-kanon FR-022, FR-023).

## Requirements

- **FR-001**: The assembly MUST build, from the model and the accounts of the instances that the consumer declares in its manifest, the dispositions of the model and the model's `instances`, and run `droppedFindings`: a claim whose `evidence` annotation no instance expresses, carries, or names unexpressed with a reason MUST fail the build with `kanon/dropped` naming the instance.
- **FR-002**: The assembly MUST give the matrix (`buildMatrix`) as a value and as Markdown and JSON, a row for each annotation of each element of Governance and a cell for each instance, each `expressed`, `carried`, `unexpressed` or `dropped`, keyed by the ids of the model (0033-kanon FR-023), so that the documentation reads it and a reviewer sees what each rendition does with each claim.
- **FR-003**: The assembly MUST read the consumer's instances from its own manifest (`kanon.ts`) and its accounts from the packages it names, through their public exports only, and MUST NOT import a consumer by a path or a name written in this library.
- **FR-004**: An instance added later (`email`, `print`, `slides`) MUST add a column that every annotation is accounted for, and the build MUST fail until it does.

## Acceptance scenarios

1. **Given** a claim annotated `evidence` and the instances `web` and `llms`, where `web` expresses it as a citation and `llms` carries it as data, **When** a third instance has no account, **Then** the build fails with `kanon/dropped` naming it and the matrix shows the cell as dropped, per FR-001 and FR-002.
2. **Given** the third instance names the annotation unexpressed with a reason, **When** the build runs, **Then** it passes and the matrix shows the reason, per FR-001.

## Out of scope

- Serving the output; any consumer's deployment.

## Open questions

- **OQ-1**: Where the matrix is published (the documentation site of the consumer, or a page of the bundle).
