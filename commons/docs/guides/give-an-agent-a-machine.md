# Give an agent a machine

A coding harness (Claude Code, Codex, herdr running them, or another) is given a machine over SSH. This page is the flow, the policy, the tiers and the key that makes it safe; the requirements are in [Ergonex 0006-agents](../../ergonex/spec-kit/specs/0006-agents/spec.md) and are not copied here.

## Where to run it

Run agents on a disposable Omarchy virtual machine or a spare machine, not on a machine you live in. An agent given a machine can change it; a machine you can throw away makes that a small risk. Omarchy is the reference environment because it ships herdr and its own agent layer, and Ergonex keeps what differs by distribution in one place, so another Linux works with the generic fallback. On Omarchy the SSH server is turned on with `omarchy-setup-security-sshd --key=KEY`, which is the way in. Ergonex does not install Omarchy or change a configuration that Omarchy's own commands own.

## The flow

1. **Write the policy** of what the persona `agent` may change (FR-005): the commands it may run (`allow`), the repositories (`repos`), the tier of its tool server (`tier`), the identity and trailer of its commits (`commit`), whether the machine is `disposable` and the hosts `remote` may reach. A policy with a key it does not know is refused; an absent one allows nothing that changes.
2. **Know the host's key** before the first connection: give `--fingerprint SHA256:...` checked by another way than this connection, or accept the key once with `--trust-on-first-use`, which prints the fingerprint it recorded. A key that changes afterwards is refused.
3. **Bootstrap** with `ergonex remote bootstrap ssh://user@host --fingerprint ... --token-stdin --policy agents.json --harness claude-code`. It probes the machine, makes sure a runtime is there, writes the token to a file of mode 0600 from standard input (never an argument), installs this version of ergonex, makes the workspace and writes the policy, writes the files of each harness, runs the doctor and tries the tool server over the same connection. Run again with nothing changed, every step says `unchanged`; `--dry-run` probes and prints the steps.
4. **Refresh the token** with `ergonex remote token refresh host --token-stdin`: the token of a GitHub App installation lasts one hour. The private key of the App never goes to the machine; the controller holds it and passes the token on standard input.
5. **Work**: the agent reads `ergonex agent brief` (the map of the workspace), runs what its policy allows, long runs as `--job` that outlive its SSH session (`ergonex agent jobs`), and reaches Ergonex as a tool server with `ergonex mcp`.

## The persona and the tiers

Run as the persona `agent` (`--persona agent`, `ERGONEX_PERSONA`, or the manifest), Ergonex never prompts, gives the JSON envelope unless asked for `--text`, and refuses `setup`, `apply`, `render`, `repos` and `worktree` changes and `remote bootstrap` with `E-AGENT-DENIED` unless the policy allows them. The tool server serves only the verbs the held tier may see, which is the lower of the policy's tier and `ERGONEX_TIER`; a verb that changes something is not a tool at all.

## The key

`ergonex agent keys line --public-key FILE --role read-only|full` prints the `authorized_keys` line that forces a key to `ergonex mcp` and the `Match` block for `sshd_config`, and writes no file. A key so forced can reach the tool server and nothing else.

## What is not proved

A full agent session of a harness needs an account of it; herdr's own remote machines are its feature; and the first install of ergonex from the package registry needs a token that may read it. The specification lists what ran against what.
