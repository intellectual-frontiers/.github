# Feature Specification: Generators

**Spec ID:** 0010-sql-generators
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** What a person or a program reads of a schema is made from it, never written beside it. A generator is an extension that turns the logical schema, with the naming and, where it wants one, a dialect, into files: an entity-relationship diagram in Mermaid and in D2, a data dictionary in Markdown and in HTML, row types in Rust, row validators in Zod, and a register of what governance says of personal data and security. A generator knows no database, reads nothing but what it is given, and gives the same text for the same input, so that the files can be checked in and compared. Everything governance said that a table or column carries (a description, an owner, personal data, a classification) reaches the files, so that governance is also the documentation of the whole flow.

## The generator

- **FR-001**: A generator MUST be a value with an identifier and a function from a logical schema, a naming and an optional dialect to files (a path and a text) or to error values; an extension MUST contribute it through the engine's point `physical.generators`, and `generate` MUST run every generator it is given and return every file in the order of the generators, or all the errors together.
- **FR-002**: A generator MUST give the same files for the same input every time: no clock, no environment, no random value; each text MUST end with one newline.
- **FR-003**: Two files with the same path MUST be an error value naming the path, and the path of each generator MUST be made from the name of the schema's domain, in the case style's words, so that two schemas never collide.
- **FR-004**: A generator MUST read the logical schema, the naming and the dialect and nothing else: it MUST NOT connect to a database, read a file or call another generator, and it MUST write the name of every table and column as the case style writes it.

## What is generated

- **FR-005**: The Mermaid generator MUST make an `erDiagram` of every table with each column's type, its key marks (`PK`, `FK`) and, between tables, a relationship for each foreign key; the D2 generator MUST make the same as `sql_table` shapes with a connection for each foreign key.
- **FR-006**: The dictionary generator MUST make, for each table, a section with its description, its owner (what governance names as the owner of its domain or concept), its primary key and a table of its columns with the type, whether it may be null, the column it points to, its description and the personal data it holds; the type MUST be the dialect's where a dialect is given, and the logical type's where none is.
- **FR-007**: The HTML generator MUST make one self-contained page of the same content as the dictionary, with a link from each foreign key to the table it points to, no script and no outside resource, and every text escaped.
- **FR-008**: The Rust generator MUST make a struct of each table with a field for each column (an `Option` where it may be null) and the description as documentation, and an `enum` for each column that only a closed list of codes may fill.
- **FR-009**: The Zod generator MUST make a schema of each table with a field for each column (`.nullable()` where it may be null), and `z.enum` for each column that only a closed list of codes may fill.
- **FR-010**: The register generator MUST make a Markdown register of every table and column that governance says holds personal data (its category, the class the category is in, the purposes and the retention) and of every one that carries a classification, access, scope or mask, so that what governance says of privacy and security is read in one place.
- **FR-011**: Every logical type MUST have a form in each generator that writes types, so that a type added to the logical schema is refused by the compiler wherever a generator does not yet write it, never written wrongly.
- **FR-012**: A text that governance wrote (a description, a code) MUST be escaped for the format it goes into: a pipe in a Markdown table, markup in HTML, a quote in a string, a line break in a documentation comment.

## What the files hold

- **FR-013**: The Zod file MUST be a module that a project can import and that validates the rows of its tables: a row that fits parses, and a row with a missing, wrong or unknown value is refused; and the Rust file MUST compile.
- **FR-014**: The files of Arca's party model MUST hold every table, every column and every foreign key of its logical schema, in each diagram, dictionary, struct and schema, and nothing more; the equivalence of the files with the old SQL Aide's is recorded in the equivalence ledger, which is not part of this library.

## Out of scope

- Diagrams drawn from governance concepts and relationships rather than tables: later.
- Rendering Mermaid or D2 to an image, or publishing the files: a tool's, not a generator's.
- Generators for other languages: an extension a project writes with FR-001.
- Writing the files to disk: the command line's (a later phase); a generator returns text.

## Edge cases

- A schema with no table: files with a heading and no section, per FR-006.
- A column that only a closed list fills: `enum` in the diagram, an enum in Rust and `z.enum` in Zod, per FR-005, FR-008 and FR-009.
- A description with a pipe in it: escaped in a Markdown table, per FR-012.
- A vector column: `Vec<f32>` in Rust and an array of its dimensions in Zod, per FR-011.
- Two generators that write the same path: an error value, per FR-003.
- A dictionary with no dialect: the logical types, per FR-006.
- A column that holds personal data of a category in no register: a row with the category and no purposes, per FR-010.

## Assumptions

- Governance is read from what the logical schema carries on each table and column (0006-logical); a generator needs no domain of its own.
- The class a category of personal data is in is the one the privacy vocabulary of governance gives.

## Open questions

- **OQ-1**: Whether the register is also a machine-readable form (CSV or JSON) beside the Markdown, and whether it follows a standard layout of a record of processing.

## Key entities

- **Generator** - an extension's function from a logical schema to files.
- **Artifact** - a file a generator makes: a path and a text.
- **Register** - the privacy and security of a schema, read in one place.

## Success criteria

- **SC-001**: A project composes the generators it wants and gets the same files every time, which it can check in and compare.
- **SC-002**: Nothing governance says of a table or a column is missing from the files that describe it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
