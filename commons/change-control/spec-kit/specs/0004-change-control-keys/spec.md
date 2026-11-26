# Feature Specification: Change Control: custody of the signing keys

**Spec ID:** 0004-change-control-keys
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The keys that sign a fleet's changes, kept so that signing works and a lost or stolen key can be replaced: the checks with a code and one fix each, a key made by OpenSSH itself, Git set to sign with it for one repository, a test signature, the pre-push hook, and a commit signed by a key; a passphrase is typed into OpenSSH and Git and is never seen, stored or passed.

## Requirements

- **FR-001**: `checkKeys` MUST give from the facts of the machine, in order, a finding for each of: OpenSSH 8.2 or later (`E-KEY-SSH`), the daily key (`E-KEY-DAILY`), its passphrase (`E-KEY-PASSPHRASE`), that it is not loaded in an ssh-agent (`E-KEY-AGENT`), Git signing every commit of the repository with it in the SSH format (`E-KEY-GIT`), an identity for Git (`E-KEY-IDENTITY`), the daily key listed (`E-KEY-LISTED`), a recovery key listed (`E-KEY-RECOVERY-LISTED`), its private file not on this machine (`E-KEY-RECOVERY-HERE`), proved within 183 days (`E-KEY-RECOVERY-OLD`) and the pre-push hook (`E-KEY-HOOK`), each with what is wrong and the one fix (in words, or the commands of the product that the caller passes as `hints`, `KeyHints`: IF Commons names no product command); `signingWorks` MUST hold only where OpenSSH, the daily key, Git signing, the identity and the listing all hold.
- **FR-002**: `renderSigners` MUST give the text of the signers file (a header and the signers by name, role, key and the day added), `replaceKey` the signers with one key replaced (the new key has the name and the role, the old key stays listed as `<name>-retired-<day>` and retired on the day, so that what it signed still verifies), and `withSigner` the signers with one added, the same where the key is already listed and a reason where the name is taken.
- **FR-003**: `recoveryOverdue` MUST say a recovery key never proved, or proved more than the days given before now, is overdue, and `opensshVersion` MUST read the version from what `ssh -V` prints.
- **FR-004**: `makeKey` MUST make an ed25519 key pair by running OpenSSH itself with the terminal (so that the passphrase is typed into OpenSSH), MUST refuse a file that is there (a key is never overwritten), and MUST give the public key line; nothing MUST be loaded into an ssh-agent.
- **FR-005**: `configureGit` MUST set Git to sign every commit with the key in the SSH format for the repository alone (`--local`); `testSign` MUST sign a test file with the key and check the signature against the public key that is listed, so that a wrong passphrase, a file that is no key and a key that is not the listed one are each refused with the reason; `commitSigned` MUST make a commit signed by the key, empty where asked.
- **FR-006**: `installHook` MUST write a `pre-push` hook that runs the command given, MUST say `already` where it is installed, and MUST NOT overwrite a hook that is not its own; `readFacts` MUST read the facts with no change and no passphrase asked.

## Acceptance scenarios

1. **Given** the facts of a machine set up, **When** they are checked, **Then** every finding holds, per FR-001.
2. **Given** a key with a passphrase and OpenSSH asking through a program, **When** it is made, set for Git, tested and used to commit, **Then** the commit verifies against the signers, per FR-004 and FR-005.

## Out of scope

- Where the keys and the signers file are kept, and the commands for setup, rotation and loss: the program that uses this.

## Edge cases

- A key that exists without its public file: not a key that is there, per FR-006.
- A hook of another kind already there: refused, per FR-006.

## Assumptions

- OpenSSH 8.2 or later and Git are on the machine.

## Open questions

- None.

## Key entities

- **Facts**, **Finding**.

## Success criteria

- **SC-001**: A person sets signing up with one command, sees every problem with its one fix, and can replace a lost key.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
