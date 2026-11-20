# Add a command to Ergonex

Ergonex is a program on Headless: each command is a governance action with its effect, its idempotence, a preview and a reach policy, run through the command-line surface ([Ergonex](../../ergonex/)).

1. **Declare it** in `commons/ergonex/src/commands/<name>.ts` with the declaration of `define.ts`: a name, a summary, its options and operands, examples, what it is as an action (its kind, effect, whether it is safe to repeat, whether it previews, where it may be reached from) and a body that returns a report or a failure. `paths.ts` is the smallest one.
2. **Put it in the tree** in `commands/program.ts`, where the commands and their groups are listed.
3. **State the requirement** in Ergonex's own spec kit and **prove it** with a test in `suite/` that runs the real program.
4. **Check it** with `bun run verify` in `commons/ergonex`.

The Programs section of this site is made from the program itself, so the new command has a page, with the command, tool and route it is drawn as for each tier of the audience, without anyone writing it.
