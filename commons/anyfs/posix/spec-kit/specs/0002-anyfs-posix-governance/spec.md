# Feature Specification: AnyFS POSIX: governance

**Spec ID:** 0002-anyfs-posix-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The identities of the POSIX view as types: the codes an operation ends with, how faithfully it was carried out, the paths of POSIX and how they become keys, the policy a program gives, the operations by their cases and what each ends with.

## Requirements

- **FR-001**: The codes MUST be the closed union of fifteen (`EACCES`, `EBADF`, `EEXIST`, `EFBIG`, `EINVAL`, `EIO`, `EISDIR`, `ENAMETOOLONG`, `ENOENT`, `ENOTDIR`, `ENOTEMPTY`, `ENOTSUP`, `EROFS`, `ESTALE`, `EXDEV`), each with the number Linux gives it and one sentence, in registries the compiler holds to one entry for each code.
- **FR-002**: A fidelity MUST be exactly one of `native`, `emulated` (with a reason of the closed list of ten, the risk that reason carries and a sentence) or `refused` (with a reason of the closed list `not-in-model`, `capability-absent`, `read-only` and a sentence); the risk of an emulation MUST be the risk of its reason, from the closed list `none`, `cost`, `deferred`, `lossy`, `non-atomic`, `unguarded`, `not-durable`.
- **FR-003**: `isStrictViolation` MUST be true for a refusal and for an emulation whose risk is `lossy`, `non-atomic`, `unguarded` or `not-durable`, and false for `native` and for an emulation of the risks `none`, `cost` and `deferred`; `worse` MUST rank a refusal above any emulation, an emulation of more risk above one of less, and an emulation above `native`.
- **FR-004**: A path of POSIX MUST be absolute, made only by `resolvePosix` or `parseAbsolute`, which MUST resolve `.`, `..` (never above the root), empty segments and repeated slashes by the text alone, put the text in normalization form C, and refuse an empty text, a backslash, a control character and a lone surrogate; `storePathOf` MUST give the root as no key and any other path as the key the parser of the store gives, or the reason the store would refuse it.
- **FR-005**: A policy MUST say whether an empty directory is kept (`none`, or `keep` with the name of a marker that is one segment), who owns what and with which mode (numbers, with modes of at most four octal digits), whether the ancestors of a new object are checked, the bytes the read cache holds, the page of a list and the attempts of an append; `defaultPolicy` MUST keep no marker, check the ancestors, hold 8 MiB, list 1000 at a time and try an append 5 times, and every smart constructor MUST refuse what is out of range with a sentence.
- **FR-006**: The operations MUST be the closed list of twenty-seven by their cases (`stat-file`, `stat-dir`, `readdir`, `mkdir`, `rmdir`, `unlink`, `rename-file`, `rename-over`, `rename-dir`, `read-all`, `read-range`, `write-all`, `open-write`, `write`, `fsync`, `close`, `truncate`, `append`, `touch`, `rm-r`, `chmod`, `chown`, `utimes`, `symlink`, `link`, `readlink`, `mmap`), each with one sentence.
- **FR-007**: The modes of opening MUST be the closed list `r`, `r+`, `w`, `w+`, `wx`, `a`, `a+`, each with the flags a file system gives it; an outcome MUST hold a value, its fidelity and what was noticed, and an error MUST hold a code, one sentence and the fidelity the operation would have had, and, where a walk failed, the objects it did and those it could not.

## Acceptance scenarios

1. **Given** the text `a//b/./c/../d` and the root as the working directory, **When** it is resolved, **Then** it is `/a/b/d`; and **Given** `..` at the root, **Then** it is the root, per FR-004.
2. **Given** `copy-then-delete` and a refusal, **When** their strictness is asked, **Then** both are violations, and **Given** `derived-directory`, **Then** it is not, per FR-003.
3. **Given** the default policy, **When** it is read, **Then** it keeps no marker and checks the ancestors, per FR-005.

## Out of scope

- Carrying an operation out: the logical and physical layers do that.

## Edge cases

- A path that is the root has no key in a store, and is not an error (FR-004).
- A marker name with a `/` is not one name (FR-005).

## Assumptions

- The library `@intellectual-frontiers/anyfs` is the host of the family and gives the store, its capabilities and its problems.

## Open questions

- None.

## Key entities

- **Errno** - a code an operation ends with.
- **Fidelity** - how an operation was carried out.
- **PosixPath** - an absolute path in the view of a store.
- **Policy** - what the program decides about the view.

## Success criteria

- **SC-001**: Every closed list of the layer has a registry that the compiler holds to one entry for each member.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
