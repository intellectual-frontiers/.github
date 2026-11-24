# Feature Specification: AnyFS Git hosts store

**Spec ID:** 0002-anyfs-githost-store
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A store over a branch of a repository on GitHub or GitLab holds regular files with a revision on every read and a stated expectation on every write, as what the token may do and what the branch is decide, through the REST API of the host: a batch is one commit, a rename is one commit, a change that changes nothing is none, and a branch that moved under a change is read again, so that of writers of one file exactly one wins and writers of different files all do. It is held to the same conformance suites as every backend of AnyFS.

## Requirements

- **FR-001**: An identity MUST be made only by `parseIdentity` (a name and an address of one line each, with no angle bracket and no space around them, the address holding an `@`), a trailer only by `parseTrailer` (a key of letters, digits and hyphens that starts with a letter, and a value of one line), and the message of a commit MUST be the first line a function of what the commit changes makes (one line, the default saying the one change or the number of changes), a line for each change of a commit of several, and the trailers after a blank line, never read from the configuration of a computer.
- **FR-002**: The store MUST refuse an object of more than `maxObjectBytes` (25 MiB where it is left out) before anything is sent, MUST refuse a path that Git or another computer reads as the folder of Git (`.git` in any case with trailing dots and spaces, and its short name) and, unless told otherwise, a path another file system could not hold, and the governance MUST find the groups of paths that differ only by case.
- **FR-003**: The token of a host MUST come from a source (none, a token given in code, the environment through a function, or a provider asked again only after its time, which includes a secret asked of a person through the credential port of Headless), MUST be one line of 8 to 512 characters with no space or control character, MUST travel in the one header the host reads it from (`Authorization: Bearer` for GitHub, `PRIVATE-TOKEN` or `JOB-TOKEN` for GitLab) and nowhere else, and no URL, body, problem, detail or sentence MUST hold it, even where the host echoes it: every sentence MUST pass through a redactor of the tokens given.
- **FR-004**: A request MUST be sent through a transport that gives the status, the headers in lower case and the body, and a connection that fails MUST be a value of the call and never thrown; a link to the next page of a list MUST be followed only where it is on the host the token is for; a status MUST be told by one table for both hosts: `401` a token the host does not accept, `403` a throttle where its headers or words say so and a refusal of the token otherwise, `429` a throttle, `5xx` a host that failed.
- **FR-005**: Every failure of a host's API MUST be of one of seven kinds and MUST be a problem of AnyFS by a total table: a missing object is `missing` and a missing repository or branch is `unavailable`, a conflict and a throttle and a failed host are worth a try, a token that is not accepted is not, a refusal of the token to push is `refused` with the reason `read-only` and the host's words, and an object the host will not hold is `too-large`.
- **FR-006**: Opening a store MUST read the repository and the branch and MUST make a store of `read`, `write`, `list`, `stat`, `delete`, `cas`, `batch`, `rename` and `history` where the token may push, and a store of `read`, `list`, `stat` and `history` alone, in its type, where the host says the token may not push the repository or the branch; it MUST say in its facts whether the branch exists and is protected; a branch that does not exist MUST be read as empty and MUST NOT be written unless the store was told which branch to start it from, and then the first write MUST make it from that branch with its files; the name of a branch MUST be refused where Git would refuse it.
- **FR-007**: The revision of a file MUST be `sha256:` and the digest of its bytes, the same text as every other store of AnyFS gives for the same bytes; the name of the blob in Git, its mode and the newest commit that changed the file MUST come back beside it; the bytes a host gives MUST be those the name of the blob says (SHA-1 of `blob <size>`, a NUL and the bytes) or the read is tampered; a digest MUST be kept by the name of the blob, and the digest of what a store wrote MUST be kept so that it is not read again.
- **FR-008**: A write that expects no object MUST conflict where there is one, one that expects a revision MUST conflict where the file is at another or is not there, and a conflict MUST say what the file is at; a change MUST be checked against the commit it was read at and made on it, and where the host refuses it because the branch or a file moved under it the change MUST be read again and checked again (up to the attempts), so that writers of different files all win, writers that expect the same file cannot both win, and a branch that keeps moving ends as a problem worth a try with nothing made.
- **FR-009**: A batch MUST be exactly one commit, a rename MUST be exactly one commit that moves the blob and makes none, and a change that changes nothing (the same bytes, a delete of nothing) MUST be no commit; a rename onto a file MUST conflict; the commit MUST be by the author and the committer the store names and MUST say the change in its message.
- **FR-010**: A list MUST be in the order of the paths by their code points, below its prefix only, in pages of any size up to ten thousand with a cursor until the last page, and whole: a tree that the host cuts short MUST be read again folder by folder, a tree of several pages MUST be read to its last, and a listing MUST NOT be returned in part.
- **FR-011**: A history MUST be the commits that changed the file, newest first, with the revision the file had after each (none where the commit removed it), by their author and instant, and the history of a file that is not there MUST be missing.
- **FR-012**: A symbolic link or another repository in the tree MUST be refused when it is named and left out of a list, a file where a folder is or a folder where a file is MUST be refused, and a store MUST hold regular files only.
- **FR-013**: A throttle MUST be a problem worth a try that says how long the host asks to wait, a host that failed (`5xx`) MUST be one, a token that may not push a protected branch MUST be refused with the host's words, and the layer `retrying` MUST recover from a throttle that passes.
- **FR-014**: The store MUST pass every case of the conformance suite of AnyFS on both hosts, and every law of the conformance suite of the bridge between a branch on a host and memory and between hosts, and a bridge sync with an atomic apply onto a branch MUST be one commit and a second sync MUST plan nothing.

## Acceptance scenarios

1. **Given** six writers that race to make one file through stores of their own, **When** they write, **Then** one wins and five conflict, per FR-008.
2. **Given** a batch of four changes, **When** it is made, **Then** the branch has one commit more, per FR-009.
3. **Given** a tree the host cuts short, **When** a store lists it, **Then** every file is listed, per FR-010.
4. **Given** a token that may not push, **When** a store is opened, **Then** it has no `write` in its type, per FR-006.

## Out of scope

- Git's own protocol, large file storage, a repository that has no commit yet (the Git Data API makes none), pull requests, signing of commits, and a host that is neither GitHub nor GitLab: other libraries or later capabilities.

## Edge cases

- A host that gives other bytes than the blob's name says: tampered, per FR-007.
- A token that the host echoes in an error: redacted, per FR-003.
- A path of two spellings of one character: not listed where it is not in normalization form C, per FR-010.

## Assumptions

- The repository's objects are named by SHA-1 (a repository of SHA-256 names is read, with the name of the blob not checked).

## Open questions

- None.

## Key entities

- **The host's API** - a repository of Git as the REST API of GitHub or GitLab gives it.
- **The revision** - `sha256:` and the digest of the bytes.

## Success criteria

- **SC-001**: Both hosts pass the same contract.

## Review & acceptance checklist

- [x] Every requirement is testable and has a test.
