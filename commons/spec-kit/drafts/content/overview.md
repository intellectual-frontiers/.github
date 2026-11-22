# Draft: the spec kit of the library `content` (Kanon for content)

Status: draft, written for intellectual-frontiers/.github#22 and not registered. Nothing here is a requirement in force: the library folder `commons/content` does not exist, and it is made with `bun run repoctl new library content --summary "..."` only after the amendments of 0033-kanon (FR-025 to FR-033) and the checks of kanon 0002-kanon-content-checks are in force. These five drafts then move to `commons/content/spec-kit/specs/` as 0001 to 0005 of that library.

| Draft | What it holds |
|---|---|
| [0001-content-layers](0001-content-layers.md) | The library as a Kanon host: its table, its layers, its family. |
| [0002-content-governance](0002-content-governance.md) | Pages, claims and records as typed data modules, and their annotations. |
| [0003-content-logical](0003-content-logical.md) | The collector, the content model and the published bundle. |
| [0004-content-physical](0004-content-physical.md) | The contract of an instance, and the web surface. |
| [0005-content-assembly](0005-content-assembly.md) | The requirement-by-instance matrix, the finding and its dated policy, and the family. |

The first consumer is a private website in another repository. It is not named here and nothing here is specific to it: its pattern is a collector that writes typed content modules and a manifest of every file with its SHA-256, and a read-only service that loads the folder once at start, refuses the whole folder naming each reason if any file differs, runs no module before the check, and reads nothing afterwards. FR-004 of draft 0003 states that as a contract of the bundle.

The method that these drafts serve (books first, the typed vocabulary, the authoring grammar, the instances and the first matrix) is in [`../../specs/0039-content-method/spec.md`](../../specs/0039-content-method/spec.md).
