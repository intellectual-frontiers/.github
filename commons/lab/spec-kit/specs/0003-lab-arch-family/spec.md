# Feature Specification: The Arch family and the Omarchy virtual machine

**Spec ID:** 0003-lab-arch-family
**Status:** Adopted
**Owner:** if
**Domain:** commons

**Input:** Ergonex is to be used by coding harnesses on an Omarchy machine (ergonex 0006-agents), and its tests need a disposable machine of that kind. Lab knows two families, `debian` (apt) and `rhel` (dnf), from containers. This specification adds a third, `arch` (pacman), from a container, and a second kind of machine, a virtual machine booted from the image that Omarchy publishes for its own tests, because a container cannot be Omarchy: Omarchy's own packages are in a repository the container does not add, and a container has no desktop session and no boot chain. What was tried, and what it showed, is in `research.md` beside ergonex 0006-agents. The ticket is intellectual-frontiers/.github#25.

## The Arch family

- **FR-001**: The base images MUST include `ghcr.io/archlinux/archlinux:latest` (Arch Linux's own image, pulled anonymously), and the family of an image (`imageFamily`) MUST be the closed union `debian`, `rhel` and `arch`, every `switch` over it ending in `absurd`.
- **FR-002**: Because the tag `latest` moves, the identity of an image made for the family `arch` MUST include the digest of the base image it was made on (the registry's digest of the image pulled, else its id; the base is pulled again before each start), so that a new base makes a new image and the same description on the same base finds the same one (0002-lab-machine FR-003).
- **FR-003**: `containerfile` MUST give for a description of the family `arch`, and the same description, the same text, with: the packages `systemd`, `openssh`, `sudo`, `iproute2`, `tzdata` and `ca-certificates` and those of the description installed by `pacman -Syu --noconfirm --needed`; `pacman --disable-sandbox` WHERE the kernel of the builder does not list Landlock in `/sys/kernel/security/lsm`; the build secret `ca`, WHERE the builder gives one, copied to `/etc/ca-certificates/trust-source/anchors/` and trusted with `update-ca-trust`, and the file left in no layer; the host keys made and `sshd.service` enabled; the users with their keys and the `sudo` rule of the description; and `/sbin/init` as the command.
- **FR-004**: A machine of the family `arch` MUST say in its description how it is started, `init: "systemd"` (the default) or `init: "none"`; with `none` its main process MUST be the SSH server in the foreground, no systemd runs, and the areas that need systemd (units and timers, the firewall's service) MUST be stated `not faithful` for it (0002-lab-machine FR-001).
- **FR-005**: `runtimeUsable`, given the description of the machine, MUST say, for a machine of the family `arch` with `init: "systemd"`, that it cannot run on a host whose kernel has no cgroup v2 (no `/sys/fs/cgroup/cgroup.controllers`), because the systemd that Arch ships has no support for cgroup v1 and exits at once with status 255 and no message, so that a test that needs it is skipped with that reason and never passes; a machine with `init: "none"` MUST NOT be refused for it.
- **FR-006**: Lab MUST give the packages of Omarchy's terminal side that Arch's own repositories carry as data, `OMARCHY_TERMINAL_PACKAGES` (read from `install/omarchy-base.packages` of Omarchy 4.5.0 and checked against `core` and `extra`: `git`, `tmux`, `mise`, `starship`, `gum`, `fzf`, `ripgrep`, `fd`, `jq` and `github-cli`), and a machine made with them MUST be described as "Arch with Omarchy's terminal-side packages", never as Omarchy, because the packages of Omarchy's own repository (`omarchy`, `omarchy-settings`, `herdr`, `mise-bin`, `yay`) are not installed; `herdr` MUST be installed, WHERE a test needs it, by the installer of herdr with its SHA-256 check and not by `pacman`.
- **FR-007**: The area of what a machine is that is called "apt packages" MUST be called "packages (apt, dnf or pacman)", with the same fidelity for each family.

## The Omarchy virtual machine

- **FR-008**: Lab MUST be able to start a virtual machine from a published image of Omarchy: from a manifest (`latest.json`: the image's address, its SHA-256, the kernel, the initrd and the command line) it MUST fetch the image and the files, check each SHA-256 and refuse the whole machine, naming each, where one differs, and MUST cache them by that digest.
- **FR-009**: A virtual machine MUST run on a copy-on-write overlay of the image that is deleted when the machine stops, so that the image is never written; each boot MUST make a new ed25519 key, hand its public half in through a systemd credential carried in the firmware tables (as Omarchy's `vm-boot` does, `tmpfiles.extra`), forward a local port to the machine's SSH port, and MUST NOT put a key or a password in the image.
- **FR-010**: Lab MUST use hardware acceleration (`kvm`) WHERE `/dev/kvm` is usable and software emulation (`tcg`) otherwise, MUST say which it used, and MUST wait for SSH for at most 300 seconds with acceleration and 2400 with emulation (observed in this work: 137 seconds to SSH with emulation on four processors and 6 GiB, Omarchy 4.5.0), ending with an error that names the bound and what the machine had printed if it does not answer.
- **FR-011**: A virtual machine MUST give the same executor as a container (`exec` of a program, with input), so that a test is written once for a container and for a virtual machine; and `vmUsable` (beside `runtimeUsable`) MUST say why a virtual machine cannot be run here (no `qemu-system-x86_64`, `qemu-img`, `ssh` or `curl`, or not enough room for the overlay).
- **FR-012**: A virtual machine MUST NOT be described as a faithful stand-in for hardware: the areas of UEFI and Secure Boot, hardware facts and a power cycle stay `not faithful` (0002-lab-machine FR-001), and a virtual machine started by emulation MUST NOT be used to claim anything about speed.
- **FR-013**: WHERE the builder gives a CA (`LAB_CA_BUNDLE`, a network that inspects TLS), a virtual machine MUST be given it after it boots (copied to the machine's `/etc/ca-certificates/trust-source/anchors/` and trusted with `update-ca-trust`, as on the container path, because `trust anchor --store` refuses a bundle that holds a certificate the system has already, observed) before a test that needs the network runs, because the published image does not trust it (observed: `mise` fails with `UnknownIssuer` on a network that re-signs TLS); a machine on a network that does not inspect TLS MUST NOT be given one.

## Acceptance scenarios

1. **Given** a description of the family `arch` and a builder with the proxy's CA as the secret `ca`, **When** the image is made, **Then** `pacman` installs through the proxy and the machine has `sshd` enabled, per FR-003.
2. **Given** the same description on a new digest of the base image, **When** the image is looked for, **Then** a new image is made, per FR-002.
3. **Given** a host with cgroup v1, **When** a test starts a machine of the family `arch` with systemd, **Then** it is skipped with the reason of FR-005, and with `init: "none"` the machine starts and answers on SSH.
4. **Given** the manifest of Omarchy 4.5.0 and an image whose SHA-256 differs, **When** a virtual machine is started, **Then** nothing boots and the difference is named, per FR-008.
5. **Given** the published image, **When** a virtual machine is started, **Then** SSH answers to the key of this boot and to no other, `/etc/os-release` says `ID=omarchy`, the image is unchanged after the machine stops and the overlay is gone, per FR-009.
6. **Given** a network that re-signs TLS, **When** a virtual machine has booted, **Then** its trust has the builder's CA and `mise` can reach the registries, per FR-013.
7. **Given** a host with no `/dev/kvm`, **When** a virtual machine is started, **Then** it uses emulation, says so, and answers SSH within the bound, per FR-010.

## Verification plan

| Requirement | Test | Runs against |
|---|---|---|
| FR-001, FR-002, FR-003, FR-007 | the text of `containerfile`, and an image made and started | the real Arch image (`ghcr.io/archlinux/archlinux:latest`), the real `pacman` through the proxy, on this host (observed: the build takes 22 seconds) |
| FR-004, FR-005 | a machine with `init: "none"` answers SSH; one with systemd is skipped with the reason | this host (cgroup v1: systemd of Arch exits 255, observed); a cgroup v2 host runs the systemd case, which is **not verified here** |
| FR-006 | the package list against `core` and `extra` | the real repositories (`git`, `tmux`, `mise`, `starship`, `gum`, `fzf`, `ripgrep`, `fd`, `jq`, `github-cli` found; `herdr`, `mise-bin` and `yay` not found, observed) |
| FR-008 to FR-011, FR-013 | a machine from the published image | the real Omarchy 4.5.0 image, with QEMU emulation here (observed: SSH after 137 s and 124 s, `ID=omarchy`, no HTTPS to the outside until the CA is trusted) and with KVM on a host that has it (**not verified here**) |

## Out of scope

- Installing Omarchy's own packages into a container, or building Omarchy from its installer.
- ARM images of Omarchy and Apple Silicon.
- A pacman dialect for Archon or for `linux-observe`: Ergonex installs tools with `mise` and does not manage packages (ergonex 0006-agents FR-034); a pacman dialect is needed only if a later specification manages the packages of a fleet.

## Edge cases

- The base image's package databases are not synchronized (`pacman -Q` warns that `core` and `extra` do not exist): the first install is `-Syu`, per FR-003.
- A builder with the CA secret and a base that already trusts it: the same text and the same result, per FR-003.
- An overlay without room: the start fails naming the folder and the room it needed, per FR-011.

## Assumptions

- The image that Omarchy publishes at `https://nightly.omarchy.org/stable/latest.json` keeps its form (an address, a SHA-256, the kernel, the initrd, the command line and a user `omarchy`); a change of form is a finding of the manifest check of FR-008.

## Decisions

Decided by the owner on 2026-11-22:

- **D-1**: The Arch family is built from the container, with systemd and sshd, and the proxy's CA reaches `pacman` through the same `ca` build secret as the `rhel` path. Omarchy's terminal-side packages and configuration are read from the Omarchy repository.
- **D-2**: `init: "none"` exists because the sandbox kernel is cgroup v1 and the systemd of Arch (262) exits with status 255 there (FR-004, FR-005).
- **D-3**: The virtual machine is a machine kind of Lab (answers OQ-1: the executor is shared), booted under QEMU emulation (`tcg`) where there is no KVM, from the published image: pinned by digest, checked, with a key made for each run and the host key pinned; stopping the machine removes it.
- **D-4**: The published Omarchy image and the nightly may be downloaded and cached (answers OQ-2 for this host: the cache is a folder named by the digest, kept between runs; the policy for the continuous integration is left to it).
- **D-5**: Honesty: the container is Arch with Omarchy's terminal-side parts, not Omarchy; the virtual machine is real Omarchy, under emulation here. Tests run against the real container and the real image and are skipped, with the reason, only where QEMU or the image is absent, never faked.

## Open questions

None open.

## Key entities

- **Family** - how a machine's packages are managed: `debian`, `rhel` or `arch`.
- **Virtual machine** - a machine booted from a published image on an overlay, reached by SSH.

## Success criteria

- **SC-001**: A test written for Ergonex runs on a container of the family `arch` and on the real Omarchy image with the same executor, and says which it ran on.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
