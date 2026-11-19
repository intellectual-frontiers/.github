# Feature Specification: arcactl init and its two models

**Spec ID:** 0047-arcactl-init
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** `arcactl init` does not initialise a database: it initialises a person's workspace, the DBA's or the developer's, so that `arcactl` can be used from it: the files `psql` and libpq read (`.pgpass`, `pg_service.conf`, `.psqlrc`), the instances the person can reach, and the profiles of the shells that source `arcactl shell`. Two models of running underlie it. The workstation is a person at a terminal, whose files are written with their agreement. The server is a pipeline, a container or a scheduled job, where nothing is asked, no home file is written and every secret is given by the environment. This first part is those two models and the machinery that changes a person's files safely; discovery, the `init` flows, the shell script and the workstation checks of `doctor` follow in later requirements.

## Requirements

- **FR-001**: The workstation model MUST say, from a platform and an environment and without touching a file, where a person's files are on Linux, macOS and Windows: `.pgpass`, `pg_service.conf` and `psqlrc` by libpq's rules (its own variables `PGPASSFILE`, `PGSERVICEFILE` and `PSQLRC` first), the directories of `arcactl`'s settings, cache and state, the file of `psql` that `arcactl` owns, and the profile files of bash, zsh, fish, PowerShell, nushell and `sh`; and MUST say that the home directory is not known where it is not.
- **FR-002**: A managed block MUST be the only way `arcactl` changes a file that a person also edits: putting a block in twice MUST be the same as once; it MUST replace itself where it is there and leave everything outside its markers as it was, and keep the file's line ending; taking it out MUST leave the file as it was; and a file whose markers make no sense (one missing, out of order, or the block twice) MUST be an error value and MUST NOT be changed.
- **FR-003**: A change of a file MUST be planned as a value (what the file is, what it would be, the difference) before it is made; making it MUST write a temporary file and rename it over, keep the file's mode (a new file the mode asked for, `0600` for a password file) and keep a copy of the first version, write through a symbolic link and keep the link, write nothing where there is nothing to change, and refuse a directory.
- **FR-004**: The server model MUST be chosen by an option (`--non-interactive`, `--interactive`) or `ARCA_MODE` first, then by the environment (`CI` and the variables of the common CI systems), and only where none says, by whether there is a terminal; a server MUST write no file of a home directory and ask no question.
- **FR-005**: A server run MUST be given its secrets (the connection URL, the seal key, the unlock secret) as a variable or as the file a `<NAME>_FILE` variable names, MUST refuse both at once and a file that cannot be read, MUST NOT take a line ending at the end of a file as part of a secret, and MUST NOT print a password it was given either way.

## Out of scope

- Discovery and probing of instances, the `init` flows, the generated shell script, the writers of `.pgpass`, `pg_service.conf` and `.psqlrc`, and the workstation checks of `doctor`: later requirements of this specification.
- `arcactl ensure`, which acts on a database: its own specification.
- A real home directory in the tests: every file is in a temporary directory, and each platform's rules are tested as a function.

## Edge cases

- A Windows user whose Documents folder is redirected (OneDrive): the PowerShell profile can be named by `ARCACTL_PWSH_PROFILE`, per FR-001.
- A dotfile manager that links `.zshrc` into a repository: the link is kept and the file it leads to is written, per FR-003.
- A file with an opening marker and no closing one: an error value, and the file is not changed, per FR-002.
- A file that ends with no line ending: one is added when the block is put in, so taking the block out restores it up to that line ending, per FR-002.
- `CI=false`: it is not a CI, per FR-004.
- Both `ARCA_DATABASE_URL` and `ARCA_DATABASE_URL_FILE`: refused, per FR-005.

## Assumptions

- libpq ignores a password file that the group or others can read, so `arcactl` makes it `0600`.
- A secret in a file has no line ending of its own: the one an editor or `echo` adds is not part of it.

## Open questions

- **OQ-1**: Whether the server model should read the secrets of a secret manager (Vault, a cloud's) directly; now it reads a variable or a file, which a sidecar or the platform provides.

## Key entities

- **Managed block** - the lines between two marker lines that name `arcactl` and the block.
- **Change** - a planned change of one file, before it is made.
- **Mode** - workstation or server.

## Success criteria

- **SC-001**: Running `arcactl` setup twice on a machine leaves every file as it was after the first, and removing it leaves every file as it was before; and a pipeline runs the same commands with nothing asked and no file of a home directory written.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
