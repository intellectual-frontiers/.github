# CI/CD: the workflows

The repository's automation is six GitHub Actions workflows, and none of their files is written by hand. Each is a typed value in `commons/libraries/src/workflows/definitions.ts`; `bun commons/libraries/src/generate-workflows.ts` writes `.github/workflows/<name>.auto.yml` from it (`--check` compares and writes nothing), and `repoctl sync` runs the same generator. To change a workflow, edit the definition and regenerate, never the `.auto.yml` file ([commons 0030-generated-workflows](../../spec-kit/specs/0030-generated-workflows/spec.md)). The pinned Bun, which every workflow uses, is the composite action `.github/actions/bun`.

## How a change is checked

- **`ci`** plans from what a push or pull request changed (`commons/libraries/src/plan.ts`, the same affected-libraries code as `dev:check`), then runs `verify` and the tests on Node 26 for the libraries that change affects, on Linux; and on Windows and macOS only for the libraries whose record in `LIBRARY_CI` names them. Its job `ci` is the one result to require.
- **`tests`** runs the tests of the repository's own files (`tests/`) on Bun and on Node 26, and checks the generated files and the rules that are not a compiler or a test (`repoctl check` covers the same ground by hand).
- **`conformance`** runs what a library's tests cannot alone: the OTLP of the telemetry library against the pinned OpenTelemetry Collector, and a program compiled into one binary on each system.
- **The documentation site** is checked inside `site`: the generator's tests and `ifc-docs check` gate a pull request and nothing else ([the site's own page of checks](site:quality/health.html)).

## Findings, never failures

A run is red only for a fault of the pipeline's own scripting or configuration (the closed list of red causes, below on this page). Everything a module says (a failing test, a type error, a warning, a crashed command) is a finding: each step of a workflow that runs a module's command goes through one wrapper that keeps what the command printed, reads it into typed findings and ends green. The job that gathers a workflow's findings is the one result to require; it is red only where a cell that ran left no findings file. Each run is kept on the branch `findings-history`, and the people who review quality and risk read the findings, their history and the accepted risks on [the build findings page](site:quality/build-findings.html).

## How long it takes

[Build time](site:quality/ci.html) shows, for each workflow, the median and the 90th percentile of the wall time of its runs on `main` that passed, held against typed targets, and the slowest jobs of each with their slowest step. A target that is missed is a finding on that page and never fails a build.

## How the evidence and the site are made

- **`evidence`** runs by the hour and by hand, never on a push: the tests of every library and of the repository's own `tests/` (one job for each, kept as a CTRF report with line coverage), a nightly job that runs mutation testing on a list of libraries (`MUTATION_LIBRARIES` in the definitions), and a `collect` job that gathers the reports into one artifact. A failed test is what the site is to show, so these jobs do not fail the workflow for what they find.
- **`site`** builds on every push to `main` from the newest evidence artifact and publishes to GitHub Pages whatever failed, with an emergency page made from the evidence alone where even the build failed. It also runs after the other workflows complete, so the page of runs is fresh. What it shows is in [Quality](site:quality/index.html), and the [DORA measures](site:quality/ci.html) are taken from its runs.

## How a release is made

- **`release`** is run by hand from `main` after `repoctl release apply` has been committed and pushed: see [the release](ops-release.md).

## What runs before a merge

`bun run repoctl check` runs the checks of the repository that are not a compiler, a linter or a test, in one report with a code for each finding, and `bun run repoctl sync --check` runs the generators' checks and writes nothing. They are the release's whole check, and you run them by hand only where your change touches them. The rest, which `.github/workflows/tests.auto.yml` runs on every push and pull request:

- at the root `bun x tsc -p tests/tsconfig.json` and `bun x tsc -p commons/tools/tsconfig.json` (which `repoctl check` runs), `bun fmt --check commons/tools tests`, and the linter as the workflow runs it;
- `bun test ./tests/*.test.ts` and `node --test "tests/*.test.ts"` (`tests/release/` is the release's);
- `bun commons/tools/generate-packaging.ts --check`;
- `bun commons/libraries/src/affected.ts --base origin/main`, which names the libraries a change affects, read from each library's package and imports ([commons 0027-commons-libraries FR-019 to FR-022](../../spec-kit/specs/0027-commons-libraries/spec.md));
- `bun commons/libraries/src/generate-workflows.ts --check` (the workflows are TypeScript values in `commons/ts/githost/workflows/`, `.github/workflows/*.auto.yml` is made from them and never edited; [0030-generated-workflows](../../spec-kit/specs/0030-generated-workflows/spec.md)) and `bun commons/libraries/src/generate-ontology.ts --check`;
- `bun commons/libraries/src/check.ts`, the rules Mizan adds, held by `commons/spec-kit/mizan.baseline.txt`, which only shrinks (`--level L0` to `L3` runs the rules of a conformance level, L3 where none is given, and `--all` also runs every library's `verify`);
- `bun commons/libraries/src/libraries.ts --check` and `bun commons/tools/mizan-check.ts`.

A test fails if a new top-level entry appears in the repository. The size of `AGENTS.md` is checked by `agents-md` in `repoctl check` and is reported as a finding ([0011-documentation FR-043](../../spec-kit/specs/0011-documentation/spec.md)).
