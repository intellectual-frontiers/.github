# Decisions on the terms of Ergonex agents (2026-11-22)

**Status:** unsigned. The owner decided on 2026-11-22 that Ergonex has an ontology namespace `ergonex` (`commons/ergonex/spec-kit/specs/0006-agents`, OQ-2) and that these Decisions are written and their signatures left blank; no agent signs them. Ticket: intellectual-frontiers/.github#25.

The `ergonex:` names were until now defined by the specifications. These are the terms of 0006-agents. For each, a standard was looked for and none names it, so each is `unaligned` and each needs a Decision that keeps it so (0018-standards-first FR-005). The searches are in `commons/ergonex/spec-kit/specs/0006-agents/research.md` and in the alignment table of the specification (FR-039); a standard that was not read is marked `(to verify)` there and not claimed here.

## D-1: `ergonex:Persona` is a term of the library's own

- **Term:** who drives a run of Ergonex: the closed set `human` and `agent` (0006-agents FR-001).
- **Basis:** `unaligned`. No standard was found that names the distinction of a person and a program at the keyboard of a command line.
- **Decision:** accepted as the library's own term.
- Signed by: ____________________  Date: __________

## D-2: `ergonex:Harness` is a term of the library's own

- **Term:** the program that drives Ergonex for a persona `agent`: `claude-code`, `codex`, `herdr` or `other` (0006-agents FR-002). `herdr` is the runtime that hosts agents, and the evidence names both (OQ-4).
- **Basis:** `unaligned`.
- **Decision:** accepted as the library's own term.
- Signed by: ____________________  Date: __________

## D-3: `ergonex:AgentPolicy` is a term of the library's own

- **Term:** the `agents` part of the manifest: what the persona `agent` may change, with which tier, identity and reach (0006-agents FR-005).
- **Basis:** `unaligned`.
- **Decision:** accepted as the library's own term.
- Signed by: ____________________  Date: __________

## D-4: `ergonex:Brief` and `ergonex:HarnessAdapter` are terms of the library's own

- **Term:** the map of the workspace for an agent (FR-009), and the instance of one port that writes the files of one harness (FR-011). The brief rests on the AGENTS.md convention, which is a convention and not a standard (research.md).
- **Basis:** `unaligned`.
- **Decision:** accepted as the library's own terms.
- Signed by: ____________________  Date: __________

## D-5: `ergonex:Job` is a term of the library's own

- **Term:** a long run that outlives the SSH session that started it, with a record under `<workspace area>/jobs/<id>/` (FR-024).
- **Basis:** `unaligned`.
- **Decision:** accepted as the library's own term.
- Signed by: ____________________  Date: __________

## D-6: `ergonex:Distro` and `ergonex:DisposableEnvironment` are terms of the library's own

- **Term:** what differs by distribution (FR-033), and a machine meant to be thrown away (FR-019). The field `ID=` of `os-release` is the file's own field (freedesktop.org os-release, not read in full; `(to verify)`).
- **Basis:** `unaligned`.
- **Decision:** accepted as the library's own terms.
- Signed by: ____________________  Date: __________

## Not done

The namespace as code (`commons/ontology/src/ergonex/`, with a record of its basis for each class and the version suite) is not written: it needs its own ontology specification, as `0003-planning-terms` is for Planning, and the signatures above. Until then the terms are defined by 0006-agents.
