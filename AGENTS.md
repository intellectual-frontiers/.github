# Intellectual Frontiers public root — agent entry point

Read [`README.md`](README.md) first, then the agora skill, which `agora skill generate` writes from the registry.
`./agora` at the repository root is the one command line; `ws-host` is all it needs.

On a machine without `ws-host` (a CI runner, a Claude Code cloud session, a Codex session), the one bootstrap of
[`0025-tooling-environment`](spec-kit/specs/0025-tooling-environment/spec.md) FR-033 comes first; it needs no setting of the
environment, and `--yes` is the committed answer of the person who wrote it, never a word you add yourself:

```shell
curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/workspaces-host/main/install.sh | WS_HOST_NO_APT=1 WS_HOST_NO_ADVANCE=1 sh
ws-host provider add "$PWD" --yes
```

Work spec first: the spec, then the ontology, then everything else (`./agora help specs`). Before you push, run
`./agora check --suite spec`, `./agora test` and `./agora fresh`.

Every commit's author and committer is Shahid Shah <shahid@shah.org> unless a person expressly authorizes an agent to be the
author of that commit in its message; an agent's part is a `Co-Authored-By` trailer (`0001-eidolon-architecture` FR-038).
