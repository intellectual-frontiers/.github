# Feature Specification: Repoctl prove

**Spec ID:** 0007-repoctl-prove
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `repoctl prove` makes the proof of a change proportional to its blast radius. From the working tree and a base it classifies each changed file, computes which tiers of proof apply (T0 static, T1 library, T2 seam, T3 packaging, T4 end to end, T5 platform, T6 release), which tests run and, for every proof it leaves out, why leaving it out is safe. The same plan drives a local run and the plan job of CI. The plan is a value: a closed union of change classes, a closed union of proofs, and a closed union of skip reasons, computed by pure functions of the changed files, the import graph and the fingerprints of the public type surfaces.

## Requirements

- **FR-001**: `repoctl prove` MUST compute the proof plan of the working tree against a base (`--base REF`, `origin/main` where it is not given) and run the proofs of the tiers T0 to T3 that apply; `--plan` MUST print the plan as one JSON document and run nothing; `--why` MUST print, for every proof of the plan and every proof left out, the sentence that says why; `--tier N` MUST restrict the run to one tier; `--all` MUST plan every proof of every tier. The exit status MUST be 0 where every proof run passed, 1 where one failed, and 2 for a command line that does not fit.
- **FR-002**: The tiers MUST be a closed set, each with its name, its budget in seconds and the occasions it runs on: T0 static (types, lint, format, specification and trace checks; affected files only), T1 library (the suite of one library, property tests included), T2 seam (provider conformance and consumer seam tests), T3 packaging (pack, install, import and type-check a tarball), T4 end to end (hermetic product flows), T5 platform (Windows, macOS, Node against Bun), T6 release (everything, once per release). Every proof of a plan MUST belong to exactly one tier.
- **FR-003**: Every changed file MUST be classified by a pure function of its path and of its content at the base and now, into one change class of a closed union: `prose` (a comment, TSDoc or text with no code change), `spec` (a specification whose requirement identifiers are unchanged), `spec-requirements` (a specification whose requirement identifiers changed), `generated` (a file a generator makes), `version` (a version or a release record only), `test` (a test file), `source` (code inside a library), `packaging` (exports, `package.json` beyond its version, the packer), `planner` (the planner, the generators, the tier rules) and `outside` (a file in no library that is none of these). The plan of a change MUST be the union of the proofs of the classes of its files, and each class MUST have one row of the table `CLASS_RULES`.
- **FR-004**: The proofs of a class MUST be: `prose`, the documentation check; `spec`, the specification and trace checks; `spec-requirements`, those and the suite of the library; `generated`, `sync --check` (the bytes equal to the generators'); `version`, the versions check; `test`, T0 and T1 of that library; `source`, by FR-006 to FR-008; `packaging`, T3 of the library (and of every library where the packer changed); `planner`, every proof of every tier; `outside`, the checks of the repository and T0 and T1 of the libraries that read the file.
- **FR-005**: The plan MUST never skip what it cannot show safe: a change to the planner, to the table of generators, to the workflow definitions or to the tier rules MUST plan every proof; a file the classifier does not know MUST be `outside`, never ignored; and where Git cannot say what changed the plan MUST be `--all` and say so.
- **FR-006**: A `source` change inside a library MUST plan T0 and T1 of that library alone, and MUST skip its dependents with the reason `surface-unchanged`, where the fingerprint of the public type surface of the library (FR-007) is the same at the base and now. A library of the foundation (`core`, `formats`, `crypto`, `system`, `terminal`, `kanon`, `libraries`) MUST in addition run its smoke gate (FR-011) before anything wider.
- **FR-007**: The public type surface of a library MUST be fingerprinted as the hash, for each exported declaration, of its emitted declaration with comments removed and whitespace normalised, together with the declarations local to the file that it can mention; the fingerprint of the library is the map from each declaration to its hash. The set of changed symbols MUST be the names whose hash differs, appeared or went away between the base and now. The same sources MUST give the same fingerprint, and a change of a comment or of a function body whose declared types are the same MUST leave it unchanged.
- **FR-008**: Where the fingerprint changed, the plan MUST plan T0 for each library whose sources import a changed symbol (a namespace import or a re-export of everything counts as importing all of them), and T1 and T2 for those importers only; a library that imports the changed library but none of the changed symbols MUST be skipped with the reason `symbols-unused`; and the reach MUST be followed through the importers whose own surface mentions a changed symbol.
- **FR-009**: Every proof the plan leaves out MUST be listed with a reason of a closed union (`class-needs-none`, `surface-unchanged`, `symbols-unused`, `no-importer`, `cache-hit`, `tier-scheduled`, `quarantined`) that the `--why` text renders as one sentence. A plan MUST have no proof that is neither planned nor skipped with a reason among those the tiers and the libraries make possible.
- **FR-010**: Tests MUST run through a content-addressed result cache (Planned): the key is the hash of the test file, of every source it transitively imports and of the runtime version, and, for a test that reads the tree, of the folder of its library; an identical key MUST not run again; the cache lives outside the repository (the cache folder of XDG); a file-level selector MUST run a test only where something it transitively imports changed, with the trace register as the second selector.
- **FR-011**: A smoke gate (Planned) of the foundation libraries MUST be a data set of golden and property tests that runs in under 30 seconds and runs on every change that reaches a foundation library; a plan widens only where the smoke gate fails.
- **FR-012**: A flake record (Planned) MUST be data: a test that is quarantined is named with its owner and its expiry, is reported by every plan that would have run it, and runs again when the expiry passes; a failing property test MUST print its seed in the failure message.
- **FR-013**: The development loop and the plan job of CI MUST read the same plan where the class rules say it is safe (Planned for the plan job): `dev:check` MUST skip with a reason, and the plan job of CI MUST keep the affected set for the main branch, so that what main proves is never less than the affected set.
- **FR-014**: The guard rails MUST stay: a nightly run of every tier, the release gate (T6) and a plan that never skips for a change to the planner (FR-005).

## Acceptance scenarios

1. **Given** a change of a comment in `commons/core/src/`, **When** `prove --plan` runs, **Then** its classes are `prose`, only the documentation check is planned and every other proof is skipped with `class-needs-none`, per FR-003 and FR-004.
2. **Given** a change of a function body in a leaf library with the same declarations, **When** it runs, **Then** T0 and T1 of that library are planned and its importers are skipped with `surface-unchanged`, per FR-006.
3. **Given** a change of an exported signature in `core`, **When** it runs, **Then** the importers of the changed symbol have T0, T1 and T2, and an importer of other symbols of `core` is skipped with `symbols-unused`, per FR-008.
4. **Given** a change to `commons/repoctl/src/logical/prove.ts`, **When** it runs, **Then** every proof of every tier is planned, per FR-005.
5. **Given** the same working tree twice, **When** the plan is made, **Then** the two JSON documents are equal, per FR-001 and FR-007.
6. **Given** `--why`, **When** it runs, **Then** each proof and each skipped proof has one sentence, per FR-009.

## Out of scope

- Running T4 to T6 locally: they are planned and left to the nightly run, the release and CI.
- Deciding a version, a tag or a release.

## Edge cases

- A file removed or added: it is classified by its path, and its content on the missing side is empty.
- Declarations that cannot be emitted (a type error): the library is treated as having a changed surface.
- A comment that holds a `// Spec:` line: a change to that line is a change of trace, so the class is `spec`.

## Assumptions

- `git`, `bun` and the compiler of the checkout are installed and the libraries are linked.

## Open questions

- None.

## Key entities

- **Change class** - what a changed file is, by its path and content.
- **Proof** - one check or run of a tier, for a library.
- **Plan** - the proofs to run and the proofs left out, each with its reason.
- **Surface fingerprint** - the map from a library's exported declarations to their hashes.

## Success criteria

- **SC-001**: A comment-only change proves in seconds and a leaf change in a library proves that library alone.
- **SC-002**: A plan is deterministic, and no change to the planner is ever skipped.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
