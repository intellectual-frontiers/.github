# Feature Specification: Headless REST surface (skeleton)

**Spec ID:** 0014-rest-surface
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A REST interface slots in beside the command line and the tool server (0001-headless-layers FR-006). This increment is its skeleton: the OpenAPI 3.1 document of a program, generated from governance for the caller's tier and holding the same refusals as the tool server. The routing, the authentication and the transport are Planned, and the document is what they will be held to.

## The document

- **FR-001**: `openApiOf(program, tier)` MUST give an OpenAPI 3.1 document (`openapi: "3.1.0"`, the program's name, summary and version) made from the program alone, pure, with one path for each command that the tier may see (0010-audience-tiers), whose reach policy names the `rest` channel and whose audience is not `human`: the path is `/v1/` and the command's words, and the operation identifier the program's name and the words joined by underscores. The options and operands of a command, and the JSON Schema of each, MUST be those the tool server takes (`offeredOptions`, `schemaOfOption`, 0013-mcp-surface FR-001): what only a person may give MUST be absent.
- **FR-002**: A command that only reads MUST be a `GET` whose options and operands are query parameters (required where a value option has no default or an operand is not optional), and every other command a `POST` whose JSON body holds them (`additionalProperties` false, required as above); each operation MUST say its effect (`x-effect`), its tier (`x-tier`) and whether it is safe to repeat (`x-idempotent`), and a command hidden from the tier MUST NOT be in the document.
- **FR-003**: Every operation MUST name the same refusals as the tool server: the responses `200` (the command's JSON document), `400` (the arguments), `403` (the tier, the channel or the key) and `409` (what the action needs of a person), the last two with a body `{ refusal, message }` whose `refusal` is one of `REFUSAL_REASONS`, which are the reasons of the tool server (`MCP_REFUSALS`); and the document MUST declare a bearer security scheme, the authentication of the caller (which gives the tier) being the host's.

## Acceptance scenarios

1. **Given** a program with a report and an `administrator` action, **When** the document is made for `public`, **Then** it holds the report as a `GET` and not the action, per FR-001 and FR-002.
2. **Given** an option only a person may give, **When** the document is made, **Then** the body does not hold it, per FR-001.
3. **Given** any operation, **When** its `403` is read, **Then** it lists every reason of the tool server, per FR-003.

## Out of scope

- Planned: the router (a request to a command through the command line's `run`, with the refusals of `decide`), the authentication that gives the tier, the HTTP transport, and a conformance test of a running server against its document.

## Edge cases

- A command whose reach does not name `rest`: no path, per FR-001.
- A program with no exposed command: an empty `paths`, per FR-001.

## Assumptions

- The tier of a request comes from its credential, which the host checks before it asks for the document or runs a command.

## Open questions

- None.

## Key entities

- **Operation** - a command of the program, as a client of the API sees it.

## Success criteria

- **SC-001**: A client generated from the document of a tier can call exactly the verbs that tier may run.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
