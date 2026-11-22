# Feature Specification: Repoctl docs verbs

**Spec ID:** 0011-repoctl-docs
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `repoctl docs build|serve|check` wrap the documentation generator `ifc-docs` of `@intellectual-frontiers/docs` for the repository that configures it. The generator is not carried by repoctl and nothing is uploaded.

## Requirements

- **FR-001**: A configuration with `docs: { config, out }` (`docs.config.ts` and `_site` where it names none) MUST turn on the verbs `docs build` (a mutation that previews with `--dry-run`), `docs check` (a report of the public tier that writes nothing in the repository) and `docs serve`; a configuration with no `docs` has none of them.
- **FR-002**: The generator MUST be loaded where it is installed (the `node_modules` of the repository or above it, else by its package name) as an optional peer, its `main` called with the arguments of `build` or `check` as `ifc-docs` reads them (`build --out DIR --config FILE`, `check --config FILE`, paths absolute from the repository's root); where it cannot be loaded the verb MUST end with 1 and the problem `E-DOCS-GENERATOR-MISSING`, whose explanation says how to install it (FR-005 says where it is looked for).
- **FR-003**: A generator that ends with a status other than 0 MUST be the problem `E-DOCS-FAILED` and the status 1; `docs build` MUST say the folder it built and `docs check` MUST say there is no finding where there is none.
- **FR-004**: `docs serve` MUST build the site and then serve the folder on a loopback port only (`127.0.0.1`, the port of `--port`, 4173 by default, 0 for one the system chooses) until it is interrupted or `--for SECONDS` has passed; it MUST NOT send the site anywhere and MUST answer a path that is not there with 404.
- **FR-005**: The generator MUST be looked for in the order of the distribution (commons 0036-distribution FR-019): first as the entry `./docs` of the one package `@intellectual-frontiers/commons` (`single` mode, the mode of this repository, where `@intellectual-frontiers/docs` does not exist), then as the package `@intellectual-frontiers/docs` (`per-library` mode); the first that is installed and exports `main` MUST be used, and a repository that has the one package MUST NOT be asked to install another. The explanation and the fix of `E-DOCS-GENERATOR-MISSING` MUST name both places and say which mode each is for, and say that the generator's own optional peers (`shiki`, `beautiful-mermaid`, `typescript`) are the consumer's to install, as the generator names them when one is missing.

## Acceptance scenarios

1. **Given** a configuration with `docs`, **When** the help is read, **Then** `docs build`, `serve` and `check` are listed, per FR-001.
2. **Given** a repository with no installed generator, **When** `docs check` runs, **Then** it ends with 1 and `E-DOCS-GENERATOR-MISSING`, per FR-002.
3. **Given** a generator installed in the fixture repository, **When** `docs build` runs, **Then** it is asked for `build --out <root>/_site --config <root>/docs.config.ts` and the site is there, per FR-002.
4. **Given** a generator that ends with 3, **When** `docs check` runs, **Then** `E-DOCS-FAILED`, per FR-003.
5. **Given** a built folder, **When** it is served on port 0, **Then** `/` answers its `index.html`, a missing path 404, and the address is a loopback one, per FR-004.
6. **Given** a repository whose `node_modules` holds the one package `@intellectual-frontiers/commons` with the entry `./docs` and no `@intellectual-frontiers/docs`, **When** `docs build` runs, **Then** the generator of the one package is asked for `build --out <root>/_site --config <root>/docs.config.ts`, per FR-005.
7. **Given** a repository with neither, **When** `docs check` runs, **Then** the problem names the one package for `single` mode and `@intellectual-frontiers/docs` for `per-library` mode, per FR-005.

## Out of scope

- The generator itself and its lenses: commons 0011-documentation.

## Edge cases

- A port that is not a number from 0 to 65535: a usage error (2), per FR-004.
- A build that fails before serving: nothing is served, per FR-004.

## Assumptions

- The generator package exports `main(argv)` that returns the exit status of the `ifc-docs` command line.

## Open questions

- None.

## Key entities

- **Docs settings** - the configuration file of the generator and the folder of the site.

## Success criteria

- **SC-001**: A repository that installs the generator builds, checks and previews its site with one command.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT)
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
