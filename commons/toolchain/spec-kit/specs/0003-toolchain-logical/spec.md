# Feature Specification: Toolchain logical

**Spec ID:** 0003-toolchain-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The Logical layer of Toolchain makes, from the declaration of tools in Governance, the model a program reasons with: which dialect carries out each tool on this platform, what must be done about each tool given what is installed, and the requirements of kind `tool` that Desired OS State orders and plans. It is manager-neutral: it holds no package manager's input and runs nothing, so a dialect package alone writes Homebrew's, apt's, WinGet's, mise's or its own. Each dialect declares what it can guarantee as data, and a tool that no dialect can carry out on a platform with the integrity a fleet asks for is a named finding with the reason for each dialect, never a surprise.

## Requirements

- **FR-001**: A dialect of tools MUST declare as data how exactly it pins (`exact`, `release-line` or `rolling`), how it checks what it installs (`hash`, `signature` or `none`), the scopes it can install in, the platforms it can reach, whether it takes the download of a pin or the packages of its manager (the package manager of the packaging ontology it drives), and whether it can build from source.
- **FR-002**: `meetsIntegrity` MUST say, for the control `toolIntegrity` of an assurance (`rolling`, `release-line` or `exact-hashed`) and the guarantees of a dialect, every reason the dialect does not meet it: a dialect that pins `rolling` does not meet `release-line`, and a dialect that does not pin `exact` or does not check by `hash` does not meet `exact-hashed`.
- **FR-003**: `resolveTools` MUST resolve the tools wanted and the tools they need, in the order of needs, each to the first dialect of the fleet's preference that has a binding for the tool on the platform, can reach the platform and the scope of the tool, pins at least as exactly as the tool and the control ask for, and meets the control; and MUST refuse a tool that is not in the catalog.
- **FR-004**: A tool that no dialect can carry out MUST be refused with every dialect and the reason it was not chosen, and a dialect that can build from source MUST NOT be chosen unless the context says the fleet approved source builds (`sourceBuild: "approved"`, never the default), so that what is installed is only what its publisher released unless a person approved otherwise.
- **FR-005**: `planTools` MUST say, by the one rule `actionFor` that the dialects use too, for each resolved tool and what is observed of it, `none` where it is as pinned, `install` where it is absent and `replace` where it differs; a copy found on the path MUST count only where the policy allows a system copy (`minimum`) and the control is not `exact-hashed`, and then only at the least version the tool states (the version of its pin where it states none), and a copy of the store or of a manager MUST count only at the pinned version, any version counting where nothing pins one.
- **FR-006**: `requirementsFor` MUST give, for a resolution and a selector of subjects, one requirement of kind `tool` of Desired OS State for each resolved tool, that is valid under Desired OS State's `defineRequirement`, with the id `tool.<name>`, a dependency on the requirement of each tool it needs, and as its desired state data that names the tool, the version it is carried out at, its program, its scope, its phases, the dialect and the source (the artifact, or the packages), holding no secret; and an order of Desired OS State MUST be buildable from them.

- **FR-007**: `resolveTools` MUST take the downloads of pins from a source it is given (`PinSource`: the version, address, SHA-256, format and folder of a pin on a platform, or the reason it has none), and MUST NOT choose a dialect of downloads for a pin that has no download for the platform or whose version is below the minimum the tool states, saying so with the reason the source gave; and Governance and Logical MUST NOT read the packaging ontology, so that they stay pure and the adapter of the Physical layer is the one place it is read.

## Acceptance scenarios

1. **Given** a tool with a pin binding and a package binding and a fleet that prefers the dialect of downloads, **When** it is resolved, **Then** the dialect of downloads is chosen, per FR-003.
2. **Given** the control `exact-hashed` and only a dialect that pins `rolling`, **When** a tool is resolved, **Then** it is refused naming the dialect and the reason, per FR-002 and FR-004.
3. **Given** a dialect that can build from source, **When** a tool is resolved, **Then** it is not chosen, and it is chosen only where the context says the fleet approved source builds, per FR-004.
4. **Given** a pin with a download for `linux-x64` only and the platform `macos-arm64`, **When** the tool is resolved, **Then** it is refused naming the pin, per FR-003 and FR-007.
5. **Given** a copy on the path at the least version and the policy `minimum`, **When** the plan is made, **Then** the tool is `none`, and under `exact-hashed` it is `replace`, per FR-005.
6. **Given** a resolution of two tools where the second needs the first, **When** the requirements are made, **Then** the second depends on `tool.<first>` and an order is built from both, per FR-006.

## Out of scope

- The input of a package manager and the program that runs it: the dialect packages.
- What is installed: observed by the dialects and given to `planTools` as a value.

## Edge cases

- A tool needed by two wanted tools: resolved once, per FR-003.
- A tool with no observation: absent, `install`, per FR-005.
- A wanted tool that is not in the catalog: refused by name, per FR-003.

## Assumptions

- A dialect's declaration is true: its conformance suite is what shows it, and this library only reads it.

## Open questions

- None.

## Key entities

- **ToolDialect** - the guarantees of a dialect of tools, as data.
- **PinSource** - where the downloads of pins come from.
- **Resolution** - each tool with the dialect and the source chosen for it.
- **ToolPlan** - what must be done about each resolved tool.

## Success criteria

- **SC-001**: For every tool and every dialect a reader can see why the tool was or was not carried out by it.
- **SC-002**: A fleet that asks for exact, hashed tools never gets a copy from a manager that cannot give one.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
