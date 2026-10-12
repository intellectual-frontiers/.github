# Intellectual Frontiers public root — agent entry point

Read [`README.md`](README.md) first, then the agora skill, which `agora skill generate` writes from the registry.
`./agora` at the repository root is the one command line. It needs only `uv` on the machine; `uv` fetches the newest Python and the
locked packages, and every command whose Needs column in the skill says `uv only` or names packages runs there, with no further step.

`./agora doctor` says what you have: provisioning `hosted` (`ws-host` is there) or `bare` (`uv` alone), and whether a person is at the
invocation. `./agora command list --json` marks each command `runnable` on this machine. A command that names a toolchain entry (building
the guide, the design systems' browser and TeX harnesses) needs `ws-host`; without it that command exits 3 and says so, and nothing is
reported as passed that did not run. Before you push on a bare machine, run `./agora check --suite spec --available`, `./agora test` and
`./agora fresh`: `--available` runs what can run, lists what was skipped, and exits 0 when what ran passed.

To run the commands that need programs outside Python, add `ws-host` by the one bootstrap of
[`0025-tooling-environment`](spec-kit/specs/0025-tooling-environment/spec.md) FR-033; it needs no setting of the environment, and
`--yes` is the committed answer of the person who wrote it, never a word you add yourself:

```shell
curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/workspaces-host/main/install.sh | WS_HOST_NO_APT=1 WS_HOST_NO_ADVANCE=1 sh
ws-host provider add "$PWD" --yes
```

Work spec first: the spec, then the ontology, then everything else (`./agora help specs`). Before you push on a machine with `ws-host`, run
`./agora check --suite spec`, `./agora test` and `./agora fresh`.

Every commit's author and committer is Shahid Shah <shahid@shah.org> unless a person expressly authorizes an agent to be the
author of that commit in its message; an agent's part is a `Co-Authored-By` trailer (`0001-eidolon-architecture` FR-038).
