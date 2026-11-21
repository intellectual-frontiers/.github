# Feature Specification: Autoinstall dialect

**Spec ID:** 0002-cloud-init-dialect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The dialect of Archon (commons archon 0004-archon-dialects) for the install of a machine from nothing: the Ubuntu autoinstall configuration and cloud-init data that the installer reads over the network at first boot (commons archon 0034-archon FR-013, the first-boot dialect). It renders; it gives no step, because the installer carries the render out, not an executor. What the machine becomes afterwards is the Ansible dialect's render, which the machine pulls from its signed repository (the default preset of Archon, `pull-approved-tips`).

## Requirements

- **FR-001**: The dialect MUST declare as data that it carries the kinds `user`, `ssh-authorized-key`, `system-setting` and `package`, reaches subjects of the class `machine`, has no plan (`none`), an idempotence that is `unproven`, and can destroy (an install erases a disk), and MUST give no step.
- **FR-002**: The facts of an install MUST be taken from the order: the host name from the subject, the administrator from the first `user`, the administrator's keys from the `ssh-authorized-key` requirements of that user, the time zone, locale and keyboard layout from the `system-setting` requirements, and the packages from `package`; the dialect MUST refuse, giving every reason, an order with no administrator, an administrator with no key, a missing setting, a kind it does not carry, and a requirement that asks for something to be absent.
- **FR-003**: The render MUST be the autoinstall `user-data` (a `#cloud-config` document, JSON being valid YAML) and the `meta-data`, each saying that it is generated, the same text and digest for the same order and options, and its `autoinstall` section MUST be valid against the published schema of Ubuntu's installer: it sets the host name, the administrator and the locale, keyboard and time zone, allows sign-in by key only, installs on the largest disk with the layout given, updates security only, reports each step to the boot server and tells it when the install is done.
- **FR-004**: The render MUST hold no secret: the hash of the administrator's password MUST be a placeholder (`@archon:password-hash@`) that the boot server replaces when it serves the file, and a requirement whose `desired` holds what looks like a secret MUST be refused. The first command of the install MUST be the blank-disk guard, which reports the machine's facts to the boot server before any disk is touched and, with no answer or an answer that is not `ok`, erases nothing and powers the machine off.
- **FR-005**: The render MUST refuse a kind the dialect does not carry, naming the requirement.
- **FR-006**: The script the machine converges itself with MUST get the signed repository at its branch, MUST run nothing unless the tip is signed by one of the signers in `/etc/archon/allowed_signers` (saying so to the boot server and exiting 1), MUST run the playbook the signed tip holds for the machine, and MUST be safe to run again, because a timer runs it every fifteen minutes. This MUST be shown with the real git, ssh-keygen and ansible-core on a disposable machine of the library `lab`: an unsigned tip runs nothing, a signed one converges. Without a container runtime the test is skipped with the reason.
- **FR-007**: The dialect MUST be made from the facts that are not requirements: the fleet, the repository (its address, its branch and the folder of its rendered playbook), the signers, the boot server's URL for the host and, where given, the MAC of the network port, the disk and a proxy.

## Acceptance scenarios

1. **Given** an order of an administrator, a key, a time zone, a locale and a keyboard layout, **When** it is rendered, **Then** the autoinstall has the identity, key-only sign-in and the guard first, and the password is the placeholder, per FR-003 and FR-004.
2. **Given** an order with no key for the administrator, **When** it is rendered, **Then** it is refused with that reason, per FR-002.
3. **Given** a machine and an unsigned tip, **When** the converge script runs, **Then** it exits 1 and runs nothing, per FR-006.

## Out of scope

- The netboot server that serves these files (a plugin of the command: commons archon-boot).
- Running the installer: it needs a machine that boots from the network; the lab proves what a container can (FR-006).

## Edge cases

- The installer's own `user-data` section is free-form and is not checked by Ubuntu's schema; the write of its files and the first command are checked by the tests, per FR-003.

## Assumptions

- Subiquity's published schema is the one the Ubuntu release installs with; it is fetched for a check and not kept here (it is GPL licensed).

## Open questions

- None.

## Key entities

- **Install spec**, **Autoinstall**, **Guard**, **Converge script**.

## Success criteria

- **SC-001**: A blank machine can be installed unattended from a render that holds no secret, and converges itself only from a tip a fleet signer signed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
