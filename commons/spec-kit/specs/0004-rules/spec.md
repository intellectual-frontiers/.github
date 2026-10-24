# Feature Specification: Rules

**Spec ID:** 0004-rules
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The rules a harness applies to its scripts, its CI and its code so that a script runs on a Mac as well as on Linux, a CI job installs nothing outside the launcher, and a command takes its programs from the toolchain and its packages from the packaging table: kept once, as data with the reason for each, so that a second harness starts with the same rules and a rule is never a regular expression buried in one harness's code.

## The rules

- **FR-001**: A rule MUST be a `pm:Rule` in the ontology (`commons/ontology/supply-chain/packaging/rules.ttl`) with a set, a pattern (a regular expression), a short name and the reason it is not allowed. The sets are `shell-portability` (a construct only GNU tools have), `ci-forbidden-program` (a program a CI step must not run), `ci-forbidden-action` (a CI construct that installs or containerizes), `host-program` (a program a command must take from its toolchain, never from the host) and `installer` (a package manager code must not call directly).
- **FR-002**: The generator MUST write every rule to `commons/generated/rules.auto.toml` (`schema = 1`, the hash of the ontology, one `[[rules]]` table each), and MUST refuse, naming it, a rule with no set from the list, no pattern, name or reason, a pattern that is not a regular expression and a name used twice.
- **FR-003**: `commons/tools/shell-portability-check.py` MUST report every line of the shell scripts it is given that matches a `shell-portability` rule, as `file:line: uses X (reason)`, skipping comment lines and trailing comments and a line that holds text the caller excuses, and MUST exit 1 where it reports one. It needs only the Python standard library.
- **FR-004**: A harness MUST take these sets from the generated file and MUST NOT keep its own copy of a pattern; what a harness adds (where the rules apply, which of its own paths are excused) is its own.

## Out of scope

- Where a harness applies a rule: its paths, and the requirement that excuses an exception, are the harness's.

## Edge cases

- A script that names `sed -i` in a trailing comment to say it avoids it: it is not reported, per FR-003.
- A line that picks `shasum` or `sha256sum` by what the computer has: the caller excuses it by the text it holds, per FR-003.
- A pattern with a typo: the generator names the rule and writes nothing, per FR-002.
- A rule whose set is spelled wrongly: the generator names it, per FR-002.

## Assumptions

- A pattern is a regular expression of Python's syntax, which every harness of the company can run.

## Open questions

- **OQ-1**: Whether the rules for a second language (the Rust crate, JavaScript) join these sets or form their own.

## Key entities

- **Rule** - a pattern, a set and a reason (`pm:Rule`).

## Success criteria

- **SC-001**: `erga-setup.sh` and `erga-bootstrap.sh` have no line the tool reports.
- **SC-002**: A harness's toolchain checks read these sets and keep no pattern of their own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
