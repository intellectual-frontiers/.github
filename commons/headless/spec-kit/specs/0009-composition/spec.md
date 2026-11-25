# Feature Specification: Headless composition

**Spec ID:** 0009-composition
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The fleet engine (issue #11) needs one command, `archon`, whose verbs come from several packages (`archon-server`, `archon-device`, `archon-boot`, and so on) that are installed separately and assembled in a small composition root. Headless had one program tree written in one place. This increment builds one program from a host and the plugins it is given: one tree, so one help, one completion script, one man page, one run log and one tier gate; a typed contract with stable identifiers; conflicts as values; and a conformance suite that a plugin runs on itself.

## The plugin and its contract

- **FR-001**: A plugin MUST be the value that a package exports (`Plugin`, made only by `definePlugin`), and a host MUST take a plugin's nodes through that value alone, never by reading a file of the package: its stable identity is the program's name, a hyphen and a noun (`PluginId`, a branded type made only by `parsePluginId` or `parsePluginIdText`), its contract is the number `PLUGIN_CONTRACT`, and it holds its version, its summary, the nodes it contributes (each with the path of the branch it is placed in, the root where none) and the plugins it requires. `definePlugin` MUST return every problem of a definition as a value (`plugin/id`, `plugin/version`, `plugin/summary`, `plugin/empty`, `plugin/root-claim`, `plugin/requires`), and MUST NOT throw. Taken from: the plan of `archon`, whose plugins are packages named `archon-<noun>`.
- **FR-002**: A plugin MUST place a node at the root of the program only under its own noun (`archon-server` contributes the word `server`), so that a root word names the plugin that owns it; below another branch it MAY place nodes where that branch exists.

## Composition

- **FR-003**: `compose(host, plugins)` MUST return one `Program` made of the host's own nodes and each plugin's, placed in the order of the plugin ids so that the tree does not depend on the order in which the plugins are given, and MUST return the owner of every command (the host or a plugin id). Two contributions of the same branch name MUST merge, their children placed one by one.
- **FR-004**: Where two owners claim one verb `compose` MUST return the conflict as a value and no tree: `claimed-twice` (two commands, or two owners of one word), `command-vs-branch` (one a command and the other a branch), `missing-parent` (a branch to place below that does not exist) or `parent-is-command`; each names the path and the owners in the order they claimed. It MUST NOT choose a winner, and it MUST NOT throw. The same plugin composed twice (`duplicate-plugin`), a plugin of another program (`wrong-program`), a contract other than `PLUGIN_CONTRACT` (`contract`) and a requirement that is not composed (`missing-requirement`) MUST each be an error value, and every error of a composition MUST be returned together.
- **FR-005**: The composed program MUST be checked as one program (`modelProblems` with the reach policy required of every command), a problem of it MUST be an error value of the composition (`model`), and the tier of every command MUST be on the host's ladder (`tier-not-on-ladder`): there is one gate for the whole command (0010-audience-tiers).
- **FR-006**: A program composed of plugins MUST have one help, one completion script for each shell, one man page and one run log: they are drawn from the one `Program`, the log of a run MUST say which owner contributed the command it ran (`Program.origins`), and the verb identifiers of the program (`verbIds`: the program's name and the words of each command, sorted) MUST be stable, so that a plugin's test can hold them in a snapshot.

## Conformance

- **FR-007**: `pluginConformance(plugin, host)` MUST give a result for each rule of `CONFORMANCE_RULES` (`definition`, `contract`, `program`, `root-claim`, `composes`, `tiers`, `reach`, `deterministic`, `ids`) by composing the plugin alone with a host that declares nothing but its name and ladder (the plugins it requires standing in), MUST be pure, and a plugin that passes it MUST compose with any other plugin that passes it unless they claim one verb.

## Acceptance scenarios

1. **Given** a host and two plugins (`server`, `device`), **When** they are composed in either order, **Then** the tree, its owners and its help are the same, per FR-003 and FR-006.
2. **Given** two plugins that each place a command at `server list`, **When** they are composed, **Then** the result is a `claimed-twice` conflict naming both, per FR-004.
3. **Given** a plugin that claims the root word `device` while being `archon-server`, **When** it is defined, **Then** it is `plugin/root-claim`, per FR-002.
4. **Given** a composed program, **When** a command runs, **Then** the run log names the plugin it came from, per FR-006.
5. **Given** a plugin with a command with no reach policy, **When** the conformance suite runs, **Then** `conformance/reach` fails and says which, per FR-007.

## Out of scope

- Finding and loading the packages: the host's composition root imports each plugin by its package name and gives the values to `compose`.
- Ordering of verbs in the help beyond the ids' order, and versions of the host that a plugin requires.

## Edge cases

- A plugin that requires a plugin that is composed: it composes; one that is not composed is `missing-requirement`, per FR-004.
- A branch of the host and a branch of a plugin of one name: they merge, and a command inside them claimed twice is the conflict, per FR-003 and FR-004.
- A host with no children and no plugins: an empty program, which is not an error, per FR-003.

## Assumptions

- A plugin is written in TypeScript against the version of Headless the host uses; `PLUGIN_CONTRACT` changes only when the type of `Plugin` changes incompatibly.

## Open questions

- None.

## Key entities

- **Plugin** - what a package exports to extend a program.
- **Composition** - the one program, its owners, and the conflicts as values.

## Success criteria

- **SC-001**: A fleet's composition root imports its plugins and gets one command, or the list of everything wrong, and a plugin author runs one function to know the plugin conforms.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
