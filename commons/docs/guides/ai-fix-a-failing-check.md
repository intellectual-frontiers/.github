# Fix a failing check with an AI assistant

## When to use it

When `bun run dev:check`, `bun run verify` in a library, `bun run repoctl check` or a run of CI fails and you want it fixed without anything being hidden to make it pass.

## What to give the assistant

- `AGENTS.md`.
- The exact output of the failing command, from its first failing line, never a summary of it.
- The command that failed, and the library it ran in.
- Which files you changed since it last passed (`git status` and `git diff --stat`).

## The prompt

```prompt
Read AGENTS.md. This command fails: `<the command>`, in `<library or the repository root>`. Its output is below.

<paste the output, from the first failing line>

Find the cause, not the symptom. Say what is wrong in one sentence, name the file and the requirement it concerns, then fix it.

Rules: do not skip, disable or loosen a test; do not add a line to a baseline to make a check pass; do not edit a file with .auto. in its name (run `bun run repoctl sync` for those); do not change a specification to match a bug, unless the specification is the thing that is wrong, and then say so first.

Run `bun run dev:check` and show me its summary when you are done.
```

## Check the result

- The same command now passes, and `bun run dev:check` passes for the libraries your change touches.
- No test was removed, skipped or weakened, and no baseline gained a line: `git diff` shows it.
- The explanation names a cause you can check in the file, not "it was flaky".
- If the failure was in CI only, ask the assistant to say what differs between CI and your computer before it changes anything.

## Common mistakes

- **Fixing the check instead of the code.** An assistant under pressure to get green will loosen the check. Ask what the check protects.
- **A generated file is stale.** If a check says a generated file is not what the folder makes, run `bun run repoctl sync` rather than editing the file.
- **A merge conflict in a generated file.** Run `bun run repoctl merge origin/main`, which makes the file again and merges the rest.
- **Only the first failure is fixed.** Run the command again; one failure often hides the next.
