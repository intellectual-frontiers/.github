# Feature Specification: What a platform repository must not say

**Spec ID:** 0015-repoctl-names
**Status:** Active
**Owner:** if
**Domain:** repoctl

**Input:** A repository that holds a reusable platform is held not to say what only a user of it may: the name of a tenant, a customer, a host, a network or a retired product belongs to the repository of the one that has them. The platform cannot list those names even to forbid them, so the names are the data of whoever asks: `repoctl names` reads the files of one or more trees for the names a user's own files give, and says where one is.

## Requirements

- **FR-001**: The program MUST have the verb `names`, declared once in the table of verbs as a report of the public tier that only reads and is safe to repeat, with an example of the command and one of `--json`, and it MUST end with 0 where no name is found and with 1 where one is.
- **FR-002**: The Logical layer MUST give `findNames`, a pure function from the files of a tree (a path and a text), a list of names, a list of allowances and a scope to the names found, each with its path and line, in the order of the files and the lines.
- **FR-003**: A name MUST be found as a whole phrase in any case, with no letter or digit against either end, spaces inside the name standing for any run of white space, and an empty name MUST find nothing.
- **FR-004**: Only the files in the scope MUST be read: by default the specifications, the ontology, the tests, the fixtures and what is generated from them, and the caller MAY give the globs.
- **FR-005**: An allowance MUST be a name, a glob of paths or both, and a finding MUST be left out where an allowance covers it: its name is the finding's name in any case where it has one, and its glob matches the finding's path where it has one; an allowance with neither MUST cover nothing.
- **FR-006**: The verb MUST read each names file as a module that exports `names` as a list of texts and may export `allowances` as a list of allowances, and MUST end with the environment status (3) and `E-ENVIRONMENT`, saying which file and why, where a file cannot be loaded or exports something else; the names MUST be the data of the caller, and the program MUST hold none of its own.
- **FR-007**: With `--hide` the report, its findings and its JSON MUST say the file and the line and never the name, so that a report kept in a public place does not repeat what it found.

## Acceptance scenarios

1. **Given** a file with a name on its third line, **When** it is read in the scope, **Then** the finding is the file, line 3 and the name, per FR-002.
2. **Given** a name inside a longer word, **When** it is read, **Then** it is not found, and the same name in other letters is, per FR-003.
3. **Given** a file outside the scope, **When** it is read, **Then** it is not, per FR-004.
4. **Given** an allowance for a name at a path, **When** the name is at that path and at another, **Then** only the other is found, per FR-005.
5. **Given** a names file that exports a number, **When** the verb runs, **Then** it ends with the environment status and says why, per FR-006.
6. **Given** `--hide`, **When** a name is found, **Then** neither the text nor the JSON holds it, per FR-007.

## Out of scope

- Which names there are: they are the data of the organization that asks, kept in its own repository.
- Finding a name that is spelled in another way: a name is a phrase, not a pattern.

## Edge cases

- A name that is a prefix of another is found as the shorter whole phrase only where the longer is not one (FR-003).

## Assumptions

- A tree is small enough to be read whole.

## Open questions

- None.

## Key entities

- **Names file**, **Allowance**, **Scope**, **Finding**.

## Success criteria

- **SC-001**: A repository that holds none of the names ends 0, and the same repository with one name added ends 1.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
