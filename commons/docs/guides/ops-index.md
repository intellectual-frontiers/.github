# Repo Ops

How the `.github` repository is operated: how its changes are proved, how its files are generated, how it is released and which command does each job. This section says each thing once and links to the page that holds the detail, so read it as a map.

The repository is small on purpose. The organization's public profile, the installers of the machine, and `commons/`, the libraries that any company or harness of Intellectual Frontiers may use, with their specifications and generated tables. Everything else is in a private repository.

## The pages of this section

- [CI/CD: the workflows](ops-ci-cd.md): the six workflows, what starts each, and how they are made (they are generated from typed definitions and never edited by hand).
- [The release](ops-release.md): one release, one package, and the three steps of it (`release plan`, `release apply`, `release publish`) with the workflow that publishes.
- [Packaging](ops-packaging.md): how the one package is made, what is in it and what is not, its size against its budget, the versions the registry holds, and what it asks of a consumer.
- [The development loop](ops-dev-loop.md): what you run between edits and before a push (`bun run dev:check`, `repoctl prove`), and how a small step reaches `main`.
- [The `repoctl` command](ops-repoctl.md): every verb, what it does, its options and examples, generated from the program's own typed definitions.

## The rules in one place

- **Specification first.** Change the specification in `commons/spec-kit/` (or the library's own spec kit), then the code, then the tests. Every requirement has a test or says why it has none.
- **Generated files are never edited.** A file under `commons/generated/` and every `.github/workflows/*.auto.yml` is made by a generator; change its source and run `bun run repoctl sync`. A test fails where one is stale.
- **Small steps to `main`.** Commit and push as soon as `bun run dev:check` passes; never force-push. Versions grow at the release and never per push.
- **No secret and no person's data**, because the repository is public.
- **The command line is the interface.** Each job of this list is a verb of `repoctl`, the same for a person and for an AI agent.

## Where the evidence of all this is

The site shows how well the operation works as it runs: the [Quality dashboard](site:quality/index.html), the [workflows and the DORA measures](site:quality/ci.html), the [repository's health](site:quality/health.html) and [what changed](site:quality/changes.html) since the tests last ran. The concepts behind the loop are [the release loop](concept-release-loop.md), [proof by blast radius](proof-by-blast-radius.md) and [the ladder](concept-ladder.md).

Newcomers: start with [the contributor path](contributor.md) and [how to add a library](add-a-library.md); this section is for the person or agent who keeps the repository running.
