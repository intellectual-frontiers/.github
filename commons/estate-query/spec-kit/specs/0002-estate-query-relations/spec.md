# Feature Specification: Estate Query: the relations of an estate

**Spec ID:** 0002-estate-query-relations
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What an estate holds (its assets, the capabilities of each, what is declared and observed, the policies judged, the risks accepted, the operational truth and the invariants broken) as relations, described once as data, built from the shapes of the estate library as a question names them, with no secret in a relation.

## Requirements

- **FR-001**: The relations MUST be one list of data (`RELATIONS`): each has a name, a sentence and columns with a name, a type (`int`, `text`, `bool` or `timestamp`) and a sentence; the catalog a question is bound to MUST be made from that list and from nothing else, so that a relation is described once.
- **FR-002**: `tablesOf` MUST build each relation from what the estate holds, with the columns of its description in order and in every row exactly as many values as columns: `asset` (id, kind, state, origin, and who installed it: `provisioned` or `inherited`, empty for a discovered asset), `capability` (every capability of every asset, offered with its owner or not with the reason), `platform` (the platform an asset declares), `declared`, `observation`, `observed` and `truth`.
- **FR-003**: `policy_result` MUST give the status of each policy for each asset as the estate library judges it with the risks accepted and the instant now (a failing policy a person accepted is `accepted` until the day it is accepted until), `policy_control` the controls each answers to, `risk` the risks accepted and `violation` the invariants broken.
- **FR-004**: A value of `declared` and `observed` MUST be one row for each leaf of what is held, with a dotted path (a list has the number of the item), and a value that looks like a secret, by what it is or by the name of its key (as `findSecretLike` of Archon decides), MUST be replaced by `[redacted: looks like a secret]` and never given.
- **FR-005**: A relation MUST be built only when a question names it, and once for a question.

## Acceptance scenarios

1. **Given** an estate of three assets, **When** `asset` and `capability` are read, **Then** the rows are those of the estate library, per FR-002.
2. **Given** an observation with a password in it, **When** `observed` is read, **Then** the value is replaced, per FR-004.
3. **Given** a failing policy with an accepted risk, **When** `policy_result` is read, **Then** its status is `accepted`, per FR-003.

## Out of scope

- Where the data comes from (a tenant's files, a fleet store): the program that opens the estate.
- Requirements, the controls of OCID, changes and approvals, and the relations of live machines: later specifications.

## Edge cases

- An estate with no observation: the relations of observations have no rows and `policy_result` is empty, per FR-002.
- A declared platform that is not an object: no row of `platform`, per FR-002.
- A key named `password` with a short value: replaced, per FR-004.

## Assumptions

- The data is already in the shapes of the estate library; nothing here reads a file.

## Open questions

- None.

## Key entities

- **Relation**, **Column**, **Estate data**.

## Success criteria

- **SC-001**: Every fact the estate library holds of an asset can be asked for in SQL, and no secret is given.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
