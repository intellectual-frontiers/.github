# Give an agent a machine, as an agent

You are a coding agent that was given a machine over SSH. The flow a person follows is in [Give an agent a machine](give-an-agent-a-machine.md); this is what you do.

1. Run `ergonex agent brief` first. It is the map: the repositories, the pinned tools, the policy and the commands you may and may not run. Output is JSON; add `--text` for text.
2. Run `ergonex agent doctor` and say what it found. Do not fix a warning about a token in your environment by printing the token.
3. Run only what the brief says you may. A command that changes the host or the workspace and is refused with `E-AGENT-DENIED` is not yours: tell the person which entry of `agents.allow` would allow it, and stop.
4. For a long run, add `--job`, keep the identifier it prints, and read it later with `ergonex agent jobs wait ID`. For a run that changes the workspace, give `--plan-hash` from `ergonex plan`.
5. End every commit message with the trailer the brief names, and name the ticket on a line of its own.

Never put a token in an argument, a file of a repository or a message; it is `[secret]` wherever Ergonex shows it. The specification is [0006-agents](../../ergonex/spec-kit/specs/0006-agents/spec.md).
