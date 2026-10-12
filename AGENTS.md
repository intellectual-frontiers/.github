# Intellectual Frontiers public root — agent entry point

Read [`README.md`](README.md) first, then the agora skill, which `agora skill generate` writes from the registry.
`./agora` at the repository root is the one command line. It needs only `uv` on the machine; `uv` fetches `archon` (workspaces-host's command runner), which fetches the newest Python and the
locked packages, and every command runs with no further step.

`./agora doctor` says what you have: whether a person is at the invocation (`unattended` unless you are at a terminal or `ARCHON_ATTENDANCE`
says so), the package manager it found, and where each program outside Python would come from. A command that names a toolchain entry (building
the guide, the design systems' browser and TeX harnesses) has `archon` obtain it first, with nobody asked: from a program already on the machine
when it is new enough, else from the machine's package manager, else from the entry's verified download. Nothing is installed by hand and there is no
step to run first; `./agora` is the whole bootstrap ([`0025-tooling-environment`](spec-kit/specs/0025-tooling-environment/spec.md) FR-033). If no
source can supply a program (offline, no administrator rights, no build for the platform) the command exits 3 and says why, and nothing is
reported as passed that did not run. `./agora check --suite spec --available` runs what can run, lists what was skipped, and exits 0 when what ran
passed.

Work spec first: the spec, then the ontology, then everything else (`./agora help specs`). Before you push, run
`./agora check --suite spec`, `./agora test` and `./agora fresh`.

Every commit's author and committer is Shahid Shah <shahid@shah.org> unless a person expressly authorizes an agent to be the
author of that commit in its message; an agent's part is a `Co-Authored-By` trailer (`0001-eidolon-architecture` FR-038).
