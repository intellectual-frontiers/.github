# CI/CD: the workflows

The repository's automation is six GitHub Actions workflows, and none of their files is written by hand. Each is a typed value in `commons/libraries/src/workflows/definitions.ts`; `bun commons/libraries/src/generate-workflows.ts` writes `.github/workflows/<name>.auto.yml` from it (`--check` compares and writes nothing), and `repoctl sync` runs the same generator. To change a workflow, edit the definition and regenerate, never the `.auto.yml` file ([commons 0030-generated-workflows](../../spec-kit/specs/0030-generated-workflows/spec.md)). The pinned Bun, which every workflow uses, is the composite action `.github/actions/bun`.

## How a change is checked

- **`ci`** plans from what a push or pull request changed (`commons/libraries/src/plan.ts`, the same affected-libraries code as `dev:check`), then runs `verify` and the tests on Node 26 for the libraries that change affects, on Linux; and on Windows and macOS only for the libraries whose record in `LIBRARY_CI` names them. Its job `ci` is the one result to require.
- **`tests`** runs the tests of the repository's own files (`tests/`) on Bun and on Node 26, and checks the generated files and the rules that are not a compiler or a test (`repoctl check` covers the same ground by hand).
- **`conformance`** runs what a library's tests cannot alone: the OTLP of the telemetry library against the pinned OpenTelemetry Collector, and a program compiled into one binary on each system.
- **The documentation site** is checked inside `site`: the generator's tests and `ifc-docs check` gate a pull request and nothing else ([the site's own page of checks](site:quality/health.html)).

## How the evidence and the site are made

- **`evidence`** runs by the hour and by hand, never on a push: the tests of every library and of the repository's own `tests/` (one job for each, kept as a CTRF report with line coverage), a nightly job that runs mutation testing on a list of libraries (`MUTATION_LIBRARIES` in the definitions), and a `collect` job that gathers the reports into one artifact. A failed test is what the site is to show, so these jobs do not fail the workflow for what they find.
- **`site`** builds on every push to `main` from the newest evidence artifact and publishes to GitHub Pages whatever failed, with an emergency page made from the evidence alone where even the build failed. It also runs after the other workflows complete, so the page of runs is fresh. What it shows is in [Quality](site:quality/index.html), and the [DORA measures](site:quality/ci.html) are taken from its runs.

## How a release is made

- **`release`** is run by hand from `main` after `repoctl release apply` has been committed and pushed: see [the release](ops-release.md).
