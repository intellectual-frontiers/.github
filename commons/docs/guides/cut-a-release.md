# Cut a release

1. From `main`, with the tags fetched, run `bun run release` to see the plan: which libraries are raised, by how much and why, in which order, and which are not released and for what reason. It writes nothing. A library is released unless its manifest carries a reason not to.
2. Run `bun run release apply`. It raises the versions, refreshes the lockfile of each library it releases, makes the generated files once and runs `repoctl sync`, runs the tests that pack, install and type-check every library, and writes the record `commons/generated/release.auto.json`.
3. Commit what it made and push to `main`.
4. Start the release workflow (by hand, from `main`). It publishes the libraries in the order of their imports, to npm and to the GitHub package registry, and tags each `<work>-v<version>`; a version already published is only tagged.

See [the release loop](concept-release-loop.md) for why versions are raised here and nowhere else.
