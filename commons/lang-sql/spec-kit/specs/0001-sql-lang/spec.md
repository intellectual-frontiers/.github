# Feature Specification: SQL language core, lexical layer

**Spec ID:** 0001-sql-lang
**Status:** Active
**Owner:** if
**Domain:** lang-sql

**Input:** SQL is written by programs and read from people, and commons needs a language library that reads it in any dialect: this library, `lang-sql`, which lifts the SQL language out of `commons/data` so that `data` and the other libraries that speak SQL consume it by package name and none of them depends on the others. This feature is the first layer of a small, fast, portable SQL language library that many later features read: the lexical layer, which turns text in any dialect into tokens and comments with exact positions, and the way a dialect says how it is written. The parser, the abstract syntax tree, the walkers, the projection to `unist` and the extraction of documentation are later specifications of the same folder; this one is what they stand on. The folder is built so that it can be published alone as `@intellectual-frontiers/sql-lang` and is, by default, a part of this library.

## The shape of the library

- **FR-001**: Every file of `src/` MUST import only other files of `src/` by relative paths and, by package name, `@intellectual-frontiers/core`; it MUST import no other library of commons and no `node:` module, so that the library runs on Bun, Node, Deno, a browser and a Worker.
- **FR-002**: The files directly in `src/` (the core) MUST NOT import `dialects/` or `extensions/` and MUST name no dialect but the base, `ansi`; a file of a dialect MAY import the core and the dialects it extends; a file of an extension MAY import the core alone.
- **FR-003**: Another library MUST consume this one by its package name, `@intellectual-frontiers/lang-sql` and its exports `./dialects/<name>` and `./extensions/<name>`, and MUST NOT import a file of it by a relative path; the manifest's exports MUST name the core, every dialect folder and every extension folder.

## Tokens

- **FR-004**: `lex(text, lexical)` MUST accept any string and any compiled lexical, MUST NOT throw, MUST end, and MUST return the tokens, the comments and the errors of the text, so that every character of the text is in exactly one token, exactly one comment or white space, the tokens and comments in the order of the text and none overlapping: the text can be put back from its parts.
- **FR-005**: The tokens MUST be kept as parallel columns (kind, start, end, id), each with a kind from a closed set (word, quoted identifier, number, string, parameter, operator, the punctuation, error, end of text), the last token always the end of text; a word that the dialect lists as a keyword MUST carry the keyword's id, found without regard to case, and a word with a character outside ASCII MUST NOT be a keyword.
- **FR-006**: What the text holds that the dialect cannot read (a comment, a string or a quoted identifier that is not closed, a character no rule reads) MUST be an error value with its span, one sentence each, and the lexer MUST go on: an unclosed comment, string or quoted identifier ends at the end of the text and a character no rule reads is a token of the error kind.
- **FR-007**: A string MUST be read as its dialect writes it: the quote that opens it, the quote that closes it (a quote of more than one character such as `'''` too), the way a quote is written inside it (by writing it twice, by a backslash, either or neither), the prefixes before the quote that change that (such as `E`, `N`, `X`, `B`, `U&`, `R`), and, where the dialect has them, dollar quotes (`$$ ... $$`, `$tag$ ... $tag$`); a quoted identifier MUST be read with its dialect's quotes and be closed by writing its close quote twice.
- **FR-008**: A number MUST be read with its fraction, its exponent, an initial point (`.5`) and, where the dialect says so, a radix prefix (`0x`, `0b`, `0o`) and underscores between digits; a parameter MUST be read in the styles the dialect lists (`?`, `?1`, `$1`, `$name`, `:name`, `@name`); an operator MUST be the longest of the dialect's operators at its place, else one character.

## Comments

- **FR-009**: A comment MUST NOT be dropped: every comment of the text, of every kind the dialect has (a line comment from `--`, `#`, `//` or `#!` to the end of the line; a block comment between its delimiters, nested where the dialect nests them and not where it does not), MUST be returned with its kind, its marker, its span, its text without the markers and its place; the kinds and markers a dialect has are data of its lexical and nothing in the lexer names a dialect.
- **FR-010**: A block comment that begins `/*+` in a dialect that has hints MUST be of the kind `hint`, one that begins `/*!` in a dialect that has conditional comments MUST be of the kind `conditional`, and every other is `line` or `block`; where the dialect has neither, `/*+` and `/*!` are `block` comments.
- **FR-011**: A line comment whose dialect asks for a space after its marker (MySQL's `--`) MUST be a comment only where its marker is followed by white space, a control character or the end of the text; otherwise its characters are read as the operators they are.
- **FR-012**: A comment's place MUST be given so that a parser can attach it to a node without reading the text again: `before`, the number of tokens that precede it (the token before it is `before - 1` and the token after it is `before`), `ownLine`, whether only white space stands between the start of its line and it, `blankAfter`, whether a blank line (or the end of the text) follows it, and `terminated`, whether it is closed.
- **FR-013**: What looks like a comment inside a string, a quoted identifier or another comment MUST NOT be a comment.

## Positions

- **FR-014**: A position MUST be given from an offset in the text: `lineIndex(text)` makes the starts of the lines once, and `positionAt(index, offset)` gives the line and column (each from 1) and the offset, in the units of the string (UTF-16 code units, as a `unist` position has them); a line ends at `\n`, `\r\n` or a lone `\r`, and an offset outside the text is placed at its nearest end.

## Dialects

- **FR-015**: How a dialect is written (its comments, its quoted identifiers, its strings and their prefixes, its parameters, its operators, its keywords, its numbers) MUST be one value, a `Lexical`, that `compileLexical` turns into the tables the lexer reads, once; a lexical that cannot be compiled (an empty marker, a marker, quote or operator that does not begin with an ASCII character, a quote used for both a string and an identifier, a keyword that is not a word) MUST be an error value that names the field, and never a thrown error.
- **FR-016**: A dialect MUST be a value made by `defineDialect` from a name, the dialect it extends (or none) and a function from its parent's lexical to its own, so that a dialect says only what differs and a chain of dialects is resolved once; a dialect that extends another MUST be able to remove and replace what it inherits as well as add to it.
- **FR-017**: The core MUST hold the base dialect, `ansi`; SQLite, PostgreSQL and DuckDB MUST each be a dialect of its own folder, `dialects/sqlite`, `dialects/postgres` and `dialects/duckdb`, that extends `ansi` and says its comments (SQLite and PostgreSQL's nesting, and what each does with `#`), quoted identifiers (SQLite's backtick and square brackets), strings (PostgreSQL's `E''` and dollar quotes), parameters and operators as the engine documents them.

## Speed

- **FR-018**: The lexer MUST read the text in one pass by character codes, with no regular expression, no allocation for a token (the columns are arrays) and no copy of the text (a token is a span; its text is cut only when asked), and MUST find a keyword by a hash of its characters folded to upper case, compared against the keyword without allocating; a benchmark (`bun tools/bench.ts`) MUST measure its throughput on a pinned corpus of this library's own, and the throughput of sqlglot's tokenizer on the same corpus MUST be recorded beside it, so that a later change is judged against a number.

## Out of scope

- The parser, the abstract syntax tree, the attachment of comments to nodes, the walkers and queries over the tree, the projection to `unist`, the extraction of documentation, SQL over a data structure, a file system or an object store, and the dialects beyond the three: later specifications of this folder, numbered after this one.
- Writing SQL from a tree (generation) and changing a tree into another dialect's.
- Splitting the dialects into packages of their own (OQ-1).

## Edge cases

- Text with a byte order mark: the mark is white space, per FR-004.
- A `--` that follows a minus (`a--b`) in a dialect whose comment needs a space after it: operators, per FR-011.
- `/*/`: a block comment that is not closed, per FR-006; `/**/`: an empty one that is.
- A nested block comment in a dialect that does not nest them: the first `*/` closes the comment, per FR-009.
- `$1` in a dialect with dollar quotes: a parameter; `$$` and `$tag$`: a dollar quote, per FR-007 and FR-008.
- `1abc`: a number, then a word; the lexer does not judge it, per FR-008.
- A lone surrogate or a character such as `\`: a token of the error kind, per FR-006.

## Assumptions

- The three dialects' lexical facts are those of their documentation: SQLite does not nest block comments, PostgreSQL does; MySQL (a later dialect) needs a space after `--` and has `#`.
- A parser, not the lexer, decides where a word is a keyword, and where `[` or `?` is an operator or a quote.
- sqlglot (MIT) was read to see what a dialect-neutral SQL front end has to cover; no code or fixture of it is copied into this folder. Its tokenizer's throughput on the corpus of this library is measured with `bun tools/bench.ts` and the command it prints.
- Measured on 2026-11-21, on one cloud container and with sqlglot at commit `b812ff9` as it is installed from a checkout (its tokenizer not compiled): sqlglot's tokenizer reads the 4 MB corpus at 1.36 MB/s, and the first version of this lexer, before any tuning, at 66 MB/s (`ansi`) to 92 MB/s (`sqlite`). One machine and one corpus, a number to be judged against and not a claim about sqlglot's compiled build.

## Open questions

- **OQ-1**: Whether each dialect becomes its own `lang-sql-<dialect>` package. Splitting is deferred until one of them has a heavy dependency; until then the dialects are subpath exports of this package, which is published to npm like every library of commons.

## Key entities

- **Lexical** - the data that says how a dialect is written.
- **Dialect** - a name, a parent and a lexical, resolved.
- **Tokens** - the parallel columns the lexer returns.
- **Comment** - a kept comment, with its kind, marker, span, text and place.

## Success criteria

- **SC-001**: For any text, the lexer returns tokens and comments from which the text can be put back, and every comment a dialect has is found, with its place.
- **SC-002**: The folder can be moved out of this library and compiled alone against `@intellectual-frontiers/core`.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
