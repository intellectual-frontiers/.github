# commons

What any company or harness of Intellectual Frontiers may use. A capability goes here when more than one harness (today `archon`, tomorrow another) should read the same facts instead of keeping
its own copy. It holds no company fact and no secret: this repository is public.

| Capability | What it is | Specification |
|---|---|---|
| **Software supply chain** | Know what software a computer is made of, where each piece came from, and how to install it the same way everywhere. | [`0001-software-supply-chain`](spec-kit/specs/0001-software-supply-chain/spec.md) |
| ↳ **Packaging** | The package managers and system families of every computer, the commands that drive them, the package each family calls a program, and how far each family has been tried. | [`0002-packaging`](spec-kit/specs/0002-packaging/spec.md) |

## Layout

- `ontology/supply-chain/packaging/`: the vocabulary (`packaging.ttl`) and the data (`managers.ttl`, `families.ttl`, `programs.ttl`), seeded from the tables of
  [`upt`](https://github.com/sigoden/upt) (MIT or Apache-2.0) and from what `archon` runs.
- `tools/generate-packaging.py`: reads the ontology and writes the two files below; `uv run commons/tools/generate-packaging.py --check` fails where they are stale.
- `generated/`: `packaging.auto.toml` (for programs) and `packaging.auto.sh` (for scripts). Generated; never edited by hand.
- `spec-kit/`: the specifications of the capabilities, in the format of `archon`'s specifications.

A harness reads `generated/`; it keeps no fact of its own that the ontology holds.
