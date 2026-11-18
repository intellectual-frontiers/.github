# Feature Specification: The engine

**Spec ID:** 0002-engine
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** The engine is the small part every layer and every extension stands on: it lets a layer say where it can be extended (a contribution point), lets an extension say what it adds and what it needs (a manifest), puts a set of extensions together in an order the project chooses, and starts each only when it is wanted. It is the tiny core's extension host, in the manner of an editor's extensions: a typed manifest, points that layers declare, lazy activation and handles that give an extension only what it asked for. It has no registry of its own that code can reach without being handed it, and nothing registers by being imported.

## Contribution points

- **FR-001**: The engine MUST import nothing of the library and nothing but the kernel; it MUST declare no contribution point of a layer, so that a layer declares its own with the engine's mechanism and the engine does not know the layers.
- **FR-002**: A contribution point MUST be a typed, named value (`point<T>(name)`), where `T` is what an extension contributes and the name has a namespace and a name (`governance.vocabulary`); a name with no namespace MUST NOT compile.

## The manifest

- **FR-003**: An extension MUST be one typed value, a manifest made by `defineExtension`: its identifier (a branded `ExtensionId`: lower-case words joined by `-` or `.`), its version, the version of the engine's contract it was written for, the extensions it requires, what it contributes (each made by `contribute(point, value)`), the handles it uses, and an optional `activate` function; it MUST be TypeScript, never YAML, XML or JSON.
- **FR-004**: A manifest's contributions MUST be typed by the point they fill, so that a contribution of another type to a point does not compile.

## Composition

- **FR-005**: A project MUST compose its extensions by passing them to `compose`, an explicit list; the engine MUST NOT scan folders for extensions and MUST NOT register an extension by its being imported.
- **FR-006**: `compose` MUST put the extensions in an order that satisfies `requires`, the order the project listed them where `requires` does not decide, and MUST return as values (never by throwing), all together, each missing extension, each cycle, each contract version the engine does not have, each handle used and not provided, and each identifier that two extensions claim.
- **FR-007**: What a layer needs of its extensions MUST reach it as a value the project passes in (the contributions of a point, in order), not as a registry the layer looks into.

## Activation

- **FR-008**: An extension MAY be given as a lazy entry (`lazyExtension`: identifier, version, contract, requires, the events that start it, and `load`, a thunk such as `() => import(...)`), and the engine MUST load and activate it only when `fire` is given one of its events, after the extensions it requires; an extension activated twice, even at once, MUST be activated once; a lazy extension's contributions MUST appear only after it is activated; a `load` whose manifest has another identifier, and an `activate` or a `load` that fails, MUST be returned as values.
- **FR-009**: `activate` MUST receive a context whose `use(handle)` gives only a handle the manifest declared in `uses`, and only what the project provided for it (`provide(handle, value)`); any other is an error value (`undeclared`, `unprovided`). A handle is a typed, named value of the engine's mechanism (`handle<T>(name)`) and the engine defines none of the layers' handles (the trace graph, the statements to emit, the files to write: each layer defines its own), so that an extension has no reach beyond what it declared; this is a discipline, not a sandbox, and the check of FR-004 in 0001-layers is what keeps an extension to the public surfaces.

## Out of scope

- What any extension does: each has a specification of its own.
- Sandboxing code that runs in the same process: not provided, FR-009 says so.
- Finding extensions installed by a package manager: a project lists what it uses.

## Edge cases

- `point("vocabulary")` with no namespace: does not compile, per FR-002.
- A manifest that contributes a string to a point of terms: does not compile, per FR-004.
- Two extensions that both claim the identifier `privacy`: `compose` returns the conflict, per FR-006.
- An extension that requires one that is not in the list: `compose` returns the missing one, per FR-006.
- Extensions that require each other: `compose` returns the cycle, per FR-006.
- A lazy extension fired by two events at once: it is loaded and activated once, per FR-008.
- A lazy extension whose `load` returns a manifest with another identifier: returned as a value, and nothing is activated, per FR-008.
- An `activate` that throws: returned as a value that names the extension, which is not active, per FR-008.
- An extension that calls `use` on a handle it did not declare: `undeclared`, per FR-009.
- An extension that declares a handle the project did not provide: `compose` returns it, per FR-006.
- A module that registers an extension at import time: no registry exists for it to reach, per FR-005.

## Assumptions

- Every requirement here is built by phase 2 of the library, and none is left Planned.
- An activation that failed stays failed in its composition: it is not tried again; a project that wants another try composes again.
- The contract's version is a small integer the engine raises when it breaks a manifest, not a semantic version.

## Open questions

- **OQ-1**: The events an extension may be activated by, which the layers declare (`onDialect:postgres`, `onGenerate:rust`).

## Key entities

- **Contribution point** - a named, typed place a layer lets extensions fill.
- **Manifest** - the typed value that is an extension.
- **Composition** - the ordered, checked list of extensions a project uses.
- **Handle** - what an extension is given to act with, and nothing more.

## Success criteria

- **SC-001**: A layer can be extended without the engine knowing it, and an extension written outside the repository composes with one written inside it.
- **SC-002**: A mistake in a list of extensions is a value the project can show, never an exception from deep inside a layer.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
