# Decision 0001: pull the earlier workspace tools up into IFWS

**Decided on:** 2026-11-17
**Decided by:** the owner, in issue #10
**Concerns:** `0023-if-workspaces`, `0024-ifws-host`, `0025-ifws`

## Decision

The owner accepted the recommendation:

1. The layout and the `ensure`, `status` and `doctor` ideas of the earlier workspace tools are pulled up into IFWS (Intellectual Frontiers Workspaces). IFWS is where they live from now on.
2. The earlier layout tool is archived, after a tag, once `ifws` reproduces its layout and status. The history is not rewritten. `ifws` reproduces them today, so the archiving is due.
3. The earlier machine-setup repository is not replaced. IFWS does not manage dotfiles, shells or packages (`0024-ifws-host` FR-020), and the machine-setup repository consumes IFWS instead.
4. chezmoi stays credited as inspiration for ideas only. IFWS never calls it or depends on it (`0023-if-workspaces` FR-046).

## Why

The layout, `ensure`, `status` and `doctor` are one concern, kept twice: once in the earlier tools and once in IFWS. Keeping them in one place, typed and tested, removes the second copy. What IFWS does not own (dotfiles, shells, packages) has its own repository and keeps it, so that the boundary stays where `0024-ifws-host` FR-020 draws it.

## Consequences

- The earlier layout tool receives a tag and is archived; nothing in its history is rewritten or deleted.
- The machine-setup repository calls `ifws` for the workspace and keeps its own work for the rest.
- The credit to the earlier tools' author and to chezmoi stays in the workspace's documentation (`0023-if-workspaces` FR-046).
