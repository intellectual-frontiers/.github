# Feature Specification: Repoctl hygiene

**Spec ID:** 0007-repoctl-hygiene
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A repository that uses commons must use it only as published packages (commons 0036-distribution). `repoctl hygiene` is the check any repository can run: it reads the repository it is in and says, with a code and a path for each finding, where the rule is broken. Its core is a pure function of facts; the reading of files is at the edge, through the ports.

## Requirements

- **FR-001**: The program MUST have the verb `hygiene`, declared once in the table of verbs as a report of the public tier that only reads and is safe to repeat, with an example of the command and one of `--json`; the codes `E-HYGIENE-GIT`, `E-HYGIENE-PATH`, `E-HYGIENE-IMPORT`, `E-HYGIENE-VENDORED`, `E-HYGIENE-DUPLICATE` and `E-HYGIENE-RANGE` MUST each be in the closed union of problem codes with an explanation (`repoctl explain <code>`).
- **FR-002**: The Logical layer MUST give `hygiene`, a pure function from the facts of a repository (its `package.json` files, lockfiles, installed copies, relative imports and workspaces, and whether it is the repository of commons) to its findings, each with a level, a code, a path, a message and a fix, in the order of the codes and then of the paths: a dependency by Git on `intellectual-frontiers/.github` (`E-HYGIENE-GIT`), a `file:` or `link:` dependency into a path with a segment `commons` that has something after it (`E-HYGIENE-PATH`), a relative import into such a path (`E-HYGIENE-IMPORT`), a package of the scope `@intellectual-frontiers/` in a folder that is not the root package or a declared workspace (`E-HYGIENE-VENDORED`), one package of the scope installed at two versions (`E-HYGIENE-DUPLICATE`) and, as a warning, a dependency of the scope that is not an exact version (`E-HYGIENE-RANGE`); in the repository of commons the path, import and vendored findings MUST NOT be made.
- **FR-003**: The Logical layer MUST gather the facts only through its ports: it MUST read `bun.lock` (JSON with comments and trailing commas) and `package-lock.json` (lockfile versions 2 and 3) as data, the `package.json` files outside `node_modules`, the packages installed under `node_modules` (nested ones and Bun's `.bun` store included) and the relative imports of the sources; a lockfile that cannot be read MUST be a failing finding of `E-ENVIRONMENT` and a repository with none MUST be a warning of it, never a silent pass.
- **FR-004**: The run MUST end with 0 where no finding fails and with 1 where one does, a warning alone MUST NOT fail it, and `--json` MUST be one document with the repository's kind, the counts and the findings with their code, level, path, message and fix.
- **FR-005**: `repoctl status` MUST read the package a library publishes (its manifest's `publishes`, else `@intellectual-frontiers/<name>`) from the registry of npm (commons 0036-distribution FR-009).

## Acceptance scenarios

1. **Given** a repository with a Git dependency on the repository of commons, **When** `hygiene` runs, **Then** it ends with 1 and `E-HYGIENE-GIT` at the path of the `package.json`, per FR-002.
2. **Given** a `link:` dependency into `../commons/core`, a folder `vendor/core` with a package named `@intellectual-frontiers/core`, an import of `../commons/core/src/mod.ts` and two versions of one package in a lockfile, **When** it runs, **Then** each of the four findings is made at its path, per FR-002.
3. **Given** the same two copies in `bun.lock` and in `package-lock.json`, **When** each is read, **Then** the same duplicate is found, per FR-003.
4. **Given** only a range on a package of the scope, **When** it runs, **Then** one warning and the status 0, per FR-004.
5. **Given** the repository of commons, **When** it runs, **Then** its own packages are not findings, per FR-002.
6. **Given** a library whose manifest publishes `@intellectual-frontiers/arcactl`, **When** `status` asks npm, **Then** it asks for that package, per FR-005.

## Out of scope

- The repair of a finding: each finding says the command, and the program does not edit a `package.json`.
- The names of the libraries of commons: the check reads a path, not a registry.

## Edge cases

- A folder named `commons` that is not ours: the path and the import are findings only where something follows the segment, and the message says what was found, per FR-002.
- One version of a package under two paths: one copy, no finding, per FR-002.
- A `package.json` that is not JSON: left out of the facts, per FR-003.

## Assumptions

- A repository that consumes commons keeps its own packages at its root or in the workspaces its root declares.

## Open questions

- None.

## Key entities

- **Facts of a repository** - its manifests, lockfiles, installed copies, imports and workspaces.
- **Finding** - level, code, path, message and fix.

## Success criteria

- **SC-001**: A repository in order has no finding, and each way of breaking the rule has one.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT)
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
