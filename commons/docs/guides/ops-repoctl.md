# The `repoctl` command

`repoctl` is the operations program of this repository: a headless program in the layers of Kanon, run as `bun run repoctl <verb>` at the root, or as `repoctl` where installed from the package, and served as tools by `repoctl mcp` so that an AI agent runs the same deterministic operations as a person. Every fact it knows of the repository (the generators of its generated files, its checks, the commit identity and trailers, the hygiene policy) is in `repoctl.config.ts` at the root; a generator or a check is added there and nowhere else. See [use repoctl in your own repository](repoctl-in-your-repo.md).

A verb is a governance action with an effect (`read`, `mutate` or `destructive`), a tier that may see it (`public`, `contributor`, `releaser`; the host fixes it with `REPOCTL_TIER`, `contributor` where it says nothing) and a reach policy. The verbs share `--json` (one JSON document), `--quiet` and `--verbose` (and most `--sarif` and `--color`); those with a preview take `--dry-run` and those that check take `--check`. Findings come with a code that `repoctl explain <code>` explains, and `repoctl help` lists the verbs. The same descriptions are drawn in full in [Programs](site:programs/index.html).

## Which verb for which job

- **Make the generated files**: `sync` (`sync --check` in CI and hooks).
- **Bring in `main`**: `merge origin/main`.
- **Say what is wrong**: `check` (the report), `doctor` (the checkout), `explain <code>` (a finding's meaning), `hygiene` (the consumption rule), `status` (versions).
- **Prove a change**: `prove`.
- **Commit**: `commit -m "Subject" --refs N`.
- **Release**: `release plan`, `release apply`, `release publish` ([the release](ops-release.md)).
- **Add a library**: `new library <name> --summary "..."`.
- **Documentation**: `docs build`, `docs check`, `docs serve`.
- **Ask in SQL**: `query "SELECT ..."` over the relations `libraries`, `specs` and `requirements`.

## explain

`repoctl explain <code>` says what a finding's problem code means and what to do about it; it runs where there is no configuration. It is part of the program and not a verb of the table below, so it is written here: `repoctl explain` with no code lists the codes.

```sh
repoctl explain          # the codes it can explain
repoctl explain <code>   # what one finding means, and the command that fixes it
```

## A generic host

`repoctl` knows every fact it has of a repository from `repoctl.config.ts` at its root: the generators of its generated files, its checks, the commit identity and trailers, the hygiene policy and the optional verbs ([repoctl 0009-repoctl-config](../../repoctl/spec-kit/specs/0009-repoctl-config/spec.md), [0010-repoctl-host](../../repoctl/spec-kit/specs/0010-repoctl-host/spec.md)). A generator or a check is added there and nowhere else; the same package, installed from npm, operates any other repository with its own configuration. A generator that is added to the repository is added to its table of generators (`commons/repoctl/src/governance/generators.ts`), and `repoctl` never makes the logic of `commons/libraries` or `commons/tools` again: it calls those programs. A library whose sources say their own version in a constant (`CORE_VERSION`) names it in `versionConstants` in its manifest, so that the release writes it and `repoctl check` finds it where it disagrees. A verb is a governance action with a reach policy and an audience tier (`public`, `contributor`, `releaser`, fixed by `REPOCTL_TIER`, `contributor` where it says nothing); `release publish` is a destruction of the releaser tier that needs a preview, `--yes` and the phrase the preview printed.
