# Feature Specification: Ansible dialect

**Spec ID:** 0002-ansible-dialect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The dialect of Archon (commons archon 0004-archon-dialects) that converges a Linux host with Ansible, the first of the configuration dialects of commons archon 0034-archon FR-013. The machine converges itself (a local connection), as the default preset of Archon has it, so that a controller needs no copy of the tool. The dialect uses only the modules of `ansible-core`, so that one tool is pinned and no collection.

## Requirements

- **FR-001**: The dialect MUST declare as data that its tool is `ansible-core` at the version it pins (2.16.3, the release of Ubuntu 24.04's archive, unless the fleet passes another), that it carries the kinds `package`, `user`, `group`, `file`, `directory`, `service`, `ssh-authorized-key` and `system-setting` (the time zone, the locale and the keyboard layout, by files and the modules of ansible-core only), reaches subjects of the class `machine`, has a `faithful` plan, a `proven` idempotence and can destroy.
- **FR-002**: The dialect MUST render an order and its plan to three files, an inventory, a configuration and a playbook, each saying that it is generated and none edited by hand, with the same text and the same digest for the same order and plan, and with a task only for each requirement whose entry in the plan changes something. Each kind has a shape of `desired`: `package` `{name, version?}`; `group` `{name}`; `user` `{name, uid?, comment?, shell?, home?, groups?}`; `directory` `{path, owner?, group?, mode?}`; `file` `{path, content, owner?, group?, mode?}`; `service` `{name, running, enabled}`; `ssh-authorized-key` `{user, key, path?}`; `system-setting` `{name: timezone|locale|keyboard, value}`.
- **FR-003**: The playbook MUST use only the modules of `ansible-core` (`ansible.builtin`), and MUST end, in check mode only, with a task that fails where any task would have changed something or could not be checked, so that the exit status 2 of the check means a change (check mode alone exits 0 where something would change).
- **FR-004**: The render MUST refuse, naming each requirement, a kind the dialect does not carry, a `desired` that does not have the shape of its kind (a relative path, a malformed name, a service that does not say whether it runs and starts at boot) and a `desired` that holds what looks like a secret; and MUST give every reason, not the first.
- **FR-005**: The dialect MUST give one step for the changes it carries, covering the requirements that change, whose apply is `ansible-playbook` with the rendered inventory and configuration and whose check adds `--check --diff` and names exit 2 as the change; every vector MUST name the digest of what was rendered, a plan that changes nothing MUST give no step, and a removal MUST be a destructive step that has a check.
- **FR-006**: The conformance of the dialect MUST be shown with the real tool on a disposable machine of the library `lab` with the pinned ansible-core: the check shows what would change and changes nothing, the apply makes it, applying the same order a second time reports no change, the check after the apply finds nothing, a change made by hand is found again with its difference, and a removal is carried out. Without a container runtime the test is skipped with the reason.

## Acceptance scenarios

1. **Given** an order of a group, a user, a directory, a file and a key and an empty observation, **When** it is rendered, **Then** the files are generated, their digest is stable and the playbook has a task for each, per FR-002.
2. **Given** a kind the dialect does not carry, a relative path and a service with no `running`, **When** it is rendered, **Then** the three reasons are given, per FR-004.
3. **Given** the machine and the steps, **When** the check runs before and after the apply, **Then** it exits 2 and then 0, per FR-005 and FR-006.

## Out of scope

- Collections of Ansible (`community.*`, `ansible.posix`): kinds that need them (sysctl, firewall rules, the host name) are not carried until a collection is pinned and proved.
- The observation of what is on the machine: an observer outside the dialect gives it (commons archon 0034-archon FR-010); the dialect changes and never observes.
- Windows hosts, and a controller that pushes over SSH: later dialect options.

## Edge cases

- A check that fails for a reason other than a change (a module error) also exits 2 in check mode: the output says which task, and the apply says whether it was a real error, per FR-003.
- A package that a `desired` pins to a version the archive does not have: the apply fails and says so; the plan was faithful as far as check mode can see, per FR-005.

## Assumptions

- The machine has ansible-core at the pinned version; the program that runs the steps checks `ansible-playbook --version` against the dialect's pin before it runs them.

## Open questions

- None.

## Key entities

- **Dialect**, **Render** (inventory, configuration, playbook), **Step**.

## Success criteria

- **SC-001**: An order converges a disposable machine and then changes nothing.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
