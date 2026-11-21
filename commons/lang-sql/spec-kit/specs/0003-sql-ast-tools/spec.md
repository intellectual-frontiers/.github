# Feature Specification: Rewriting, queries and unist for the SQL syntax tree

**Spec ID:** 0003-sql-ast-tools
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** 0002-sql-ast-parser gives a tree and the walks that read it. What a program does with a tree is mostly three things: change it (rename a table, replace a column by an expression), ask it questions (which tables does this statement read, is it read-only, which functions does it call), and hand it to the tools that already exist for trees. This feature adds all three to `src/`: a rewrite that keeps the types of the tree, typed queries and a few named analyses as an extension, and a projection of the tree and its comments to `unist`, as an extension, so that the `unist` utilities (`unist-util-visit`, `unist-util-select` and the rest) read a SQL tree as they read a Markdown one.

## Rewriting

- **FR-001**: `rewriteScript`, `rewriteStatement`, `rewriteQuery`, `rewriteSource` and `rewriteExpr` MUST rewrite a tree from the leaves up by rules given for the sorts `ident`, `name`, `expr`, `query`, `source` and `statement`: a rule is called for each node that stands in a place of its sort, with the node whose children have already been rewritten, and returns a node of the same sort to replace it or `undefined` to keep it; a rule's type MUST make a node of another sort not compile, and the result MUST have the type of the sort of the node it was given.
- **FR-002**: A rewrite MUST NOT change the tree it is given, MUST give back the very same object for every node that no rule changed and for the whole tree where no rule changed anything, and MUST make new objects only for a changed node and the nodes above it.
- **FR-003**: A rewrite MUST keep the range of every node it does not replace (including the nodes above a replaced one), and MUST give a replacing node the range its rule gave it; the builders `build.ident`, `build.name`, `build.number`, `build.string`, `build.boolean`, `build.null`, `build.star`, `build.unary`, `build.binary` and `build.call` MUST take the range of the node they stand for as their first argument.
- **FR-004**: A rewrite MUST handle every kind of node, with a `switch` on `kind` that ends with `absurd`, and MUST NOT throw for any tree the parser can make; a rule for `ident` MUST be called for every identifier of the tree, wherever it stands.

## Queries

- **FR-005**: `parentIndex(root)` MUST make, once, the table from each node to its parent; `parentOf` and `ancestors` MUST read it, nearest first.
- **FR-006**: `select(root)` MUST give a selection of nodes that is lazy and can be read again, and whose methods `children`, `descendants`, `find(kind)`, `ofKind(kind)`, `where`, `map`, `flatMap`, `parent`, `ancestors` and `closest(kind)` give a selection whose type follows the kind asked for (`find("table")` is a selection of table references), and whose ends `toArray`, `first`, `count`, `some` and `every` read it; nodes MUST come in the order of the text.
- **FR-007**: `tableUses(root)` MUST give each use of a table by name and access (`read` for a table in a source, `write` for the target of `INSERT`, `UPDATE` and `DELETE`, `create` for `CREATE TABLE` and `CREATE VIEW`, `alter` for `ALTER TABLE` and `CREATE INDEX`, `drop` for `DROP`) with the node, in the order of the text; a single name that is the name of a common table expression in scope MUST NOT be a table; a common table expression is in scope in the body of its `WITH`, in the common table expressions after it, and, where the `WITH` is recursive, in its own and the others'.
- **FR-008**: `functionsCalled(root)` MUST give every call with its name and node; `readOnlyProblem(script)` MUST give `undefined` for a script of one query and, for anything else, one sentence that says why (more than one statement, no statement, a statement that could not be read, or the kind of statement that changes data or definitions).

## The projection to unist

- **FR-009**: `toUnist(parsed)` MUST give a tree of `unist` nodes in which each node of the syntax tree is a node whose `type` is its kind; a node with children has `children` in the order of the text, a node without (an identifier, a number, a string, a boolean, `NULL`, a parameter) has a `value` (the identifier's name, the number's text, the string's value, the boolean, `null`, the parameter's text), and each has a `position` of `unist` points (line and column from 1, offset from 0) for its range.
- **FR-010**: Each node's `data` MUST hold the fields of the syntax node that are not nodes (`op`, `distinct`, `negated`, `quoted`, `prefix` and the rest), and a node that is the child of another MUST say in its `data` which field of the parent it is (`field`) and, in a list, its place in it (`index`), so that the tree loses nothing of the syntax tree's structure.
- **FR-011**: Each comment MUST be a node `comment` with its text as `value` and, in its `data`, its style, marker, placement, whether it is on a line of its own and the node it is attached to (its type and range), among the children of the node that encloses it, so that the order of the children is the order of the text; the option `comments: false` MUST leave them out. A statement that could not be read MUST be a node `unparsed` whose children are its comments and whose `data.source` is its text.
- **FR-012**: The projection MUST NOT change the tree or the comments it is given, MUST give the same tree for the same input, and MUST be a tree in the `unist` sense: every node an object with a string `type`, every parent an array of children, no node twice.
- **FR-013**: The projection MUST be read by the `unist` utilities as it stands: `unist-util-visit` MUST visit its nodes by type and in order, and `unist-util-select` MUST select with type, child, descendant and attribute selectors; the nodes MUST be assignable to the types of `@types/unist`.

## Out of scope

- Writing SQL from a tree, so a rewritten tree is not yet turned back into text; writing a `unist` tree back as a syntax tree.
- Typing each projected node by the kind it is projected from: the projection's types are the same for every kind (OQ-1).
- Resolving columns to the tables they come from, and the scope rules of names beyond the common table expressions.
- Using these in the rest of this library (the read-only check of `queries` still uses its pattern): a later step.

## Edge cases

- A rule that returns the node it is given, or `undefined`: nothing changes, per FR-002.
- A rule for `expr` that replaces a column by an expression: the expression's ancestors are new objects with their old ranges, per FR-002 and FR-003.
- `WITH a AS (SELECT * FROM a) SELECT * FROM a`: the `a` in the common table expression is a table where the `WITH` is not recursive and a reference where it is, and the `a` in the body is a reference, per FR-007.
- `SELECT 1; SELECT 2`: not read-only for a script of two statements, per FR-008.
- A comment inside a statement that could not be read: a child of the `unparsed` node, per FR-011.
- A comment between two columns: a child of the `create-table` node between them, per FR-011.

## Assumptions

- A node made by a rule has the range its rule gave it, and builders are given the range of what they replace: a rewritten tree has no text of its own.
- `unist` positions are in the units of the string, as 0001-sql-lang says.
- Names are compared as written for the common table expressions: an unquoted name is compared without regard to case and a quoted one as written.

## Open questions

- **OQ-1**: Deriving the type of each projected node from the kind it is projected from (a `select` node whose children are typed) needs one cast at the boundary or a projection written out for each of the kinds; the first is against the rules of this library and the second is long. The projection is typed the same for every kind until one of them is chosen.

## Key entities

- **Rules** - what a rewrite calls for each sort.
- **Selection** - a lazy, typed set of nodes.
- **Projection** - the `unist` tree of a parse.

## Success criteria

- **SC-001**: A rule written for a sort cannot return a node of another sort, and a rewrite that changes nothing returns its input.
- **SC-002**: The `unist` utilities work on a parse of the corpus without a line of adaptation.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
