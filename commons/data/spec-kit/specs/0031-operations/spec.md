# Feature Specification: Operations

**Spec ID:** 0031-operations
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** A model is tables; a business is what is done to them: create an organization, invite a user, sign someone in, rotate a token, check a permission. These are the operations of a model. They are done in the application's language, in one transaction, because SQL has no portable control flow (a rotation of a refresh token that finds the token was already used must revoke the whole family and still commit, and still tell the caller; an exception would roll the revocation back) and because the three engines have different procedural languages or none. Operations are therefore three things. A contract, in governance, that holds no SQL and names no database: what the operation is for, what it takes (typed), the concepts it reads and writes, the permission it needs and in which tenant, what it records in the audit trail, and whether it runs as its caller or as the service; and a lint that holds contracts to the domain they are for. A runtime, an extension, that runs an implementation in one transaction on any of the engines and holds it to its contract: its input is checked, its caller is authorized (and a refusal is itself recorded), what it writes is what it said, and a command that writes records what it said it would record in the audit trail in the same transaction. And implementations, written once against typed row operations by the words of the names of tables and columns, so that they do not change with the dialect, the case style or the schema. A business outcome is a value, never an exception: only what is thrown rolls back. Stored procedures in a database are an opt-in for a deployment that needs them, and are not the default.

## The contract

- **FR-001**: `operation` MUST make a contract, frozen, from a name and a specification: a definition, whether it is a command or a query, its inputs (each `text`, `integer`, `number`, `boolean`, `instant` or `textList`, and whether it may be left out), the concepts it reads and writes by name, the permission it requires (`resource:action`) and the input that holds the tenant it is required in, what it emits to the audit trail (`subject.verb`), whether it runs as its caller or as the service, and whether doing it twice leaves the same state.
- **FR-002**: `lintOperations` MUST find, against the domain, a concept a contract names that the domain does not have, a query that says it writes, a permission or an audit action that is not of its form, a scope that is not an input, two operations with one name, a command that writes a concept classified restricted and runs as its caller (it must run as the service), and, as a warning, a command that writes and says it records nothing.

## The runtime

- **FR-003**: `operations` MUST make a runtime from the logical schema, a dialect, a driver, the contracts and an implementation of each by name, and MUST give errors as values for a contract with no implementation, an implementation with no contract, a table that a contract names and the schema does not have, a contract that requires a permission when no authorizer is given, and one that emits when no audit trail is given.
- **FR-004**: An implementation MUST be given a transaction of typed row operations (insert, update and remove, with the number of rows changed; select, count, and a read written from the names), whose tables and columns are named by the words of their names (a column that holds a relationship by the key of the relationship), written by the naming layer for the dialect and the schema, whose values enter only as literals that the dialect writes, and which notes every table that was written; a query MUST NOT be able to write.
- **FR-005**: `run` MUST check the input against the contract and give, as errors as values, an input that is missing, one that is not a declared input and one of the wrong type, and MUST do nothing of the operation until the input is right.
- **FR-006**: Where a contract requires a permission, `run` MUST ask the authorizer of the project whether the caller holds it in the tenant the scope input names, and where it does not (or there is no caller) MUST return the status `denied` and MUST record the attempt in the audit trail as an event of the first action the contract emits, with the outcome `denied`, and commit that record alone.
- **FR-007**: `run` MUST run an implementation in one transaction; commit what it did where its outcome does not say otherwise (so that an outcome that must be kept, such as a revocation, is kept and returned); and roll back, giving an error value, where it throws, where it wrote a table its contract does not name, and where it wrote and did not record in the audit trail any action its contract emits.
- **FR-008**: A query MUST be run in a transaction that is rolled back; and the context an operation is given (the clock, identifiers, tokens, the hash of a token and of an identifier, the check of a password, who is acting) MUST have defaults that need no secret (a password verifier is the application's) and be replaceable, so that a test is the same every time.

## Out of scope

- A server or a protocol: the runtime is a function; an HTTP or RPC layer wraps it.
- A generated typed client, and a check that a client's state is the database's: a later specification.
- Operations as stored procedures or functions in a database: an opt-in, a later specification.
- Concurrency across connections: the tests cannot show it on these engines; the single conditional statement of an operation, not the application, decides who wins.

## Edge cases

- DuckDB cannot update a row that another row refers to (its foreign key limitation, which it reports as an error): an operation that does so fails there as a value, per FR-007; PostgreSQL and SQLite are the engines for operations that change rows others refer to.
- An operation that writes nothing because its outcome is a refusal (`slug-taken`): not an error, and records nothing, per FR-007.
- An operation that throws after writing: nothing it did stays, per FR-007.
- A denied call to a query: nothing is recorded; it is rolled back, per FR-006.

## Assumptions

- The database's transactions include its DDL and are the unit of an operation.
- The authorizer and the audit sink are the model's (the identity model's are in 0032).

## Open questions

- **OQ-1**: Whether the driver should take bound parameters, so that no value is ever a literal in SQL text.

## Key entities

- **Operation** - a contract: what it takes, reads, writes, needs and records.
- **Runtime** - what runs operations in one transaction and holds them to their contracts.
- **Outcome** - the status an operation gives, with what goes with it.

## Success criteria

- **SC-001**: The business operations of a model are written once, behave the same on every engine, and cannot write what they did not say or leave no trace of what they did.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
