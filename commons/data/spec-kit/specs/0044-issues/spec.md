# Feature Specification: Issues as typed code

**Spec ID:** 0044-issues
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** A weakness that is written in a document can be forgotten, reworded away or called fixed with nothing to show. This feature makes an issue a value of a type in the code of the library or the module it is about: a status is a sum whose cases carry what they need (a fixed issue its proof, a duplicate its original, a refused one its reason), a set of issues is checked as a whole and against the version before it, and the files are kept so that each issue is one numbered file that its folder's `mod.ts` lists. The gate that `bun run verify` runs holds every folder of the library.

## Requirements

- **FR-001**: An issue MUST be a frozen value whose status is a sum: `fixed` carries a non-empty proof, `duplicate` the number it duplicates, and `wont-fix`, `not-a-defect` and `deferred` their reason, so that a status without what it needs does not compile; it MUST say its severity, priority, goals, size, the engines it is about (or all) and the day it was raised.
- **FR-002**: Each library or module MUST keep its issues in an `issues/` folder as one file for each, named `NNNNN-slug.ts` with numbers from 00001 and no gap, listed in order by the folder's `mod.ts`, which exports the set under the scope of the folder; a file that is not named so, a number out of place, a file that `mod.ts` does not list and a name that `mod.ts` lists with no file MUST each be found.
- **FR-003**: A set MUST be checked: numbers from 1 with none missed or used twice, a slug in words, a date, a critical issue is P1 and a low one is never P1, engines named where not all, at least one goal, a fixed issue with a proof that is not only a review, a reason where one is owed, a duplicate of another issue that is not itself a duplicate, links to issues of the set, and citations in the form of a requirement.
- **FR-004**: Two versions of a set MUST be checked against each other so that an issue is never lost: one taken out, one whose number now names another issue and a status that moves along a path the moves do not allow MUST each be found; a finished issue MUST be able only to be reopened.
- **FR-005**: The issues still to be done (open, in progress, deferred) MUST be listed most pressing first, by priority, then severity, then number.
- **FR-006**: The check of the library MUST hold every `issues/` folder in `bun run verify`: the files as FR-002 says, each issue the one its file is named for, every set sound as FR-003 says, and the proof of a fixed issue resolving (a file that exists, a test whose title is in its file, a specification that exists, a commit that exists).

## Out of scope

- The database copy of the issues: 0045-issues-model.
- Fixing the issues themselves: each issue says what is to be done.

## Edge cases

- A folder of a model or an extension that is itself called `issues`: it is a unit and not a folder of issues, per FR-002.
- A shallow clone cannot say whether a commit exists: the commit is then taken as given, per FR-006.
- An issue that is wrong: it is closed as not a defect with its reason, never removed, per FR-004.

## Assumptions

- Issues are raised and closed by editing code in a commit, which is the record of who and when.

## Open questions

- **OQ-1**: Whether the git history of a set (the version before) should be read by the gate itself, which now holds a set only as it is.

## Key entities

- **Issue** - one known weakness, as a typed value.
- **Issue set** - the issues of one scope, in order.

## Success criteria

- **SC-001**: A weakness known to the library cannot be dropped, left without its proof when called fixed, or charged to an engine that cannot be expected to have what is missing.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
