# Feature Specification: Repoctl sync, merge and check

**Spec ID:** 0003-repoctl-sync
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The verbs that keep the generated files as their generators make them, and that check the repository. `repoctl sync` makes every generated file in the order the table of generators gives, rerunning only the generators whose own check says their files are stale; `sync --check` writes nothing and ends with 1 naming each stale generator and the command that fixes it, which is what CI and the hooks run. `repoctl merge <ref>` merges and never resolves a generated file by hand. `repoctl check` runs every check of the repository in one calm report with problem codes, and `repoctl explain <code>` says what a code means. It calls the generators' programs and does not make their logic again.

## Requirements

- **FR-001**: `sync` MUST run the generators in an order where each comes after every generator that writes something it reads, as the globs of the table say, the order of the table standing where they do not order two; a table whose generators wait for one another MUST be refused with the ones that do.
- **FR-002**: `sync` MUST ask each generator's own check first and run the generator only where its check ends with 1, then check it again; a generator whose check ends with another status, or that is still not as it makes after it ran, MUST be reported as a failure of that generator (`E-GENERATOR-FAILED`) and the others MUST still be tried.
- **FR-003**: `sync --check` MUST write nothing and MUST end with the status 1 where any generator is stale, naming each stale generator (`E-STALE-GENERATED`) with the command that makes its files, and MUST end with 0 where none is; `--dry-run` MUST say which generators would be run and end with 0.
- **FR-004**: `sync` MUST give the same bytes for the same sources: running it a second time MUST change no file, and `--only` MUST run only the generators it names and MUST refuse an id that is not one.
- **FR-005**: `merge <ref>` MUST run Git's merge; where files conflict, it MUST make the conflicting generated files again by their generators (taking one side to clear the markers, running `sync` and staging what then is as its generator makes it) and MUST NOT resolve a generated file by hand, and MUST report every conflict in a file that no generator writes (`E-MERGE-CONFLICT`), leaving that file as Git left it; a generated file that also holds text a person wrote (the table of the README, the register of the libraries) MUST keep the lines of both sides where they conflict before its generated part is made again, and `merge` MUST say so.
- **FR-006**: `merge` MUST make the merge commit only where no conflict is left, MUST end with the status 1 where any is, and where Git merges with no conflict MUST report the generated files that are stale (`E-STALE-GENERATED`) and write nothing; a merge that Git refuses for another reason MUST be reported as `E-MERGE-FAILED` with Git's words.
- **FR-007**: `check` MUST run the check of every generator, the format check of the specification kit of commons, the rules of Mizan, the versions, the format check and the rules of the specification kit of each library at its level, and the check of the constants that say a version, MUST write nothing, and MUST give one report in which each finding has a code of `ProblemCode` and the command that fixes it, ending with 1 where any finding fails and 0 where none does.
- **FR-008**: `check` MUST find every constant of the sources of a library that is named `<LIBRARY>_VERSION` (the library's name in capitals, a hyphen as an underscore) or named by the manifest in `versionConstants`, whose text is not the version of the library (`E-VERSION-CONSTANT`), and MUST find a constant the manifest names that is not in its file.
- **FR-009**: `explain <code>` MUST say, for every code of the program, its title, what happened, the likely cause and the fix, and for a text that is no code MUST say so and name the nearest.

## Acceptance scenarios

1. **Given** a table in which a generator reads what another writes, **When** it is ordered, **Then** the reader comes after the writer, per FR-001.
2. **Given** a table in which two generators read what the other writes, **When** it is ordered, **Then** it is refused naming both, per FR-001.
3. **Given** a generator whose check ends with 1 and whose run makes it end with 0, **When** `sync` runs, **Then** it is made once and reported as made, and a fresh generator is not run, per FR-002.
4. **Given** a generator that still ends with 1 after it ran, **When** `sync` runs, **Then** it is a failure of that generator and the next generator is still tried, per FR-002.
5. **Given** a stale generator, **When** `sync --check` runs, **Then** nothing is written, the status is 1 and the generator and its command are named, per FR-003.
6. **Given** the real repository, **When** `sync --check` runs, **Then** it ends with 0, per FR-003 and FR-004.
7. **Given** two branches that changed the README table and a manifest differently, **When** `merge` runs, **Then** the README is made again and staged, the merge is committed, and no marker is left, per FR-005 and FR-006.
8. **Given** two branches that each wrote a line of the README and changed the sources of its table, **When** `merge` runs, **Then** both lines are in the README and its table is made again, per FR-005.
9. **Given** two branches that changed one line of a source differently, **When** `merge` runs, **Then** the file is named and left with Git's markers, the merge is not committed and the status is 1, per FR-005 and FR-006.
10. **Given** a library whose version is 0.4.7 and a constant that says 0.4.6, **When** `check` runs, **Then** the constant is a finding with the file and the line, per FR-008.
11. **Given** `explain E-STALE-GENERATED`, **When** it runs, **Then** it says the title, the cause and `repoctl sync`, per FR-009.

## Out of scope

- The logic of each generator: the generators' own specifications.
- The check of the tests and the types of each library: `bun run dev:check` and each library's `verify`.

## Edge cases

- A generator that is not installed or whose source is broken ends with a status that is neither 0 nor 1: it is a failure of the generator, per FR-002.
- A generated file that conflicts while the source of its generator also conflicts: its generator cannot make it, so it stays unresolved (`E-REGENERATE-FAILED`), per FR-005.
- A repository with no `origin/main`: the check of the versions cannot run and is a warning, not a failure, per FR-007.

## Assumptions

- The libraries of commons that Repoctl calls (`libraries`, the tools of commons) are on the branch that holds it, and `git`, `bun` and `node` are installed.

## Open questions

- None.

## Key entities

- **Generator** - a program that makes files from sources and checks them.
- **Section** - one check of `check` and what it found.

## Success criteria

- **SC-001**: After `sync`, `sync --check` ends with 0, and after a merge of generated files nothing is hand-edited.
- **SC-002**: A version constant left behind by a release is found before the push.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
