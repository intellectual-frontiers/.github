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

| Phase | What                                                                                                               | State   |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ------- |
| 1     | Algebra, dialects, the `SQL` template and its two renderings, naming, hooks, governance, TSDoc maps, TAP           | here    |
| 2     | Views, typed indexes and partitions, PostgreSQL objects, tests inside the database                                 | here    |
| 3     | Typed routines, triggers, policies, DuckDB macros                                                                  | here    |
| 4     | Integrations: seed rows, CSV through DuckDB, attached databases, adapters; four strategies; lineage; vault loads   | here    |
| 5     | ISLM: catalogs read, plans classified, an append-only ledger in the database, undo, script, lint, teardown         | here    |
| 6     | Query builder: joins by foreign key, projections, CTEs, set operations, insert, update, delete, returning, upsert  | here    |
| 7     | Transforms: typed models, build order from references, five materializations, tests recorded and reported as TAP   | here    |
| 8     | Drivers: node:sqlite, pg, PGlite and DuckDB adapters typed by shape; bound values, decoding by domain, typed calls | here    |
| 9     | Generators, the command line, plugins                                                                              | not yet |

### Limits, said plainly

- Integrations (phase 4): a load is a script the caller runs whole; it begins no transaction, so a `replace` or `snapshot` that fails
  halfway leaves what it did unless the caller wraps it in one. Files are read only by DuckDB (`read_csv`); PostgreSQL's `COPY` is not
  used. An attached database is a file of the same engine: DuckDB attaching SQLite or PostgreSQL needs an extension it would download,
  and is not tested.
- Data Vault targets Data Vault 2.1. What it gives: hubs of business keys, satellites of attributes a row for each change, links of
  hubs, a load date (`load_at`) and a record source on every row, and loads that only insert, change nothing when run again and add a
  satellite row only for a changed attribute. What it does not yet give: hash keys and hash differences (a hub is keyed by its business
  key as text, and a change is found by comparing attributes with `IS NOT DISTINCT FROM`), point-in-time and bridge tables, ghost
  records, and any other rule of 2.1. The 2.1 standard was looked for on 2026-11-15 and not found published where it could be read:
  [datavaultalliance.com](https://datavaultalliance.com/) names only the CDVP2.1 certification of DVA University, its
  [blog](https://datavaultalliance.com/blog/) has no post on 2.1, and the one page found labelled 2.1
  ([dv2.org](https://www.dv2.org/2023/01/data-vault-anti-pattern-adding-column.html)) is an unsigned blog post. So nothing of 2.1 is
  implemented from memory, and open question OQ-3 stays open until a person gives the library the standard to follow. A satellite's
  states are numbered with nine digits; a landing relation should hold one state of a key in one load.
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
  The rows of an insert must all give the same columns. The builder types rows as the model does, and a driver decodes a column of the model by
  its domain; an expression that is not a column (a `count(*)`) is given as the client gives it.
- A comparison now parenthesizes an operand that is not a single name or value, so that `(a > 1) = TRUE` keeps its meaning; DuckDB
  refused the chained form.
- Transforms (phase 7): a model's references are found by walking its query, rendered for the first of PostgreSQL, DuckDB and SQLite
  it has a case for. An incremental model adds the rows whose key it does not hold and never changes a row it holds. A materialized view
  is PostgreSQL's, made if absent and refreshed on each build; a change of its query is not applied (ISLM reports that). A relationship
  test between a relation and itself is not supported. Lineage covers integrations, Data Vault's loads and transforms.
- Drivers (phase 8): `run` binds a single statement's values and writes a script's (a fragment of several statements) as literals.
  Values are decoded where a column's domain is known: a column of a table, view, model or common table expression, or a call of a
  function that returns a value; anything else comes as the client gives it. SQLite keeps NUMERIC as a floating-point number, so its
  digits beyond a double's are lost before they are written to the column's scale. `pg` reads a date as local midnight and the driver
  writes it back in local time; the tests ran in UTC only. DuckDB's blobs are read through its JSON form.

## File Aide, being built

File Aide is SQL Aide's peer for stores of files, specified by [`0010-file-aide`](../../spec-kit/specs/0010-file-aide/spec.md): a store's layout written once as
TypeScript algebraic types, drivers for memory, a folder and an S3-compatible bucket behind one interface, checks of a store against its layout, and a small SQL-like query
language compiled into a function that walks a store as `fd` does, honouring `.gitignore` and `.faignore`. It lives in [`file-aide/`](file-aide/mod.ts), and the layout that accepts it, the IF Renditions File System (IFRFS, the
folder erga's `publication sync` fills), in [`ifrfs/`](ifrfs/mod.ts), tested on the synthetic tree `suite/ifrfs/tree/`. Each of its
requirements has a row in [`enforcement.tsv`](../../spec-kit/enforcement.tsv) naming the phase that finishes it.

| Phase | What                                                                                                 | State   |
| ----- | ---------------------------------------------------------------------------------------------------- | ------- |
| 1     | Segments, path patterns and their laws, entries, layouts, names                                      | here    |
| 2     | The store interface, the `memory` and `posix` drivers, the conformance suite                         | here    |
| 3     | Queries: the builder, the text form, the planner, the compiler, `explain`, ignore files, `fd` parity | here    |
| 4     | The `s3` driver, the local S3 server, tests against real providers                                   | not yet |
| 5     | Checks and recipes, and stores that fail on purpose                                                  | not yet |
| 6     | With SQL Aide: the file-reference domain and listings as a source; IFRFS end to end                  | not yet |

Use it:

```ts
import { compile, parseQuery, query, queryTree } from "./file-aide/mod.ts";
import { posixStore } from "./file-aide/runtime/mod.ts";
import { ENTRIES, rendition } from "./ifrfs/mod.ts";

const store = posixStore("/path/to/works", { readOnly: true });
const pdfs = query(rendition)
  .select("kind", "slug", "file")
  .where((w) => w.and(w.eq("kind", "book"), w.glob("file", "*.pdf")))
  .orderByKey();
const same = parseQuery("select kind, slug, file from rendition where kind = 'book' and file glob '*.pdf' order by key", ENTRIES);
const c = compile(pdfs); // its plan lists book/ alone; c.value.plan says so
if (c.kind === "ok") for await (const row of c.value.run(store)) console.log(row);
compile(
  queryTree()
    .where((w) => w.eq("extension", "md"))
    .scan(),
); // fd's walk: every file and folder, .gitignore and .faignore honoured
```

File Aide's limits, said plainly:

- The `posix` driver reads a whole folder to give one page of a listing, and a whole file to give a range; it skips symbolic links, and does
  not claim a write on a version, which it cannot make atomic. A name on disk that is not in normalization form C is listed in form C and is
  then reached only where the file system treats the two forms as one (as APFS does).
- A layout finds two overlapping entries by its segments' witnesses: an overlap that no witness shows is not found when the layout is made,
  and a path both entries match is unmatched, saying so.
- A query's walk lists a folder whole before it goes below it, so a folder with very many files is held in memory while it is read. In key
  order a folder's own row sorts by its path, and the files below it by theirs (`book`, `book-series`, `book-series/...`, `book/...`).
- `.git/info/exclude` is read only at the root of the store, not where the store's root is deeper in a Git working tree. `regex` is
  ECMAScript's, and is allowed only by `with (regex = on)`. The comparison with `fd` runs where `fd` (or `fdfind`) and `git` are installed,
  and is skipped, saying so, where they are not; its speed is not measured yet.
