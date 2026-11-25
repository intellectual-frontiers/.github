# Feature Specification: Repoctl library, commit and doctor

**Spec ID:** 0005-repoctl-library-commit-doctor
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `repoctl new library <name>` scaffolds a library of commons with everything it needs and makes what needs it again. `repoctl commit -m <subject>` makes the commit of this repository one way: the repository's identity, the trailers `Refs #N`, `Co-Authored-By` and `Claude-Session`, the refusal of files that must not be committed, and the check of the generated files first. `repoctl doctor` says what is wrong with a checkout and what to do about it.

## Requirements

- **FR-001**: `new library <name>` MUST write, under `commons/<name>/`, a manifest `library.ts` that declares the table of its layers (Kanon), `package.json`, `release.ts`, `tsconfig.json`, a typed `about.ts`, the three layers' entries, a specification kit (the registry, the enforcement register, an empty baseline and a first specification with its requirements and scenarios), a test that proves it, the check `bun run verify` runs, and its `LICENSE` made by the license program; and `--dry-run` MUST list the files and write nothing.
- **FR-002**: `new library` MUST refuse a name that is not lower-case letters, digits and hyphens starting with a letter (`E-LIBRARY-NAME`), a name that `family.ts` of the libraries holds for a family (`E-LIBRARY-RESERVED`) and a name whose folder exists (`E-LIBRARY-EXISTS`), and MUST write nothing then.
- **FR-003**: `new library` MUST classify the library for the README (its `--role`, a program by default) in the map of roles of `readme.ts`, link it, and make every generated file that needs it, so that `sync --check` ends with 0 after it.
- **FR-004**: `commit` MUST make the commit with the author and the committer the identity of the repository's configuration (0009-repoctl-config FR-004), given to Git as `-c user.name` and `-c user.email` and never from the checkout's own configuration.
- **FR-005**: The message of a commit MUST be the subject, a blank line, and then, each on a line of its own and in the order of the configuration's trailers, the reference to an issue (the configuration's prefix and the number of `--refs`, where it is given), the line `Impact: <word>` of FR-009, the line that credits the agent (`--co-author`, the variable `REPOCTL_CO_AUTHOR` or the configuration's) and `Claude-Session: <address>`, the address being `--session` or the variable `CLAUDE_SESSION_URL`; a subject that is not one line of at most 100 characters without a full stop, an issue that is not a number and an address that is missing or not https MUST be refused before anything is staged.
- **FR-006**: `commit` MUST refuse, naming the path and what it is, a file under `.claude/`, a file under `node_modules/`, and a file that looks like a secret by its name (an environment file, a key, a certificate, a file of credentials) or by what it holds (a private key, a token of npm, GitHub, Slack or AWS), and MUST make no commit then (`E-COMMIT-FORBIDDEN`), except a canary file pinned by its path and its digest (0016-repoctl-canaries).
- **FR-007**: `commit` MUST check the generated files before it commits and MUST make no commit where any generator is stale (`E-STALE-GENERATED`); with nothing staged and no path it MUST say so (`E-COMMIT-NOTHING`); and `--dry-run` MUST show the message and the files and commit nothing.
- **FR-008**: `doctor` MUST find, in the order to fix them, that Git does not run or the folder is not a working tree, that the root has no `node_modules`, that libraries are not linked, that Node is older than 26 or missing, that Bun is not the version the packaging ontology pins, and which generated files are stale, each with a code and the command that fixes it, and MUST say that the checkout is in order where it finds nothing.
- **FR-009**: `commit --impact major|minor|patch` MUST write the line `Impact: <word>` (commons 0026-works-versioning FR-021) in the place the configuration's trailers give to `impact`, MUST refuse a word that is none of the three with `E-COMMIT-IMPACT` before anything is staged, and MUST refuse the option where the configuration's trailers have no `impact`; a commit that gives none has no such line. `repoctl new library` MUST list the spec kit of the library it makes in the configuration of the site that the repository names (`libraries.docsFile`), so that the check of commons libraries 0001-libraries FR-025 finds it listed.

## Acceptance scenarios

1. **Given** a name and a summary, **When** `new library --dry-run` runs, **Then** the files are listed and none is written, per FR-001.
2. **Given** a name and a summary, **When** `new library` runs in a copy of the repository, **Then** the library is there, its `verify` passes and `sync --check` ends with 0, per FR-001 and FR-003.
3. **Given** `Bad_Name`, `archon-x` and an existing folder, **When** `new library` runs, **Then** each is refused with its code and nothing is written, per FR-002.
4. **Given** a staged file, **When** `commit` runs, **Then** the commit has the identity as author and committer, whatever the checkout's configuration says, per FR-004.
5. **Given** a subject, an issue and a session address, **When** the message is made, **Then** the trailers are in the order of FR-005, each on its own line.
6. **Given** a staged `.claude/settings.json`, a `.env` or a file with a private key, **When** `commit` runs, **Then** it is refused and no commit is made, per FR-006.
7. **Given** a stale generated file, **When** `commit` runs, **Then** it is refused with the generator named, per FR-007.
8. **Given** a checkout with no `node_modules`, a Node of 22 and no link, **When** `doctor` runs, **Then** each is a finding with its code and its fix, in that order, per FR-008.

## Out of scope

- Pushing: the person pushes, with `git push origin HEAD:main`.
- Signing a commit: the checkout's own configuration.

## Edge cases

- A path given to `commit` that is forbidden: refused before it is staged, per FR-006.
- `--refs` absent: the commit has no `Refs` line, per FR-005.
- A checkout with no `origin`: `doctor` warns that the tags and the base of the checks are not known, per FR-008.

## Assumptions

- The libraries of commons that Repoctl calls (`libraries`, the tools of commons) are on the branch that holds it, and `git`, `bun` and `node` are installed.

## Open questions

- None.

## Key entities

- **Scaffold** - the files of a new library.
- **Trailer** - a line of the end of a commit message.

## Success criteria

- **SC-001**: A library made by `new library` passes its own `verify` and `repoctl check`.
- **SC-002**: No commit is made with another identity, a missing trailer or a secret.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
