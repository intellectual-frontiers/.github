# Feature Specification: AnyFS Git: governance

**Spec ID:** 0002-git-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A commit is by an identity and says what it changed in a message that a program makes; a store holds files below a limit, with names fit for a repository.

## Requirements

- **FR-001**: An identity MUST be made only by `parseIdentity` from a name and an address, each one line with no angle bracket and no space around it, and the address MUST hold an `@` and no space; a trailer MUST be made only by `parseTrailer` from a key of letters, digits and hyphens that starts with a letter and a value of one line.
- **FR-002**: The message of a commit MUST be the first line made by a subject function from what the commit changes (by default `anyfs: write <path>`, `anyfs: delete <path>`, `anyfs: move <path> to <path>` or `anyfs: <n> changes`), a line for each change where there are several, and the trailers after a blank line, and it MUST end with a line ending and hold no line break in its first line.
- **FR-003**: The paths a store holds MUST be refused where a component is read as the folder of Git by some file system (`.git` in any case, with trailing dots or spaces, and its short name `git~1`), and a function MUST give the groups of paths that differ only by case; an object larger than the limit of the store (50 MiB unless told another) MUST be refused with a sentence that names the limit.

## Acceptance scenarios

1. **Given** a name with an angle bracket, **When** an identity is made, **Then** it is refused with a sentence, per FR-001.
2. **Given** three changes and two trailers, **When** the message is made, **Then** it has the subject, a line for each change and the trailers after a blank line, per FR-002.
3. **Given** the paths `a/.GIT/x`, `a/git~1` and `a/.git.`, **When** they are checked, **Then** each is refused, per FR-003.
4. **Given** `A/b` and `a/B`, **When** their collisions are asked for, **Then** they are one group, per FR-003.

## Out of scope

- Signing a commit.

## Edge cases

- A name that is `.git` followed by a dot is refused as the folder of Git (FR-003).

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
