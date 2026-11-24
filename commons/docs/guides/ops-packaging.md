# Packaging

Commons reaches every other repository as one package, `@intellectual-frontiers/commons`, from a package registry, and from nowhere else. This page says how that package is made and what is in it; the figures below it are read from the evidence of the build, so they are the package as it is. The version in the heading of every page of this site is the newest stable version the registry holds.

## The strategy

- **One package, a library per subpath.** In `single` distribution mode ([commons 0036-distribution](../../spec-kit/specs/0036-distribution/spec.md)) the whole of commons is one package with one version. A consumer imports a library as `@intellectual-frontiers/commons/<library>` (and a subpath of it); the sources of this repository keep importing `@intellectual-frontiers/<library>` and a build step writes the specifiers of the package. Four commands come with it: `anyfs`, `arcactl`, `ifc-docs` and `repoctl`.
- **One registry.** The package is published to the GitHub package registry (`npm.pkg.github.com`) with the job's own token. The public npm registry is a typed list of targets, `SINGLE_TARGETS`, that is off; adding `npm` to it is the one change that turns it on. A consumer installs with a scoped `@intellectual-frontiers:registry=` line in its `.npmrc` and a token that may read packages.
- **An exact version.** A consumer pins an exact version, never a range: `repoctl hygiene` finds an `@intellectual-frontiers` dependency that is not exact, a copy of commons that is vendored and a dependency on a checkout. `repoctl usage --json` says, for a consumer, which libraries it imports, which it reaches through them and which it never touches, with their sizes; those are on [the package page of Quality](site:quality/package.html).
- **A version is raised at the release, never per push.** The next version comes from the greatest `Impact:` of the commits that touched a library since the last release. [The release page](ops-release.md) has the three steps.
- **Superseded versions leave the registry.** The workflow `maintenance` has a job, `package-clean`, that keeps the newest version and deletes the others from the registry, after a dry run that says which. A release is named in git by a tag, `commons-v<version>`, but a consumer never installs from a tag.

## What is in it, and what is not

The packer inspects the package before it is packed and refuses it where its content policy is broken, so that the package is the same kind of thing each time:

- `dist/` holds declarations and nothing else; a compiled file is the one beside a source of the same name.
- Nothing internal ships: the tests (`suite/`), the spec kits, the tools, the acceptance kits, `node_modules`, the source maps, the lockfiles, the baselines of the checks and the manifest of a library.
- No file is shipped twice: what a library reads at run time (an ontology, a stylesheet, a font) is there once.
- The size is held to a budget (the files, the apparent size and the size of the tarball). A growth beyond it is a finding of the packer, so that it is a decision and never an accident.

## What it asks of the consumer

The package installs no dependency of its own. It asks for `@types/node`, and the things only some libraries need are **optional peers**: the database drivers (`@duckdb/node-api`, `@electric-sql/pglite`, `pg`), the TypeScript compiler, `shiki` and `beautiful-mermaid`. A consumer installs the ones it uses, and a library that needs one that is absent says which. The GitHub registry drops the `peerDependenciesMeta` that marks a peer optional, so the package names its optional peers in its own field, `ifcOptionalPeers`, and the tools that read the package read it from there.

## The package at this commit
