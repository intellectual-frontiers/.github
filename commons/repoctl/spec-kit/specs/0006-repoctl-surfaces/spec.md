# Feature Specification: Repoctl surfaces

**Spec ID:** 0006-repoctl-surfaces
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Repoctl is a program on Headless: its verbs are declared with the facts of their actions, drawn by the command line, described for the documentation and served as tools by audience tier. The command line has one entry for a person (`bun run repoctl <verb>`, or `repoctl <verb>` from the package), the tool server (`repoctl mcp`) exposes the verbs the held tier sees so that an AI agent runs the same repository operations deterministically, and the reach policy of each action says how it may be reached and how a destruction is confirmed.

## Requirements

- **FR-001**: Every verb MUST be declared once as a Headless command with its options, operands and at least one example, its summary and the traits of its action coming from the table of Governance, and the model of the program MUST have no problem under Headless' conformance (every action has a reach policy, the words of no two verbs clash).
- **FR-002**: The program MUST be described by Headless' `describe` (the layered model of its actions, verbs, options, operands, problem codes, command-line commands, tools of the tool server and routes of the REST projection), so that the documentation lists every verb per tier with its examples and every problem code with its explanation.
- **FR-003**: `repoctl mcp` MUST serve, as the tools of a tool server on standard input and output, the verbs that the held tier sees, that come through the `mcp` channel and that are not for a person alone, each with the schema of its options and operands; a tool that the held tier does not see MUST be refused with the reason, and a destruction MUST be served only as a preview, never confirmed by the caller.
- **FR-004**: The reach policy of each action MUST be: the verbs that only read are read-only and safe to repeat; `sync` is safe to repeat and can preview and check; `release publish` is a destruction that previews and is confirmed by a person, and the option that types its confirmation MUST be one that only a person may give, so that no tool of the tool server can give it.
- **FR-005**: The tier the program holds MUST be a fact of the host: the variable `REPOCTL_TIER` (`public`, `contributor` or `releaser`), `contributor` where it says nothing; a word that is no tier MUST end the run with the status 2; and a caller of a lower tier MUST NOT see, be offered or run a verb of a higher one.
- **FR-006**: The root `package.json` MUST have the script `repoctl` (which links the libraries, then runs the program) and the `bin` `repoctl`, the package MUST have the launcher `bin/repoctl.mjs` that runs the program on Bun and on Node 26, and the package MUST be packed with the command as one bundled file.

## Acceptance scenarios

1. **Given** the program, **When** the model's conformance is checked, **Then** there is no problem, per FR-001.
2. **Given** the program, **When** it is described, **Then** every verb, option, code and tool is an element of the model, per FR-002.
3. **Given** the tier `public`, **When** the tools are listed, **Then** only the verbs that read are there, per FR-003.
4. **Given** the tier `releaser`, **When** `release_publish` is called with no preview, **Then** it is refused as needing a confirmation, per FR-003 and FR-004.
5. **Given** `contributor`, **When** `repoctl release publish` is typed, **Then** the verb is not there and the sentence says the tier it is for, per FR-005.
6. **Given** `REPOCTL_TIER=admin`, **When** the program runs, **Then** it ends with 2, per FR-005.
7. **Given** the root package, **When** it is read, **Then** the script and the bin are there, per FR-006.

## Out of scope

- The REST server: its projection is described, and a host serves it.
- Remote targets: the program runs on the checkout it is in.

## Edge cases

- A tool server asked for a tool that does not exist: invalid params, per FR-003.
- `REPOCTL_READ_ONLY=1`: the key may only read, so a verb that changes something is refused through the tool server, per FR-003.
- `--confirm` given through a tool: refused as for a person alone, per FR-004.

## Assumptions

- The libraries of commons that Repoctl calls (`libraries`, the tools of commons) are on the branch that holds it, and `git`, `bun` and `node` are installed.

## Open questions

- None.

## Key entities

- **Tool** - a verb as a tool of the tool server.
- **Held tier** - the tier a host fixes for a caller.

## Success criteria

- **SC-001**: The tools a tier sees are exactly the verbs of that tier and below.
- **SC-002**: No tool can publish.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
