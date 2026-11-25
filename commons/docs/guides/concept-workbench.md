# The workbench

A workbench is everything a role needs to do its job with a repository. It is declared once, as a contract, and every operator, a person or an agent of any harness, is prepared from that one contract. This page says how it is built. [Get started](start-workbench.md) says how to use it.

## The four words

- **Workstation**: where the operator orchestrates from.
- **Workshop**: where the work happens (a machine, a virtual machine or a container).
- **Workspace**: the repositories and stores the work is about, laid out so that a path means the same everywhere.
- **Workbench**: what a role needs: programs and runtimes, credential names, network needs, Git settings and authority.

Every requirement and every error belongs to exactly one of them.

## A contract made of contributions

The contract is not one list of every tool. It is a small **base** that every task needs and **contributions** from the units that need more. A library of commons states its contribution in its own manifest, the field `workbench` of its `library.ts`: the programs it needs for a task, the folders whose dependencies must be installed, and which test files need which program. A task is made ready from the base and the contributions of the units it is about, and nothing else: `ready --for test --unit anyfs-sql` asks for `sqlite3` because the SQL library's tests say so, and `ready --for test --unit repoctl` does not. A test you have not selected installs nothing. That is the default, as it already is for `agora work build` in erga.

A requirement is one of six kinds: a program (with a least version and the argument vector that installs it, never a shell), a credential (the **name** of an environment variable, never its value), a network host, a Git setting, an install of a folder's dependencies, or an authority (a gate).

## People and agents are both first class

Roles are held by a person, an agent or either. Stages of a workflow have an autonomy level, and a stage the contract calls regulated is `agent-proposes` unless it says more, so a workflow can be fully automated in one stage and fully human in the next, and move from one level to the next as evidence accumulates. A gate names the role that approves it, and that role is always held by a person. An approval and a signed tag are a person's at every level.

## A dialect for each kind of operator

A dialect is how one kind of operator receives the contract. There is one for Claude Code, one for Codex and one for a person. The matrix of requirement by dialect has a cell for every pair, each expressed, carried or unexpressed with a reason, and a cell nobody answers is a finding. One rule is added to the Kanon matrix: a requirement an agent dialect leaves to a person must be a gate that the human dialect expresses, so an agent that is told to stop always has a person who is told what to do.

## Errors are a closed catalog

Every failure has a code, `E-WB-<CONCEPT>-<KIND>`, a concept, who fixes it (the agent, a person, the environment's owner or CI) and one fix. [The catalog](workbench-errors.auto.md) is generated from the code. A failure that is in no entry is `E-WB-UNKNOWN`, and meeting one means it is classified, given a check and a test and documented, all in one change.

## Built to Kanon

The library `workbench` is a Kanon host: governance holds the four words, the roles, the contract and the catalog; logical holds the pure functions (compose a task's requirements, evaluate them against facts, make the projections); physical holds the probe, the `ready` check, the command and the dialects, one folder each. Its specifications are in `commons/workbench/spec-kit/`.
