# Feature Specification: Headless tool server (MCP)

**Spec ID:** 0013-mcp-surface
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** `archon-mcp` is generated from governance (issue #11): the tools an agent sees are the verbs of the program that its tier may see, and the machine's rules of governance (it cannot be asked, takes no flag for a confirmation, may not do what is for a person) hold whatever the agent says. The surface serves the Model Context Protocol over standard input and output, forced over SSH to a tier limit, with the tools made from the program's own model instead of a table kept beside it, and the runner a port, so that the surface imports no other surface. The reach policy already named `mcp` as a channel (0005-reach-and-targets); this makes it a surface.

## Tools from governance

- **FR-001**: The tools MUST be generated from the program (`served(program, tier)`): one tool for each command that the caller's tier may see (0010-audience-tiers), whose reach policy names the `mcp` channel and whose audience is not `human`, named by the program's name and the command's words joined by underscores (`archon_server_list`), with a JSON Schema of its options and operands (a flag is a boolean, a value a string, a repeated option an array of strings, an operand a string or an array; required where a value option has no default or an operand is `one` or `many`) and the hints `readOnlyHint` (effect `read`), `destructiveHint` (effect `destructive`) and `idempotentHint`. An option that only a person may give (`humanOnly`) MUST NOT be in the schema, nor any standard option of the command line but `--dry-run` and `--check` where the command has them. Two commands that would be one tool name MUST be an error value (`mcp/name-collision`), never a silent winner.
- **FR-002**: A tool the tier hides MUST be absent from `tools/list`, and a call to it MUST be refused as a tool result with `isError` and the typed reason of the gate (`tier-too-low`, `tier-unknown`) and MUST NOT run; a command that exists but may not come through `mcp` MUST be refused as `channel`; a name that is no command of the program MUST be the protocol's invalid parameters, not a refusal. The caller's tier MUST be fixed by the host (`McpConfig.tier`) and never taken from a message.
- **FR-003**: A call MUST be decided as a machine surface's: where the key may only read (`McpConfig.mayOnlyRead`) a command that changes something MUST be refused as `read-only-key`; an option that only a person may give MUST be refused as `human-only-option`; and `decide` MUST be asked as a surface that cannot ask and takes no flag for a confirmation, so a destructive action MUST be refused (`confirmation-needed`) unless the call is a preview (`dryRun` or `check`), which goes. Every refusal MUST be of the closed set `MCP_REFUSALS` and carry its reason as data (`structuredContent.refusal`) and one sentence.

## The protocol

- **FR-004**: The server MUST be JSON-RPC 2.0 of the Model Context Protocol (`PROTOCOL_VERSION`) as a function from a line to the line to answer with (`handleLine`): `initialize` (the protocol version, the capability `tools`, the program's name and version), `ping`, `tools/list` and `tools/call`; a message with no `id` (a notification) MUST never be answered, whatever it names; a line that is not JSON MUST be the error -32700 with the id `null`, a message that is not a request (a batch is one: this protocol version has none) or whose `id` is not a string or a number -32600, a method that is not served -32601, wrong parameters -32602, and a failure of the server -32603 and not a throw.
- **FR-005**: A call's arguments MUST become a command line by one pure function (`argvOf`, shared with the REST surface): flags as `--name`, a value as `--name=value` so that a value that starts with a dash is still its value, repeated options once each, the operands last; an argument that is not an option or operand of the tool (`unknown-argument`), of the wrong type (`wrong-type`), missing (`missing-argument`) or an operand that starts with a dash (`looks-like-an-option`) MUST be an error value and the command MUST NOT run. A command that passes MUST run through the port `ToolRunner` (the words, `--json` and `--non-interactive`) which the host wires to the command line's `run` with the caller's tier, and the result MUST be the JSON document as the text and as `structuredContent`, with `isError` true only where the status is not 0, 1 (findings) or 4 (pending).
- **FR-006**: The server MUST touch no process global: `serve` takes a `Transport` (lines in, lines out) and answers each line in order, writing nothing for a notification and skipping an empty line; an answer MUST be one line with no line break inside it; and the transport of the standard streams (`stdioTransport`, with the pure framing `framer`: a partial line is kept for the next chunk, a `\r` before the break is not part of the line) MUST write only the protocol to standard output.

## Acceptance scenarios

1. **Given** a program with an `operator` verb and a caller of `public`, **When** it lists the tools, **Then** the verb is absent, and calling it is refused for `tier-too-low` with nothing run, per FR-002.
2. **Given** a destructive action, **When** an agent calls it without `dryRun`, **Then** it is refused as `confirmation-needed`; with `dryRun` it runs as a preview, per FR-003.
3. **Given** an option only a person may give, **When** a call carries it, **Then** the refusal is `human-only-option`, per FR-003.
4. **Given** the line `{"jsonrpc":"2.0","method":"notifications/initialized"}`, **When** the server handles it, **Then** it answers nothing, per FR-004.
5. **Given** an operand `--force`, **When** the arguments are made a command line, **Then** it is `looks-like-an-option`, per FR-005.

## Out of scope

- Planned: resources (the specifications and documents of a fleet), prompts, pagination of `tools/list`, progress notifications from a run (the events of 0012), and the server forced as an SSH command with the tier of the key (the generator of `authorized_keys` lines is `ssh-inbound`).
- Authentication: the host gives the tier.

## Edge cases

- A program with no command that may come through `mcp`: `tools/list` is an empty list, per FR-001.
- A runner whose status is 3: the result is an error with the stream the command wrote, per FR-005.
- A line with only spaces: skipped, per FR-006.

## Assumptions

- A client speaks the protocol version of `PROTOCOL_VERSION` or one it negotiates down to; the server does not refuse an older one.

## Open questions

- None.

## Key entities

- **Tool** - a command of the program, as an agent sees it.
- **Refusal** - why a call did not run, as data.

## Success criteria

- **SC-001**: An agent sees exactly the verbs its tier allows and can do nothing a person has not been asked for, whatever it sends.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
