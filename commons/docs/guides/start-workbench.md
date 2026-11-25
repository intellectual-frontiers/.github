# Get started: set up your workbench

Whether you are a person, Claude Code, Codex or another harness, you need the same things before you start work on a repository of commons: the right programs, the right credentials by name, a repository in a predictable place and a clear idea of what you may do alone. The workbench says all of it once, checks it with one command and prepares each kind of operator in its own way.

## Four words

| Word | It is | Example |
|---|---|---|
| **Workstation** | where you orchestrate from: the harness, your identity and your keys | your laptop, or the app of a cloud session |
| **Workshop** | where the work happens | a machine, a virtual machine or a container |
| **Workspace** | the repositories and other stores the work is about | `$HOME/workspaces/<githost>/<org>/<repo>` |
| **Workbench** | everything a role needs to do its job with a repository | programs, credential names, Git settings, what you may do |

A laptop is a workstation and a workshop at once. A cloud session is a workstation that drives a workshop somewhere else. [The concept page](concept-workbench.md) says how they fit.

## Three commands

Run them at the root of a clone:

```
bun run workbench ready
bun run workbench ready --for test --unit anyfs-sql --ensure
bun run workbench explain E-WB-WORKSHOP-MISSING-PROGRAM
```

- `ready` checks the base that every task needs: Git, Node 26, Bun and a Git identity.
- `ready --for TASK --unit LIBRARY` also checks what that library needs for that task, and with `--ensure` installs it. **It installs only what that task needs**: a library you do not work on asks nothing of you, and a test you do not run installs nothing.
- `explain CODE` says what a code of the [catalog of errors](workbench-errors.auto.md) means and the one fix.

Until 1 January 2027 everything but a safety rule (a secret in a file) is only a hint: it tells you what to do and never stops you. After that day the checks are prescriptive.

## Where things go

```
$HOME/workspaces/
  github.com/<org>/<repo>/                    your checkout, which an agent never writes
  github.com/<org>/<repo>.wt/<actor>/<task>/  one worktree for one actor on one task
  stores/<kind>/<place>/                      other stores, read-only unless a grant says otherwise
```

A person works in the checkout or in worktrees of their own. An agent works only in a worktree named for it. To review an agent's work, open its branch as a worktree of your own beside the repository.

## Set up for your harness

- [As a person](workbench-setup-human.auto.md): a checklist, the runbook for stages and gates, how to review and approve.
- [With Claude Code](workbench-setup-claude-code.auto.md): the settings and hook it reads.
- [With Codex](workbench-setup-codex.auto.md): the block of `AGENTS.md` it reads, and what to set in its own configuration.
- With another harness: it reads `AGENTS.md`. Run `bun run workbench ready` first, as the block says.

## What an agent may do alone

Each stage of the work has one of four levels: `human-only`, `agent-proposes`, `agent-acts-human-reviews` and `agent-autonomous`. A gate is a point where work stops for a person who is never the author: a signed release tag, an accepted finding, a change to the scanner's pins, rewriting published commits. An agent that meets a gate stops and hands back; it does not retry a denial and never approves its own work. Where a person is needed, a person is told what to do: the [human runbook](workbench-setup-human.auto.md) lists every gate with its approver.
