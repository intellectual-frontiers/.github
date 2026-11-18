# Feature Specification: Names

**Spec ID:** 0005-naming
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** A name in governance is a TypeScript identifier, lower camel case, and nothing about a database: `givenName`, `partyRole`, `line1`. A database writes the same name another way (`given_name`), another database a third (`GIVEN_NAME`), and a database has names that governance never wrote (the column of a foreign key, the name of an index). So a name crosses the layers as a list of words. Governance splits its names into words, the logical schema chooses which words each element of a relational schema has, and the physical schema joins them in the case style of its target. The case style is a strategy that an extension adds, so that snake case is the default and not the rule, and the same governance domain makes a schema in either.

## Names in governance

- **FR-001**: A name in governance (of a domain, a concept, an attribute, a relationship, a code list or a code) MUST be lower camel case, `[a-z][a-zA-Z0-9]*`, so that it is a TypeScript identifier and holds no underscore; a name that is not MUST be an error of `domain` (0003-governance FR-004).
- **FR-002**: `words` MUST split a name into lower-case words: at a change from lower case to upper (`givenName` into `given` and `name`), on either side of a run of digits (`line1` into `line` and `1`; `iso3166Code` into `iso`, `3166` and `code`), and at the end of a run of capitals (`HTTPServer` into `http` and `server`); it MUST give the same words for the same name every time and at least one word for a valid name, and it is the only place that knows how a name splits.

## Names below governance

- **FR-003**: The logical schema MUST name each element of a relational schema as a list of words made from governance's names by conventions it states: a concept's table by the words of its name, an attribute's column by the words of its name, the column of an attribute that is a code of an open code list by the words of the list and `code`, the column of a relationship by the words of the target and `id` (with the words of the relationship before them where its name is not its target's), an index by the table, its members and `idx`, a uniqueness by `uq`, a rule by its words and `ck`.
- **FR-004**: The physical schema MUST write a list of words as a name in the case style of its target, with the quoting, the length limit and the reserved words of its dialect.
- **FR-005**: A case style MUST be a strategy that an extension adds through the engine (`snake`, `camel`, `pascal` are the library's own), and snake case MUST be the default of a composition that names none.
- **FR-006**: The stored value of a code MUST be written by the case style too, from the code's name in the code list (`employedBy` stored as `employed_by` in snake case), so that data stored by a snake case schema stays what it was; a project MAY choose to store the name as it is.
- **FR-007**: Two elements whose names are equal after they are written MUST be returned as an error value of the projection, never silently made one (`line1` and `line_1` are not both a name of governance, but two words that join alike can come from different names).

## Out of scope

- The projection and the binding that use these conventions: the specifications of the logical and the physical schema.
- Names in another human language, and the transliteration of non-ASCII names: a name is ASCII.
- A name of a vocabulary's annotation (`privacy.personal`): it is not an element's name.

## Edge cases

- `concept("party_role", ...)`: an error of `domain`, for it holds an underscore, per FR-001.
- `concept("PartyRole", ...)`: an error of `domain`, for it begins with a capital, per FR-001.
- `words("line1")`: `line` and `1`, written `line_1` in snake case, per FR-002 and FR-004.
- `words("ulid")`: `ulid`, one word, per FR-002.
- `words("HTTPServer")`: `http` and `server`, per FR-002.
- `words("a")`: `a`, one word, per FR-002.
- A code `employedBy` of an open list, stored in a snake case schema: `employed_by`, per FR-006.

## Assumptions

- Only FR-001 and FR-002 are built with governance; FR-003 to FR-007 are Planned and the register says so for each.
- A name of three words or more is written in full: shortening to a dialect's limit is the physical schema's (FR-004).
- Digits are words of their own, so that `line1` becomes `line_1`, as the model this one replaces wrote its column.

## Open questions

- **OQ-1**: Whether a name may keep a capital run as one word (`ID`), where a business writes it so.

## Key entities

- **Name** - a governance identifier in lower camel case.
- **Words** - the lower-case words a name splits into.
- **Case style** - how a list of words is written as a name in a target (snake, camel, pascal).

## Success criteria

- **SC-001**: A domain written once makes a schema whose names a person reads as their database's own, whatever its case, and changing the style changes no domain.
- **SC-002**: No name of governance holds a database's convention.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
