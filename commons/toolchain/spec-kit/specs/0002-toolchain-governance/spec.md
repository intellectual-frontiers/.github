# Feature Specification: Toolchain governance

**Spec ID:** 0002-toolchain-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The Governance layer of Toolchain says what a tool is, in the words of its domain and once: its name, how strictly it must be pinned, what it provides and needs, the phase of work that first needs it, whether it lives in a user's folder or in the system's, and the bindings that say how each dialect obtains it: a reference to a pin of the packaging ontology, which holds the version and the checksums, or the names a package manager of the ontology knows. A tool is made only by `defineTool`, which refuses with every reason what is not one, and a catalog of tools is made only by `defineCatalog`. It is pure data and pure functions.

## Requirements

- **FR-001**: The library MUST make a tool name and a version only by functions that validate them: a tool name is lower case words joined by hyphens, starting with a letter, at most 60 characters; a version is dotted numbers (one to four) with an optional suffix after a hyphen or a plus sign, and the texts `latest`, an empty text and any range (`^`, `~`, `*`, `>`, `<`, `||`, a space) MUST be refused with the rule they broke; and `compareVersions` MUST order two versions by their numbers, a version with a pre-release suffix coming before the same numbers without one.
- **FR-002**: `defineTool` MUST return a tool or every reason it is not one: it MUST refuse a tool with no summary, no program, no phase, a phase that is not one of `core`, `dev`, `test`, `stage` and `publish`, a scope that is not `user` or `system`, no binding, a need that is not a tool name, and a variable of its environment whose name is not made of upper case letters, digits and underscores.
- **FR-003**: A tool MUST state how strictly it is pinned, `exact`, `release-line` or `rolling`, and MAY state the least version a copy found on the computer may be (`minimum`), which MUST NOT be above the version of a package binding that names one.
- **FR-004**: A download that a pin gives for a platform (made by `defineDownload`) MUST have a version, an address that is `https` with no user name or password in it, a SHA-256 of 64 hexadecimal digits, a format of `zip`, `tar` or `file`, and the folder of its programs as a path inside the unpacked folder (empty for the root, never absolute, never with `..`), and its platform MUST be one of `linux-x64`, `linux-arm64`, `macos-x64`, `macos-arm64` and `windows-x64`.
- **FR-005**: A tool MUST have at least one binding, either one pin binding (a pin of the packaging ontology, named by its id `pin-<name>`) or package bindings (a package manager of the ontology named by its id `manager-<name>`, at least one package name each and a version where one is named), and MUST NOT have more than one pin binding or more than one package binding for the same manager.
- **FR-006**: No text of a tool's environment or program MUST look like a secret (the guard of Archon's governance), because a catalog is committed and published.
- **FR-007**: `defineCatalog` MUST return a catalog or every reason it is not one: it MUST refuse two tools of one name, a need that is not a tool of the catalog, a cycle of needs (naming the tools in it) and a program provided by two tools, and a catalog MUST give its tools in an order where each comes after the tools it needs.

- **FR-008**: A tool MUST NOT hold the version or a hash of a pin: a pin binding names the pin by its id, and the version, the addresses and the checksums are the ontology's, written once.

## Acceptance scenarios

1. **Given** the version `latest`, `^1.2.3` or `1.x`, **When** it is made a version, **Then** it is refused with the rule, per FR-001.
2. **Given** `1.10.0` and `1.9.9`, **When** they are compared, **Then** `1.10.0` is the later, and `2.0.0-rc.1` comes before `2.0.0`, per FR-001.
3. **Given** a download with an `http` address, an address with a password or a hash of 63 digits, **When** it is made, **Then** it is refused with each reason, per FR-004.
4. **Given** a tool with a `minimum` above the version of its package binding, **When** it is defined, **Then** it is refused, per FR-003.
5. **Given** two tools that need each other, **When** the catalog is defined, **Then** it is refused and both are named, per FR-007.
6. **Given** a tool with an environment value that is a private key block, **When** it is defined, **Then** it is refused, per FR-006.

## Out of scope

- Obtaining a tool, and the dialects that do: other packages.
- The assurance of a fleet and how strictly it pins: the governance of Archon; this library reads its control.

## Edge cases

- A tool with a pin that has a download for one platform only: allowed; it is unexpressed on the others, per FR-005.
- A version with four numbers (a browser's `157.0.8103.50`): allowed, per FR-001.
- A tool that needs a tool of its own name: a cycle, per FR-007.

## Assumptions

- The versions and hashes of pins are in the packaging ontology, put there by a person from the publisher's own checksums and reviewed; this library checks the form of a download and never fetches.

## Open questions

- None.

## Key entities

- **Tool** - a program a computer needs.
- **Binding** - how one dialect obtains a tool: a pin of the ontology, or the packages of a manager of the ontology.
- **Download** - what a pin gives for one platform.
- **Catalog** - the tools, each once, in an order of needs.

## Success criteria

- **SC-001**: A catalog that holds a version that is not exact, an address that is not `https` or a hash that is not a SHA-256 is never made.
- **SC-002**: A version and a hash are written once, in the packaging ontology, and no catalog of tools holds one.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
