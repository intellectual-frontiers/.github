# Feature Specification: SQL Aide

**Spec ID:** 0009-sql-aide
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** One library every Intellectual Frontiers harness uses to say what its data is and to make the SQL for it: a schema written once as TypeScript algebraic types and rendered as SQL for PostgreSQL, SQLite and DuckDB, with stored routines, indexes and partitions that the compiler checks, a way to keep a database's schema as the model says it should be (ISLM), integrations, transforms, tests that run inside the database and in TypeScript, and, where a driver is at hand, typed queries. It is a SQL generator first and a database client second. It takes the ideas of `netspective-labs/sql-aide` (SQL partials in tagged templates, one model for many dialects through an emit context, stored routines as first-class values) and replaces it. Its name is Intellectual Frontiers Commons SQL Aide (IFCSQL).

## The library

- **FR-001**: The library MUST be kept in `commons/ts/data/sql-aide/`, in the package `commons/ts/data/package.json` describes, and MUST be built on IFC TypeScript (0005-typescript-runtime): its errors as values, exhaustive matching, brands, graphs and hashes are the kernel's, and its tests register through `runtime/test.ts`. It MUST be TypeScript that the TypeScript 7 compiler checks with IFC TypeScript's options (`commons/ts/data/tsconfig.json` extends `commons/ts/tsconfig.json`) and that the pinned Bun and Node 26 or later run as written, with no build step. Deno is not a runtime of it.
- **FR-002**: The package MUST have no `dependencies`: what it installs is for checking and testing only. A file of the library MUST import only files of `commons/ts/data/sql-aide/` and the kernel of IFC TypeScript, and only the files under its `runtime/` folder MAY import IFC TypeScript's runtime; none imports a module of a host or of a vendor.
- **FR-003**: The library MUST use only syntax a runtime can erase (no `enum`, no `namespace`, no parameter property, no decorator), MUST NOT use `any` or a non-null `!`, MUST return a failure it expects as a value (the kernel's `Result`) and MUST handle a tagged union with a `switch` that fails to compile where a case is left out (the kernel's `absurd`).
- **FR-004**: What a person would configure MUST be a typed TypeScript value: the library MUST NOT read a YAML, XML, TOML or JSON file as its configuration, and MUST NOT find a model by scanning directories. A project is a module that imports its models and passes them in.
- **FR-005**: Every file of the library and of a library built with it MUST begin with a comment that says `@module`, and every declaration it exports MUST carry a TSDoc comment. The comment of a model's entity, column or routine MUST be what the SQL documentation says of it (FR-025): a tool MUST read the comments into a generated documentation map (a file with `.auto.` in its name, 0001-software-supply-chain FR-002) and MUST fail where the map is not what the source makes.

## The algebra

- **FR-006**: A domain MUST be one case of a tagged union of logical SQL types (text, integer, big integer, real, numeric, boolean, date, timestamp with or without a zone, JSON, UUID, bytes, enumeration, array, custom) that carries the TypeScript type of its values.
- **FR-007**: A column MUST be a domain with its nullability, its default, whether it is generated and its key role, each of which changes its type, so that the type of a row read, a row inserted and a row updated is computed from the columns and never written beside them.
- **FR-008**: The names of a table and of its columns MUST be literal types, so that a reference to a column a table does not have, an index on another table's column and a row with a key the table lacks fail to compile. A primary key's values MUST be branded by its table.
- **FR-009**: The entities of a model (tables, views, routines, types, sequences, policies, sources) MUST form a graph by their references, and whatever the library emits MUST be ordered by it, a referenced entity before the one that refers to it.

## Dialects and emit

- **FR-010**: A dialect MUST be a value that says how a logical domain is written, how a name and a literal are quoted, how a bound parameter is written and which features it has. PostgreSQL, SQLite and DuckDB MUST be provided. A feature a dialect lacks (a stored procedure in SQLite) MUST be a compile error where the model is bound to that dialect, not a failure at run time.
- **FR-011**: Where SQL must differ by dialect, `byDialect` MUST take a case for every dialect the model is written for and MUST fail to compile where one is left out.
- **FR-012**: The names in emitted SQL MUST come from the naming strategy of the emit context (plain quoted, bracketed, qualified by a schema), which a hook MAY replace, and one name MUST be renderable as a SQL token, a TypeScript type and a Rust member, singular or plural.
- **FR-013**: `SQL` MUST be a tagged template whose interpolations are partials (a value that renders itself for a context, of kind statement, expression, relation, identifier or fragment) or values to bind. A plain string MUST NOT be accepted as an interpolation: text that is SQL MUST be marked with `raw`.
- **FR-014**: One template MUST render two ways: as a script, with every value written as a literal the dialect quotes safely, and as a statement, with the text and the list of bound parameters in the dialect's parameter style.
- **FR-015**: The same model MUST render the same bytes on every runtime and on every run; emitted SQL MUST be un-indented text a person can read, and every file the coordinator writes MUST begin with where it came from (the module, the hash of the model and the version of the library).
- **FR-016**: A model MUST be emitted as several files in order by a coordinator that knows the execution context (sandbox, test, production), and a script MUST be able to carry typed variables in the dialect's own way.

## Structure

- **FR-017**: Tables with their keys, constraints and self-references, views with typed columns and indexes MUST be emitted for the three dialects, and what is emitted MUST load into each engine.
- **FR-018**: An index MUST name its method (a union that an extension may widen), its keys (columns of its own table or typed expressions over them), and MAY be unique, partial, covering and built concurrently.
- **FR-019**: A partitioned table MUST name its strategy (range, list or hash) and its key, which MUST be columns of the table that its primary key contains, and a partition's bounds MUST be of the key's type.
- **FR-020**: A stored routine MUST be defined in TypeScript with a signature built from domains and entities and a body that is one of: a typed query whose row type MUST match what the routine returns, or the definition fails to compile; a typed block of statements (declare, assign, branch, loop, raise, call, return) that renders as PL/pgSQL; or a template with typed references to its arguments and to tables and columns.
- **FR-021**: A routine MUST be emitted as a function, a procedure or a trigger for PostgreSQL, as a macro for DuckDB where its body is a query, and for SQLite as a trigger or inlined where it is used.
- **FR-022**: For PostgreSQL the library MUST be able to emit schemas, extensions, enumerated types, domains, sequences, materialized views, row-level security and policies.

## Extensions

- **FR-023**: A dialect MUST be extensible by a value (`with`) that adds domains, functions, index methods or entity kinds, and the type of the dialect MUST then include them.
- **FR-024**: Naming, the life of an emit, lint rules, the classification of a change, the sources of an integration, materializations and generators MUST be typed hooks, and a plugin MUST be a value of extensions and hooks passed to the context: there MUST NOT be a global registry or an import that registers by its side effect.

## Governance

- **FR-025**: Every table, column and routine MUST have a description, taken from its TSDoc comment (FR-005), and an owner; the description MUST be emitted as the dialect's comment on the object.
- **FR-026**: A column that holds personal data MUST say so with a term of the W3C Data Privacy Vocabulary (DPV) and MAY name its category with a term of DPV's Personal Data extension; the terms MUST be the vocabulary's own, by their IRIs, and the library MUST NOT invent one.
- **FR-027**: Lint rules (a table with no primary key, a name that breaks the naming rule, a description or an owner that is missing, personal data with no term) MUST be typed values whose findings are data, and a hook MAY add one.
- **FR-028**: The lineage of an integration and of a transform (source, target, transform) MUST be computed from the graph and MUST be storable in tables beside the run ledger.

## Tests

- **FR-029**: A test MUST be a typed value of the model: an assertion that an object exists with a shape, that a query returns given rows, that a statement fails, or that a routine returns a value. The same test MUST run inside the database (as pgTAP in PostgreSQL where pgTAP is installed, and as SQL that returns TAP lines in every dialect) and from TypeScript through a driver.
- **FR-030**: The tests that every table, column, key, index and routine of a model exists as the model says MUST be generated from the model.
- **FR-031**: Every result (TypeScript tests, tests inside the database, the tests of transforms, the health checks of ISLM, lint) MUST be reportable as TAP version 14 by one typed emitter.

## Integrations

- **FR-032**: An integration MUST be a typed value: a source, a contract (the row type expected), a landing relation and a load into a target with a strategy that is one of append, upsert, replace or snapshot. Seed data and reference data MUST be integrations whose source is rows written in TypeScript.
- **FR-033**: A load MUST use the engine's own means (DuckDB's `read_csv` and `ATTACH`, PostgreSQL's `ON CONFLICT`, SQLite's `ATTACH`), and a load by upsert run twice MUST leave the same rows as run once.
- **FR-034**: A source that is not SQL MUST come through a source-adapter hook that lands rows in a relation; the library MUST NOT carry such an adapter.

## ISLM

- **FR-035**: ISLM (the information schema lifecycle manager) MUST take the model as the state wanted, read the catalog of a database, and say as a plan what differs.
- **FR-036**: Every change of a plan MUST be classified as idempotent (it may be run on every apply: a routine, a view, a trigger, a policy, a comment, an object made only if absent) or non-idempotent (it changes structure or data that exists), and the non-idempotent ones MUST be the fewest the plan needs.
- **FR-037**: ISLM MUST keep its own history in the database (an append-only ledger of every step run: its name, the hash of its content, its kind, who, when, how long and how it ended), and a step already applied MUST do nothing when it is run again.
- **FR-038**: ISLM MUST go forward only: nothing is removed from the ledger, and an undo MUST be a new step that names the step it reverses.
- **FR-039**: ISLM MUST by default write a script for a person to read and MUST apply it only when asked; it MUST flag a change that destroys data or cannot run in a transaction, and MUST refuse a teardown in a production context.
- **FR-040**: ISLM MUST work in PostgreSQL, SQLite and DuckDB with no migration tool outside the library.

## Access

- **FR-041**: Queries (`select`, `insert`, `update`, `delete`, with joins, common table expressions, set operations, `returning` and upsert) MUST be built from the model with the type of their rows inferred, and the relations between tables MUST be taken from their foreign keys.
- **FR-042**: A driver MUST be an adapter typed by the shape of the client it is given, importing no driver itself, that returns its failures as values; adapters MUST be provided for SQLite and PostgreSQL on both runtimes, for PGlite and for DuckDB.

## Transforms

- **FR-043**: A transform model MUST be a typed query whose rows another model may use by importing it; the order of a build MUST come from those references; and a model MUST be materialized as one of view, table, incremental, materialized view or ephemeral.
- **FR-044**: A test of a transform (unique, not null, accepted values, relationship, a query of one's own) MUST be SQL that records what it finds, and MUST report as FR-031 says.

## Generators and the command line

- **FR-045**: From a model the library MUST generate an entity-relationship diagram as Mermaid and as D2, a data dictionary, Rust structures and Zod schemas.
- **FR-046**: The command line MUST be a function a project module calls with its project (`cli(project)`): there MUST NOT be a global program that looks for a project.

## The libraries that accept it

- **FR-047**: Arca, the typical data models (`commons/ts/data/arca/`), MUST be built with the library's public entry point alone, MUST begin with the party model (party, person, organization, their relations, roles, identifiers and contact points, with their reference data) and MUST be the library's own work: no text, diagram or file of a published book is copied.
- **FR-048**: Data Vault (`commons/ts/data/data-vault/`) MUST be built with the public entry point alone and MUST give hubs, satellites and links as generic functions, with loads that only insert and that change nothing when run twice.
- **FR-049**: Both MUST be tested on SQLite, DuckDB and PostgreSQL (PGlite in process, and a database made for the run and dropped after it on a PostgreSQL server where one is given), under Bun and under Node: that the model compiles for each dialect, that what is emitted is what is committed, that it loads, that constraints hold, that the same scenario gives the same rows in every engine, and that the generated tests pass inside the engine.
- **FR-050**: A phase of the library is done only where Arca and Data Vault pass what that phase adds.

## Targets and durability

- **FR-051**: A database target MUST say its durability, durable or ephemeral, whatever its dialect, as part of the emit context's type. A durable target's database is the system of record and its structure changes go through ISLM; an ephemeral target's system of record is the TypeScript (its structure and its rows) and its database is a build product, made again from empty whenever wanted. A context is durable unless it says otherwise; PostgreSQL MAY be an ephemeral target (PGlite is the case tested), and SQLite and DuckDB files are the usual ephemeral ones.
- **FR-052**: ISLM's plan, apply and teardown, and so its ledger and its undo steps, MUST NOT be usable with an ephemeral context: passing one fails to compile.
- **FR-053**: The build of an ephemeral target MUST emit one `.auto.sql`: a header that says where it came from (the module, the hash of its body and the version of the library), the definitions in the order their references give, then the rows as `INSERT` statements in a stable order by primary key, at most a fixed number of rows to a statement. It MUST be the same bytes from the same source on every runtime and every run: a row's identity is given in the source or derived from its natural key, never random and never the clock.
- **FR-054**: The build MUST be able to make the database from the `.auto.sql` in two ways: as the command a person runs with the engine's own client, and through a driver adapter, writing a temporary file and renaming it over the old one so that a reader never sees a database half made. The database file is not committed; the `.auto.sql` is.
- **FR-055**: A check MUST fail where a committed `.auto.sql` or `.auto.json` is not what its source makes, as the documentation maps' check does; lint MUST report an ephemeral target whose rows pass a threshold of size; and `cli(project)` MUST build and check.

## osquery ATC

- **FR-056**: osquery ATC (`commons/ts/data/osquery-atc/`) MUST let an osquery-based service manage its Automatic Table Construction tables in TypeScript: an ATC table is an IFC SQL Aide table and what ATC needs (the path of the SQLite database on the host, the query, the columns and the platform), and the columns it names MUST be the table's, which the compiler checks. It MUST generate the ATC configuration as `.auto.json` in the format osquery documents and reads, the `.auto.sql` of the SQLite database behind it (FR-053), and build the `.auto.sqlite.db` (FR-054). Generating JSON for osquery to read is output, not configuration: the library never reads it back (FR-004).
- **FR-057**: osquery ATC MUST be built with the public entry point alone, carry a TSDoc comment on every export with a documentation map, and be tested as Arca and Data Vault are (FR-049, FR-050): its committed `.auto.sql` and `.auto.json`, a build that is byte-identical twice and under Bun and Node, and a database built by a driver and queried with the configuration's query.

## Out of scope

- Scheduling: the library emits scripts and runs a graph when asked; when is decided elsewhere.
- Publishing to a registry.
- Compatibility with `netspective-labs/sql-aide`, and dialects other than the three (they come as plugins).
- An adapter for a source that is not SQL.

## Edge cases

- A model asks SQLite for a stored procedure: it does not compile, per FR-010.
- A routine declared to return the rows of one table returns another's: it does not compile, per FR-020.
- An interpolation is a plain string a person typed: it does not compile, and `raw` says it is meant, per FR-013.
- A text value holds a quote: the script doubles it and the statement binds it, per FR-014.
- A foreign key names a column its target does not have: it does not compile, per FR-008.
- A table refers to itself: it is emitted once, with its reference, per FR-009 and FR-017.
- Reference data is loaded a second time: no row is added, per FR-033.
- A plan is applied twice: the second apply runs no non-idempotent step, per FR-037.
- A step that dropped a column is to be undone: a new step is written and the ledger keeps both, per FR-038.
- A teardown is asked for in production: it is refused, per FR-039.
- An exported declaration has no TSDoc comment, or the documentation map is stale: the check fails, per FR-005.
- A column of personal data names no term of the vocabulary: lint reports it, per FR-026 and FR-027.
- No PostgreSQL server is given: the tests that need one say they were skipped and the rest run, per FR-049.
- ISLM is asked to apply a plan to an ephemeral target: it does not compile, per FR-052.
- An ephemeral target's rows are emitted twice, or under the other runtime: the bytes are the same, per FR-053.
- The database is being rebuilt while a program reads it: the program sees the old file or the new one, never a half-made one, per FR-054.
- A committed `.auto.sql` or `.auto.json` is stale: the check fails and says which, per FR-055.
- An ATC table names a column its table lacks, or a column named `path`, which osquery adds itself: it does not compile, per FR-056.

## Assumptions

- A harness that uses the library runs Bun or Node; `commons/tools/` and the machine setup stay Deno (their specifications say so) and do not import it.
- IFC TypeScript (0005-typescript-runtime) is in the same checkout: the library imports its kernel by a relative path until a release of it is what a harness installs.
- TAP version 14 and the Data Privacy Vocabulary are read as their publishers wrote them; DPV is a W3C Community Group report, not a W3C standard.
- pgTAP is installed in a PostgreSQL server by whoever runs it; where it is not, the SQL that returns TAP lines is what runs.

## Open questions

- **OQ-1**: Whether DPV's terms should be kept in `commons/ontology/` and the TypeScript generated from it, as the packaging tables are, instead of a module of the library.
- **OQ-2**: How the library is released: as part of IFC TypeScript's package, or as a package of its own that depends on it; and whether `isolatedDeclarations` is turned on then, since it asks for a written type on every export, which a model that is inferred does not have.
- **OQ-3**: Data Vault (FR-048) targets Data Vault 2.1. Which of its features the library gives beyond hubs, satellites and links with a load date, a record source and loads that only insert (hash keys, hash differences, point-in-time and bridge tables, ghost records) is open: the 2.1 standard is taught through the Data Vault Alliance's CDVP2.1 certification and was not found published where it could be read (datavaultalliance.com, its blog, 2026-11-15), so no rule of 2.1 is implemented from memory.
- **OQ-4**: How far the typed block of a routine can go before the compiler's work on it is too slow.

## Key entities

- **Domain** - a logical SQL type and the TypeScript type of its values.
- **Column** - a domain with its nullability, default and key role.
- **Entity** - a table, view, routine, type, sequence, policy or source.
- **Dialect** - how one engine writes types, names, literals and parameters, and what it can do.
- **Partial** - a value that renders itself as SQL for an emit context.
- **Emit context** - the dialect, the naming strategy, the hooks and the execution context of one rendering.
- **Integration** - a source, a contract, a landing and a load.
- **Step** - one change ISLM applies, idempotent or not, with its hash.
- **Ledger** - the history ISLM keeps in the database.
- **Model** (of a transform) - a typed query other models may use.
- **Test** - a typed assertion that runs inside the database and in TypeScript.
- **Library** - models built with the public entry point (Arca, Data Vault, osquery ATC).
- **Target** - a database a model is rendered for, durable (the system of record) or ephemeral (a build product of the TypeScript).

## Success criteria

- **SC-001**: In `commons/ts/data`, `bun run verify` (the TypeScript 7 compiler, the documentation maps, then every test under Bun) and `bun run test:node` (the same tests under Node) pass on a computer with Bun, Node and the three engines.
- **SC-002**: The party model of Arca and a vault of Data Vault load into SQLite, DuckDB and PostgreSQL from the same TypeScript, and their generated tests pass inside each.
- **SC-003**: A harness that used `netspective-labs/sql-aide` can make its SQL with this library instead.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
