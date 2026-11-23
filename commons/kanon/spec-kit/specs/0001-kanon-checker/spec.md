# Feature Specification: Kanon checker

**Spec ID:** 0001-kanon-checker
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The library `@intellectual-frontiers/kanon` is the code of the pattern that commons specifies as commons 0033-kanon: the type of a library's table of layers, the import check that holds the table (lifted from the checks that `commons/data` and `commons/headless` each kept), the check that no annotation of Governance is dropped, and the types-only contract `LayeredModel`. It is a utility library of a single level: it is not itself built in layers, and declares no table.

## The table

- **FR-001**: The library MUST give the type of a table (a package name and units, each unit a folder with a layer of Governance, Logical or Physical, or `own`), the three layers with their ranks, and a decoder that reads a table from the `kanon` field of a manifest; WHEN a unit declares a layer that is not one of the three, a folder with no trailing slash, a folder twice, a unit in no layer that is not `own`, an `own` unit with a layer, or a `mayImport` naming no unit, the decoder MUST refuse the table with one sentence naming the unit.
- **FR-002**: WHEN a file's path is given, the library MUST name the unit it is in, the most specific folder winning, and for a unit with instances one unit for each folder under it; a path that no unit holds MUST be found as none. An own unit MAY name exact paths relative to its folder in `files`, so a production entry point can be declared without exempting unrelated files.

## The check

- **FR-003**: The library MUST parse TypeScript source without executing it and read module references from its syntax tree with the line of the module target. It MUST distinguish static imports, side-effect imports, re-exports, type imports and dynamic imports. Literal module targets MUST be checked against the layer rules; computed dynamic targets MUST be represented explicitly as unresolved and are outside the static layer check. Comments and strings that describe imports MUST NOT count as imports. A syntax error MUST produce a `layers/syntax` finding with its source line and MUST fail the command even if an existing baseline names that finding.
- **FR-004**: The import check MUST be pure and MUST give, from a table, the files and the `exports` map of the package, a finding with a code, a file, a line, a sentence and a key for each of: a file in no unit (`layers/unclassified`), a file of another unit imported by a relative path (`layers/relative`), an import of the package by a path `exports` does not name (`layers/private`), an import of a package the unit's row does not allow (`layers/external`), an import of a unit that stands below the importer, even when explicitly listed (`layers/above`), an import of a unit of the same layer or one the row does not list (`layers/around`) and a loop among distinct units connected by permitted imports (`layers/cycle`, once, at the import that closes it); a unit that is `own` MUST be exempt from the relative-import and reach rules.
- **FR-005**: The library MUST find each annotation of an element of the first layer of a `LayeredModel` that no disposition of the model accounts for as `kanon/dropped`, and a disposition that names a target that is no element of the model, or an unexpressed annotation with no reason, MUST be the same finding.

## The contract

- **FR-006**: The library MUST give `LayeredModel` as types only (no value but the lists of agreed kinds and the builders of the ids: `headless:<program>/<verb-path>`, `cli:<program> <verb path>`, `mcp:<tool_name>`, `rest:<METHOD> <path>`, and `<verb id>#--flag` or `<verb id>#<operand>`), in the shape of the layered model of the documentation generator with the account of the annotations added.

## The host and the package

- **FR-007**: The library MUST read from the file system, in its `host` entry only, a library's manifest for its table, the `exports` of its package and its `.ts` files (leaving out `node_modules`, `dist` and the spec kit), and MUST judge the findings against a baseline of keys that only shrinks: a finding the baseline does not hold, and a line of it that no longer occurs, MUST each fail the command `check` (exit 1), and a table that cannot be read MUST exit 2. The manifest MUST be read as data by locating its top-level exported constant in the syntax tree and decoding its literal initializer without evaluation.
- **FR-008**: The library MUST be published as compiled modules with their declarations (commons 0032-libraries-by-concern FR-005, FR-013): the entries `.`, `./check` and `./host`, each with a `types` file, and it MUST be proved by `bun run verify` in its folder.

## The typing

- **FR-009**: The library MUST be typed as an algebra (commons 0033-kanon FR-018): the layers, the finding codes and the kinds of a unit are closed unions matched exhaustively, a unit is a sum of a layered unit and an own unit, a folder, a package name and an element id are branded types made only by a smart constructor that returns a `Result`, the records are `readonly`, the host reads through a port (a record of functions) and returns a `Result` for a failure it can cause, and the pure modules throw nothing, use no `any`, no non-null assertion and no `enum`.

## Instances, plugins and families

- **FR-010**: The decoder MUST read, in the table, the optional `family` (two name templates, `dialect` and `plugin`, each with `{host}` once and `{name}` once, and optionally `contract`, an export subpath), `instances` (each a `name`, the `instanceOf` unit it is an instance of and a `placement` of `folder` or `package`), `plugins` (each a `noun` and optional `dependsOn` nouns of other plugins) and `extends` (the host package of a package that is a dialect or a plugin), into a `Table` that always has `instances` and `plugins`; it MUST refuse, with one sentence, instances or plugins with no family, a template without its two holes or with the same text for dialect and plugin, an instance of no layered unit, a folder instance of a unit that has no `instances`, a name or noun that is declared twice or is not a name, a plugin noun that would read as a dialect, a dependency on itself, on no plugin or in a loop, a contract that is not an export subpath, and a table that both extends a host and declares members.
- **FR-011**: The library MUST derive the package of each member from the family's rule and never from a second spelling (`memberPackage`), and MUST read a package name back as the host, a dialect, a plugin or none (`classify`), a dialect before a plugin and only within the host's scope; a name made for any dialect name round-trips to that dialect, and one made for any plugin noun that is not `dialect-...` to that plugin.
- **FR-012**: The checks MUST give, as data in the form of the others, these further codes: `instances/sibling` (an instance imports another instance of its unit, or a dialect another dialect), `instances/undeclared` (a folder under a unit whose instances the table declares that no instance names), `plugins/inverted` (a host's file outside its own checking imports a dialect or a plugin of its family), `plugins/undeclared` (an extension imports a member of the family it declares no dependency on), `plugins/contract` (the family's contract is not among the host's exports, or a plugin does not import it) and `family/name` (a package that extends a host is not one the host's table declares by the family's rule, or names another host); `extensionFindings` MUST be pure, take the host's table and `exports` with the extension's table, files and `exports`, reach the host only through the host's `exports` (`layers/private` otherwise), let a dialect reach the units its instance's unit may import and a plugin any unit the exports name, and treat a relative import that leaves the package as `layers/relative`; the host side MUST find the host beside the extension by the package name of `extends`.
- **FR-013**: WHERE a model has instances, the check of FR-005 MUST be made for each instance: an annotation of Governance MUST end, for each instance, expressed, carried or unexpressed with a reason, by a disposition given for that instance or else by one given for none; an annotation with none for an instance, a target that is no element or that belongs to another instance, an unexpressed one with no reason, and a disposition for an instance the model does not have, MUST each be a `kanon/dropped` finding whose key names the instance; `ModelElement` MUST be able to say which instance it belongs to.
- **FR-014**: The library MUST build, from a model and with no other input, the matrix of requirement by instance (`buildMatrix`): a row for each annotation of each element of the first layer and a cell for each instance, each cell one of `expressed`, `carried`, `unexpressed` (with its reason) or `dropped`, made from the same reading of the dispositions as FR-013 so that a `dropped` cell is a finding and no other cell is; it MUST render it as a Markdown table (`matrixMarkdown`) and as JSON (`matrixJson`), both pure and in the order of the model, and count its cells by outcome (`matrixTotals`).

## Acceptance scenarios

1. **Given** a table with a layer of `middle`, **When** it is decoded, **Then** it is refused, per FR-001.
2. **Given** a table with a unit that has instances, **When** a file under one of its folders is placed, **Then** it is in that folder's unit, per FR-002.
3. **Given** a file with an import in a comment, a dynamic import and a re-export, **When** it is read, **Then** the two real imports are found with their lines, per FR-003.
4. **Given** a file of Governance that imports Logical by the package's name, **When** the check runs, **Then** it reports `layers/above`, per FR-004.
5. **Given** a file of Logical that imports a file of Physical by a relative path, **When** the check runs, **Then** it reports `layers/relative`, per FR-004.
6. **Given** a model with an annotation of Governance that nothing accounts for, **When** it is checked, **Then** it reports `kanon/dropped`, and after the annotation is named unexpressed with a reason, nothing, per FR-005.
7. **Given** a library whose manifest declares a table and whose tree breaks it, **When** `check` runs with an empty baseline, **Then** it exits 1, and with the finding held it exits 0, and with a held line that no longer occurs it exits 1, per FR-007.

8. **Given** a host with two dialects declared by package, **When** a dialect imports the other, **Then** it reports `instances/sibling`, per FR-012.
9. **Given** a plugin that imports a plugin it declares no dependency on, **When** the check runs, **Then** it reports `plugins/undeclared`, and with the dependency declared nothing, per FR-012.
10. **Given** a model with two dialects and an annotation accounted for in one, **When** it is checked, **Then** `kanon/dropped` names the other dialect, per FR-013.
11. **Given** that model, **When** the matrix is built and rendered, **Then** a row for each annotation has a cell for each dialect and the Markdown and the JSON say the same, per FR-014.

## Out of scope

- The pattern itself and its vocabulary: commons 0033-kanon of the specifications of commons.
- Moving the checks that `commons/data` and `commons/headless` keep.

## Edge cases

- A surface folder with no row in the table: `layers/unclassified`, per FR-004.
- Two instances of one class that import each other: `layers/cycle`, per FR-004.
- An `exports` target given as an object of conditions: the `bun` or `default` target is read, per FR-004.

## Assumptions

- A library's `.ts` files are all under its root and none is outside a unit the table names.

## Open questions

- **OQ-1**: Whether a conformance level of commons requires a library to declare its table (commons 0033-kanon OQ-1); the check of the manifests has the switch and no level uses it.

## Key entities

- **Table** - the units of a library, each in a layer, as data in its manifest.
- **Finding** - a breach of the table or of the account of annotations, with a key a baseline can hold.
- **LayeredModel** - the types-only contract of a Kanon library's model.

## Success criteria

- **SC-001**: A library's layers are held by one check, whatever its units are called.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
