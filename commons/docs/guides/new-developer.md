# I am new to the repository

You need Bun (Node 26 also works). Everything below runs on Linux, macOS and Windows.

1. **Clone the repository where you like.** Nothing here assumes a folder layout: run the commands from the repository's root, whichever folder it is in. Install Bun and Git, and set `NODE_AUTH_TOKEN` to a token that can read packages.
2. **Look around.** The libraries are in `commons/`. Each has an overview page here (what it is for, what it imports, its specifications) and an API reference for every export. Start with Core, which imports nothing, then Kanon, which says how the others are laid out.
3. **Run one library's checks.** From a library's folder, `bun run verify` type-checks it, checks that its specifications and tests agree, and runs its tests. Between two edits, `bun run dev:check` at the repository's root checks only what you changed and what depends on it.

**Your first small task:** run `bun run verify` in `commons/core`, then open the specification [0001-core](../../core/spec-kit/specs/0001-core/spec.md), pick any requirement, and find the test that names it (`proves([...])` in `suite/`). You have followed a requirement from words to proof.
