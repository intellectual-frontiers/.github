# commons

What any company or harness of Intellectual Frontiers may use. A capability goes here when more than one harness (today `archon`, tomorrow another) should read the same facts instead of keeping
its own copy. It holds no company fact and no secret: this repository is public.

| Capability | What it is | Specification |
|---|---|---|
| **Software supply chain** | Know what software a computer is made of, where each piece came from, and how to install it the same way everywhere. | [`0001-software-supply-chain`](spec-kit/specs/0001-software-supply-chain/spec.md) |
| ↳ **Packaging** | The package managers and system families of every computer, the commands that drive them, the package each family calls a program, and how far each family has been tried. | [`0002-packaging`](spec-kit/specs/0002-packaging/spec.md) |
| **Specification kit** | The format of specifications, the register of numbers and the register of what enforces each requirement, and the tool with no dependency that checks a folder against them. | [`0003-spec-kit`](spec-kit/specs/0003-spec-kit/spec.md) |
| **Rules** | The rules a harness applies to scripts, CI and code (portable shell, no installs outside the launcher, no host programs), as data with the reason for each, and the tool that finds what breaks the shell ones. | [`0004-rules`](spec-kit/specs/0004-rules/spec.md) |

## Layout

- `ontology/supply-chain/packaging/`: the vocabulary (`packaging.ttl`) and the data (`managers.ttl`, `families.ttl`, `programs.ttl`), seeded from the tables of
  [`upt`](https://github.com/sigoden/upt) (MIT or Apache-2.0) and from what `archon` runs.
- `tools/`: the tools, in TypeScript that Deno runs. `generate-packaging.ts` reads the ontology (with its own strict reader of the Turtle it is written in) and writes the files below:
  `deno run --allow-read --allow-write commons/tools/generate-packaging.ts`, and with `--check` it fails where they are stale. `spec-kit-check.ts` checks a spec-kit folder
  (`deno run --no-config --allow-read commons/tools/spec-kit-check.ts [--root DIR]`) and `shell-portability-check.ts` finds what only GNU tools have in shell scripts
  (`deno run --allow-read commons/tools/shell-portability-check.ts FILE...`).
- `generated/`: `packaging.auto.toml` (for programs), `packaging.auto.sh` (for scripts), `packaging.auto.ts` (for the machine setup, which is TypeScript), `pins.auto.env` (the pinned
  downloads, Deno among them, which the bootstraps also carry between their marks) and the tables of rules and of the installation record. Generated; never edited by hand.
- `spec-kit/`: the specifications of the capabilities, in the format of `archon`'s specifications.

A harness reads `generated/`; it keeps no fact of its own that the ontology holds.
