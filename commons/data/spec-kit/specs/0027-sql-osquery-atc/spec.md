# Feature Specification: osquery ATC

**Spec ID:** 0027-sql-osquery-atc
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** osquery can expose a local SQLite database as tables of its own through Automatic Table Construction: a configuration with an `auto_table_construction` entry for each table, giving the `query` to run against the database, its `path`, the `columns` the query gives and, optionally, the `platform`. This feature makes that configuration from a logical schema: an entry names a table and its columns by the words of their names, the query is written by the SQLite dialect with the schema's names, and what osquery refuses is refused here first. The database behind it is an ephemeral target (0025), so one source gives the database and the configuration that reads it. The rules of the format are those of osquery's documentation for Automatic Table Construction as they were read when this was written; the configuration was checked against them and by running every entry's query against a database built here, and it was not run in osquery itself.

## The configuration

- **FR-001**: `atc` MUST make, from a logical schema, the SQLite dialect and entries (a table name for osquery, a table and columns by the words of their names, the path of the database and optionally a platform), a configuration of `auto_table_construction` entries and the text of it as JSON, the same bytes every time with the entries in the order of their names, and MUST give errors as values for a table or column the schema does not have, a dialect that is not SQLite's, two entries with one name, and a name that is not lower-case letters, digits and underscores that begins with a letter.
- **FR-002**: An entry's query MUST be `SELECT` of its columns, written and quoted by the dialect and in the order given, from its table, and its `columns` MUST be the same names in the same order, so that the query gives exactly the columns the entry says.
- **FR-003**: A column that is written as `path` (in any case) MUST be refused, as an error value, because osquery adds a `path` column of its own; an entry with no columns MUST be refused; and a platform MUST be one of `darwin`, `linux`, `posix`, `windows`, `any` or `all`, an entry with none applying to all.
- **FR-004**: A path MUST be absolute for its platform (a drive or a share for `windows`, a leading `/` for `darwin`, `linux` and `posix`, either for `any` and `all` or none), where `%` stands for any one directory, and anything else MUST be an error value.

## Behind it

- **FR-005**: Every entry's query MUST run on a SQLite database built from the same schema and rows (the ephemeral target of 0025), and the columns it gives MUST be those of the entry; this is what the tests do, since osquery is not run.

## Out of scope

- Running osquery.
- The types of values osquery reads: they are text to osquery, a boolean being `1` or `0`.

## Edge cases

- An entry for a table in a schema qualifier: the dialect has no schemas, so the schema's words come first in the table's name, per FR-002.

## Assumptions

- The rules of the format are as read in osquery's documentation.

## Open questions

- **OQ-1**: Whether osquery accepts every path form listed; only the documented ones are.

## Key entities

- **Entry** - an osquery table made from a table of the database.
- **Configuration** - the `auto_table_construction` object and its JSON.

## Success criteria

- **SC-001**: osquery reads the rows of a database that is built from the same source as the configuration that names its columns.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
