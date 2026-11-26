# Feature Specification: Headless SSH forward

**Spec ID:** 0016-headless-ssh-forward
**Status:** Draft
**Owner:** if
**Domain:** headless

**Input:** A device that cannot be reached from outside sends its signals to the controller by an SSH `-L` forward to the controller's loopback receiver, authenticated by its own key. Headless builds every `ssh` argument vector by one function and forbids a hand-built one (`ssh/hand-built`), and writes the `authorized_keys` line and the `Match` block that take away forwarding of any kind. It cannot write a forward and cannot allow one. This specification adds the one forward, to loopback and to one port, and no other. It is governed by commons 0041-telemetry-and-reach (audit row A13). **Every requirement that asks for code is Deferred until after the owner's acceptance run of the command line.**

## Requirements

- **FR-001**: `SshConfig` MUST gain the optional field `forward` of the closed type `LocalForward { localPort, remotePort }` (both ports integers from 1024 to 65535; both ends are `127.0.0.1` and no other address, so the type holds no host), and `sshForwardArgv(target, all, config, forward)` MUST be the one function that builds the argument vector of a forward: `-N`, `-L 127.0.0.1:<localPort>:127.0.0.1:<remotePort>`, `-o ExitOnForwardFailure=yes`, `-o ServerAliveInterval` and the options of the family `pinned` (a pinned host key, batch mode), and MUST refuse a forward with any other family. Relies on audit rows: A13.
- **FR-002**: The check `ssh/hand-built` MUST keep finding an argument built by hand, and MUST find a `-L`, `-R` or `-D` that is not made by `sshForwardArgv`. Relies on audit rows: A13.
- **FR-003**: A reverse forward (`-R`) and a dynamic forward (`-D`) MUST NOT be built: the `tether` of ssh-server 0006-reserved FR-007 is reserved and MUST NOT be enforced here. Relies on audit rows: E4.
- **FR-004**: `authorizedKeysLine` MUST accept an option `forward: { port }` and then write `restrict,port-forwarding,permitopen="127.0.0.1:<port>"` and a forced command that does nothing (the key has no shell), and without it MUST write exactly what it writes today (`restrict`, so no forwarding); a port outside 1024 to 65535 MUST be refused. Relies on audit rows: A13, D2.
- **FR-005**: `matchBlock` MUST accept the same option and then write `AllowTcpForwarding local` and `PermitOpen 127.0.0.1:<port>` in place of `AllowTcpForwarding no`, keeping `AllowStreamLocalForwarding no`, `GatewayPorts no`, `PermitTTY no` and public keys only; without the option it MUST write what it writes today. Relies on audit rows: A13.
- **FR-006**: The forward MUST be a long-lived process: Headless gives the argument vector and the state it can read (`up` where the local port accepts a connection, `down` otherwise, as a pure function of a probe the caller gives) and MUST NOT supervise it; the supervisor is a service of the family's own (linux-services 0003-linux-services-otel). Relies on audit rows: A13.
- **FR-007**: On Windows the program MUST be the OpenSSH client that comes with the system (`ssh.exe`) and the argument vector MUST be the same; this is UNVERIFIED for `-L` and `ExitOnForwardFailure` on a real Windows host. Relies on audit rows: A13.

## Acceptance scenarios

1. **Given** a forward of local port 4318 to remote port 4318, **When** the argument vector is made, **Then** it holds `-N`, `-L 127.0.0.1:4318:127.0.0.1:4318` and `ExitOnForwardFailure=yes` and no other forward, per FR-001.
2. **Given** a port of 80, **When** the forward is made, **Then** it is refused, per FR-001.
3. **Given** a source that writes `-R` by hand, **When** the check runs, **Then** it is a finding, per FR-002.
4. **Given** a key with `forward: { port: 4318 }`, **When** its line is made, **Then** it holds `permitopen="127.0.0.1:4318"` and `restrict`, per FR-004.
5. **Given** a key with no option, **When** its line is made, **Then** it is unchanged, per FR-004.

## Out of scope

- The server that accepts the forward when it is not OpenSSH: ssh-server 0007-ssh-server-dedupe-and-forward.
- Supervising the process.

## Edge cases

- A forward whose local port is in use: `ExitOnForwardFailure=yes` makes the process end, and the state is `down`, per FR-001 and FR-006.

## Assumptions

- The controller's receiver is on loopback and its port is one number given by the policy.

## Open questions

- None.

## UNVERIFIED

- That OpenSSH honours `permitopen` together with `restrict` and `port-forwarding` as the manual of `sshd` says (read, not run).

## Key entities

- **LocalForward** - a loopback port to a loopback port, and nothing else.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
