# Implementation Plan: Planning

**Spec:** 0037-planning (Draft; the name, the prefix and the custom types of OQ-9 are confirmed by the owner). **Written:** 2026-11-21. It is the order in which the library is built and how each requirement is proved. The inventory it generalizes is `inventory.md`; the first version covers its entries 1 to 14, and the records of 15 to 22 are the later phase.

## Standards considered

Read from the primary texts (the table of `spec.md`, Standards considered, has the versions and the sections): PROV-O for the actor, its delegation and the trace; SARIF 2.1.0 for the severity, the fingerprint and the baseline classes new, unchanged, updated and absent that `reconcile` uses; Web Annotation for the motivation; RFC 5545 and RFC 9253 for the status, the relations and the direction of a dependency; OSLC Change Management 3.0 as the comparison for the state and the fields of a change request (it has no history, so the events are Planning's); GFM for the task list item; GitHub documentation for the state reason, the closing keywords and the sub-issues; `git interpret-trailers` for what a trailer is; RFC 9562 and the ULID text for the ids; RFC 8785 and JSON5 for the files. Chosen where a choice was open: UUID version 7 by the hybrid clock AnyFS already has (RFC 9562 section 5.7, method 1 of 6.2) and not a ULID, because the ids of two stores must merge by union and a ULID gives no order inside a millisecond; JSON5 at the boundary, the one file for each event in the store.

## What is built and what is reused

Planning reuses and does not make again: the hybrid clock and the version id of `anyfs` (`nextTime`, `seeTime`, `makeVersionId`, `ReplicaId`), the stores of `anyfs` for every file, the JSON5 codec of `formats`, the SHA-256 of `crypto`, the Git host contract of `githost`, the headless program and its surfaces of `headless`, the typed ontology of `ontology` (`plan:`), the check of `kanon`, the SQL plugin pattern of `estate-query` and `anyfs-query`, and the SQL of `lang-sql`. What is new is the algebra (kinds, events, `fold`, `reconcile`, patches and previews), the lens laws, the sources and the surfaces.

## Package layout

| Package (folder under `commons/`) | Layer | Holds | Imports |
| --- | --- | --- | --- |
| `planning` | Kanon: governance, logical, physical | Governance: kinds, events, states, actors with principal, ids, patches, capabilities, the configuration type. Logical: `fold`, `reconcile`, the three-way merge, the query algebra, the views, the matrix of FR-015. Physical: the port a source implements, `defineSource`, the store of events over AnyFS, the surfaces (`planctl`, the tool server) | `core`, `anyfs`, `formats`, `crypto`, `headless`, `githost` (by its public exports only) |
| `planning-issues-code` | plugin | The source for the typed issues of a library (FR-024) | `planning` |
| `planning-event-files` | plugin | The source for the event files of the monorepo's issue schema (FR-025) | `planning` |
| `planning-markdown` | plugin | Task list items (FR-026) | `planning` |
| `planning-comments` | plugin | `TODO`, `FIXME`, `XXX`, `HACK` in source (FR-027) | `planning` |
| `planning-githost` | plugin | Issues and commit references of a Git host (FR-028) | `planning`, `githost` |
| `planning-query` | plugin | The SQL relations (FR-036) | `planning`, `lang-sql` |
| `planning-<noun>` (later) | plugin | SARIF, tests, bots, iCalendar and the findings of the later phase (FR-031) | `planning` |

`planctl` is the command of `planning`; it is not a library of its own (as `repoctl` is the command of `repoctl`). The names of the plugins follow OQ-8 and change together if the owner chooses dialects. The manifest of each is made by `repoctl new library <name>`, and each declares `distribution` as the owner decides; none is released by this plan.

## The order

1. Scaffold the libraries.
2. The core algebra and `fold`.
3. The ids and the clock; the event store.
4. `reconcile` and the three-way merge.
5. The lens laws and the conformance suite.
6. Sources, in this order: the event files (the real data), the typed issues of a library, Markdown, comments, a Git host, AnyFS over every backend, `defineSource`.
7. `planctl`, the tool server, the SQL relation.
8. Documentation, the typing test, the manifests, CI.
9. Later phase: sources of the later records.

The order is the order of risk: the algebra and the merge are what everything else rests on and are proved with no source; the lens laws are what a source must keep, and are written before the second source so that the suite shapes it; the event files come first among the sources because they are real data with a real fold to compare with.

## Phases

Size is in working sessions of one agent with the owner reviewing at its end.

| Phase | Deliverables | Exit criteria | Size |
| --- | --- | --- | --- |
| 0. Scaffold | `repoctl new library planning` and the plugin folders; the spec kit of the library (`planning/spec-kit`: layers, algebra, sources, surfaces) with its enforcement register; `docs.config.ts` entry | `repoctl sync`, `repoctl check`, the Mizan check and the ontology generation green with no code; the ontology audit says every kept class has its basis | 0.5 |
| 1. Core algebra and `fold` | The kinds, events, states, severities, verdicts, link kinds, capabilities, actors with principal, branded ids, the closed unions with an exhaustive `switch`; `fold` with the order by id; the refusal of an agent with no principal and of a person naming an agent; the cycle check of `blocks` | Property tests: `fold` is the same for any order and any repeat of the events (FR-004); the actor laws (FR-005); proposals are not counted (FR-006); a cycle is refused with its items (FR-009); the typing test finds no `any`, `!`, `enum` or cast but `brand` | 2 |
| 2. Ids, the clock and the store | The ids of FR-007 over the AnyFS clock; the legacy id function of FR-044; the encoding of events as JSON5 files (one file for each event; one for each item in the edition); the decoder that is total | Properties: two replicas' stores merge by union in any order with the same `fold`; the next id after a merge is after every id taken; a far-future id is refused; the same ULID gives the same id on any machine and its order is the ULID's; encode then decode is the identity and the key order is that of RFC 8785 | 1.5 |
| 3. `reconcile` and the merge | `reconcile` (the match order of FR-016), the baseline classes of FR-017, the derived close and reopening (FR-018), the conflict value, the duplicate proposals (FR-019), the outbox (FR-033), the patch and the preview with their hash (FR-010, FR-011, FR-014) | Properties over generated places and stores: a read of an unchanged place gives no event; each disagreement is an event or a conflict, never a silent choice; a person's event beats a derived close; the same inputs give the same proposals in the same order; a preview that differs from the plan is refused | 2 |
| 4. Lens laws and conformance | The laws of FR-023 as a suite that a source is given; the generators of places; the matrix of FR-015 and its `kanon/dropped` finding; the views and the query algebra (FR-020, FR-021) | The suite runs against a fake source in `planning` itself and finds a source that breaks each law; the views find a requirement with no item and an item that cites a requirement that does not exist | 1.5 |
| 5. Sources | In the order of the list above, each its own package with the suite and the property tests of its own place. The event files: all ten event types and every field of the opening read and written back by the rules of the schema, byte-identical for an unchanged file. The typed issues: the layout of data 0044 FR-002, every field kept. Markdown: the extension of GFM 5.3 exactly. Comments: the markers of the configuration and the anchor. Git host: through `githost`, read-only where the contract is. AnyFS: over a folder, Git, S3, SSH and SQL. `defineSource` | Each source passes the conformance suite; the event-file source's `fold` equals the real fold of the monorepo's code on every generated file (the one place where a second implementation exists to be compared with, run by a test that is skipped and says so where the monorepo is not there); the Markdown source is tested against every example of the task list section of the GFM text; the Git host source over a real temporary repository and, for the host's API, the transport of `githost` recorded | 7 |
| 6. Surfaces | `planctl` with the verbs of FR-034 and the exit status of check mode (FR-032); the tool server with the principal of FR-035; `planning.config.ts` and `definePlanning` (FR-037); the SQL relations (FR-036) | The headless envelopes are tested as the other programs'; the same verb through the CLI and the tool server gives the same outcome; the SQL answers the same as the query algebra; a write with no preview is a dry run | 3.5 |
| 7. Documentation and the gate | TSDoc of every module (`@remarks`, `@limits`); `about.ts` for the layers; the library's `verify`; the entry of `commons/planning/spec-kit` and of each plugin's in `docs.config.ts` (`specKits`, layout `commons`); the registration of each manifest; the typing test | `bun run verify` of each library, `dev:check`, `repoctl check`, the root tests on Node 26 and Bun green; the docs build has the specification and the library | 1.5 |
| 8. Later phase (design hooks only, no commitment) | After experience with the library: the sources of the later records, named in FR-031 | Decided by the owner then | not estimated |

The total of phases 0 to 7 is about 19 sessions; the later phase is not counted.

## How each requirement is proved

The rule of this repository is the real thing wherever it can run: a real `git`, real files, the real AnyFS backends; a simulator only for what needs an account.

| Requirements | Proof |
| --- | --- |
| FR-001 to FR-004, FR-006, FR-009, FR-010, FR-041 | Unit and property tests of the pure algebra (generated histories in any order and with repeats); the typing test compiles files that must not compile (a value outside a union, a missing `switch` case, a cast, an `enum`) |
| FR-005, FR-045 | Property tests of the actor laws over generated events; the principal from the configuration, from an argument and from a commit's author, the last over a real temporary Git repository made by `repoctl commit`'s own trailers |
| FR-007, FR-044 | Property tests with the real AnyFS clock: a clock set back, a full counter, two replicas; the ULID function against the ULID text's own layout and against ULIDs made by the monorepo's algorithm re-stated in the test (made-up, not copied from private files) |
| FR-008, FR-016 to FR-019, FR-033 | Property tests over generated places and stores with a fake source; the same over the real sources of phase 5 |
| FR-011, FR-032, FR-034, FR-035 | The real `planctl` run as a process over a temporary directory (dry run, hash, apply, check-mode status); the tool server over its real transport with an agent actor |
| FR-012 | Properties of `fold` with each authority and each actor kind, an agent acting for a person included |
| FR-013, FR-014, FR-023, FR-030, FR-042 | The conformance suite of the host over every source and over a source made by `defineSource` in the test |
| FR-015 | The matrix generated for each source and the `kanon/dropped` finding found when a reason is missing, by the check of Kanon over the library |
| FR-020, FR-021, FR-036 | The query algebra and the SQL relation compared on the same items; the views on made-up repositories of requirements |
| FR-024 | The real `issues/` folder of `commons/data` read and written back unchanged |
| FR-025 | Made-up files of the schema `erga/issue@1` (the real ones are private) and the comparison with the monorepo's fold where it is present (phase 5) |
| FR-026 | Every example of the task list section of the GFM text, read and written back byte for byte but the one character; nested items; a `tasks.md` of Spec Kit; an issue body |
| FR-027 | Real source files with comments, moved and reread; the generated and vendored files refused |
| FR-028 | A real temporary Git repository for the commits; the host API through the transport of `githost` with recorded responses, the part that needs an account left untested and said so in the header of the test |
| FR-029 | The same source over the AnyFS backends that run here (folder, Git, memory, SQLite) and over S3 and SSH where the repository's own tests run them; a changed file under a stated revision is a conflict |
| FR-031 | A test that the reserved names exist and that no source of the list is registered |
| FR-037, FR-038, FR-039 | The configuration with a field of the wrong type refused naming it; JSON beside it not read; decode then encode identity; a renderer that cannot hold a field says so |
| FR-040 | `verify` runs the check of Kanon |
| FR-043 | The ontology test and the Mizan terms rule |
| FR-046 | Each source over made-up records that carry every field of its inventory entry, the fields in the observation as read |
| FR-047 | A journal made by the real Evidence Capture code in a temporary directory, an item citing a line, the journal's bytes unchanged |

## The typed configuration, `planning.config.ts`

Shape, as the specification fixes it (this is a design sketch of the file a repository writes, not library code):

```ts
// planning.config.ts at the root of a repository
import { definePlanning } from "@intellectual-frontiers/planning";

export default definePlanning({
  principal: { id: "a-person" },           // who runs the work (FR-045); an argument of the run overrides it
  confirmers: "any-person",                // or "principal" (FR-006)
  store: { source: "event-files", place: "planning/" },
  sources: [
    { name: "markdown", place: "**/*.md" },
    { name: "comments", place: "src/**/*.ts", markers: ["TODO", "FIXME", "XXX", "HACK"], anchors: ["src/**/*.ts"] },
    { name: "githost", place: "github.com/owner/repo" },
  ],
  authority: { title: { markdown: "source wins" }, severity: { githost: "person only" } },
  duplicates: { threshold: 0.85 },
  clock: { maxDriftMs: 300_000 },
  agents: { claude: { actsFor: "a-person" } },   // the explicit rule of FR-044
  render: ["markdown", "json5"],
});
```

`definePlanning` checks the shape and is the identity, as `defineConfig` of `repoctl` is; `parsePlanning` is the one reader and returns a `Result` that names the field of a bad value; a field a source does not know is an error. The names of the keys are the design's and are final only when the library's spec kit is written.

**Trust.** `planning.config.ts` is TypeScript that the program imports, so it runs with the permissions of the person who runs `planctl`: it is as trusted as a build script. The rules are: it is read only from the root of the repository the run was started in and never from a path an argument or an item names; a run in a repository that was just cloned from someone else's remote reads it only after the person says so (`--trust` for a headless run, which a tool server never takes from an agent's call); it holds no secret, because a token is named by the variable that holds it and not written; and the principal of FR-045 is read from it but an argument of the launcher overrides it, so a configuration cannot make an agent act for a person who did not launch the run. The tool server takes the principal from the session it was launched for and not from a call.

## Typing test and documentation

A typing test of the library (as the one of `commons/tools`) compiles small files that must not compile: a severity outside the three, a state outside the four, an event type not in the union, a `switch` over a union that misses a case, an id made without the smart constructor, an agent actor with no principal, an `enum`, a non-null `!`, an `any`, a cast other than `brand`; and files that must compile.

Documentation: the TSDoc of each module, `about.ts` for the layers, the spec kit of each package in its own `spec-kit`, and the entries of `docs.config.ts`: `{ layout: "commons", dir: "commons/planning/spec-kit" }` and one for each plugin, beside the ones that are there; the guide for a person who adds a source (SC-003) is a page of the library's `docs`.

## Risks and open items

- **The principal in the monorepo's schema** (OQ-10): until it has a field, an agent's event cannot be written there with its principal, so the event-file source is read-only for agent events or a person's; the existing events of an agent written as a person are read by the explicit rule of FR-044.
- **Fold order for legacy ids** where two events of one second hold ids of two forms: a documented difference that a property test against the real fold reports; the owner decides whether it matters.
- **The Git host contract** holds no close reason, assignee or comment and has no write for an issue: the host source is read-only until `githost` is extended, which is its own specification.
- **AnyFS's id** is a UUID version 7 with a seeded counter in `rand_a` and a random `rand_b` for each id; it holds no replica, so the clock of Planning keeps its replica as a field and takes its entropy as a value a test can fix.
- **A ULID's 74 of 80 bits** in the legacy id function: two ULIDs of one millisecond that differ only in their last six bits give one id; the chance is 2 to the power of minus 74 for two given ids, and the external id is carried so that a collision is found by `reconcile`.
- **The names** of the plugins (OQ-8) and the markers (OQ-11) move together if the owner changes them.
- **Scale**: one file for each event gives many small files for a large history; the published edition holds one file for each item, and the store is read through AnyFS's listing: measured in phase 2 with a store of ten thousand events before the layout is frozen.
- **Overlap** (OQ-6): who owns what is the owner's; Planning reads data 0044 and 0045 and the notes scan of Docs and does not replace them, and the first version changes none of them.
- **The later phase** (sources of the Quality System, pen test findings, SARIF files and tests) has hooks only: the kind `plan:Finding`, the locator of a file span, the observation's fingerprint and the reserved names of FR-031; nothing more is designed until the library has been used.
