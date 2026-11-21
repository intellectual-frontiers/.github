# Feature Specification: Stored routines and procedural code

**Spec ID:** 0006-sql-routines
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** `CREATE FUNCTION` and `CREATE PROCEDURE` carry code in another language (PL/pgSQL, SQL, a procedural block of a dialect), and that code holds statements that end in `;`, so a parser that ends a statement at the first `;` cuts a routine in pieces. This feature makes the parser end a statement where the statement ends, reads the header of a routine (its name, parameters, result, language and characteristics) and finds where its body is, and, as an extension, reads the body of a PostgreSQL routine as PL/pgSQL: its blocks, declarations, control flow, loops, cursors, exceptions and the SQL it embeds, which the core parser reads with its positions in the whole text.

## Where a statement ends

- **FR-001**: A statement that is procedural (a `CREATE` of a function, procedure, trigger, package or event, with or without `OR REPLACE` and a `DEFINER`; an anonymous block that begins `BEGIN` where `BEGIN` does not begin a transaction, or `DECLARE`; an `IF` or `WHILE` at the start of a statement) MUST end at the first `;` that is outside every block it opens, where a block is opened by `BEGIN`, `CASE`, `LOOP` and `REPEAT`, and by `IF` where it begins a statement (after `;`, `THEN`, `ELSE`, `ELSIF`, `ELSEIF`, `BEGIN`, `LOOP` or a label), and closed by `END`, a word after `END` (`IF`, `LOOP`, `CASE`, `WHILE`, `REPEAT`, `FOR`, `TRY`, `CATCH`, or a label) not opening another; a string, a quoted identifier, a dollar quote and a comment hide what they hold; and every other statement MUST end at its first `;`, as before.
- **FR-002**: `BEGIN` MUST begin a transaction, and end at its `;`, where it is followed by `;`, the end of the text, or one of `TRANSACTION`, `WORK`, `DEFERRED`, `IMMEDIATE`, `EXCLUSIVE`, `ISOLATION`, `READ` or `NOT`; elsewhere it begins a block.

## The header of a routine

- **FR-003**: `CREATE [OR REPLACE] FUNCTION | PROCEDURE name (parameters) ...` MUST be a node `create-routine` with its object, whether it replaces, its name, its parameters (each a node `routine-param` with its mode `IN`, `OUT`, `INOUT` or `VARIADIC`, its name, its type and its default), what it returns (a type, `SETOF` a type, or `TABLE (columns)`), its language, its other characteristics as written (`IMMUTABLE`, `STRICT`, `SECURITY DEFINER`, `COST 100`, `SET x TO y` and the rest), and its body; a header the grammar does not read MUST be a `command`, as any other `CREATE` of an object it does not read.
- **FR-004**: The body MUST be a node `routine-body` with its style and its text: `dollar` (`AS $$ ... $$`), `string` (`AS '...'`, with the text as the string's value and `exact` false where the source has escapes), `block` (`BEGIN ... END`, `BEGIN ATOMIC ... END`, or `AS BEGIN ... END`), `return` (`RETURN expression`, with the expression read) and `external` (`AS 'object', 'symbol'`); and for a `dollar` body, and a `string` or `block` body with nothing escaped, the offsets of the text between its delimiters in the whole text, so that what is in it can be read with its positions in the whole text.

## PL/pgSQL

- **FR-005**: `parsePlpgsql` MUST read the body of a routine whose language is PL/pgSQL (and a `DO` block) as a block: `[<<label>>] [DECLARE declarations] BEGIN statements [EXCEPTION WHEN condition [OR condition] THEN statements] END [label]`, with declarations of variables (`CONSTANT`, `NOT NULL`, `DEFAULT`, `:=`, `=`, `%TYPE`, `%ROWTYPE`, `ALIAS FOR`) and cursors, and the statements assignment, `IF`/`ELSIF`/`ELSE`, `CASE` (searched and simple), `LOOP`, `WHILE`, `FOR` over an integer range and over a query, `FOREACH`, `EXIT` and `CONTINUE` with a label and `WHEN`, `RETURN`, `RETURN NEXT`, `RETURN QUERY`, `RAISE`, `PERFORM`, `EXECUTE`, `OPEN`, `FETCH`, `MOVE`, `CLOSE`, `CALL`, `NULL`, `GET DIAGNOSTICS`, `ASSERT`, `COMMIT`, `ROLLBACK`, a nested block, and a SQL statement.
- **FR-006**: The expressions and SQL statements a body holds MUST be read with the core parser as nodes of the core tree with their positions in the whole text; an `INTO [STRICT] targets` of a SQL statement MUST be taken out of it and kept as the statement's targets; dynamic SQL (`EXECUTE`) MUST keep its command as an expression and its `USING` expressions.
- **FR-007**: The comments of a body MUST be kept and attached to its nodes by the same rule as the comments of a script.
- **FR-008**: `parsePlpgsql` MUST NOT throw; what it cannot read MUST be an error value with its span in the whole text, and the statement that holds it MUST be kept as a node of the kind `pl-unparsed`, so that the statements after it are read.
- **FR-009**: Every routine of the corpus of PL/pgSQL functions (taken from PostgreSQL's regression tests) MUST be read without a throw, and the number whose body is read with no error MUST be held by a ratchet that only rises.

## Out of scope

- The bodies of routines of the other dialects (PL/SQL, T-SQL, MySQL, BigQuery and Snowflake scripting), which are read as `block` bodies without being read inside, and triggers, which are commands.
- Checking that a variable is declared, that a type exists or that a label is used.

## Edge cases

- `CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql; SELECT 1`: two statements, per FR-001.
- `BEGIN; SELECT 1; COMMIT;`: three statements, per FR-002.
- `DO $$ BEGIN PERFORM 1; END $$`: one statement, a command whose body is read as a block, per FR-005.
- `CASE WHEN a THEN 1 END` inside a body: opens and closes, per FR-001.
- `END IF;` and `END LOOP;`: close one block each, per FR-001.
- `IF EXISTS` in `DROP TABLE IF EXISTS t;`: not a block, per FR-001.
- `SELECT a INTO x FROM t` in a body: the select without its `INTO`, and `x` as the targets, per FR-006.

## Assumptions

- A label is `<<name>>`; a loop's label is the one before it.
- The rule of FR-001 is the common rule of the dialects with blocks, not each dialect's grammar: a procedural statement the rule ends wrongly becomes an error value like any other.

## Open questions

- **OQ-1**: Reading the bodies of the other dialects' routines: one extension each, by the same pattern, after this one.

## Key entities

- **Routine** - a function or procedure with its header and its body.
- **PL block** - a block of PL/pgSQL with its declarations, statements and handlers.

## Success criteria

- **SC-001**: A script with a routine in it gives the routine as one statement, with its body found and, for PL/pgSQL, read.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
