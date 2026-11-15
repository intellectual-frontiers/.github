# IFC SQL Aide, Arca and Data Vault

The data libraries of Intellectual Frontiers Commons, specified by [`0006-sql-aide`](../../spec-kit/specs/0006-sql-aide/spec.md) and built on
[IFC TypeScript](../README.md)'s kernel. SQL Aide is a SQL generator first and a database client second: a schema is written once as TypeScript algebraic types and rendered as
SQL for PostgreSQL, SQLite and DuckDB. It replaces `netspective-labs/sql-aide`.

| Folder                             | What it is                                                                                                                                        | May import                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`sql-aide/`](sql-aide/mod.ts)     | The library: domains, columns and tables whose row types are computed; dialects whose features the compiler knows; the `SQL` template; lint; TAP. | `sql-aide/`, the kernel; `sql-aide/runtime/` the runtime |
| [`arca/`](arca/mod.ts)             | Arca, the typical data models: the party model first.                                                                                             | `arca/`, `sql-aide/mod.ts`                               |
| [`data-vault/`](data-vault/mod.ts) | Data Vault: hubs, satellites and links as generic functions.                                                                                      | `data-vault/`, `sql-aide/mod.ts`                         |
| [`tests/`](tests/)                 | The suite, with committed SQL (`golden/`) for every dialect.                                                                                      | anything here                                            |

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
IFCSQL_UPDATE_GOLDEN=1 bun test tests/                # write the committed SQL again, then read the diff
IFCSQL_PG_URL=postgres://... bun test tests/          # also on a PostgreSQL server: each test makes a database and drops it
(cd .. && bun fmt)                                    # the formatter of commons/ts
```

## What is here, and what is not yet

The specification's requirements each have a row in [`enforcement.tsv`](../../spec-kit/enforcement.tsv) that names its test or says which phase finishes it.

| Phase | What                                                                                                     | State   |
| ----- | -------------------------------------------------------------------------------------------------------- | ------- |
| 1     | Algebra, dialects, the `SQL` template and its two renderings, naming, hooks, governance, TSDoc maps, TAP | here    |
| 2     | Views, typed indexes and partitions, PostgreSQL objects, tests inside the database                       | here    |
| 3     | Typed routines, triggers, policies, DuckDB macros                                                        | not yet |
| 4     | Integrations                                                                                             | not yet |
| 5     | ISLM                                                                                                     | not yet |
| 6     | Query builder                                                                                            | not yet |
| 7     | Transforms                                                                                               | not yet |
| 8     | Driver adapters                                                                                          | not yet |
| 9     | Generators, the command line, plugins                                                                    | not yet |
