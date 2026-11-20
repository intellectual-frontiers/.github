# The release loop

Versions grow at the release, not on every push ([commons 0026-works-versioning](../../spec-kit/specs/0026-works-versioning/spec.md)).

1. **Between edits:** `bun run dev:check` at the repository's root type-checks and tests only the libraries your change affects, and the libraries that depend on them; `bun run repoctl prove` goes further and proves only what the change can reach, with the reason for every proof it leaves out ([proof by blast radius](proof-by-blast-radius.md)).
2. **At the release:** `bun run release` plans what a release does from the tags and the working tree, and `bun run release apply` raises the versions it says (a library whose files changed is raised by the greatest declared impact of its commits since its last tag, and a library that imports a raised one is raised by at least a patch), makes the generated files once, runs the tests that pack, install and type-check every library, and writes the record `commons/generated/release.auto.json`.
3. **The workflow:** the release workflow reads that record from `main`, publishes the libraries in the order of their imports, to npm and to the GitHub package registry, and tags each as `<work>-v<version>`. A version that is already published is only tagged.

Nothing publishes except the workflow, and nothing in the record names a day or a person, so the same state gives the same bytes.
