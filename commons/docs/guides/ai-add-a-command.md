# Add a command to Ergonex with an AI assistant

The steps are in [Add a command to Ergonex](add-a-verb.md). This guide is the same work, asked of an assistant.

## When to use it

When a person doing their work needs one more thing Ergonex can do, and you can say what it reads, what it changes (or that it changes nothing) and whether it is safe to run twice.

## What to give the assistant

- `AGENTS.md`, and the page [Add a command to Ergonex](add-a-verb.md).
- One sentence for what the command does, and one for what it must never do.
- The smallest existing command as the pattern: `commons/ergonex/src/commands/paths.ts`.
- Where the commands are listed: `commons/ergonex/src/commands/program.ts`.

## The prompt

```prompt
Read AGENTS.md and commons/docs/guides/add-a-verb.md. Add a command `<name>` to Ergonex.

What it does: <one sentence>.
What it must never do: <one sentence>.
Its effect is <read | mutate | destroy>, and it is <safe | not safe> to run twice.

Work spec first, in Ergonex's own spec kit: state the requirement with a number, what the command reads and changes, and its edge cases. Then declare the command in commons/ergonex/src/commands/<name>.ts, following commons/ergonex/src/commands/paths.ts, and put it in the tree in commons/ergonex/src/commands/program.ts. Then write a test in commons/ergonex/suite/ that runs the real program, never a stand-in, and names the requirement with proves([...]).

Do not edit any file with .auto. in its name. Stop and ask me if the command needs a new option that no other command has.
When you finish, run `bun run verify` in commons/ergonex and `bun run dev:check`, and show me both results.
```

## Check the result

- `bun run verify` passes in `commons/ergonex`, and `bun run dev:check` passes.
- The command's effect and idempotence in its declaration say what you asked for, not what is convenient.
- A command that changes something has a preview, and the test runs it.
- The Programs section of the site has a page for the command, made from the program itself.

## Common mistakes

- **The effect is declared as a read and the body writes.** The declaration is what the tiers of the audience are shown, so it must be true.
- **The test stands in for the real tool.** A test of a command runs the real program on real files, never a fake.
- **The command is not in the tree.** A declared command that `program.ts` does not list has no page and cannot be run.
- **A secret is read and printed.** A command prints no credential, in a report or in an error.
