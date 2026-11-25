# `.github`: agent entry point

This file is an index: each rule is one or two sentences and names where it is stated in full ([how it is prepared and used](commons/docs/guides/agents-md.md), [0011-documentation FR-043](commons/spec-kit/specs/0011-documentation/spec.md)). The repository is small on purpose: the public profile (`profile/`), the one-command installers of agora (`bin/`), `commons/` (what any company or harness of Intellectual Frontiers may use, with its own ontology, specifications and generated tables; the site is <https://intellectual-frontiers.github.io/.github/>) and `tests/`. Erga, its specifications, ontology and content are in the private `erga` repository: add none of it here.

- **Between edits run `bun run dev:check`** (once `bun install`); `bun run repoctl prove [--why|--plan]` proves a change by its blast radius; CI runs the rest, once, in `ci.auto.yml`. The development loop is not the release loop: [the loop](commons/docs/guides/ops-dev-loop.md), [proof by blast radius](commons/docs/guides/proof-by-blast-radius.md), [CI](commons/docs/guides/ops-ci-cd.md), commons 0001-libraries FR-011, FR-012.
- **Push small steps to `main`**: `bun run repoctl merge origin/main`, then `bun run repoctl commit -m "Subject" --refs N`, then `git push origin HEAD:main`; never force-push. Set `git config user.name` and `user.email` before you pull. Every commit is made by `repoctl commit`, authored as Shahid Shah with the GitHub no-reply address (an agent is the author only where a person expressly authorizes it in the message), names its ticket and credits the agent in `Co-Authored-By`: [push small steps](commons/docs/guides/ops-dev-loop.md), [0007-repoctl-hygiene FR-007](commons/repoctl/spec-kit/specs/0007-repoctl-hygiene/spec.md), [the attribution Decision](commons/spec-kit/specs/../audits/2026-11-agent-attribution.md).
- **Versions grow at the release, never per push** (0026-works-versioning FR-022, FR-041; 0001-libraries FR-013 to FR-015). The release is `bun run repoctl release plan` then `apply`; in `single` distribution mode it is one release, `commons`, and the owner commits what `apply` made and runs the workflow `release`: [the release](commons/docs/guides/ops-release.md), [0036-distribution](commons/spec-kit/specs/0036-distribution/spec.md) FR-019, FR-027.
- **Complete a package change in Erga** (0036-distribution FR-035): release the new version, refresh every Erga pin and lockfile, install with frozen lockfiles, run `./agora doctor`, `./agora check` and `./agora test` and each consumer's verification, review the findings and record the version and results.
- **Work spec first**, then code, then tests; every requirement has a test or says why it has none: [the rules every change follows](commons/docs/guides/contributor.md), [0003-mizan](commons/spec-kit/specs/0003-mizan/spec.md).
- **TypeScript, strongly typed**: Bun is the default TypeScript 7 runtime, Node 26 the backup; tests are `<kebab-case>.test.ts` with `proves`, run the real programs and never stand in for Git or the GitHub CLI ([0005-typescript-practice](commons/spec-kit/specs/0005-typescript-practice/spec.md)). The environment has Node 26 next to Bun ([the environment](commons/docs/guides/ops-dev-loop.md)).
- **A file under `commons/generated/` is generated**: change the ontology under `commons/ontology/`, never the file, and run `bun run repoctl sync` before you push.
- **`repoctl` is a generic host**: every fact it knows of a repository is in `repoctl.config.ts`, and a generator or check is added there and nowhere else ([ops-repoctl](commons/docs/guides/ops-repoctl.md), repoctl 0009, 0010).
- **A top-level folder of commons with a `spec-kit/` is an independent library** with a manifest `library.ts`; it imports other libraries by package name, never by a relative path out of its folder, and its specifications are numbered in its own registry ([0027-commons-libraries](commons/spec-kit/specs/0027-commons-libraries/spec.md), [add a library](commons/docs/guides/add-a-library.md)). Nothing we install invents a folder under a person's home, and no program assumes where repositories are kept (0031-install-locations FR-005).
- **Commons reaches another repository only as a published package** (0036-distribution FR-001 to FR-028): a repository other than `.github` installs commons from a registry, with no Git dependency on this repository, no `file:` or `link:` dependency into a checkout, no vendored copy; `repoctl hygiene` finds each. `single` mode is active: one package, `@intellectual-frontiers/commons`, one version, one tag ([consuming commons](commons/docs/guides/consuming-commons.md)).
- **Acceptance kits** live in a library's `acceptance/` (or `oat/`, `uat/`, `aat/`), apart from its `suite/` (0027-commons-libraries FR-025).
- **Documentation is the code's** (0011-documentation): a module's TSDoc and an area's `about.ts`; change them in the same commit as the code; `bun run verify` in `commons/docs` before you push; the explanation of Mizan is the group Mizan of the documentation.
- **License**: every part of this repository is under `PolyForm-Noncommercial-1.0.0` (0035-licensing); `bun commons/libraries/src/license.ts` writes every `LICENSE`, so never write a license text by hand.
- **Never put a secret, a token or a person's data in this repository: it is public.**
- **A fact a program owns is a generated block between marks** (the libraries map of the README, the workbench block below): never edit inside the marks. What a check can enforce is a requirement with an enforcement row, not prose here.

<!-- workbench:begin -->
## The workbench

Generated from the workbench contract `commons`; do not edit between the marks. Until 2027-01-01 every finding but a safety rule is a hint: it says what to do and never stops you.

**Before you start, run `bun run workbench ready`. For the task you are about to do, run `bun run workbench ready --for TASK --ensure`: it installs only what that task needs.**

- **workstation**: Where the operator, a person or an agent, orchestrates from: the harness, the operator's identity and keys, and the tool client configuration.
- **workshop**: Where the work happens: a machine, a virtual machine or a container, with its toolchain, runtimes and network.
- **workspace**: The repositories and other stores the work is about, laid out predictably so that a path means the same everywhere.
- **workbench**: Everything a role needs to do its job with a repository: programs and runtimes, credential names, network needs, Git settings and the authority it has.

| Role | Held by | May |
|---|---|---|
| contributor | either | read, edit, test, propose, commit, push |
| publisher | either | publish |
| approver | human | approve |
| releaser | human | approve, publish, tag |

| Stage | Autonomy | Gates |
|---|---|---|
| develop | agent-autonomous | none |
| safety-configuration | agent-proposes | scanner-pins |
| release | agent-acts-human-reviews | release-tag |
| rewrite | human-only | rewrite-published |

| Gate | Approver | What stops |
|---|---|---|
| release-tag | releaser | A release tag is signed by the releaser, from the commit that holds the release record. |
| scanner-pins | approver | The pins of the secret scanner (the canaries) change only with the approver's say. |
| rewrite-published | releaser | Rewriting published commits breaks every hash, tag and signature and is the releaser's. |

An agent that meets a gate stops and hands back; it never retries a denial and never approves its own work.
<!-- workbench:end -->
