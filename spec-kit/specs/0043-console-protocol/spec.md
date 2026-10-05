# Feature Specification: What a provider owes the Workspaces Console

**Spec ID:** 0043-console-protocol
**Status:** Draft

**Input:** The Workspaces Console is the one VS Code extension that is the
secondary interface for every provider's command line. It belongs to
`ws-host`, which specifies and builds it; a provider (the public root's `agora`, or any other
repository whose command line follows 0041-command-line) plugs into it and
holds no code of it. This spec states the contract between them: how a provider
declares itself, what its launcher answers, and what it may rely on the
Console to do, so that a new provider appears in the Console with no change to
the Console and no knowledge of the Console in the provider. It is the protocol;
how the extension draws it is the Console's spec.

## Declaration and discovery

- **FR-001**: A provider MUST declare itself in `.workspaces-host/provider.toml`
  at its root: `name`, `summary`, `launcher` (an executable file at the root,
  named `./<file>`) and `protocol` (the integer `1`), which `ws-host` also
  reads to enable the provider. That file is the only declaration: the Console
  and `ws-host` find the launcher by it, carry no list of launcher names, and
  name no provider's command line.
- **FR-002**: A provider's launcher MUST answer `<launcher> command list --json`
  with a document whose `schema` is a `command-list` version the Console
  understands (0041-command-line FR-053), carrying its name, its audience, its
  commands, nouns, verbs, categories, arguments and surfaces, and the
  `presentation` of 0041-command-line FR-064 (its views, nouns, titles and
  icons), so that the Console holds no rule of any one provider.
- **FR-003**: A provider's launcher MUST be run by the Console only when VS Code
  trusts the workspace and the person has trusted the repository
  (0041-command-line FR-052, FR-061). Reading `.workspaces-host/provider.toml`
  needs no trust (0041-command-line FR-062).

## What the Console relies on

- **FR-004**: Everything the Console shows MUST be a resource the provider's
  launcher returned with `--json` (0041-command-line FR-016, FR-019). A provider
  MUST NOT depend on the Console re-implementing a command, a check, a type's
  validation or a rule, and MUST hold no code, setting or file that exists for
  the Console alone beyond FR-001.
- **FR-005**: A provider MUST give each command a title and an icon in its
  presentation, and each noun whose resources are listed a `list` command that
  asks for nothing, as 0041-command-line FR-064 and FR-072 state, so that the
  Console draws its views, rows and palette from the provider's own words.
- **FR-006**: The Console MUST set the environment variable `IF_CONSOLE` to `1`
  for every invocation of a launcher, and a provider's log MUST then name the
  surface `editor` (0041-command-line FR-042).
- **FR-007**: A provider's command that writes MUST take `--dry-run` and return
  the change as a diff per file (0041-command-line FR-015), so that the Console
  can show what a write would change before it is made.
- **FR-008**: A provider's `decision` command (0041-command-line FR-014) MUST run
  only after the person's confirmation: the Console passes `--confirmed` only
  after a modal that only a person can answer (0041-command-line FR-051), and a
  terminal asks the person to type yes; no `decision` is offered over MCP
  (0041-command-line FR-023).
- **FR-009**: A provider's streams MUST be NDJSON, one resource per line
  (0041-command-line FR-019), which the Console shows as progress with the
  stream's own words.
- **FR-010**: A provider that serves MCP (`mcp serve`, 0041-command-line FR-027)
  MUST be registered by the Console with VS Code where it supports it, and
  MUST offer no `decision` through it.

## Out of scope

- How the Console draws a provider's resources: workspaces-host's Console
  specification.
- The commands a provider has: each provider's own spec states them
  (0042-agora is the public root's).

## Edge cases

- A repository with a launcher but no `.workspaces-host/provider.toml`: it is
  not found, per FR-001.
- A launcher that does not answer `command list` with a document the Console
  understands: it is not shown as a provider and the Console's output channel
  says why, per FR-002.
- A repository the person has not trusted: nothing of it is run and the reason
  is shown, per FR-003.
- A `decision` over MCP: refused and not listed, per FR-008 and FR-010.

## Assumptions

- Every provider is also a provider for `ws-host`: its declaration is the one
  file of FR-001, and its programs are installed as 0025-tooling-environment
  states.

## Open questions

- **OQ-1**: Whether a provider may contribute its own views to the Console
  beyond the lists its nouns declare (a new kind of view would be the Console's
  spec).

## Key entities

- **A provider** — a repository with `.workspaces-host/provider.toml` and a
  launcher that speaks 0041-command-line.
- **A launcher declaration** — `.workspaces-host/provider.toml` (FR-001).
- **Presentation** — what a launcher says about how its nouns are listed and
  titled (FR-002, FR-005).

## Success criteria

- **SC-001**: A repository that follows FR-001 to FR-010 appears in the Console
  with its views, rows and commands and with no change to the Console.
- **SC-002**: No provider holds code that exists for the Console alone.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
