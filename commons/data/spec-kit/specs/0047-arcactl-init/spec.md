# Feature Specification: arcactl init and its two models

**Spec ID:** 0047-arcactl-init
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** `arcactl init` does not initialise a database: it initialises a person's workspace, the DBA's or the developer's, so that `arcactl` can be used from it: the files `psql` and libpq read (`.pgpass`, `pg_service.conf`, `.psqlrc`), the instances the person can reach, and the profiles of the shells that source `arcactl shell`. Two models of running underlie it. The workstation is a person at a terminal, whose files are written with their agreement. The server is a pipeline, a container or a scheduled job, where nothing is asked, no home file is written and every secret is given by the environment. This part is those two models, the machinery that changes a person's files safely, and the script `arcactl shell` prints; discovery, the `init` flows and the workstation checks of `doctor` follow in later requirements.

## Requirements

- **FR-001**: The workstation model MUST say, from a platform and an environment and without touching a file, where a person's files are on Linux, macOS and Windows: `.pgpass`, `pg_service.conf` and `psqlrc` by libpq's rules (its own variables `PGPASSFILE`, `PGSERVICEFILE` and `PSQLRC` first), the directories of `arcactl`'s settings, cache and state, the file of `psql` that `arcactl` owns, and the profile files of bash, zsh, fish, PowerShell, nushell and `sh`; and MUST say that the home directory is not known where it is not.
- **FR-002**: A managed block MUST be the only way `arcactl` changes a file that a person also edits: putting a block in twice MUST be the same as once; it MUST replace itself where it is there and leave everything outside its markers as it was, and keep the file's line ending; taking it out MUST leave the file as it was; and a file whose markers make no sense (one missing, out of order, or the block twice) MUST be an error value and MUST NOT be changed.
- **FR-003**: A change of a file MUST be planned as a value (what the file is, what it would be, the difference) before it is made; making it MUST write a temporary file and rename it over, keep the file's mode (a new file the mode asked for, `0600` for a password file) and keep a copy of the first version, write through a symbolic link and keep the link, write nothing where there is nothing to change, and refuse a directory.
- **FR-004**: The server model MUST be chosen by an option (`--non-interactive`, `--interactive`) or `ARCA_MODE` first, then by the environment (`CI` and the variables of the common CI systems), and only where none says, by whether there is a terminal; a server MUST write no file of a home directory and ask no question.
- **FR-005**: A server run MUST be given its secrets (the connection URL, the seal key, the unlock secret) as a variable or as the file a `<NAME>_FILE` variable names, MUST refuse both at once and a file that cannot be read, MUST NOT take a line ending at the end of a file as part of a secret, and MUST NOT print a password it was given either way.
- **FR-006**: `arcactl shell` MUST print one script, for bash, zsh, fish, PowerShell, nushell or `sh`, made from its input alone: the `ARCA_*` variables, `PGSERVICE`, and `PGOPTIONS` with the search path, each value quoted by the rules of its shell so that any text arrives as it is and nothing in it is run; `PGOPTIONS` MUST stay a person's own where they have set it; the script MUST hold no password and MUST be refused input that has one, or a name that is not safe; and the command MUST connect to nothing, write nothing, name the shell it is for, and give the same script each time.
- **FR-007**: The script MUST define `arca`, `arca-doctor`, `arca-psql`, `arca-use` and `arca-off` (and `arca-prompt` where asked) that call `arcactl` or `psql` with their arguments as they are, and completions of the commands, their options and their values made from the one table of commands; sourcing it twice MUST be the same as once; `arca-off` MUST take away what the script set and its functions and MUST leave a person's own variables; and `arca-use` MUST switch the instance without carrying the label or the service of the last instance over.
- **FR-008**: The writer of `.pgpass` MUST write each credential as libpq reads it (a colon and a backslash escaped, a lone `*` a wildcard) inside a managed block of a file made `0600`; MUST replace the password of a place that is there where it is, add a new place at the end, and take one out, without touching the credentials of other places or a line the person wrote; MUST say where a line of the person's own that matches comes before the block, since libpq reads the first that matches; MUST find a file whose mode libpq would ignore (the group or others can read it) and put it right; MUST refuse a password or field that `.pgpass` cannot hold, and MUST NOT print a password in an error.
- **FR-009**: The writer of `pg_service.conf` MUST write the instances it is given as the services of a managed block (host, port, `dbname`, user, `sslmode`, and the search path as `options`), read them back, refuse an instance that is not valid and a service the person defined outside the block (libpq reads the first, so the one written would be ignored), and take the block out where it is given none.
- **FR-010**: The writer of `psqlrc` MUST write a file of its own (the prompt naming the instance, display settings, and the helper queries `:tables`, `:invariants`, `:guard` and `:audit`) that makes no output at start, and a managed block in the person's `psqlrc` that includes it by an absolute path with forward slashes; and an undo MUST take every block and credential of these writers out and leave the person's own lines as they were.
- **FR-011**: Discovery MUST find the instances a person can reach from the connection they gave (its password dropped), libpq's environment, the services of `pg_service.conf`, the hosts `.pgpass` has passwords for, what `arcactl` remembers (its state file, which holds no password), and, where asked, PostgreSQL on this machine; MUST make one of a place heard of twice, naming it by its service; MUST NOT take a wildcard host or a service with no host; and MUST find the `arca.config.ts` files in an Ergonex workspace (`ERGONEX_HOME`), leaving out `node_modules`, `.git`, `.worktrees` and `dist`.
- **FR-012**: Looking at an instance MUST read and change nothing, and MUST say whether it is reached, as whom, what that role could do to it (read, migrate, or migrate and guard, from its being a superuser and its right to create in the schema or the database) and which arca models its tables hold in full; a password MUST go only to the host it is written for (never by a wildcard line) and MUST NOT be in anything said of a failure.
- **FR-013**: `arcactl init` MUST set up a workstation and no database: show every change it would make (the passwords of `.pgpass` not shown) and make them only where agreed (`--yes`, or a person's yes), write nothing on `--dry-run` or where it is declined or there is no one to ask, change nothing the second time, leave a person's own lines, a service of their own that it would use and what other tools wrote, take away with `--undo` only what it put in, refuse a server run, refuse an option, model, name, shell or password it cannot use before it writes anything, refuse a file whose markers are broken without changing any file, never put a password anywhere but `.pgpass`, and end by running the checks of the workstation.
- **FR-014**: The script of `arcactl shell` for the default instance MUST be kept in a cache file of `arcactl`'s, and a managed block `arcactl:shell` in the profile of each shell wanted MUST source it only where it is readable, so that a shell whose cache is gone starts without an error; the block MUST be a different block from Ergonex's, and both MUST be able to be in one profile.
- **FR-015**: The checks of the workstation (`ARCA-W001` to `ARCA-W006`: `psql` and its version, the password file and its mode, the default instance's service, the psql files, each profile's block and the cache it sources being the script as it would be made now, and the default instance being reached) MUST each say pass, warn, fail or that they could not be made, and what to do; `arcactl doctor --scope workstation` (and `--scope all`, with the checks of the database) MUST run them, and a server run MUST refuse them.

## Out of scope

- `arcactl ensure`, which keeps a database and its migrations current: its own specification.
- Looking for PostgreSQL by a Unix socket, in containers or in a cloud: only TCP, the places above and `127.0.0.1:5432` where asked.
- Putting `arcactl` on the path or installing it: Ergonex's and the package manager's.
- The password prompt: the writers are given a password and write it to `.pgpass` alone; where it comes from (a prompt without echo, standard input) is `init`'s.
- The helper file needs `psql` 15 or later (`\\getenv`); an older `psql` shows an error at start.
- `arca-scope` (a sealed scope for the shell): it needs a command that makes the mark, and comes with it.
- The completions of zsh, PowerShell and nushell are checked for syntax only (zsh needs a completion system loaded); fish's and bash's are run.
- A real home directory in the tests: every file is in a temporary directory, and each platform's rules are tested as a function.

## Edge cases

- A person in an Ergonex workspace: `ERGONEX_HOME` is searched for `arca.config.ts`, and the profile holds Ergonex's block and ours, per FR-011 and FR-014. (Ergonex replaced IFWS, the earlier workspaces tool, which is retired.)
- A service of the person's own with the instance's name: it is used and not written over, per FR-013.
- A role that cannot create in the database or the schema: the instance is read only, per FR-012.
- A shell whose cache file was removed: it starts, and `doctor` says the cache is missing, per FR-014 and FR-015.
- A password with a colon, a backslash, a quote or a space: written escaped, and read back exactly by the real libpq, per FR-008.
- A `.pgpass` of mode `0644`: libpq says it has group or world access and ignores it; the writer puts the mode right, per FR-008.
- A service the person already has, with the name of an instance: refused, and the file is not changed, per FR-009.
- PGlite served over a socket ignores the `options` startup parameter, so the search path from `options` is seen in the file and not in a PGlite session, per FR-009.
- A value with a quote, a `$`, a backtick or a line ending in a path: it arrives as it is, per FR-006.
- A person who has their own `PGOPTIONS`: it is kept, and `arca-off` does not remove it, per FR-006 and FR-007.
- `sh` (dash) has no function name with a dash: it gets `arca_doctor` and the rest with underscores, per FR-007.
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
