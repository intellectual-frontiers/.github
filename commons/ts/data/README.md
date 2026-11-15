# IFC SQL Aide, Arca and Data Vault

The data libraries of Intellectual Frontiers Commons, specified by [`0009-sql-aide`](../../spec-kit/specs/0009-sql-aide/spec.md) and built on
[IFC TypeScript](../README.md)'s kernel. SQL Aide is a SQL generator first and a database client second: a schema is written once as TypeScript algebraic types and rendered as
SQL for PostgreSQL, SQLite and DuckDB. It replaces `netspective-labs/sql-aide`.

| Folder                             | What it is                                                                                                                                        | May import                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`sql-aide/`](sql-aide/mod.ts)     | The library: domains, columns and tables whose row types are computed; dialects whose features the compiler knows; the `SQL` template; lint; TAP. | `sql-aide/`, the kernel; `sql-aide/runtime/` the runtime |
| [`arca/`](arca/mod.ts)             | Arca, the typical data models: the party model first.                                                                                             | `arca/`, `sql-aide/mod.ts`                               |
| [`data-vault/`](data-vault/mod.ts) | Data Vault: hubs, satellites and links as generic functions.                                                                                      | `data-vault/`, `sql-aide/mod.ts`                         |
| [`suite/`](suite/)                 | The tests, with committed SQL (`golden/`) for every dialect; not named `tests/`, which is IFC TypeScript's own suite and what its jobs run.       | anything here                                            |

## Use it

```ts
import { context, date, definitions, fk, pk, postgres, render, type RowOf, sqlite, table, text } from "./sql-aide/mod.ts";

const party = table("party", { party_id: pk.ulid(), name: text() });
const person = table("person", { party_id: fk(party.c.party_id).primaryKey(), born: date().nullable() });

type Person = RowOf<typeof person>; // { readonly party_id: Brand<string, "party">; readonly born: string | null }
render(definitions([person, party]), context({ dialect: postgres() })); // CREATE TABLE "party" ...; CREATE TABLE "person" ...
render(definitions([person, party]), context({ dialect: sqlite() })); // the same model, as SQLite writes it
```

What a dialect lacks does not compile where the model is rendered for it: a table with an array column renders for PostgreSQL and DuckDB and is a type error for SQLite.

## Work here

```sh
cd commons/ts && bun install --frozen-lockfile        # IFC TypeScript: TypeScript 7 and the kernel's tools
cd data && bun install --frozen-lockfile              # DuckDB, PGlite and pg, for the tests only: the libraries have no dependency
bun run verify                                        # tsc 7, the documentation maps, every test under Bun
bun run test:node                                     # the same tests under Node 26
bun run docs                                          # write arca/party.docs.auto.ts again after changing a TSDoc comment
IFCSQL_UPDATE_GOLDEN=1 bun test suite/                # write the committed SQL again, then read the diff
IFCSQL_PG_URL=postgres://... bun test suite/          # also on a PostgreSQL server: each test makes a database and drops it
(cd .. && bun fmt)                                    # the formatter of commons/ts
```

## What is here, and what is not yet

The specification's requirements each have a row in [`enforcement.tsv`](../../spec-kit/enforcement.tsv) that names its test or says which phase finishes it.

| Phase | What                                                                                                             | State   |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------- |
| 1     | Algebra, dialects, the `SQL` template and its two renderings, naming, hooks, governance, TSDoc maps, TAP         | here    |
| 2     | Views, typed indexes and partitions, PostgreSQL objects, tests inside the database                               | here    |
| 3     | Typed routines, triggers, policies, DuckDB macros                                                                | here    |
| 4     | Integrations: seed rows, CSV through DuckDB, attached databases, adapters; four strategies; lineage; vault loads | here    |
| 5     | ISLM                                                                                                             | not yet |
| 6     | Query builder                                                                                                    | not yet |
| 7     | Transforms                                                                                                       | not yet |
| 8     | Driver adapters                                                                                                  | not yet |
| 9     | Generators, the command line, plugins                                                                            | not yet |

### Limits, said plainly

- Integrations (phase 4): a load is a script the caller runs whole; it begins no transaction, so a `replace` or `snapshot` that fails
  halfway leaves what it did unless the caller wraps it in one. Files are read only by DuckDB (`read_csv`); PostgreSQL's `COPY` is not
  used. An attached database is a file of the same engine: DuckDB attaching SQLite or PostgreSQL needs an extension it would download,
  and is not tested. Lineage covers integrations and Data Vault's loads; transforms add theirs in phase 7.
- Data Vault's loads key a hub by its business key as text, not by a hash (open question OQ-3), and number a satellite's states with
  nine digits; a landing relation should hold one state of a key in one load.

## File Aide, specified and not built yet

File Aide is SQL Aide's peer for stores of files, specified by [`0010-file-aide`](../../spec-kit/specs/0010-file-aide/spec.md): a store's layout written once as
TypeScript algebraic types, drivers for memory, a folder and an S3-compatible bucket behind one interface, checks of a store against its layout, and a small SQL-like query
language compiled into a function that walks a store as `fd` does, honouring `.gitignore` and `.faignore`. It lives in `file-aide/`, and the layout that accepts it, the IF Renditions File System (IFRFS, the
folder erga's `publication sync` fills), in `ifrfs/`. Each of its
requirements has a row in [`enforcement.tsv`](../../spec-kit/enforcement.tsv) naming the phase that finishes it.

| Phase | What                                                                                                 | State   |
| ----- | ---------------------------------------------------------------------------------------------------- | ------- |
| 1     | Segments, path patterns and their laws, entries, layouts, names                                      | not yet |
| 2     | The store interface, the `memory` and `posix` drivers, the conformance suite                         | not yet |
| 3     | Queries: the builder, the text form, the planner, the compiler, `explain`, ignore files, `fd` parity | not yet |
| 4     | The `s3` driver, the local S3 server, tests against real providers                                   | not yet |
| 5     | Checks and recipes, and stores that fail on purpose                                                  | not yet |
| 6     | With SQL Aide: the file-reference domain and listings as a source; IFRFS end to end                  | not yet |
