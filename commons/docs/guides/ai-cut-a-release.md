# Cut a release with an AI assistant

The steps are in [Cut a release](cut-a-release.md). This guide asks an assistant to do the part that is safe for it, and to stop where a person must act.

## When to use it

When libraries have changed since their last tag and you want the plan, and then the versions raised and the generated records made, ready for you to read and push.

## What to give the assistant

- `AGENTS.md`, and the page [Cut a release](cut-a-release.md).
- The specification that says why versions are raised only at the release: `commons/spec-kit/specs/0026-works-versioning/spec.md`.
- A clean checkout of `main` with its tags fetched.

## The prompt

```prompt
Read AGENTS.md and commons/docs/guides/cut-a-release.md. Prepare a release, and stop before anything is published.

1. Run `bun run repoctl status` and tell me, for each library, its version in the repository, on npm and in its tag.
2. Run `bun run repoctl release plan`. Show me the plan: which libraries are raised, by how much and in which order. Explain anything that surprises you.
3. Wait for me to say the plan is right. Then run `bun run repoctl release apply`, which writes the versions and the record under commons/generated/.
4. Run `bun run dev:check`, show me the result and the files that changed, and stop.

Never raise a version by hand, never publish, never run `repoctl release publish`, and never print or ask for a token or a password. I commit, push and start the publish workflow myself.
```

## Check the result

- The plan raises only the libraries that changed, and in the order of their imports.
- No `version` was edited by hand: the only changes are the ones `bun run repoctl release apply` made.
- `bun run dev:check` passes, and the record `commons/generated/release.auto.json` is among the changed files.
- You, not the assistant, push to `main` and start the publish workflow.

## Common mistakes

- **A version is raised in a feature change.** Versions grow at the release and nowhere else.
- **The assistant publishes.** Publishing is the owner's act, behind a preview and a typed confirmation; an assistant never holds the credential.
- **The plan is applied without being read.** A plan that raises a library nobody changed means a tag is missing or a change leaked in.
- **A generated file is edited.** Run `bun run repoctl sync` to make it again.
