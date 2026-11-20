# Feature Specification: GRC governance

**Spec ID:** 0002-grc-governance
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** Governance says what must be true and how it is to be shown, as data: the frameworks and their controls, the crosswalks between them, the policies that map to controls, the checks that ask the question, the requirements with their verification and validation, the evidence policy and the exceptions. It names no framework, no runner and no store: a check names a kind of runner and gives it an input, never code. A requirement generalizes the enforcement register of Mizan (commons 0003-mizan, `enforcement.tsv`: requirement, mechanism, by) with its validation, so that there is one register and not two.

## Frameworks, catalogs and crosswalks

- **FR-001**: A framework MUST be a document of kind `grc.framework` with a slug id, a version, a title and controls, each with an id, a title and a statement; a control MUST be addressed by the stable URN `urn:grc:<framework>:<version>:<control>`, which `controlUrn` writes and `parseControlUrn` reads back, and a duplicate control id in a framework MUST be a problem.
- **FR-002**: A crosswalk MUST be a document of kind `grc.crosswalk` whose mappings each join two control URNs by a Set Theory Relationship Mapping (NIST IR 8477: `equal`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`) with a strength from 1 to 10; `mappedControls` MUST give the controls reached from a control through crosswalks, in both directions, with the relationship read the other way for the reverse (`subset-of` and `superset-of` swap).

## Policy, check and requirement

- **FR-003**: A policy MUST be a document of kind `grc.policy` with its scope (platforms and tags), severity (`info | low | medium | high | critical`), rationale, the control URNs it maps to, the checks that show it, an owner and a review (an ISO 8601 cadence and the date it was last reviewed); `reviewDue` MUST say when its review falls due.
- **FR-004**: A check MUST be a document of kind `grc.check` that says what is asked (`ask`), what is expected (an expectation: `empty`, `non-empty`, `equals`, `count` with bounds, or `every` row matching a field comparison), where it applies (platforms), how fresh its result must be (an ISO 8601 duration), the control URNs it shows, and a runner as a kind id and an input of JSON data; a check MUST NOT carry code, and an input that is not JSON data MUST be refused by its decoder.
- **FR-005**: A requirement MUST be a document of kind `grc.requirement` with a statement, a level (`MUST | SHOULD | MAY`), a verification and a validation. The verification MUST be exactly a row of the enforcement register (`mechanism`: `check | gate | review | none`; `by`; `note`), and `fromEnforcementRegister` and `toEnforcementRegister` MUST read and write the register's TSV, so that Mizan's rows and requirements are one kind of data. The validation says that the requirement is the right one: its method (`review | scenario | stakeholder | measure`), who validated it and when.
- **FR-006**: An evidence policy MUST be a document of kind `grc.evidence-policy` saying what counts as evidence (evidence kinds, the longest age, the producers accepted), how long it is retained (an ISO 8601 duration), who may attest (roles), and the custody of the key an attestation needs (`none | file | managed | hardware`).

## Exceptions and accepted risk

- **FR-007**: An exception MUST be a document of kind `grc.exception` naming what it excuses (a control URN, a check or a policy), the subjects it covers (an id or a glob), the reason, who approved it, when it was granted and when it expires, and MAY carry an accepted risk (its owner, its level and its review date); one with no expiry, or an expiry not after its grant, MUST be refused, and `exceptionApplies` MUST be false at and after the expiry.

## Validation of a set

- **FR-008**: `governanceProblems` MUST find, as data, each control URN that no loaded framework holds, a check a policy names that does not exist, a policy that maps to no control, an id used twice, an invalid duration, a runner kind that is not a stable id, and an exception that excuses nothing that exists.
- **FR-009**: Durations MUST be ISO 8601 (`P1D`, `PT1H`, `P30D`, `P1Y`, `P1W`), parsed by `parseDuration` to an exact length in milliseconds with a year as 365 days and a month as 30, and `addDuration` MUST add them to an instant.

## Scenarios

- **Given** the URN `urn:grc:nist-800-53:5.2.0:AC-2(1)`, **When** it is parsed, **Then** the framework is `nist-800-53`, the version `5.2.0` and the control `AC-2(1)`, per FR-001.
- **Given** a crosswalk that says A is a `subset-of` B, **When** the controls mapped from B are asked, **Then** A is given as `superset-of`, per FR-002.
- **Given** an exception granted on 1 March that expires on 31 March, **When** it is asked on 1 April, **Then** it does not apply, per FR-007.
- **Given** a check whose input holds a function, **When** it is read, **Then** the decoder refuses it, per FR-004.

## Out of scope

- The content of any catalog (0008-grc-catalogs); running a check (0005-grc-runners).

## Edge cases

- A framework with no controls: valid, with none judged, per FR-001.
- A URN with a colon in the control id: refused, per FR-001.
- `P1M` against `P30D`: one month is 30 days, per FR-009.

## Assumptions

- The mechanisms of the register are those of commons 0003-mizan at the time of writing.

## Open questions

- **OQ-1**: Whether `validation` should be a register of its own beside `enforcement.tsv`.

## Key entities

- **Framework**, **Control**, **Crosswalk**, **Policy**, **Check**, **Requirement**, **EvidencePolicy**, **Exception**.

## Success criteria

- **SC-001**: A policy set that points at a control no framework holds is found before anything runs.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
