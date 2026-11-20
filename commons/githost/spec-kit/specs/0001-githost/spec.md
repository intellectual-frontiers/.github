# Feature Specification: Git hosts

**Spec ID:** 0001-githost
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A check of change control and a workspace manager both need to ask where a repository is and what a Git host says about it, and neither may name a host's own word. This library is the one interface to a Git host: GitHub (public and private repositories), GitLab (groups to any depth, `gitlab.com` or a self-managed host) and plain Git, shaped together and held to the same conformance tests, with the reading of a remote written in any form a person uses. It depends on `core`, `net` and `system` only.

## The interface

- **FR-001**: Git hosts MUST be reached only through one `GitHostClient` interface, shaped at the same time for GitHub (public and private repositories), GitLab (public and private repositories, groups to any depth) and plain Git, and the interface MUST NOT be fixed until the three adapters pass the same conformance tests.
- **FR-002**: Every Git host kind MUST offer the common capabilities: the clone URL of a repository (`ifccm:CloneUrl`), authentication (`ifccm:Credentials`), the default branch (`ifccm:DefaultBranch`) and whether a commit's signature verifies (`ifccm:SignedCommits`); and GitHub and GitLab MUST also offer protected branches (`ifccm:ProtectedBranches`), issues (`ifccm:Issues`) and pull or merge requests (`ifccm:ChangeRequests`) behind the same calls.
- **FR-003**: A capability that a Git host kind does not list (`ifccm:supports`) MUST be answered with a typed result that says it is unsupported, naming the host and the capability, and MUST NOT be silently skipped, emulated or thrown: GitLab alone offers groups to any depth (`ifccm:NestedGroups`), and plain Git offers no protected branches, issues or change requests.
- **FR-004**: A Git host adapter MUST authenticate through a Git credential helper, through the host's own command-line tool (`gh`, `glab`) or through a token read from the environment it is handed, and MUST NOT write a credential into any file, a remote URL, a result or an error; a token MUST be sent only to the host the client serves, and in a header alone.

## Remotes

- **FR-005**: The kind of host for a remote MUST be GitHub for `github.com`, GitLab for `gitlab.com` and for a host a map names as GitLab, and plain Git for every other host; a self-hosted GitLab MUST be named and MUST NOT be guessed from a URL.
- **FR-006**: A repository whose path is deeper than its host kind supports (more than two segments on a host without `ifccm:NestedGroups`) MUST be told by the depth the kind allows (`maxDepth`), so that a caller can refuse it naming the host and the path.
- **FR-007**: The `https`, `http`, `git`, `ssh` and scp-like (`git@host:owner/repo`) spellings of one remote MUST read as one `RepoRef`, the host in lower case, the port, the credential and the `.git` dropped; and a text that is not a remote of a host (a path on this computer, a `file:` URL, an owner with no repository) MUST be refused with what is wrong with it, holding no credential.
- **FR-008**: A remote as a person writes it MUST be read where the domain says the rest: `github.com/owner/repo` and `gitlab.example.com/group/sub/repo` with no scheme, `owner/repo` as a repository of GitHub, `github:owner/repo` and `gitlab:group/sub/repo`, and the address of a branch's page (`.../tree/main`, GitLab's `/-/tree/main`) as the repository and that branch; a path on this computer MUST still be refused.

## The library

- **FR-009**: The types, the table of capabilities and the reader of a remote MUST import `core` alone, and the adapters MUST import only `node:` built-ins, `core`, `net` and `system`, so that the types are pure and no other library is needed to read a remote.
- **FR-010**: The library MUST be published to npm as compiled modules with their declarations, one entry for the package (`.`) and one for each module (`./types`, `./capabilities`, `./remote`, `./github`, `./gitlab`, `./git`), and its declarations MUST name no package it does not declare (commons 0032-libraries-by-concern FR-005, FR-013).

## Acceptance scenarios

1. **Given** a recorded GitHub, a recorded GitLab and a real plain Git repository, **When** the same conformance tests run on each adapter, **Then** all three pass, per FR-001.
2. **Given** a capability a kind does not offer, **When** it is asked, **Then** the answer is a typed unsupported result naming the host and the capability, per FR-003.
3. **Given** a token in the environment, **When** a client is made, **Then** the token is held in the client, sent in a header to the one host it serves, and appears in no result, URL or error, per FR-004.
4. **Given** `git@github.com:octo/hello.git` and `https://github.com/octo/hello`, **When** each is read, **Then** they are one repository, per FR-007.
5. **Given** `octocat/Hello-World` and `gitlab.com/g/s/r/-/tree/feature`, **When** each is read, **Then** the first is a repository of GitHub and the second is a repository of GitLab on the branch `feature`, per FR-008.

## Out of scope

- A host's account, its tokens and the network's reliability: a live test of the hosts is skipped where there is no account.
- The typed model of GitHub Actions workflows: another library's.

## Edge cases

- A GitHub or GitLab project that is private, asked with no credential: not found, as the host says, and typed, per FR-004.
- A self-hosted GitLab not named in the map: plain Git, never guessed, per FR-005.
- A remote with a credential in it: the credential is dropped and never in an error, per FR-007.

## Assumptions

- The hosts' REST APIs (GitHub v3, GitLab v4) keep the fields the adapters read.

## Open questions

- None.

## Key entities

- **GitHostClient** - the one interface to a Git host.
- **RepoRef** - a repository on a host: its kind, its host and its path.
- **Capability** - what a kind of host offers, from `ifccm:GitCapability`.

## Success criteria

- **SC-001**: A check or a workspace reads any remote a person writes and asks any of the three kinds of host through one interface.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
