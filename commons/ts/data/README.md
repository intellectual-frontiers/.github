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

| Phase | What                                                                                                              | State   |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------- |
| 1     | Algebra, dialects, the `SQL` template and its two renderings, naming, hooks, governance, TSDoc maps, TAP          | here    |
| 2     | Views, typed indexes and partitions, PostgreSQL objects, tests inside the database                                | here    |
| 3     | Typed routines, triggers, policies, DuckDB macros                                                                 | here    |
| 4     | Integrations: seed rows, CSV through DuckDB, attached databases, adapters; four strategies; lineage; vault loads  | here    |
| 5     | ISLM: catalogs read, plans classified, an append-only ledger in the database, undo, script, lint, teardown        | here    |
| 6     | Query builder: joins by foreign key, projections, CTEs, set operations, insert, update, delete, returning, upsert | here    |
| 7     | Transforms                                                                                                        | not yet |
| 8     | Driver adapters                                                                                                   | not yet |
| 9     | Generators, the command line, plugins                                                                             | not yet |

### Limits, said plainly

- Integrations (phase 4): a load is a script the caller runs whole; it begins no transaction, so a `replace` or `snapshot` that fails
  halfway leaves what it did unless the caller wraps it in one. Files are read only by DuckDB (`read_csv`); PostgreSQL's `COPY` is not
  used. An attached database is a file of the same engine: DuckDB attaching SQLite or PostgreSQL needs an extension it would download,
  and is not tested. Lineage covers integrations and Data Vault's loads; transforms add theirs in phase 7.
- Data Vault's loads key a hub by its business key as text, not by a hash (open question OQ-3), and number a satellite's states with
  nine digits; a landing relation should hold one state of a key in one load.
- ISLM (phase 5): a plan compares which tables, columns, views and indexes exist and whether a column may be null. It does not compare
  column types, keys, checks, foreign keys or defaults of what exists (so FR-035 is not yet whole); such a change is a step a person
  writes. An added column gets its type, nullness and default, not its references or checks. SQLite cannot change whether a column may
  be null in place, and the plan says so instead of rebuilding the table. DuckDB will not alter a column of a table that has an index,
  so the plan drops the table's indexes first and makes the model's again. DuckDB has no triggers, so nothing in the database refuses a
  change to its ledger there. A materialized view whose definition changed is reported, not replaced. A teardown drops tables, views
  and indexes and leaves routines, policies and types.
- Query builder (phase 6): a relation is in a query's scope by its name, so a table cannot be joined to itself (no aliases yet). A join
  without a condition needs exactly one foreign key between the relation and the scope: the compiler refuses none, and two (a relation
  that points twice at one table) fail when rendered and ask for the condition. There is no `GROUP BY` or aggregate helper; `valueAs`
  and `call` type hand-written expressions. A set operation checks at run time that both sides name their columns in the same order.
  The rows of an insert must all give the same columns. The builder types rows as the model does; how a driver decodes them (a
  PostgreSQL `count(*)` comes back as text) is phase 8's.
- A comparison now parenthesizes an operand that is not a single name or value, so that `(a > 1) = TRUE` keeps its meaning; DuckDB
  refused the chained form.
