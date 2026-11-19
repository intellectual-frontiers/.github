# Feature Specification: The layers

**Spec ID:** 0001-layers
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** IFC data is three layers and an engine that extends them. Governance describes a business domain and what must be true of its data, and knows no database. A logical schema is made from governance and knows the kind of database (relational), not an engine. A physical schema is made from a logical schema for one engine (PostgreSQL, SQLite or DuckDB) and is the only layer that knows one. Each layer imports only the layers below it and the engine, an extension imports only the public surfaces of the layers it extends, and a check of the library holds every import to that table, because the compiler cannot: an import by package name is invisible to the layers check of commons' kernel (commons 0005-typescript-runtime FR-077).

## The layers

- **FR-001**: Governance (layer 1) MUST describe a business domain, its concepts, attributes, relationships and code lists, and the governance of its data (documentation, privacy, security, ownership, quality and requirements), in terms that name no database, no kind of database and no engine; it MUST import nothing but the engine and the kernel.
- **FR-002**: A logical schema (layer 2) MUST be made from governance by a projection and MUST know the kind of database (relational) but no engine; it MUST import only governance, the engine and the kernel.
- **FR-003**: A physical schema (layer 3) MUST be made from a logical schema, a dialect and a target, and MUST be the only layer that knows an engine; it MUST import only the logical schema, governance, the engine and the kernel, and never an extension.
- **FR-004**: Imports MUST point one way: the engine imports nothing of the library; governance imports the engine; the logical schema imports governance and the engine; the physical schema imports the logical schema, governance and the engine; the lifecycle (what changes a database from one physical schema to the next) imports the physical and logical schemas, governance and the engine; a dialect imports the physical and logical schemas, governance and the engine; an extension of SQL imports the lifecycle as well imports the physical and logical schemas, governance and the engine; a model and an extension that needs no database import governance and the engine, and a model may also import the models it requires (0028-modules FR-006), the imports among models making no cycle; and the command line imports any of them. An import that climbs, or reaches around, MUST be a finding.
- **FR-005**: Layers 1 to 3 and the engine MUST import no package but the kernel (`@intellectual-frontiers/commons/ts/kernel`) and this library's own, so that nothing of a host, a driver or an engine reaches them.

## Identity and flow

- **FR-006**: Every element of governance MUST have an identity that never changes; every element of a logical schema MUST carry the identity of the element it was made from, and every object of a physical schema the identity of the element of the logical schema, so that the links form a graph from a concept to a column to a table.
- **FR-007**: Governance MUST never be silently dropped on its way down: each annotation MUST end as expressed (a constraint, a policy or a comment), carried as data (a table), or named as unexpressed in a report of the flow.

## Folders and public surfaces

- **FR-008**: Every `.ts` file of the library MUST belong to exactly one unit of the table the check holds (`engine/`, `governance/`, `sql/logical/`, `sql/physical/`, `sql/lifecycle/`, `sql/presets/`, each folder of `models/`, `extensions/`, `sql/dialects/` and `sql/extensions/`, `sql/cli/`, `suite/`, `examples/`, `tools/` and the files of the library's root), and a file that belongs to none MUST be a finding.
- **FR-009**: The public surface of each layer MUST be one entry of the `exports` of the library's `package.json`: `./engine`, `./governance`, `./sql/logical` and `./sql/physical`, each the `api.ts` of its folder; an import by the package's name of a subpath that `exports` does not name MUST be a finding.
- **FR-010**: A file of a layer, a model, an extension, a dialect or the command line MUST import a file of another unit by the package's name, through an entry of `exports`, and MUST NOT import it by a relative path; a relative import that reaches another unit MUST be a finding. The suite, the examples, the tools and the files of the root are the library's own checking, not its layers, and MAY import any file of the library by a relative path.

## The check

- **FR-011**: `tools/layers.ts` MUST find each of the above as data (`layers/unclassified`, `layers/relative`, `layers/private`, `layers/external`, `layers/above`, `layers/around` and `layers/cycle`), reading every import of every file of the library, relative or by package name; `tools/check.ts` MUST run it with the trace of the library's sources and tests to these specifications (commons 0015-trace), hold the findings against `trace.baseline.txt`, and be part of `bun run verify`.

## Names

- **FR-012**: A name MUST cross the layers as a list of words: governance's names MUST be lower camel case and `words` MUST split them, the logical schema MUST choose the words of each element of a relational schema, and the physical schema MUST write the words in the case style of its target (0005-naming); a name of governance MUST NOT hold a database's convention.

## Out of scope

- What each layer does: governance, the logical schema and the physical schema have specifications of their own; this one says only how they are laid out and what each may import.
- Layers of another kind of database (a graph, a document store): a later folder beside `sql/` would take the same table.
- Checking the imports of the engine's extensions among themselves beyond FR-004 (`requires` is specified in 0002-engine).

## Edge cases

- A file of `sql/logical/` that imports `@intellectual-frontiers/data/sql/physical`: `layers/above`, per FR-004.
- A file of `governance/` that imports `@intellectual-frontiers/data/sql/logical`: `layers/above`, per FR-004.
- A file of one extension that imports another extension's surface: `layers/around`, per FR-004.
- A file of `models/arca/` that imports `@intellectual-frontiers/data/sql/physical`: `layers/around`, per FR-004.
- A file of `sql/physical/` that imports a database driver, or `node:fs`: `layers/external`, per FR-005.
- A file of `governance/` that imports `../engine/api.ts`: `layers/relative`, per FR-010.
- A file that imports `@intellectual-frontiers/data/engine/internal`, a file `exports` does not name: `layers/private`, per FR-009.
- A `.ts` file in a folder the table does not know: `layers/unclassified`, per FR-008.
- A file of `suite/` that imports any unit by package name: allowed, per FR-004.
- A file of `suite/` that imports `../tools/layers.ts` by a relative path: allowed, the suite and the tools are the library's own checking, per FR-010.
- An import that is a comment, or inside a template literal: not read, as the kernel's reader does not read it, per FR-011.

## Assumptions

- The table is the library's own: commons' ladder (commons 0016-ladder) is not used, because the engine and the layers do not fit its rungs without a file for each extension that imports the engine; the layers keep the ladder's rule (a unit relies only on what is below it) and its order of work (governance, then the logical schema, then the physical schema, then extensions).
- FR-006 and FR-007 are Planned: they are built with governance and the logical schema, and the register says so.
- A model and an extension that need no database are above governance and below nothing: nothing in the library imports them but the command line.

## Open questions

- **OQ-1**: Whether an extension of SQL may import a neutral extension through `requires` (0002-engine), and what its table row then says.

## Key entities

- **Layer** - governance, the logical schema or the physical schema.
- **Unit** - a folder of the table that FR-008 names, with the units it may import.
- **Public surface** - an entry of `exports`, the `api.ts` of a layer.
- **Finding** - what the check says is wrong, with a rule, a file, a line and a key, held against a baseline.

## Success criteria

- **SC-001**: A change that makes a lower layer know a higher one, or a layer know an engine it should not, fails `bun run verify` and names the file and the rule.
- **SC-002**: No import by package name escapes the check, which the compiler and the runtimes do not give.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
