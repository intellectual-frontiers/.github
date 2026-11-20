# Feature Specification: GRC logical model

**Spec ID:** 0003-grc-logical
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** The logical layer says what a result, a finding, an item of evidence, an attestation, an assessment and a risk are, as documents, and computes with them by pure functions: the time is always a parameter, no file or network is read. It is made from governance (0002) and knows no runner, store or exchange format.

## Statuses and results

- **FR-001**: A result's status MUST be one union, `pass | fail | warn | error | not-applicable | gap | pending`, and the outcome after exceptions MUST add `accepted`; combining statuses (`join`) MUST be associative, commutative and idempotent, with `not-applicable` its identity, in the order `not-applicable < pass < accepted < pending < warn < gap < fail < error`, so that a roll-up does not depend on the order it is taken in.
- **FR-002**: The documents `grc.result` (a check run on a subject: the check, the control URNs, the subject, the status, the observation, the time observed), `grc.finding` (a result that needs attention: severity, title, detail, evidence ids, remediation, the exception that accepted it), `grc.evidence` (what was observed: kind, subject, digest, media type, the store reference), `grc.attestation` (a person or key states a claim about a subject: attester, role, statement, evidence ids, signature reference), `grc.assessment` (results, findings, the frameworks and policies assessed, the time) and `grc.risk` (a likelihood and an impact, the level, treatment, owner, review date) MUST each be one document kind with decoders (0004).
- **FR-003**: `evaluate` MUST judge an observed JSON value against an expectation (`empty`, `non-empty`, `equals`, `count`, `every`) as `pass` or `fail`, with the reason, and an observation that is not an array where the expectation needs rows MUST give `error`.

## Computations

- **FR-004**: Freshness MUST compare the time of the newest evidence or result with a duration at a given instant, saying `fresh`, `due` (within a tenth of the duration of its end) or `stale`, and when it falls due; with none observed it MUST say `stale`.
- **FR-005**: Drift MUST compare two views of keyed records (what is declared and what is observed) and give what was added, removed and changed, each change naming the path of the field and both values, in key order.
- **FR-006**: Change impact MUST read declarations mapping paths (globs) to control URNs and judge a change (the paths it touches) as `allowed` or `blocked`, blocking where a touched path is declared for a control whose newest status is `fail`, `error` or `gap`, naming each reason; a blocked change MUST become `allowed` where an exception that applies covers the control or where the caller gives an approval for it (what the approval is, and how it is verified, is the caller's: a signed trailer, a review), and the result MUST say which allowed it. Declarations over facts of a model (a setting that weakens a control) are another source of touched controls that a caller gives as data of the same shape.
- **FR-007**: Coverage MUST say for each control of the frameworks given whether it is `gap` (no check shows it, not even through a crosswalk), `untested` (a check shows it that has no result), `failing`, `stale`, `partial`, `accepted` or `covered`, and MUST list the controls with no passing check.
- **FR-008**: Roll-up scoring MUST give, for a set of results and a weight for each severity, the weighted share of applicable results that pass (an accepted result counts as passing and is counted apart), the worst status, and the counts of each status, the same for any order of the results.
- **FR-009**: Exceptions MUST be applied by a pure function: an applying exception turns `fail` or `warn` into `accepted` and keeps its id on the result, and does not turn `error`, `gap` or `pending`; an expired one does not apply.
- **FR-010**: A risk's level MUST be computed from its likelihood and impact on five levels (`very-low` to `very-high`) by a table, and a risk past its review date MUST be reported by `risksDue`.

## Scenarios

- **Given** `fail` and `pass`, **When** it is computed, **Then** `join` is `fail`; `pass` and `not-applicable`, `pass`, per FR-001.
- **Given** a control mapped to a check whose newest result is `fail`, **When** a change touches a path declared for it, **Then** the change is `blocked` with that reason, per FR-006.
- **Given** a control with no check and a crosswalk to a covered control, **When** it is computed, **Then** its coverage is `covered` by the crosswalk and the report says so through the mapping, per FR-007.
- **Given** evidence from 31 days ago and a duration of 30 days, **When** it is computed, **Then** `stale`, per FR-004.

## Out of scope

- Running a check (0005-grc-runners); the files and formats (0004-grc-documents).

## Edge cases

- No results at all: roll-up share is `undefined`, never 100 percent, per FR-008.
- Two results for one check and subject: the newest by time wins; equal times are broken by id, per FR-007.

## Assumptions

- A crosswalk counts as coverage only where it is `equal`, or says this control is a `subset-of` another, at a strength of 5 or more; `superset-of`, `intersects-with`, `no-relationship` and a weaker strength do not.

## Open questions

- **OQ-1**: Whether coverage through `subset-of` should count at full weight.

## Key entities

- **Result**, **Finding**, **Evidence**, **Attestation**, **Assessment**, **Risk**.

## Success criteria

- **SC-001**: The same results in any order give the same roll-up, the same coverage and the same findings.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
