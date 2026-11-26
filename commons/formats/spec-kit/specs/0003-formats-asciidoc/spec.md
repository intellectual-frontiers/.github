# Feature Specification: Formats AsciiDoc

**Spec ID:** 0003-formats-asciidoc
**Status:** Active
**Owner:** if
**Domain:** formats

**Input:** Two libraries write AsciiDoc: the documentation library writes the volumes of a book from the pages of a site, and the dossier library (commons 0046-dossiers) writes a sealed file of evidence. Each must keep text from being read as markup, in the same way, and a rule held in two places is a rule that drifts. Formats holds the rules once, as pure functions over text.

## Requirements

- **FR-001**: Formats MUST have a module `asciidoc` that exports `textAdoc`, `lead`, `codeAdoc` and `fence`, each a pure function over text with no outside package and no host global, and the module MUST be reachable as `@intellectual-frontiers/formats/asciidoc`.
- **FR-002**: `textAdoc` MUST give, for any text, AsciiDoc that a reader shows as exactly that text: a run with a character that the language reads as markup (an asterisk, an underscore, a backtick, a hash, a caret, a tilde, a brace, a bar, a plus, a backslash, an angle bracket, an ampersand, a double hyphen, an ellipsis, a symbol in parentheses, an address) MUST be passed through unchanged, and a square bracket MUST be written as the attribute that holds its place, so that no text closes a macro or makes an anchor.
- **FR-003**: `lead` MUST give a line that begins safely: a line that the language would read as a list item, a heading, a block title, a comment, an attribute entry, an admonition, a page break or a list continuation MUST begin with `{empty}`, and any other line MUST be as it is.
- **FR-004**: `codeAdoc` MUST write text as code in a line with its square brackets apart, and `fence` MUST give a delimiter of a source block that is longer than any line of hyphens in the text it fences.

## Acceptance scenarios

1. **Given** the text `a * b [c]`, **When** it is made safe with `textAdoc`, **Then** it contains no unescaped asterisk and no square bracket, per FR-002.
2. **Given** a line `== not a heading`, **When** it is given to `lead`, **Then** it begins with `{empty}`, per FR-003.
3. **Given** text with a line of six hyphens, **When** it is given to `fence`, **Then** the delimiter has seven or more, per FR-004.

## Out of scope

- The model of a page or of a dossier, and the anchors of either: the libraries that write them.

## Edge cases

- Empty text is empty after `textAdoc`, per FR-002.

## Assumptions

- A reader of the output is a program that reads the base language of AsciiDoc.

## Open questions

- None.

## Key entities

- **Safe text**, **Lead line**, **Fence**.

## Success criteria

- **SC-001**: One copy of the rules serves every writer of AsciiDoc in commons.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the code it holds
