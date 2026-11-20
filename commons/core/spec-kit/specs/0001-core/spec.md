# Feature Specification: Core

**Spec ID:** 0001-core
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The foundation that the rest of commons stands on, in a package of its own with no dependency: errors as values, exhaustive matching, branded types, decoders at the boundary, a few pure text helpers, type-level tests, graphs of work and exact optional objects. It is the first library lifted out of `commons/ts` (commons 0032-libraries-by-concern), and its requirements are those that 0005-typescript-practice made of the kernel's foundation, kept here.

## The foundation

- **FR-001**: Core MUST give errors as values (`Result<T, E>`, a union of `Ok` and `Err` told apart by `kind`, with `ok`, `err`, `map`, `mapErr`, `andThen`, `orElse`, `all`, `match`, `unwrapOr`, `attempt`, `settle`), exhaustive matching (`absurd(value: never)`) and branded types (`Brand<T, B>`), one name for each.
- **FR-002**: Core MUST give decoders from `unknown` to typed values (`string`, `number`, `integer`, `boolean`, `literal`, `nullable`, `array`, `tuple`, `record`, `object` with optional fields, `tagged` unions by `kind`, `oneOf`, `refine` to a brand, `json`), each failure naming the path of the value, what was expected and what was found. Type assertions that decoding needs MUST be confined to `src/decode.ts`.
- **FR-003**: Core MUST give the pure text helpers more than one harness wrote: line endings made LF, terminal escapes removed, a command line split into its argument vector without a shell, and an argument vector quoted for a POSIX shell.
- **FR-004**: Core MUST give tests of types with no framework (`expectType<Equal<A, B>>()`, with `Equal`, `Extends` and `Not`), which compile only where the types are as claimed, and its laws MUST be property-tested.
- **FR-005**: Core MUST order a graph so that each node comes after the nodes it needs, the same way every time, or name a cycle; and MUST run a graph's nodes each the moment the nodes it needs are done, no more at once than asked, skipping (and saying) a node whose needed node failed or was skipped, and holding back nothing else.
- **FR-006**: Core MUST give `compact`, which makes an object from fields some of which may be `undefined`, leaving those out, typed exactly for `exactOptionalPropertyTypes`: a field whose type includes `undefined` becomes optional without `undefined`, every other field stays as it is.

## The package

- **FR-007**: Core MUST depend on nothing, MUST import nothing outside its own files, MUST name no host global, and MUST be published as compiled modules with their declarations as `@intellectual-frontiers/core` (commons 0032-libraries-by-concern FR-005), so that it runs on Bun, on Node 26 and in a browser with no build step.
- **FR-008**: Core MUST give the types of the facts a library states of itself for its documentation (`About` and the types it is made of: its title, its summary, the specification it implements, its folders with what each may import, its commands, its rules with what enforces each, its areas, layers and facts) as a type-only entry `@intellectual-frontiers/core/about`, which exports no value, so that a library types its `about.ts` by Core and depends on nothing else for it.

## Acceptance scenarios

1. **Given** a `switch` over a union that leaves an alternative out, **When** it ends in `absurd`, **Then** it does not compile, per FR-001.
2. **Given** a value of no known shape, **When** a decoder reads it, **Then** a failure names the path, what was expected and what was found, per FR-002.
3. **Given** a command line with quotes, **When** it is split and quoted again, **Then** the same argument vector comes back, per FR-003.
4. **Given** an acyclic graph and a limit, **When** it is scheduled with random outcomes, **Then** no more than the limit run at once and a node whose needed node failed is skipped, per FR-005.
5. **Given** the packed package installed under `node_modules`, **When** Node 26 and Bun import it, **Then** both give the same `ok`, `err` and `decode`, per FR-007.

## Out of scope

- Everything that parses a format, hashes, talks to the host or the network: other libraries (commons 0032-libraries-by-concern FR-002).

## Edge cases

- A graph with a cycle: ordered as an error naming the cycle, per FR-005.
- A field of an object that is `undefined` under `exactOptionalPropertyTypes`: left out by `compact`, per FR-006.
- A decoder given `null`, an array where an object is expected, or an object with an extra field: each named by path, per FR-002.

## Assumptions

- ECMAScript 2024 and the web standards are all that the code needs.

## Open questions

- None.

## Key entities

- **Result** - a value or an error told apart by `kind`.
- **Brand** - a type made distinct from its representation by a function that validates it.
- **Decoder** - a function from `unknown` to a typed value or an error with a path.

## Success criteria

- **SC-001**: A library of commons uses these and nothing else to be correct at its boundaries.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
