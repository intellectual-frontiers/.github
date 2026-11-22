# The release

A release is a separate, rarer act than a push. Versions grow at the release and never per push: do not raise a `version` in `release.ts`, `library.ts` or `package.json` when you change a library ([commons 0026-works-versioning](../../spec-kit/specs/0026-works-versioning/spec.md)). The reasons are in [the release loop](concept-release-loop.md); the steps for a person are in [cut a release](cut-a-release.md), and for an agent in [cut a release with an AI assistant](ai-cut-a-release.md).

## One mode: single distribution

The distribution mode is typed, `per-library | single`, one constant in `commons/libraries/src/distribution.ts`, and `single` is active ([commons 0036-distribution](../../spec-kit/specs/0036-distribution/spec.md)). In `single` mode the whole of commons is one package, `@intellectual-frontiers/commons`, with one version and one tag `commons-v<version>`; a consumer imports a library as `@intellectual-frontiers/commons/<library>`. The package is raised from the tag and the files of every library since it, by the greatest `Impact:` of the commits that touched any library (a patch where none states one) and by the floor of the keys of its `exports`; the versions of the libraries are not raised. The per-library machinery is switched off and not deleted (`--distribution per-library` or `IFC_DISTRIBUTION=per-library` runs it for one run). See [consuming commons](consuming-commons.md) for how another repository installs it.

## The three steps

1. **`repoctl release plan`** says what a release would do and why, from the tags and the working tree. It writes nothing. Read it first.
2. **`repoctl release apply`** raises the version, refreshes the lockfile, makes every generated file, runs `repoctl sync`, runs the proof that packs and installs the tarball (with npm and Bun, every entry of every library imported on Node 26 and Bun, a consumer type-checked with and without `dom`) and writes `commons/generated/release.auto.json`. It commits nothing: commit and push what it made with `repoctl commit` and `git push origin HEAD:main`. `--impact major|minor|patch` on `repoctl commit` writes the `Impact:` line that feeds the next plan.
3. **The workflow `release`**, run by hand from `main` (`publish` is off by default, which is a dry run that plans, proves and packs), publishes the package of the record and makes the tag; the runner makes the tag because the Git proxy refuses a tag push. In `single` mode the tarball goes to the GitHub package registry alone; the npm target is the typed list `SINGLE_TARGETS`, off now, and adding `npm` to it is the one change that turns it on.

**`repoctl release publish`** publishes by hand instead, a destruction of the releaser tier: it needs a preview, `--yes` and the phrase the preview printed, it prints no credential, and from the tool server it is only a preview.

## The details

- What a version means and when it rises: [commons 0026-works-versioning](../../spec-kit/specs/0026-works-versioning/spec.md).
- The workflow that publishes, and the other workflows: [CI/CD](ops-ci-cd.md).
- Every option of each verb: [the `repoctl` command](ops-repoctl.md).
- How a release shows on the site: [the releases pages](site:overview/releases.html).
