# Feature Specification: Repoctl host and capabilities

**Spec ID:** 0010-repoctl-host
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `repoctl` is published as a package (bin `repoctl`, a typed API) that any repository installs from npm. Its host knows no repository: what a repository may do beyond the verbs every one has is a capability its configuration turns on.

## Requirements

- **FR-001**: The host (the Governance, Logical and Physical layers outside the capabilities that read a family of library manifests) MUST name no repository: no folder of one, no table, no library, no scope. The facts of the repository of Intellectual Frontiers Commons MUST be in the `repoctl.config.ts` at its root, and a test MUST find no quoted path of that repository in the source of the host.
- **FR-002**: The verbs every repository has are `check`, `sync`, `merge`, `commit` and `doctor`. The capabilities MUST be flags of the configuration: `release` (`release plan`, `apply` and `publish`), `newLibrary` (`new library`), `status` (`status` of the packages) and `prove` (`prove`), each of which needs `libraries`, the settings of the family of library manifests (the folder, the programs that judge a specification kit, whether version constants are checked, the program that links the libraries and the file that classifies them by role); `hygiene` MUST be present where there is a hygiene policy and `docs` where there are docs settings. A verb whose capability is off MUST NOT be in the help, in the tool server or in the program, and running it MUST end with 2.
- **FR-003**: The package MUST be published with the bin `repoctl`, compiled ESM and declarations through the packer of commons, and the entry `.` MUST export `main` (the host), `defineConfig`, `parseConfig`, the types of the configuration and the building blocks of the verbs (`governance`, `logical` and `physical` as namespaces); the license MUST be the generated one. The package installed into a scratch project MUST run `repoctl --help` and `repoctl doctor` with no network and no configuration. In `single` distribution mode (commons libraries 0001-libraries FR-028 to FR-032) the package that holds Repoctl MUST be `@intellectual-frontiers/commons`, whose `bin` map MUST name `repoctl` and whose export `./repoctl` MUST be this entry, and the installed tarball MUST run the two commands; the package of Repoctl alone is that of `per-library` mode (`IFC_DISTRIBUTION=per-library`).
- **FR-004**: A library held out of the release (commons libraries 0001-libraries FR-024) MUST show as `held` in `status`, with no npm cell and no tag.

## Acceptance scenarios

1. **Given** the source of the host, **When** it is read, **Then** no quoted path of the repository of commons is in it, per FR-001.
2. **Given** a configuration with `capabilities: { status: true }` and `libraries`, **When** the help is read, **Then** `status` is listed and `release` is not, per FR-002.
3. **Given** a configuration with `release: true` and no `libraries`, **When** it is read, **Then** it is refused with `E-CONFIG-INVALID`, per FR-002.
4. **Given** the packed tarball installed into an empty project, **When** `repoctl --help` and `repoctl doctor` run offline, **Then** the help lists the verbs and the doctor says there is no configuration, per FR-003.
5. **Given** a held library, **When** `status` runs, **Then** its state is `held`, per FR-004.

## Out of scope

- Publication of the package to npm: the owner's act (`repoctl release publish`).

## Edge cases

- `prove` on a repository whose library layout is not that of `@intellectual-frontiers/libraries`: it is the capability of that layout and is left off, per FR-002.
- A scratch project with no `.git`: the doctor says so as a warning of Git, per FR-003.

## Assumptions

- The capabilities that read library manifests use the layout `<folder>/<name>/library.ts` as `@intellectual-frontiers/libraries` defines it.

## Open questions

- None.

## Key entities

- **Host** - the program that loads a configuration and runs the verbs.
- **Capability** - a flag of the configuration that turns on a verb that only some repositories have.

## Success criteria

- **SC-001**: A repository of any kind installs the package, writes a configuration and runs `check`, `sync`, `commit` and `merge`.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT)
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
