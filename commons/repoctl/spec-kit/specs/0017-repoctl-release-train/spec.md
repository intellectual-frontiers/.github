# Feature Specification: Release train

**Spec ID:** 0017-repoctl-release-train
**Status:** Active
**Owner:** if
**Domain:** repoctl

**Input:** A release of the libraries is several acts that a person has made by hand, in an order that is easy to get wrong: make the release (`release apply`), commit what it made together with its record, push, publish, wait for the registry, then move the pin of every repository that consumes the libraries, install, and check that each still passes. Two mistakes were made in this order: a publication was asked for on a commit that did not hold the release record, and a pin was moved with a lockfile that did not move with it. `repoctl release train` is the one verb that walks the order, stops where a person must act, and says in one summary where it stopped and why. It makes no publication and no tag: it prepares, hands off and follows.

## Requirements

- **FR-001**: The verb `release train` MUST exist beside `release plan`, `release apply` and `release publish`, with the tier `contributor`, the effect `mutate`, a dry run and the channel `local`; it MUST NOT publish, tag, commit or push, and what it writes MUST be only what `release apply` writes in this repository and the manifests and lockfiles of the consumers it is told of (FR-004).
- **FR-002**: The first phase, the release, MUST do what `release apply` does (the same options `--offline`, `--distribution`, `--raise` and `--no-tests`) where the release record names no release that is untagged, and nothing at all where it names one (the release is made and waits for its publication: it MUST NOT be made again, and the summary MUST say so); where the plan has nothing to release and the record names nothing untagged, the verb MUST say that nothing is to release and go on to the pins.
- **FR-003**: The second phase, the hand-off, MUST be reached only where a release is waiting for its publication, and it MUST say the release is ready to be published only where the release record is tracked by Git and the working tree has no change at all, and where the commit at `HEAD` is contained in `origin/main` as this checkout knows it; otherwise it MUST refuse with a finding that names the cause and the files (`E-TRAIN-NOT-COMMITTED`, `E-TRAIN-NOT-PUSHED`), MUST NOT print the step that publishes, and MUST end with a failure, so that a publication is never asked for on a commit that lacks the record. Where the hand-off is ready the verb MUST say that publishing is the step of a person and name the commit.
- **FR-004**: The third phase, the pins, MUST read each consumer given by `--consumer DIR` (repeatable): the `package.json` files that Git tracks in it, and in each the dependencies (of every section) that are packages of the release record and are pinned to an exact version. A pin MUST move only to the version of the record and only upward: a range, a link, a workspace reference or a version at or above the record's MUST be left alone, and `--only PATH` (repeatable) MUST restrict the pins to the `package.json` files whose folder is `PATH` or under it, so that a consumer that pins its own version keeps it.
- **FR-005**: For each consumer that has a pin to move, the verb MUST write the new pins, make the install that updates its lockfile, make the install that refuses a lockfile that is not up to date, and then run the commands of the consumer's `commons-consumer.json` (`{ "verify": [{ "check": NAME, "argv": [program, argument...] }, ...] }`, each a check of the table of commons libraries `ci/policy` (libraries 0002-libraries-ci-findings FR-010) and an argument vector run with no shell from the consumer's root), once for the consumer, in order, every one of them whatever an earlier one said (FR-008); a consumer with no such file MUST say it declares no check, and MUST NOT be said to have passed one. Where the install cannot find the version (it is not on the registry yet), the verb MUST put the consumer's `package.json` and lockfiles back as they were, MUST say the consumer is waiting for the publication, and MUST end with a warning that is not a failure; with `--wait SECONDS` it MUST try again at an interval until the time is up.
- **FR-006**: With `--offline` the verb MUST install nothing and move no pin of a consumer: it MUST list the pins that it would move; with `--dry-run` it MUST write nothing and list what each phase would do.
- **FR-007**: The summary MUST be one report, as text for a person and as data for `--json`, with a row for each phase and for each consumer pin (`moved`, `current`, `waiting`, `failed`, `planned`) and each verify command with its exit status, and the order of what is next; a phase that was not reached MUST say `not reached` and why.
- **FR-008**: What a failing check of a consumer does MUST be what the table of checks says (libraries 0002-libraries-ci-findings FR-010): a check that blocks a release (`syntax`, `types`, `pack`, `secret-scan`) MUST end the verb with a failure (`E-TRAIN-VERIFY`); every other check MUST be recorded as a warning that is not a failure (`E-TRAIN-FINDING`, and `E-TRAIN-TESTS-FAILING` for the tests, which MUST say in capitals that failing tests also hold acceptance), and MUST NOT end the verb with a failure; a name in `commons-consumer.json` that is no check of the table MUST refuse the consumer (`E-TRAIN-CONSUMER`).

## Acceptance scenarios

1. **Given** a repository whose plan has a release and a clean tree, **When** `release train` runs, **Then** the release is made as `release apply` makes it, the hand-off refuses with `E-TRAIN-NOT-COMMITTED` naming the changed files, and the summary does not name the publication step, per FR-002 and FR-003.
2. **Given** the release made and committed but not pushed, **When** it runs, **Then** the hand-off refuses with `E-TRAIN-NOT-PUSHED`; **Given** it committed and pushed, **Then** it says the release is ready and that publishing is a person's step, per FR-003.
3. **Given** a record that names a release that is untagged, **When** it runs, **Then** the release is not made again, per FR-002.
4. **Given** a consumer that pins two packages of the record, one to an older exact version and one to a range, **When** the pins phase runs, **Then** the first is moved to the record's version and the range is left alone, per FR-004.
5. **Given** `--only services/a`, **When** a consumer has pins in `services/a` and `services/b`, **Then** only the first moves, per FR-004.
6. **Given** a consumer whose install cannot find the new version, **When** the phase runs, **Then** its manifest and lockfile are as they were, it is `waiting`, and the run ends with a warning and no failure, per FR-005.
7. **Given** a consumer whose install succeeds, **When** its `verify` commands run, **Then** each runs in order from the consumer's root and none is left out because an earlier one failed, per FR-005.
10. **Given** a consumer whose failing checks are `surface-thin`, `hygiene` and `tests`, **When** the train runs, **Then** it ends well with a warning for each and the failing tests said in capitals; **Given** a failing `types` or `syntax` check, **Then** it ends with a failure, per FR-008.
8. **Given** `--offline`, **When** it runs, **Then** nothing is installed and the pins that would move are listed, per FR-006.
9. **Given** a run, **When** it ends, **Then** the summary names every phase and every pin, per FR-007.

## Out of scope

- Publication and the tag: `release publish` of a person, or the release workflow (commons 0030-generated-workflows FR-009, FR-017).
- Which consumers exist: each run is told its consumers; no repository of a product is named here.
- Repositories that pin a range: a range moves with the registry and has nothing to repin.

## Edge cases

- A consumer that is not a Git checkout: it is refused with a finding that names it, per FR-004.
- A `commons-consumer.json` that is not what FR-005 says: the consumer is refused before any pin moves, per FR-005.
- A pin whose package is not in the record: not a pin of this release, per FR-004.
- A tracked `package.json` that is not JSON: named, and the consumer is not touched, per FR-004.

## Assumptions

- A consumer's installer is Bun, which reads the registry the consumer configures, with the credential its own environment holds.

## Open questions

- None.

## Key entities

- **Release record** - the file the release writes (commons libraries 0001-libraries FR-014).
- **Consumer** - a repository that pins packages of the record.
- **Pin** - an exact version of a package of the record in a consumer's `package.json`.
- **Hand-off** - the state in which a person may publish: the record committed and the commit on `origin/main`.

## Success criteria

- **SC-001**: A publication is never asked for on a commit that lacks the release record by following this verb's output.
- **SC-002**: A person runs one command twice at most (before and after the publication) to move every pin and see every consumer pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
