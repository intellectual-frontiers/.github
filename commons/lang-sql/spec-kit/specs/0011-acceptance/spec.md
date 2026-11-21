# Feature Specification: Acceptance utilities, sqlfs and sqlfind

**Spec ID:** 0011-acceptance
**Status:** Active
**Owner:** if
**Domain:** lang-sql

**Input:** A library is accepted when what it is for is done by something real. `acceptance/` holds two utilities that are useful in themselves and are the acceptance tests of the language, of its introspection and of aide, and demos: `sqlfs` searches a file system with SQL and runs the query in this process; `sqlfind` is the same language compiled to a `find` command. They share one language, one catalog and one fixture, so that the three ways of answering one query (the process, the `find` of the system, a table in memory) must agree.

## The language of both

- **FR-001**: The dialect `sqlfs` MUST be the common ground of SQL with the like-words `GLOB` and `ILIKE`, the units `B`, `KB`, `MB`, `GB` (1024 in each step) and `S`, `M`, `H`, `D`, `W` (seconds), and the functions `now()`, `lower`, `upper`, `length`, `basename`, `dirname`, `regexp(text, pattern)` and `glob(text, pattern)`; the profile MUST be the queries of one table, `files`, with no join, no aggregate and no subquery, whose columns are `name` (text), `path` (text, relative to the root, with `/`), `ext` (text, without the dot), `kind` (`f`, `d` or `l`), `size` (int, bytes), `mtime` (timestamp, seconds since the epoch), `mode` (int), `owner` (text) and `depth` (int, 1 for a file in the root).
- **FR-002**: A query MUST be read, conformed to the profile, bound, typed and planned by aide (`src/aide/`); an error at any step MUST be an error value with a span and a sentence, and each utility MUST print it with the line and the caret.

## sqlfs

- **FR-003**: `sqlfs` MUST run a query over a file system given as an interface (a walk of entries with a name, a path, a kind, a size, a modification time, a mode, an owner and a depth), pruning a directory whose path and depth the filter shows to be out of reach where it can, and MUST give the same rows as the same query over an in-memory table of the entries; its command MUST read `sqlfs [--root DIR] [--explain] [--format table|json|paths] 'SELECT ...'`.

## sqlfind

- **FR-004**: `sqlfind` MUST compile a query to the argument list of a `find` command (never a shell string): the root, `-mindepth` and `-maxdepth` from `depth`, `-type` from `kind`, `-name` and `-iname` from `name` and `ext` and the equality and `LIKE` and `GLOB` of them, `-path` from `path`, `-size` in bytes (`-size +Nc`) from `size`, `-newermt` from `mtime`, `-user` from `owner`, `-perm` from `mode`, with `-a`, `-o`, `!` and parentheses for `AND`, `OR` and `NOT`, and `-print0`; a condition that `find` cannot say MUST be left to the process, so that the rows are the same as those of `sqlfs`.
- **FR-005**: `find` MUST be given as a flavor, `gnu` or `bsd`: the GNU flavor reads the columns of the rows from `-printf`, the BSD flavor from `-print0` and a `lstat` of each path in the process; the argument list MUST contain none of `-exec`, `-execdir`, `-ok`, `-okdir`, `-delete`, `-fprint`, `-fprint0`, `-fprintf`, `-fls`, whatever the query holds, and a test MUST prove it for hostile values.
- **FR-006**: `sqlfind --explain` and `sqlfs --explain` MUST print the plan, what is pushed and what is residual; `sqlfind --emit argv|shell` MUST print the argument list as JSON or as one line quoted for a POSIX shell.

## Acceptance

- **FR-007**: For each query of a table of queries (the automated acceptance, AAT), over a fixture tree that a function builds the same way every time (names with spaces, newlines, quotes and glob characters, a symlink, a hidden directory, files of many sizes and times), the rows of `sqlfs` over the real directory, of `sqlfs` over the in-memory table, and of `sqlfind` through the real `find` of the system MUST be the same, ordered the same; the GNU flavor is run where the `find` of the system is GNU, and the argument lists of both flavors are held by golden files in `acceptance/demos/`, the BSD one being the only check of that flavor where the system has no BSD `find`.
- **FR-008**: The operational acceptance (OAT) MUST prove, for each utility: the exit status (0 for a query that runs, 1 for a query that is wrong, 2 for a usage error, a root that is not a directory being one); that an unreadable directory does not stop the run and is reported as a warning, and that a symbolic link that loops is listed and not followed; that a result limit of the command (`--max-rows`, 10000 by default) and a depth limit (`--max-depth`, 64 by default) apply and the first is reported; that a hostile value in a query changes no more than its own condition; and that a tree of ten thousand entries is searched in under ten seconds.
- **FR-009**: The user acceptance (UAT) MUST be a table of scenarios, each a sentence a person would say, the query that answers it and the paths it must give over the fixture; the demos MUST be the transcripts of the scenarios, generated into `acceptance/demos/` by `bun acceptance/demos.ts` (which also writes, for each flavor of `find`, the command that sqlfind makes of each query of the automated acceptance), and a test MUST fail where a file is not what the utilities print.

## Out of scope

- Joins, aggregates and a store other than the file system; publishing these utilities as packages.

## Edge cases

- A query whose filter folds to `FALSE`: no rows and no walk, per FR-003.
- `ORDER BY` with `LIMIT`: done in the process, over the rows `find` gives, per FR-004.

## Assumptions

- The fixture has no entry younger than its own creation; times in the fixture are set with `utimes`.
- `find` in this environment is GNU's; the BSD flavor is checked by golden argument lists and by a real BSD `find` only where one is the system's.

## Open questions

- None.

## Key entities

- **Language** - the dialect, profile and catalog both utilities share.
- **Fixture** - the tree every acceptance runs over.
- **Scenario** - a sentence, a query and the paths that answer it.

## Success criteria

- **SC-001**: Three independent ways of answering one query agree on a hostile tree.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
