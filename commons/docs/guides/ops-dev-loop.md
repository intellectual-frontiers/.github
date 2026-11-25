# The development loop

The loop you run between edits and before every push is not the release loop ([commons 0001-libraries FR-011, FR-012](../../libraries/spec-kit/specs/0001-libraries/spec.md)). It proves a change cheaply and early; the release is the separate act of [the release page](ops-release.md).

## Between edits: `bun run dev:check`

Once, `bun install`. Then `bun run dev:check` at the root finds the libraries your working tree changes since `origin/main` and the libraries whose own sources import them, links every library under `commons/node_modules` (a library imports another by its package name, so a local import is the checkout, never a copy from npm), type-checks them with TypeScript 7 and runs their tests, each library in its own `bun test` process and several at a time, then prints a short summary. Options: `--only NAME`, `--files A,B`, `--all`, `--list`, `--no-tests`, `--bail` (`bun run dev:check --help`). It proves less than a library's `verify`, and says so: a change to `commons/libraries`, to a specification or to a manifest wants that library's `bun run verify` as well (seconds, in its folder).

## The proof of a change: `repoctl prove`

`bun run repoctl prove [--why|--plan]` proves a change by its blast radius: the class of the change, the fingerprint of each library's public types, the importers of the changed symbols, the tests selected by imports and cached by content, and the reason for every proof left out. `ci` writes the same plan to the summary of its run. The idea is in [proof by blast radius](proof-by-blast-radius.md).

## A small step to `main`

1. Work spec first: the requirement in the spec kit, then the code, then the test.
2. `bun run dev:check` (and `bun run verify` in the library you touched).
3. `bun run repoctl sync` so that no generated file is stale.
4. `bun run repoctl commit -m "Subject" --refs N` (the commit has the identity, the trailers, no `.claude/`, no `node_modules`, no secret and no stale generated file).
5. `bun run repoctl merge origin/main` (or `git pull --no-rebase origin main`): a generated file that conflicts is made again, never merged by hand. Set `git config user.name` and `user.email` to the identity of `repoctl.config.ts` first (an agent session sets them before its first pull): a merge made where they are not set credits another name, and `repoctl hygiene` reports it as `E-HYGIENE-IDENTITY` ([commons repoctl 0007-repoctl-hygiene FR-007](../../repoctl/spec-kit/specs/0007-repoctl-hygiene/spec.md)).
6. `git push origin HEAD:main`. Never force-push; CI proves each step while the next is written.

## What CI runs that you run only where your change touches it

`repoctl check` is every check that is not a compiler, a linter or a test, in one report; `repoctl sync --check` runs the generators' checks and writes nothing. [CI/CD](ops-ci-cd.md) says what each workflow runs, and [the `repoctl` command](ops-repoctl.md) has every verb. Where a check fails, [fix a failing check with an AI assistant](ai-fix-a-failing-check.md) and `repoctl explain <code>` say what the code means.

## The environment

The cloud environment should have Node 26 next to Bun (`node --version` is `v26.x`; the pin is `NODE_VERSION` in `commons/libraries/src/workflows/definitions.ts`): `node --test` on an older Node fails on what Node 26 added.

The setup-script lines that install Node 26 where the environment has none are `curl -fsSL https://nodejs.org/dist/v26.13.1/node-v26.13.1-linux-x64.tar.xz | tar -xJ -C /usr/local --strip-components=1` and `node --version`; `nodejs.org` must be an allowed host of the environment, and the version in the line stays in step with `NODE_VERSION`. The commons' `engines` field says `>=26`.

## Push small steps

A fork or a person commits and pushes small steps to `main` as soon as `dev:check` passes, so that work meets in small merges and CI proves each step while the next is written. Run `bun run repoctl merge origin/main` first: it makes a generated file that conflicts again and never leaves one to be merged by hand. Never force-push. `bun run repoctl commit -m "Subject" --refs N` makes the commit (the identity, the trailers, no `.claude/`, no `node_modules`, no secret and no stale generated file), and `git push origin HEAD:main` pushes it. The release (versions, register, packing, publishing) is a separate, rarer act and is not done per push; see [the release](ops-release.md).

## Set your identity before you pull

A `git pull --no-rebase` or `git merge` makes a merge commit with the checkout's own `user.name` and `user.email`, and where they are not set the history credits another name ([repoctl 0007-repoctl-hygiene FR-007](../../repoctl/spec-kit/specs/0007-repoctl-hygiene/spec.md)). Before the first pull of a session run `git config user.name "Shahid Shah"` and `git config user.email "47497+shah@users.noreply.github.com"`, or merge with `bun run repoctl merge origin/main`, which uses the identity of `repoctl.config.ts`. `bun run repoctl hygiene` reports a merge by another identity as `E-HYGIENE-IDENTITY`; the merges made before the check are held by hash in `commit.heldMerges`, and history is never rewritten.

## Who makes a commit

Every commit is made by `bun run repoctl commit -m "Subject" --refs N`. Its author and committer is Shahid Shah with the GitHub no-reply address, given to Git with `-c user.name` and `-c user.email` and never another address, unless a person expressly authorizes an agent to be the author of that commit in its message. Its message includes `Refs #N` and the agent credit in `Co-Authored-By`; use `--co-author` when the configured default does not identify the agent. The standing authorization under which agents commit, and what it leaves to the owner, is recorded in [the Decision on the attribution of agent work](../../spec-kit/audits/2026-11-agent-attribution.md).
