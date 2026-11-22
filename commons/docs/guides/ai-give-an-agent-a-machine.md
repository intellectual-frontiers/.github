# Give an agent a machine, as an agent

The flow a person follows is in [Give an agent a machine](give-an-agent-a-machine.md). This guide is the same work, asked of the coding agent that was given the machine over SSH. The specification is [0006-agents](../../ergonex/spec-kit/specs/0006-agents/spec.md).

## When to use it

When a coding agent has been given a machine over SSH and must work on it under Ergonex's policy, with the commands it may and may not run decided by the brief and not by the agent.

## What to give the assistant

- `AGENTS.md`, and the page [Give an agent a machine](give-an-agent-a-machine.md).
- The machine's login, and nothing else: no token is passed in an argument, a file of a repository or a message.
- The ticket the work is traced to, so the agent can name it on every commit.

## The prompt

```prompt
You are a coding agent that was given a machine over SSH. Work under Ergonex's policy.

1. Run `ergonex agent brief` first. It is the map: the repositories, the pinned tools, the policy and the commands you may and may not run. Output is JSON; add `--text` for text.
2. Run `ergonex agent doctor` and say what it found. Do not fix a warning about a token in your environment by printing the token.
3. Run only what the brief says you may. A command that changes the host or the workspace and is refused with `E-AGENT-DENIED` is not yours: tell me which entry of `agents.allow` would allow it, and stop.
4. For a long run, add `--job`, keep the identifier it prints, and read it later with `ergonex agent jobs wait ID`. For a run that changes the workspace, give `--plan-hash` from `ergonex plan`.
5. End every commit message with the trailer the brief names, and name the ticket on a line of its own.

Never put a token in an argument, a file of a repository or a message; it is `[secret]` wherever Ergonex shows it.
When you finish, run `bun run verify` in commons/ergonex and show me the result.
```

## Check the result

- `ergonex agent doctor` reported no finding the agent hid, and the brief was read before any other command.
- No command refused with `E-AGENT-DENIED` was worked around.
- Every commit ends with the trailer the brief names and a ticket line.
- `bun run verify` passes in `commons/ergonex`.

## Common mistakes

- **The agent works from memory and skips the brief.** The brief is the policy; without it the agent guesses which commands are allowed.
- **A refusal is treated as a fault to get around.** `E-AGENT-DENIED` means the command is not the agent's: the person decides.
- **A token is printed to explain a warning.** No credential appears in an argument, a file or a message.
- **A long run is started without `--job`.** The run is lost when the session ends.
