# Feature Specification: Transforms

**Spec ID:** 0023-sql-transforms
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Data is made from data: a model is a query whose result is kept as a view, a table, an incremental table or nothing at all (ephemeral, written in where it is read), and models read the tables of a schema and one another. This is the work that dbt popularised, with what dbt leaves to its users made part of the design. A model's SQL is written by a person but its names are not: it asks for tables and columns by the words of their names and is given them written by the naming layer, qualified as the schema is, so that an unknown name is found when the project is made, and the same model runs on every dialect and schema. The order of a build comes from what each model asks for, and a cycle is an error value. Reliability is the point: each model is built in one transaction together with its tests (unique, not null, accepted values, relationships, and a query of one's own that gives the rows that are wrong), and where a test of severity error finds a row the transaction is rolled back, so that what was published before is still there, and the models that read it are not built; an old table is never half replaced. Each successful build is a row in a ledger with the hash of the model's definition and its row count, and lineage is a value.

## The project

- **FR-001**: `transformer` MUST make a project from a logical schema, a dialect, a naming and models (each a name, a function from references to its SQL, a materialization, a key and tests) and MUST give errors as values for a name its SQL asks for that is neither a table of the schema nor a model, a cycle among models, two models with one name, an incremental model with no key, and an ephemeral model with a test.
- **FR-002**: The order of a project MUST be that of what each model asks for, a model after every table or model its SQL refers to, found by running its SQL function with references that note what was asked; and lineage MUST be the edge from each thing a model reads to the model, in that order.
- **FR-003**: Models MUST be written where the setting says (the schema of the tables where it does not say) and each model's name MUST be written by the naming layer, with the schema's words added where the dialect has no schemas.

## Materializations

- **FR-004**: A `view` MUST be dropped and made again, a `table` MUST be dropped and made again as the result of its query, an `incremental` model MUST be made as a table the first time and after that MUST add the rows whose key it does not hold and never change a row it holds, and an `ephemeral` model MUST be written into the SQL of the models that read it and be made as nothing; a table made again under views that read it MUST be dropped with `CASCADE` where the dialect has one, and a build of some models MUST also build every model that reads them.

## Tests

- **FR-005**: A test MUST be SQL that gives the rows that are wrong: `unique` (columns that have the same values in more than one row), `not-null`, `accepted-values`, `relationship` (a value with no row in another relation) and `custom`; its finding MUST give the model, the test, its severity, the number of rows that are wrong and a sample of them.
- **FR-006**: A model MUST be built and its tests run in one transaction; where a test of severity `error` finds a row, the transaction MUST be rolled back, so that the model is as it was, and the models that read it MUST be reported as blocked and not be built; a finding of severity `warn` MUST be reported and MUST NOT stop the build.

## The record

- **FR-007**: A built model MUST add a row to a ledger table (its name, its sequence, the hash of its definition, its materialization, its row count and the number of warnings), made `IF NOT EXISTS`, in the transaction of the build; and a report MUST say, for each model, whether it was built, was ephemeral, failed (with the error or the findings) or was blocked, and whether the whole build succeeded.

## Settings

- **FR-008**: The schema models are written in, the ledger's table and the number of rows in a sample MUST each have a default and be changeable.

## Out of scope

- Snapshots (slowly changing history) and seeds: integrations load data.
- Documentation sites.
- Macros: a model's SQL function is a function.

## Edge cases

- A model that reads a table the schema does not have: an error value naming it, per FR-001.
- A table model under a view model: the view is dropped by `CASCADE` and made again in the same build, per FR-004.
- Two builds of the same project: the table models are made again, the incremental ones add nothing, per FR-004.

## Assumptions

- Models are best written in a schema of their own (FR-003), so that a reader of the catalog that reads the tables of the schema (convergence) does not find them as drift.
- A model's columns are named by its SQL; its tests name them as the SQL does.
- The dialect's DDL is transactional (PostgreSQL, SQLite and DuckDB are).

## Open questions

- **OQ-1**: Whether an incremental model can also update rows that changed, by a second key of change.

## Key entities

- **Model** - a name, a query and how its result is kept.
- **Project** - the models in the order they build, with their lineage.
- **Finding** - the result of a test that found rows that are wrong.

## Success criteria

- **SC-001**: A model that is wrong is not published, and what was published before is still there.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
