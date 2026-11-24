# Feature Specification: AnyFS Git: layers

**Spec ID:** 0001-git-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The Git stores are a plugin of the family of AnyFS in two layers, and the library runs Git only through the system library and only with the configuration of a computer turned off.

## Requirements

- **FR-001**: The library MUST be registered as a plugin of the family `anyfs` that extends `@intellectual-frontiers/anyfs`, with the entries `.`, `./governance` and `./physical`, held from release until the fleet store runs on it, and its layers MUST be governance (who a commit is by, what it says, what a store holds) and physical (the stores), each importing only what its unit in the manifest names.
- **FR-002**: The governance layer MUST do no input or output (a source MUST NOT import from `node:`, from the system or net libraries of commons, or use `Bun`, `Deno`, `fetch` or `process`), and the physical layer MUST run Git only through one function that names the repository by its Git folder, turns off signing, hooks, prompts and pagers, and fixes the language of Git's messages, so that the configuration of a computer cannot change what a command does.

## Acceptance scenarios

1. **Given** the manifest of the library, **When** it is read, **Then** it is a plugin of `anyfs` with the exports of its package, per FR-001.
2. **Given** every source of the governance layer, **When** it is read, **Then** none reaches a file, a network or a process, per FR-002.
3. **Given** a repository whose configuration turns on signing and a hook, **When** a store makes a commit, **Then** it is made with no signature and no hook, per FR-002.

## Out of scope

- Releasing the library to npm (it is held).
- Large file storage: a file over the limit of a store is refused, and Git's large file extension is not read or written.

## Edge cases

- A repository whose configuration turns on signing and a hook is committed to with neither (FR-002).

## Assumptions

- Git is on the path of the computer; the stores are held to the laws of AnyFS (anyfs 0003-anyfs-logical FR-003).

## Open questions

- None.

## Key entities

- **Branch**, **Working tree**, **Revision**, **Identity**.

## Success criteria

- **SC-001**: Every behaviour is tested in real repositories in temporary folders, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
