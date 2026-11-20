# Feature Specification: Repoctl status and release

**Spec ID:** 0004-repoctl-status-release
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `repoctl status` tells, for each library, its version in the repository, the version npm shows and its tag, as a table or as JSON, and `--offline` asks no network. `repoctl release plan|apply|publish` wraps `releasing.ts` of the libraries: `plan` says what a release would do and why, `apply` makes it, and `publish` sends the packed libraries to npm by hand, which is a destruction that needs the releaser tier, a preview, `--yes` and a typed confirmation. The credential for npm is never printed, echoed or logged.

## Requirements

- **FR-001**: `status` MUST give, for each library of the repository in the order of its name, the version in its manifest, what npm shows (the latest version and whether the version of the repository is listed, or that the library is not on npm, or that npm could not be asked), the greatest version of its tags and whether the version of the repository is tagged, and one state of `released`, `unpublished`, `untagged` or `unknown`, as a table for a person and as JSON.
- **FR-002**: `status --offline` MUST ask no network: npm MUST NOT be asked and the tags MUST be those of the local clone.
- **FR-003**: `status` MUST report what npm shows and nothing it does not: a version that npm does not list MUST be shown as not listed and the library as `unpublished`, and the program MUST NOT say that a version is staged or on its way; a registry that cannot be asked MUST be a warning (`E-NPM-UNREACHABLE`) and not a failure.
- **FR-004**: `release plan` MUST give the plan of `releasing.ts` (`factsOf` and `planRelease`), library by library with the reason of each, and MUST write nothing.
- **FR-005**: `release apply` MUST call `applyRelease` of `releasing.ts` (which raises the versions in the record, the manifest, the package and the constants the manifest names, makes the generators it knows and runs the tests that pack), then make every generated file by the table of generators, and MUST commit and publish nothing; with `--dry-run` it MUST give the plan and write nothing.
- **FR-006**: `release publish` MUST be a destruction: it MUST be visible only to the tier `releaser`; `--dry-run` MUST print the releases that would be sent and the confirmation phrase, which is the word `publish`, how many packages and the start of a digest of which; and a run that sends MUST need `--yes` and `--confirm` with that phrase, and MUST send nothing where the phrase is not the plan's (`E-PUBLISH-REFUSED`) or the token is not there (`E-NO-TOKEN`).
- **FR-007**: The credential MUST be read only through the credentials port, from the variable `INFRO_NPMJS_TOKEN`, and held as a `Secret`; it MUST NOT be printed, echoed, logged or put in an argument of a program, and every line the verb reports from a program MUST have it redacted first.
- **FR-008**: The credential MUST be written, for the one `npm publish` run, to a file of mode 0600 in a folder made outside the repository, and that folder MUST be removed whatever happens, a failure of npm included.
- **FR-009**: `npm publish` MUST be given the absolute path of each tarball (`dist/intellectual-frontiers-<library>-<version>.tgz` of the library's folder), never a relative path, which npm reads as the shorthand of a GitHub repository.
- **FR-010**: `release publish` MUST try each release in order, skip one that npm lists already, report one that failed or could not be tried and go on with the others, and MUST say, where any was sent, that npm stages a version published by hand for about an hour and that `repoctl status` lists it once npm shows it.

## Acceptance scenarios

1. **Given** the versions of three libraries in the repository, on npm and in the tags, **When** `status` runs, **Then** each row has the three and a state, per FR-001.
2. **Given** `--offline`, **When** `status` runs, **Then** the registry is not asked and the tags are the local ones, per FR-002.
3. **Given** npm that lists a library at an earlier version, **When** `status` runs, **Then** the row says the version is not listed and the state is `unpublished`, with no word of staging, per FR-003.
4. **Given** a registry that cannot be reached, **When** `status` runs, **Then** the row says `unreachable` and a warning with a code is raised, per FR-003.
5. **Given** the tags and the tree, **When** `release plan` runs, **Then** it says each library and why and writes nothing, per FR-004.
6. **Given** a library whose manifest names a constant, **When** `release apply` raises it, **Then** the constant has the new version, per FR-005.
7. **Given** the releases of the record that are not tagged, **When** `release publish --dry-run` runs, **Then** the releases and the phrase are printed and nothing is sent, per FR-006.
8. **Given** a wrong phrase or no token, **When** `release publish --yes` runs, **Then** nothing is sent and the codes are `E-PUBLISH-REFUSED` and `E-NO-TOKEN`, per FR-006.
9. **Given** a token and a run of npm that prints it, **When** `release publish` runs, **Then** no stream, no outcome and no argument holds the token, per FR-007.
10. **Given** a run that ends well and one that fails, **When** `release publish` ends, **Then** the folder of the npmrc is gone in both, its file was 0600, and npm was given an absolute tarball, per FR-008 and FR-009.
11. **Given** three releases of which one is on npm, one fails and one is sent, **When** `release publish` runs, **Then** each is reported, the failure fails the run and the staging is said, per FR-010.

## Out of scope

- Tagging: the release workflow makes the tags.
- Trusted publishing from CI: the workflow's.

## Edge cases

- A library that names no npm: it is not a row of the publication, per FR-010.
- A tarball that is not there: the release is not tried and the code is `E-NO-TARBALL`, per FR-010.
- A token that is shorter than the redaction's minimum: it is still never put in an argument, per FR-007.

## Assumptions

- The libraries of commons that Repoctl calls (`libraries`, the tools of commons) are on the branch that holds it, and `git`, `bun` and `node` are installed.

## Open questions

- None.

## Key entities

- **Row** - one library of the status.
- **Confirmation phrase** - what the person types to send a publication.

## Success criteria

- **SC-001**: The credential is in no output of any run.
- **SC-002**: What is sent is what the preview printed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
