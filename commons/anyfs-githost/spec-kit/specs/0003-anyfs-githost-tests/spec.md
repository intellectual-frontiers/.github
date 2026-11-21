# Feature Specification: AnyFS Git hosts tests

**Spec ID:** 0003-anyfs-githost-tests
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The tests run on fakes of the REST APIs of GitHub and GitLab made in process, which enforce what the hosts enforce (a branch moves only forward, each file a GitLab commit changes is checked, a tree is cut short or paged, a throttle comes with its headers), and, where a real Git host can be run, on it; one contract is held on every host the tests have, so that a fake is trusted only as far as the real host agrees with it.

## Requirements

- **FR-001**: The fake of GitHub's API MUST refuse a branch that is not moved forward, MUST cut a recursive tree short where told, MUST answer a protected branch and a throttle as GitHub does; the fake of GitLab's API MUST page a tree along the `Link` header, MUST check each file a commit changes (a create of a file that exists, an update or a delete of one that does not, an update or a delete whose last commit is not the file's) and MUST commit on the head the branch has when the request arrives; the same contract tests MUST run on both.
- **FR-002**: Where the environment names a repository on a real GitHub or GitLab and a token that may push to it, the conformance suite of AnyFS MUST run on it, in a folder of its own, with the token read from the environment by a function and written nowhere.
- **FR-003**: Where no real host is named, the test MUST say why it did not run (that GitHub and GitLab cannot be run in the sandbox and that Gitea, which can be, does not speak their write API), and MUST NOT pass silently for want of it.

## Acceptance scenarios

1. **Given** the fake of GitHub's API and the fake of GitLab's, **When** the contract runs, **Then** it is the same code, per FR-001.
2. **Given** no real host is named, **When** the real-host test runs, **Then** it says why it did not, per FR-003.

## Out of scope

- A real GitHub or GitLab in the checks of every run: a token for one comes from the environment and is not in a test. A real Git host that can be run in process (Gitea or Forgejo) speaks its own API for a commit, not GitHub's or GitLab's, so it would need a client of its own: a later library.

## Edge cases

- A fake that is more lenient than the host: held to the contract that the real host runs, per FR-002.

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **The fake** - a host's API made in process as a transport.

## Success criteria

- **SC-001**: The tests pass on Bun and on Node 26.

## Review & acceptance checklist

- [x] Every requirement is testable and has a test.
