# Feature Specification: Repoctl configuration

**Spec ID:** 0009-repoctl-config
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `repoctl` is a generic host: everything it knows of the repository it operates is in a typed `repoctl.config.ts` at the repository's root. This specification is the shape of that file, how it is found and read, and what each part of it decides.

## Requirements

- **FR-001**: The Governance layer MUST export `defineConfig`, the one way a configuration is written (it checks the shape and is the identity), and `parseConfig`, the one way the host reads one: from the input to the configuration as a `Result`, every identity (a generator or check id, the name of a variable) made by its smart constructor, every default filled, and, where it is wrong, every reason listed at once: an id used twice, a generator that waits for one that is not there, a capability that needs `libraries`, a trailer named twice, a regular expression that does not compile, a path that leaves the repository.
- **FR-002**: The host MUST find the configuration at `--config FILE`, else at the first `repoctl.config.ts` from the working folder up to the root of the Git checkout, MUST take the folder of the file as the repository's root, MUST import it (its default export, else its export `config`) on Bun and on Node 26, and MUST give each way it can fail a typed problem: `E-CONFIG-MISSING` where there is none, `E-CONFIG-LOAD` where it cannot be imported or exports no configuration, `E-CONFIG-INVALID` where `parseConfig` refuses it. A verb that needs the configuration MUST end with 3 and that problem; `help`, `explain` and `doctor` MUST run without one, and `doctor` MUST report it.
- **FR-003**: A generator MUST be declared with an id, a command (an argument vector run from the root with no shell between, or a typed function), its check (the command with `--check` added where it is not given; a function gives its own), the globs of its inputs and outputs, the generators it declares to come after and the outputs that also hold text a person wrote; a check MUST be declared with an id, a command or function and the problem code of its findings (`E-CHECK-FAILED` where it names none). `sync` MUST order the generators after those they declare and after those whose outputs they read, `check` MUST report each generator and each named check as a section, and `merge` MUST know a generated file by the generators. The host MUST hold no generator and no check.
- **FR-004**: The commit rules MUST be the configuration's: the identity of the author and the committer, the issue reference (a prefix such as `Refs #` and whether it is required), the trailers in order (`issue`, `co-author`, `session`), the line that credits the agent (from `--co-author`, the variable `REPOCTL_CO_AUTHOR`, else the configuration's), the globs of paths that must not be committed with the globs that are allowed though they match, and the patterns of texts that look like secrets. The Governance layer MUST export the defaults a configuration may spread (`DEFAULT_FORBIDDEN_PATHS`, `DEFAULT_ALLOWED_PATHS`, `DEFAULT_SECRET_PATTERNS`).
- **FR-005**: The hygiene policy MUST be the configuration's: the scope of the family's packages, the fragments that name its own repository in a Git dependency, the folder name a path dependency or a relative import must not go through, the file whose presence says the repository is the family's own, and the allowances (globs of dependency paths, names of packages). A configuration with no hygiene policy has no `hygiene` verb.
- **FR-006**: The doctor policy (the least major version of Node, the file and variable that pin Bun, the folder under which libraries are linked and the program that links them, the command that installs) and the names of the variable that fixes the tier and of the one that says a tool server may only read (`REPOCTL_TIER` and `REPOCTL_READ_ONLY` by default) MUST be the configuration's, and a repository that names none MUST be checked for Git, installed dependencies and its generated files alone.

## Acceptance scenarios

1. **Given** a configuration with two generators that declare each other in `after`, **When** it is read, **Then** it is refused with `E-CONFIG-INVALID` naming both, per FR-001.
2. **Given** a folder with a `repoctl.config.ts` two folders above the working folder, **When** `repoctl check` runs, **Then** it runs in the folder of the file, per FR-002.
3. **Given** no configuration, **When** `repoctl check` runs, **Then** it ends with 3 and `E-CONFIG-MISSING`, and `repoctl doctor` names it, per FR-002.
4. **Given** a generator that is a typed function, **When** `sync --check` runs, **Then** it is checked through the function, per FR-003.
5. **Given** a configuration whose trailers are `issue` alone and whose prefix is `Refs #212`-style, **When** `commit` runs, **Then** the message has that line and no other trailer, per FR-004.
6. **Given** a configuration with no hygiene policy, **When** `repoctl --help` runs, **Then** `hygiene` is not listed, per FR-005.

## Out of scope

- The release, the scaffold of a library and the proof by blast radius: their settings are in 0010-repoctl-host.

## Edge cases

- A generator whose command is a function and that gives no check: refused, per FR-003.
- A configuration that exports a value that is not a configuration: `E-CONFIG-LOAD`, per FR-002.
- `--config` that names a file that is not there: `E-CONFIG-MISSING`, per FR-002.

## Assumptions

- The repository's configuration is code of the repository and is trusted as the code of its other tools is.

## Open questions

- None.

## Key entities

- **Config** - the typed, checked description of one repository.
- **Generator** - a program or function that makes files, with its check, inputs and outputs.
- **Check** - a named program or function whose findings are lines.

## Success criteria

- **SC-001**: A repository needs one file of data to be operated by `repoctl`, and the host names none of its facts.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT)
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
