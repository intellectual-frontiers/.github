# Feature Specification: sql-describe

**Spec ID:** 0057-sql-describe
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The documentation of the data models has to say what each layer is and how to use it, for a developer and for an agent: governance (written with the data definition DSL), the logical schema that projects from it and its physical forms (SQL for each dialect, the typed tables). `sql/describe` describes the models of a composition in those layers as plain data, with stable ids, the words the model gives each element, where it is written, the trace from each element to what it is made into, and findings; the generator of the site (commons 0011-documentation FR-029) turns it into pages and into a Markdown twin and a JSON file for each model.

## Requirements

- **FR-001**: `describeModels` MUST compose the modules, project them and bind them for each dialect it is given, and give one described model for each module, or say why the composition, the projection or the binding failed.
- **FR-002**: A described model MUST have the three layers (governance, logical, physical), each with a title and a summary that says what the layer is, which code writes it and whether it may be edited, and the kinds of element it holds.
- **FR-003**: A described model MUST have, with a stable id each (unique within the model, of the form `layer:...`): in governance its module, concepts, attributes, relationships, code lists and codes, each with its definition and what is said of it (identity, datatype, multiplicity, annotations); in logical the tables, columns, foreign keys, uniques and indexes it owns; in physical the SQL of each table for each dialect and the typed table that reads and writes it.
- **FR-004**: A described model MUST trace each governance concept to its table, each attribute and relationship to its columns, and each table to its SQL for each dialect and to its typed table; every end of a trace MUST be an element of the models; the typed table MUST name a file and an export that exist.
- **FR-005**: The same models MUST give the same bytes as JSON, and the source of an element (a file and a line) MUST be what the caller's `locate` says of it, none where it says none.
- **FR-006**: What has no definition (a module, a concept, an attribute, a relationship, a code list), a concept identified by nothing, a code list with no code, and personal data held for no purpose MUST each be a finding that names the element and says what to do; the models of this library MUST have none.

## Out of scope

- Operations and invariants, issues and the SQL-DQ tests of a model: later parts, as elements of the same layers.
- Writing pages and files: the generator's lens does it (commons 0011-documentation FR-029).
- Models of other libraries (the headless command model): each library describes its own.

## Edge cases

- A module that owns no table (a module of concepts that another projects) is described with its governance elements alone, per FR-003.
- A foreign key to a table of another module references that table's element, which is in another described model, per FR-004.
- A concept that cannot be located by the caller has no source, which is not a finding, per FR-005.

## Assumptions

- The element ids are the keys of links and of diffs between releases: a rename is a removal and an addition.
- The caller finds where values are written from the exports it imports; this unit reads no source file.

## Open questions

- **OQ-1**: Whether an operation (governance's `operation`) becomes an element of the governance layer with a trace to its SQL routine, or stays with the library that implements it.

## Key entities

- **Described model** - the layers, elements, trace and findings of one module.
- **Element** - one thing a layer says, with a stable id.
- **Trace** - an element of one layer made into an element of another.

## Success criteria

- **SC-001**: An agent that is given only a described model (as JSON) can say which file to edit to add an attribute, which command regenerates what follows, and what will change in each layer.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
