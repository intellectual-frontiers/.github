# Feature Specification: The logical schema

**Spec ID:** 0006-logical
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The logical schema is the second layer (0001-layers): a relational schema made from governance by a projection, in terms of tables, columns, keys, constraints and indexes, and of no engine. It knows what a relational database is, and none in particular. Each of its elements carries the identity of the governance element it was made from, so that a concept can be followed to its table and a column back to its attribute; it names itself as lists of words (0005-naming) that the physical schema writes in a case style; and what governance said that the schema cannot express itself (who may read a column, how long it is kept) it carries or it reports, never loses. The projection is a value, so that another can take the place of the default.

## The logical schema

- **FR-001**: A logical schema MUST be plain data that names no engine: value sets (the closed code lists) and tables, each with its name as words, its comment, its columns (name as words, logical type, nullability, default, comment), its primary key, its foreign keys, its unique constraints, its checks and its indexes, and for a code table its rows; every element MUST carry an identity of its own, made of its words, and the identity of the governance element it was made from.
- **FR-002**: A column's type MUST be one of the logical types: text (with its longest), integer, decimal (with precision and scale), boolean, date, timestamp (with whether it has a zone), json, bytes and vector (with its dimensions); none MUST name a type of an engine.
- **FR-003**: `project` MUST return the logical schema of a domain, or every error of the projection together, as values; the projection MUST be a value (`normalized` is the library's own), given to `project` or contributed through the engine's point `logical.projection`, so that another takes its place.

## What the normalized projection makes

- **FR-004**: It MUST make a table of each concept, and of each open code list a code table (`code`, `label`, `description`, the code its key) whose rows are the list's codes, with each code's label and definition; it MUST make no table of a closed code list but a value set, which keeps its codes and what governance said of it.
- **FR-005**: It MUST make a column of each attribute (null where the attribute is optional); of an attribute that is a code of an open list, a column of the words of the list and `code` that refers to the code table, and of a closed list, a column with a check that its value is one of the codes; of each relationship of cardinality one or optional, the foreign key columns (null where optional) named by 0005-naming FR-003; of a relationship of cardinality many a junction table of the two keys; and of an attribute that is many a table of its values and the key of the concept; the columns that identify a concept are its primary key and come first.
- **FR-006**: It MUST make a unique constraint of each `quality.unique`, a check of each `quality.differs` (named by the rule's words), of each `quality.range` and of each `quality.pattern`, a default of each `quality.default`, and an index of each `usage.lookup`; the name of each, as words, is 0005-naming FR-003's.
- **FR-007**: Where a domain or a concept is audited, its table MUST have the columns that say who made, changed and removed a record, and when, with the description of each; the column of when it was made has the moment of the insert as its default.
- **FR-008**: The comment of a table and of a column MUST be the definition of the concept, attribute, relationship, code list or code table column that it was made from, so that what governance says reaches the database.

## Names and trace

- **FR-009**: The words of every table, column and constraint MUST be those 0005-naming FR-003 gives, and the projection MUST return as an error two tables, two columns of a table, or two constraints or indexes whose words are equal; the first identity of the two elements MUST be in the error.
- **FR-010**: Every element of the schema MUST carry the identity of its governance element (`from`), so that a table is traced to its concept, a column to its attribute or relationship, a constraint to the annotation's element and a code table to its code list.

## The flow of governance

- **FR-011**: The projection MUST give a report of the flow: every annotation of the domain, once, as expressed (a constraint, a default, an index, a column, a table), carried (kept, as it is, on the logical elements it was made for, so that a layer or an extension below may express it), or unexpressed (of a kind the projection knows nothing about), with the logical elements it became; no annotation MUST be left out of it.

## Row types

- **FR-012**: The type of a row of a concept MUST be computed from its attributes and relationships (`RowOf`), the type of a row to insert from the same (`InsertOf`, in which what is optional or many may be left out) and the type of its key from its identifying members (`KeyOf`); an attribute is typed by its datatype (a code by the names of its list), null where it is optional, and an attribute of another type than its datatype's does not compile.
- **FR-013**: The logical schema MUST name no engine: its code holds none of the names of one.

## Out of scope

- The engine, the dialect, quoting, case and the order in which statements are emitted: the physical schema.
- A view over the schema, a routine and a query: later layers and extensions.
- Row-level security and every other thing a carried annotation becomes: extensions.
- The tables of a Data Vault or any other projection: a projection of its own.

## Edge cases

- A domain with a person identified by a party: the person's primary key is its foreign key to the party, per FR-005.
- An optional relationship: a foreign key that may be null, per FR-005.
- A relationship named `from` and another `to`, both to `party`: the columns `from party id` and `to party id`, per FR-005 and 0005-naming FR-003.
- An attribute `line1` and an attribute `line2`: the columns `line 1` and `line 2`, per FR-005.
- An open code list used by two concepts: one code table, and a foreign key from each, per FR-004 and FR-005.
- An attribute that is many: a table of its values, per FR-005.
- An audited domain: every table of a concept has the audit columns, a code table has none, per FR-007.
- An annotation of a kind nobody knows: `unexpressed` in the report, per FR-011.
- Two relationships of a concept that name alike after their words are joined: returned as a collision, per FR-009.

## Assumptions

- A foreign key refers to the primary key of its target; a target with a key of several columns makes a foreign key of several.
- The order of a table's columns is the key first, then the attributes, then the relationships, then the audit columns; a column's position is not meaning, and a comparison of schemas does not hold to it.
- `quality.retention`, `quality.deprecated`, the privacy, security and ownership annotations and the requirements are carried: extensions below express them.
- A decimal's row type is text, to keep what it holds exactly; a date and an instant are text in ISO 8601 form.

## Open questions

- **OQ-1**: Whether a foreign key names the action on delete, and where it is said in governance.

## Key entities

- **Logical schema**, **Table**, **Column**, **Foreign key**, **Unique**, **Check**, **Index** - the relational schema and its parts.
- **Projection** - a value that makes a logical schema from a domain.
- **Flow report** - where each annotation of governance ended.
- **Row types** - `RowOf`, `InsertOf` and `KeyOf`, computed from a concept.

## Success criteria

- **SC-001**: A domain makes one logical schema, whose every table, column and constraint can be followed to what the business said and whose names a case style writes as a database wants them.
- **SC-002**: Nothing governance said is lost between the domain and the schema: each annotation is in the report.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
