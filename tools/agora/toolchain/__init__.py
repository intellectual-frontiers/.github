"""What agora knows of its toolchain entries beyond what `.workspaces-host/toolchain.d/` declares: one module per entry, holding its `NAME` and, where it has
them, its functional `check` and the `argv` that starts a program (0042-agora FR-030).

The declarations themselves (version, address, checksum, what an entry needs and sets) are data that `ws-host` reads and installs from
(0008-providers in workspaces-host); a module here imports only the standard library (0041-command-line FR-005) and holds no address, no checksum and no version.
The registry finds modules by presence (0041-command-line FR-066), so adding one adds a check and deleting one removes it.

An entry's address, checksum or version changes only in a commit of its own that passes its functional check (`agora check toolchain --functional`)
and the checks that use it (0041 FR-068, 0025-tooling-environment FR-009).
"""
