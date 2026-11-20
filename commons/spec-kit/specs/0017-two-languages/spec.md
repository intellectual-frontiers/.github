# Feature Specification: Two languages: natural language and TypeScript 7

**Spec ID:** 0017-two-languages
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** Specifications, ontology and code of Intellectual Frontiers stay in two vertically integrated languages: natural language for specifications and TypeScript 7 and later for the ontology, the code, the tools and the tests, because drift between a specification, an ontology and the code is a real danger and each further language or format is another place to drift. TypeScript is modern, strongly typed, interpreted but also compilable (with Bun and other tools), portable across servers, workstations and devices, and known to many people and to every AI agent. Bun is the default runtime and Node 26 the backup.

## The two languages

- **FR-001**: A harness's specifications MUST be natural language in Markdown, and its ontology, code, tools and tests MUST be TypeScript 7 or later, run on Bun by default and on Node 26 as the backup (0005-typescript-practice).
- **FR-002**: A fact, a setting or a schema MUST NOT be kept as source in another language or format (YAML, JSON, XML, Turtle, SQL), except as a named exception (FR-004); what other forms a tool writes from the TypeScript is generated, marked `.auto.`, and never edited by hand.

## Integrations

- **FR-003**: Code written to integrate, extend or plug into another system MUST be TypeScript 7 where it can be. Where TypeScript does not support what the job needs natively and a hand-written minimal parser or client would not be good enough, the best stack (format, language or tool) for the integration job MUST be chosen and used: an integration that works is not given up for a language.
- **FR-004**: Each such choice MUST be a typed `Exception` of the ontology: the tool, its language or format, why TypeScript or a hand-written parser is not enough, its pinned version (0002-packaging), its isolation (a typed TypeScript wrapper with files in and files out, so that nothing else depends on it), the platforms it supports, and the real-tool tests that run it.

## Against drift

- **FR-005**: Mizan's documentation MUST say that drift between specification and ontology is a real danger, and that sticking to natural language for specifications and TypeScript 7 for ontology and code reduces it without removing it.
- **FR-006**: A harness MUST hold these controls against drift: each source file names the requirements it implements (`// Spec:`), each test names what it proves (`proves([...])`), each ontology term names the specification that defines it, a specification names only terms the ontology defines, the words code branches on are code lists imported as unions and never written again, generated files are checked for staleness and the direction of imports is checked (0015-trace).
- **FR-007**: Mizan MUST state that a type checker cannot check prose against code, so that what no control reads (whether a requirement means what its authors meant) is reviewed by a person, and a requirement that only review can prove MUST be declared as reviewed with the reason.

## Out of scope

- Which tools a particular integration uses: each states its own `Exception`.
- The form of a specification: `0003-mizan`.

## Edge cases

- A harness that keeps a fact in a YAML file: the fact is moved into the ontology or the file is declared an exception, per FR-002 and FR-004.
- A third-party file a tool reads (a lockfile, a manifest): not ours, so no exception is needed for reading it, per FR-002.
- An importer for a format TypeScript cannot read without a large parser: a pinned reader with a typed wrapper, as an `Exception`, per FR-003 and FR-004.
- An exception whose tool exists only on Linux: its tests run only there, and it says so, per FR-004.
- A requirement whose meaning only a person can judge: declared as reviewed with its reason, per FR-007.

## Assumptions

- The kernel and the host runtime already hold commons' TypeScript to Bun and Node 26 (0005-typescript-practice), so this specification adds no runtime of its own.
- Where TypeScript 7 does not yet support a need, the choice of another stack is the integration author's, recorded in the `Exception`.

## Open questions

- **OQ-1**: Whether the exceptions' isolation should be a subprocess contract or a library boundary, per tool, once the first one exists.

## Key entities

- **Exception** - a recorded choice of a tool that is not TypeScript, with its reason, version, isolation, platforms and tests.

## Success criteria

- **SC-001**: A harness's only non-TypeScript sources are named exceptions or third-party files.
- **SC-002**: Every exception has a pinned version and a test that runs its real tool.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
