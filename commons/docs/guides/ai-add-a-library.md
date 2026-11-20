# Add a library with an AI assistant

The steps are in [Add a library](add-a-library.md). This guide is the same work, asked of an assistant.

## When to use it

When you have a new capability that other libraries or programs will import by package name, and you can say in two sentences what it is for and what it must not do.

## What to give the assistant

- `AGENTS.md`, and the page [Add a library](add-a-library.md).
- The two sentences: what the library is for, and what it must not do or import.
- The library nearest to it in kind, as a pattern to copy: a small one such as `commons/package-managers/` shows the layout, the manifest and the spec kit.
- The specification that governs libraries: `commons/spec-kit/specs/0027-commons-libraries/spec.md`.

## The prompt

```prompt
Read AGENTS.md and commons/docs/guides/add-a-library.md. Add a library `<name>` to commons.

What it is for: <two sentences>.
What it must not do or import: <list>.

Work spec first. Use commons/package-managers/ as the pattern for the layout.
1. Start its spec kit: registry.tsv, enforcement.tsv and the first specification, with numbered requirements, acceptance scenarios, edge cases that cite requirements, and a success criterion for each outcome.
2. Write library.ts, package.json, about.ts, release.ts and tsconfig.json. If it has layers, declare the table in `kanon`.
3. Write the code, then a test for every requirement, each naming it with proves([...]).
4. Do not raise any version and do not edit any file with .auto. in its name.

Stop and ask me before you add anything that is not in the two sentences above.
When you finish, run `bun run repoctl sync`, then `bun run dev:check`, and show me the result of both.
```

## Check the result

- `bun run dev:check` passes, and it lists your library among the affected ones.
- `bun run repoctl check` reports nothing for it.
- `bun run verify` passes in the library's own folder.
- Read the specification before the code: each requirement should be one you would be willing to fail a build over.
- Open the diff for files you did not ask for. The generated files that change are the table in `README.md` and the register under `commons/generated/`, and only through `bun run repoctl sync`.

## Common mistakes

- **The assistant writes code before the specification.** Stop it and ask for the specification first; a requirement written after the code describes the code instead of constraining it.
- **A version is raised.** Versions are raised at the release and nowhere else.
- **A generated file is edited by hand.** Revert it and run `bun run repoctl sync`.
- **A library imports a sibling by a relative path.** A library imports another by its package name, and the layers check finds it.
- **A requirement has no test.** Every requirement is proved by a test that names it, or the specification says why it has none.
