"""agora's toolchain lock: the programs outside Python that its commands need, one module per entry (0042-agora FR-030).

Each module declares an `ENTRY` (core/toolchain.py): name, version, an `https` address and SHA-256 per platform, what it
provides and a functional check. The registry finds them by presence (0041-command-line FR-066), so adding a module adds an
entry and deleting it removes one. A module imports only the standard library at module level (0041 FR-005).

An entry's address, checksum or version changes only in a commit of its own that passes its functional check
(`agora toolchain add NAME`) and the checks that use it (0041 FR-068, 0025-tooling-environment FR-009).
"""
