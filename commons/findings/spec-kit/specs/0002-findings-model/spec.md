# Feature Specification: Findings: what a finding is

**Spec ID:** 0002-findings-model
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A finding, whichever tool found it: its fields, its identity, and the care taken with the evidence a report holds.

## Requirements

- **FR-001**: A finding MUST have a rule, a title, a severity (`critical`, `high`, `medium`, `low` or `info`), the asset it is about, a description, the weaknesses (CWE) and vulnerabilities (CVE) it names, and where it was read from (the tool, its version where known, and the file); it MAY have a place on the asset, a solution and a piece of evidence.
- **FR-002**: The evidence of a finding MUST be at most 500 characters and MUST have what looks like a credential replaced: the value of an authorization, cookie, API key, password, secret or token header or assignment, a private key, a token of a known shape and any long run of token characters.
- **FR-003**: The identity of a finding MUST be the first 16 hexadecimal digits of the SHA-256 of the tool, the rule, the asset (lower case) and the place without its query and fragment, so that the same finding in a later report has the same identity; two findings of one identity in one reading MUST be one, the first kept and the repeats counted.

## Acceptance scenarios

1. **Given** the same alert found at the same URL with another query string, **When** the identities are made, **Then** they are equal, per FR-003.
2. **Given** evidence with a bearer token, **When** it is redacted, **Then** the token is gone, per FR-002.

## Out of scope

- Reading reports (0003-findings-importers) and what becomes of a finding (0004-findings-lifecycle).

## Edge cases

- A weakness identifier of 0 or -1, which tools write for none, is no weakness, per FR-001.

## Assumptions

- A report holds what the tool saw, and the tool saw secrets.

## Open questions

- None.

## Key entities

- **Finding**, **Fingerprint**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
