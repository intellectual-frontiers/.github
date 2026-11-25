# Feature Specification: Canaries for the secret scanner

**Spec ID:** 0016-repoctl-canaries
**Status:** Active
**Owner:** if
**Domain:** repoctl

**Input:** `repoctl commit` refuses a file that holds what looks like a secret (0005-repoctl-library-commit-doctor FR-006), so a test that must hand a program a fake private key or a fake token, to prove that the program redacts or rejects it, cannot be committed. A canary is text that looks like a secret and is not one. The corpus of canaries is one module of the library Test (commons test 0001-test FR-009), tests import canaries and hold no secret-looking text of their own, and the scanner lets exactly that module pass: not by its path, which anyone could write a real secret into, but by its path and the digest of its content, pinned in the configuration, so that any edit of it blocks it again as an ordinary holder of a secret. The pass is a finding of its own, informational, never a failure.

## Requirements

- **FR-001**: The configuration MUST accept `commit.forbidden.canaries`, a list of `{ path, sha256 }` that is empty where the configuration says nothing, where `path` is one file written relative to the repository with `/` and with no glob character (`*`, `?`, `[`, `{`) and `sha256` is 64 lower-case hexadecimal digits, and the configuration MUST be refused with `E-CONFIG-INVALID` saying why where a path is not so written, a digest is not one, a path is listed twice or an entry lacks its digest: a file is never allowed by its path alone.
- **FR-002**: The Logical layer MUST give `canaryOf(policy, path, text)`, a pure function that says a file is a canary file only where the policy pins its exact path and the SHA-256 of its text (as UTF-8) is the pinned digest, and that says which rule of the scanner its text matches (the label), and nothing else: a file whose path is not pinned, a file at a pinned path with any other content (one changed byte, a line added) and a text that matches no rule are not canary files.
- **FR-003**: `repoctl commit` MUST refuse a file that holds what looks like a secret with `E-COMMIT-FORBIDDEN` as before, except a canary file (FR-002), which it MUST let pass and report as one finding of the code `E-CANARY` naming the path and the rule it matches; that finding MUST NOT fail the commit, MUST be in the findings of the preview and of the commit, and a pinned path whose content is not the pinned digest MUST be refused as an ordinary holder of a secret, its message saying that the digest is not the pinned one.
- **FR-004**: A finding MUST have the level `info` beside `fail` and `warn`: it never fails a run and never changes an exit status, it is told in `--json` as `info`, `repoctl check` marks it `info` and Headless carries it as a warning, which no exit status counts.
- **FR-005**: `repoctl check` MUST have a section for the canaries of the configuration where it pins any: one `E-CANARY` finding for each pinned file whose digest is the pinned one, and one failure `E-CANARY-CHANGED` for each pinned file that is missing or has another digest, naming the path and the command that pins the new digest, so that a pin never outlives or lags the file it pins.
- **FR-006**: `repoctl explain E-CANARY` and `repoctl explain E-CANARY-CHANGED` MUST each explain the code (a title, what happened, why and the fix), and every code of the closed union MUST keep its explanation.
- **FR-007**: The scanner MUST be as strict as it was in everything else: the rules of `DEFAULT_SECRET_PATTERNS`, the forbidden paths and the allowed paths are unchanged, and the one pin of this repository's configuration is the module of canaries of the library Test, `commons/test/src/canaries.ts`, with its digest.
- **FR-008**: The suite of Repoctl MUST prove the scanner against the corpus of canaries it imports from the library Test: each canary text is found by the scanner with the rule the canary declares, the same text in a file that is not a canary file is refused, a canary file with one changed byte is refused, the real module of canaries has the digest of the pin of this repository's configuration and is let pass by it, and in a real repository the commit of a canary file succeeds with the finding and the commit of the same file edited is refused.

## Acceptance scenarios

1. **Given** a configuration with `canaries: [{ path: "a.ts", sha256: "xyz" }]`, **When** it is read, **Then** it is refused and says the digest is not 64 hexadecimal digits, per FR-001; the same with `path: "*.ts"`, per FR-001.
2. **Given** a file at a pinned path with the pinned content, **When** `canaryOf` reads it, **Then** it is a canary file with the rule of its text; **Given** the same text at another path, or at the pinned path with one byte changed, **Then** it is not, per FR-002.
3. **Given** the pinned canary file staged, **When** `repoctl commit` runs, **Then** the commit is made and its findings say `E-CANARY` with the path and the rule; **Given** the file edited, **Then** the commit is refused with `E-COMMIT-FORBIDDEN`, per FR-003.
4. **Given** a finding of `info`, **When** the run ends, **Then** its status is 0 and `--json` says `info`, per FR-004.
5. **Given** a configuration that pins a file, **When** `repoctl check` runs, **Then** its report has the section of the canaries with `E-CANARY` where the digest is the pinned one and `E-CANARY-CHANGED` where it is not, per FR-005.
6. **Given** the two codes, **When** `repoctl explain` is run on each, **Then** each is explained, per FR-006.
7. **Given** the corpus of canaries, **When** the scanner reads each text, **Then** it is found with its declared rule, per FR-008.

## Out of scope

- A canary of a rule the scanner does not have: a new rule is a change to the scanner's strictness, which is the owner's.
- The secret scanners of other systems (the host's push protection): a canary is made to pass the scanner of `repoctl commit`, and no more.

## Edge cases

- A canary file that holds no text matching a rule is not a canary file and is not reported (FR-002).
- A canary file is pinned by the digest of its content as UTF-8: a change of line endings changes the digest (FR-002).

## Assumptions

- The owner reads the pin in a change of `repoctl.config.ts` as the act of approving the new content of the canary file.

## Open questions

- None.

## Key entities

- **Canary**, **Canary file**, **Pin** (a path and a digest), **Finding of `info`**.

## Success criteria

- **SC-001**: A real secret pasted into the canary file, or any other edit of it, makes the commit refuse it again; the unedited file never blocks a commit or a build.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
