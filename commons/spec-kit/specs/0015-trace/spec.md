# Feature Specification: Trace and layers

**Spec ID:** 0015-trace
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A harness of Intellectual Frontiers keeps no code that is not tied to a requirement or an ontology term, and a dependency that climbs its ladder the wrong way is refused (erga's constitution, Article I, and `erga 236-ladder`). Erga holds both with Rust checks of its own (`erga check trace`, `erga check layers`); a TypeScript harness (`stolos` first) needs the same checks without writing them again. IFC TypeScript's kernel gives them as pure functions over the contents of files: a trace check, which reads each source file's `// Spec:` lines, each test's `proves([...])` calls and `// Proves:` lines, each specification's requirements and status and the spec citations of the ontology's terms, and finds what is untied or names what does not exist; and a layers check, which reads each file's relative imports and finds an import from a rung of the ladder to a rung it may not rely on. Both give their findings as data, held against a baseline of the findings that exist when a check is first held, which may only shrink. A thin part of the runtime reads the files, so that a harness calls both from its own tools.

## The findings and the baseline (kernel)

- **FR-001**: `kernel/trace.ts` (exported by `kernel/mod.ts` as `trace`) MUST give a finding as data: the file (a path relative to the repository, with `/`), the line (1 for a whole file), the rule's id, one plain sentence, and a key that names the finding without its line (`<rule> <file>` and, where a file holds several of one rule, what the finding is about), so that a finding keeps its key when lines move.
- **FR-002**: A baseline MUST be a plain text file: comment lines beginning with `#`, then one finding key a line, sorted by code point, each once. The kernel MUST write it from findings (`formatBaseline`), read it (`parseBaseline`), and judge findings against it (`judge`): a finding whose key is not in the baseline is new, a baseline key that no finding has is stale, and the check MUST fail on either, so that the baseline only shrinks and MUST be shrunk when a finding is fixed. A plain text file is chosen over a TypeScript module because the tool writes it and a person only deletes lines from it: nothing in it runs when it is read, no formatter rewrites it, it reads the same on Bun and Node and in the pure kernel, and its diff is one line a finding.
- **FR-003**: The kernel MUST say the result of a judgement as lines for a person (`report`): every new finding with its file, line and sentence, every stale key with how to shrink the baseline, and a summary that names the counts; the lines MUST hold no colour, so that a log and a terminal read alike.

## The trace check (kernel)

- **FR-004**: The kernel MUST read a specification (`parseSpec`): its slug (the folder's name, `NNN-slug`), its status (the first word after `Status` in its head, in either Spec Kit's `**Status**:` or commons' `**Status:**`), its requirements (every line `- **FR-NNN**`, with a letter where one was inserted, and their lines), and the requirements its `reviewed.tsv` reviews (each line a requirement, a tab and the reason; `#` lines and blank lines skipped).
- **FR-005**: The kernel MUST read a source file's citations: every line that is `// Spec: ` followed by one or more groups separated by `;`, each a spec's slug and none or more requirements separated by `,` or spaces, where `FR-a to FR-b` is every requirement of that spec from `a` to `b`; a group with no requirement cites the whole spec. A file MAY hold several such lines.
- **FR-006**: The kernel MUST read a test file's proofs: every requirement named by a string literal in the array a `proves(` call opens, an identifier in that array being read as the string or array of strings a `const` of the same file gives it, and every requirement of a `// Proves: ` line (written as in FR-005).
- **FR-007**: `traceFindings` MUST, given the specifications, the source files, the test files and the ontology's citations, find: a source file with no `// Spec:` line (`trace/no-spec-line`); a `Spec:` line naming a spec that does not exist (`trace/unknown-spec`) or a requirement its spec does not have (`trace/unknown-requirement`); a requirement of a spec whose status is neither Draft nor Retired that no test proves and no `reviewed.tsv` reviews (`trace/unproved`, at the requirement's line of its `spec.md`); and an ontology term that cites no spec (`trace/term-uncited`) or cites a spec or a requirement that does not exist (`trace/term-unknown-spec`). A file with `.auto.` in its name is generated and MUST be exempt from every rule.
- **FR-008**: The ontology's citations MUST be data a harness passes (a term, the specs and requirements it cites, and where it is stated), and the kernel MUST make them from the individuals of an ontology (`citationsOf`): every individual made by a class schema that has a field named `spec` (or another name given), its citations the values of that field, and none where it has none.

## The layers check (kernel)

- **FR-009**: `kernel/layers.ts` (exported by `kernel/mod.ts` as `layers`) MUST take a ladder as data: rungs, each with its number, its name, its homes (globs of paths, a folder written with a trailing `/` meaning everything under it) and the numbers of the rungs it may rely on. A path MUST be on the rung of the home that matches it most specifically: a home with no glob character and no trailing `/` (one path) beats every other, a home whose last segment names files beats a folder, and among the rest the one with more literal characters wins; two rungs that tie MUST be a finding (`layers/ambiguous`), and a path no home matches MUST be a finding (`layers/unclassified`).
- **FR-010**: `layerFindings` MUST read each file's relative imports (a static `import` or `export ... from`, a side-effect `import`, and a dynamic `import()` of a string, `import type` included), resolve each against the file's folder, and find an import from a rung to a higher rung (`layers/above`) or to a lower rung its rung may not rely on (`layers/around`), each naming both files and both rungs. An import of a file on the same rung, or of a package by its name, MUST NOT be a finding. A file with `.auto.` in its name MUST be classified (a generated file has a rung) and its imports held like any other's.

## The runtime

- **FR-011**: `runtime/trace.ts` (exported by `runtime/mod.ts` as `trace`) MUST read what the kernel judges: the specifications of a folder (`specs/NNN-slug/spec.md` and `reviewed.tsv`), the `.ts` files under roots (leaving out `node_modules`), as paths relative to the repository with `/`; and MUST hold findings against a baseline file (`holdBaseline`): read it (a missing file is an empty baseline), judge, and give the lines of FR-003 and an exit status (0 when nothing is new or stale, 1 otherwise), or, with `write`, write the baseline from the findings and give 0. It MUST print nothing itself: the harness's tool prints the lines.

## Out of scope

- Reading Rust, SQL or any language but TypeScript (erga's checks keep their own).
- Resolving imports by package name or by a path alias of `tsconfig.json`: a harness's packages are another repository's ladder.
- Running the tests: what a test proves is read from its text, as the runner's own record already says what passed.
- Which ladder a harness has: the harness states it, in its own ontology.

## Edge cases

- A file `// Spec: 097-controller FR-001, FR-003 to FR-005`: four requirements cited, per FR-005.
- A file with two lines `// Spec: 097-controller` and `// Spec: 098-pair FR-002`: both cited, per FR-005.
- A file that cites `065-console`, a spec no folder holds: `trace/unknown-spec`, per FR-007.
- A range `FR-010 to FR-003`, or one whose end the spec does not have: `trace/unknown-requirement`, per FR-005 and FR-007.
- `proves([FR], ...)` with `const FR = "100-remote-access FR-003"` in the same file: the requirement is proved, per FR-006.
- A requirement proved only by a call that builds its id at run time (`FR(3)`): not read, so `trace/unproved` until a literal, a `const` or a `// Proves:` line names it, per FR-006 and FR-007.
- A spec with status `Draft`, or with no requirement any test proves: no `trace/unproved` for a Draft spec, per FR-007.
- `src/archon/assets.auto.ts` with no `Spec:` line: exempt, per FR-007.
- A baseline entry for a file that now has its `Spec:` line: stale, and the check fails until the line is deleted, per FR-002.
- A baseline with its lines out of order: read as the set it is, and written sorted, per FR-002.
- `src/archon/model/mod.ts` matched by the folder `src/archon/model/` and by `src/**/mod.ts`: on the rung of `src/**/mod.ts`, a home that names files, per FR-009.
- A file of rung 4 that imports a file of rung 2, when rung 4 may rely on 0, 1 and 3: `layers/around`, per FR-010.
- `import type { X } from "../model/types.ts"`: an import like any other, per FR-010.
- An import of `@intellectual-frontiers/commons/ts/kernel`: not a finding, per FR-010.

## Assumptions

- A harness's source files are TypeScript, and its imports are written as the house writes them: relative with `.ts`, or a package by its name.
- A file's citations are near its head, but the check reads every line, so a citation anywhere counts.

## Open questions

- **OQ-1**: Whether `trace/unproved` should also read the runner's record of which tests passed, once a harness wants the static reading and the run to agree.
- **OQ-2**: Whether erga's Rust checks should read the same baseline format.

## Key entities

- **Finding** - a file, a line, a rule, one sentence, and a key without the line.
- **Baseline** - the keys of the findings that existed when a check was first held; it only shrinks.
- **Citation** - a `Spec:` line's groups: a spec and its requirements, or the whole spec.
- **Proof** - a requirement a test names, in `proves([...])` or a `Proves:` line.
- **Ladder** - rungs with their homes and the rungs each may rely on.

## Success criteria

- **SC-001**: A TypeScript harness holds trace and layers with a tool of a few dozen lines that calls the runtime and prints its lines.
- **SC-002**: A new violation fails the check, and so does a baseline entry that no longer occurs.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Confidential: no sensitive fact written as a literal
