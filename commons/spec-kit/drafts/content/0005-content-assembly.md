# Feature Specification: Content assembly (draft)

**Spec ID:** 0005-content-assembly
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The assembly puts the accounts of the instances beside Governance and shows the matrix of requirement by instance, and reports a finding where an annotation ends in none, which warns as a planning issue until 2027-01-31 and fails the build only if the owner decides so afterwards (commons 0033-kanon FR-022, FR-023, FR-034; 0039-content-method FR-014).

## Requirements

- **FR-001**: The assembly MUST build, from the model and the accounts of the instances that the consumer declares in its manifest, the dispositions of the model and the model's `instances`, and run `droppedFindings`: a claim whose `evidence` annotation no instance expresses, carries, or names unexpressed with a reason MUST give the finding `kanon/dropped` naming the instance; the finding warns as a `commons/planning` issue until `2027-01-31` and fails the build only from a day the owner has recorded in the policy `CONTENT_GATE_POLICY` (FR-005).
- **FR-002**: The assembly MUST give the matrix (`buildMatrix`) as a value and as Markdown and JSON, a row for each annotation of each element of Governance and a cell for each instance, each `expressed`, `carried`, `unexpressed` or `dropped`, keyed by the ids of the model (0033-kanon FR-023), so that the documentation reads it and a reviewer sees what each rendition does with each claim.
- **FR-003**: The assembly MUST read the consumer's instances from its own manifest (`kanon.ts`) and its accounts from the packages it names, through their public exports only, and MUST NOT import a consumer by a path or a name written in this library.
- **FR-004**: An instance added later (`email`, `print`, `slides`) MUST add a column that every annotation is accounted for, and the finding MUST stay open, and warn by the policy of FR-005, until it does.

- **FR-005**: The decision of what a `kanon/dropped` finding does MUST be the typed dated policy of 0039-content-method FR-014, in the form of `RELEASE_POLICY` (0038-build-policy FR-010):

```ts
export type ContentGatePolicy = {
  readonly mode: "warn-as-planning-issues";
  readonly until: string; // a day, YYYY-MM-DD
  readonly reviewedOn?: string;
  readonly decision?: { readonly by: "shah"; readonly on: string; readonly mode: "fail-build" };
};
export const CONTENT_GATE_POLICY: ContentGatePolicy = { mode: "warn-as-planning-issues", until: "2027-01-31" };
```

  The function `contentGateDecision(day)` MUST give `fail-build` only where `decision.by` is `shah` and the day is not before `decision.on`; otherwise `warn`, with the finding `content-gate-review-due` (severity `error`, holding nothing) once the day is after `until` and no `reviewedOn` is recorded. Nothing changes by itself after January; the owner decides.

## Acceptance scenarios

1. **Given** a claim annotated `evidence` and the instances `web` and `llms`, where `web` expresses it as a citation and `llms` carries it as data, **When** a third instance has no account, **Then** the finding `kanon/dropped` names it, the build passes as a warning that is a planning issue, and the matrix shows the cell as dropped, per FR-001, FR-002 and FR-005.
2. **Given** the third instance names the annotation unexpressed with a reason, **When** the build runs, **Then** it passes and the matrix shows the reason, per FR-001.

## Out of scope

- Serving the output; any consumer's deployment.

## Open questions

- **OQ-1**: Where the matrix is published (the documentation site of the consumer, or a page of the bundle).
