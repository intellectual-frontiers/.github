# commons

What any company or harness of Intellectual Frontiers may use. A capability goes here when more than one harness (today `archon`, tomorrow another) should read the same facts instead of keeping
its own copy. It holds no company fact and no secret: this repository is public.

| Capability | What it is | Specification |
|---|---|---|
| **Software supply chain** | Know what software a computer is made of, where each piece came from, and how to install it the same way everywhere. | [`0001-software-supply-chain`](spec-kit/specs/0001-software-supply-chain/spec.md) |
| ↳ **Packaging** | The package managers and system families of every computer, the commands that drive them, the package each family calls a program, and how far each family has been tried. | [`0002-packaging`](spec-kit/specs/0002-packaging/spec.md) |
| **Identity and roles** | Know who a person is, what part the person plays, what the person has bought and what the person may do, the same way on every site and platform, whichever provider answers. | [`0005-identity-and-roles`](spec-kit/specs/0005-identity-and-roles/spec.md) |
| **Specification kit** | The format of specifications, the register of numbers and the register of what enforces each requirement, and the standard-library tool that checks a folder against them. | [`0003-spec-kit`](spec-kit/specs/0003-spec-kit/spec.md) |
| **Rules** | The rules a harness applies to scripts, CI and code (portable shell, no installs outside the launcher, no host programs), as data with the reason for each, and the tool that finds what breaks the shell ones. | [`0004-rules`](spec-kit/specs/0004-rules/spec.md) |

## Layout

- `ontology/supply-chain/packaging/`: the vocabulary (`packaging.ttl`) and the data (`managers.ttl`, `families.ttl`, `programs.ttl`), seeded from the tables of
  [`upt`](https://github.com/sigoden/upt) (MIT or Apache-2.0) and from what `archon` runs.
- `tools/generate-packaging.py`: reads the ontology and writes the two files below; `uv run commons/tools/generate-packaging.py --check` fails where they are stale.
- `ontology/identity/`: the vocabulary (`identity.ttl`) and the data (`roles.ttl`): the roles and permissions of a book imprint and a think tank, and the depth levels of a work. `tools/generate-identity.py` makes `generated/identity.auto.toml` from it; `--check` fails where it is stale.
- `generated/`: `packaging.auto.toml` (for programs) and `packaging.auto.sh` (for scripts). Generated; never edited by hand.
- `spec-kit/`: the specifications of the capabilities, in the format of `archon`'s specifications.

A harness reads `generated/`; it keeps no fact of its own that the ontology holds.
