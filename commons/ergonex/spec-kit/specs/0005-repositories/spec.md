# Feature Specification: Repositories

**Spec ID:** 0005-repositories
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The main job of `ergonex` is to hold the repositories a person works on. A person adds one with `ergonex add github.com/owner/repo`, takes one out with `ergonex remove`, and brings the repositories already on the disk under management with `ergonex adopt`, without editing TypeScript, and sees what is on the disk that the manifest does not name.

## The list

- **FR-001**: The repositories that `ergonex add`, `remove` and `adopt` keep MUST be the typed file `.ergonex/repositories.ts`, which exports an array of entries of the shape the manifest takes for a repository (`remote`, and `branch`, `group` and `worktrees` where there are any), and the manifest MUST read the entries of that file and those of `workspace.ts` as one list, in which two entries for one path are a collision as they are in one file (0002-workspace-model FR-011).
- **FR-002**: A command of this module MUST write the file whole, next to the old one and renamed over it, so that a run that stops leaves the file as it was, and MUST NOT edit `workspace.ts`.

## Adding

- **FR-003**: `ergonex add REMOTE...` MUST accept a remote as a person writes it (`github.com/owner/repo` and `gitlab.example.com/group/sub/repo` with no scheme, `owner/repo` for GitHub, `github:` and `gitlab:` prefixes, `git@host:path.git`, an https address, and the address of a branch's page), MUST record the HTTPS address the repository is cloned from, with no credential in it, and the branch the page names or `--branch` gives, and MUST report a repository that the manifest already holds and not add it twice.
- **FR-004**: `ergonex add` MUST decode the whole manifest with its change before it writes, and IF the manifest would not accept it (a remote that is not a repository on a Git host, a path deeper than the host's manager supports, a host the policy does not allow), THEN it MUST write nothing and exit with the status of a usage error, saying why for each.
- **FR-005**: `ergonex add --apply` MUST then carry out the plan as `ergonex apply` does, so that the repositories are cloned.

## Removing

- **FR-006**: `ergonex remove REPOSITORY...` MUST take a repository out of `.ergonex/repositories.ts`, naming it as it was added, by its path in the workspace or by its name where only one repository has it, and MUST NOT delete its folder. IF the repository is named in `workspace.ts`, THEN it MUST refuse, saying that line is to be removed there.
- **FR-007**: `ergonex remove --delete` MUST delete the folder of a repository only where its state does not hold work that exists nowhere else (0002-workspace-model FR-027) and it has no worktree, and IF any repository named is not so, THEN it MUST remove none of them and delete nothing.

## Adopting

- **FR-008**: `ergonex adopt` MUST list the repositories under the root that the manifest does not name, and for each say that it can be adopted (it is at the path its `origin` makes), that it is at the wrong path (and the path it belongs at), or that its `origin` is missing or is not a repository on a Git host; it MUST change nothing, and MUST NOT move a repository.
- **FR-009**: `ergonex adopt --apply` MUST add the repositories that can be adopted to `.ergonex/repositories.ts` and no other.
- **FR-010**: `ergonex status` MUST say, as a note, of each repository under the root that the manifest does not name, so that a repository left by `ergonex remove` or cloned by hand is not unseen.

## Acceptance scenarios

1. **Given** a workspace, **When** the person runs `ergonex add github.com/owner/repo`, **Then** `.ergonex/repositories.ts` holds `https://github.com/owner/repo.git` and `ergonex plan` shows its clone, per FR-001 and FR-003.
2. **Given** a manifest that allows only one Git host, **When** the person adds a repository of another, **Then** nothing is written and the reason is given, per FR-004.
3. **Given** `ergonex add --apply`, **When** it runs, **Then** the repository is cloned at the path its remote makes, per FR-005.
4. **Given** a repository that is clean and pushed, **When** `ergonex remove --delete` runs, **Then** it is out of the list and its folder is gone, and for one with uncommitted work nothing changes, per FR-006 and FR-007.
5. **Given** a repository cloned by hand at the path its remote makes, **When** `ergonex adopt --apply` runs, **Then** it is in the list, and one cloned elsewhere is reported with the path it belongs at, per FR-008 and FR-009.

## Out of scope

- Moving or renaming a repository, and creating one on a Git host: later.
- Editing `workspace.ts`: it is the person's.

## Edge cases

- The same repository written two ways (`owner/repo` and its https address): one repository, per FR-003.
- A repository added twice in one command: added once, per FR-003.
- A repository in `workspace.ts` and in the list: a path collision, per FR-001.
- `.ergonex/repositories.ts` edited by hand into something that is not an array of entries: every command says what is wrong with it, per FR-001.

## Assumptions

- A repository is cloned over HTTPS with the person's sign-in (0004-onboarding FR-004), so that what is recorded is the same for every person.

## Open questions

- None.

## Key entities

- **List** - `.ergonex/repositories.ts`, the repositories the commands keep.
- **Unmanaged repository** - a repository under the root that the manifest does not name.

## Success criteria

- **SC-001**: A person adds, removes and adopts repositories without opening a file.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
