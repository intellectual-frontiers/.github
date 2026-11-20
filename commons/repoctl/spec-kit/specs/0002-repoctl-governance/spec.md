# Feature Specification: Repoctl governance

**Spec ID:** 0002-repoctl-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The Governance layer of Repoctl says what the program is, as data and as types that cannot be made wrong, before any surface draws it: the identities (a library name, a version, an issue number, a session address, a commit subject, a Git reference), the audience tiers, the verbs with their facts and reach, the problem codes with their explanations, the table of generators with what each reads and writes, and the table of the other checks. It is pure data and pure functions.

## Requirements

- **FR-001**: A library name, a version, an issue number, a session address, a commit subject and a Git reference MUST be values of branded types made only by their smart constructors (`parseLibraryName`, `parseSemver`, `parseIssueNumber`, `parseSessionUrl`, `parseSubject`, `parseGitRef`), each of which MUST return the sentence that says why a text is not one, so that no function takes a text where it needs one of these.
- **FR-002**: Every verb MUST be declared once in the table `VERBS` with its words, summary, kind, effect, whether it is safe to repeat, whether it previews and checks, the tier that sees it and its reach (channels and confirmation); the table MUST hold every verb of the union `VerbId`, and the facts of no verb MUST contradict each other or its reach under the rules of Headless' governance.
- **FR-003**: The program MUST declare three audience tiers, lowest first, `public`, `contributor` and `releaser`, with `contributor` as the tier of a caller who says nothing; the verbs that only read MUST be `public`, the verbs that change the checkout `contributor`, and `release publish` `releaser`.
- **FR-004**: Every problem a verb raises MUST be one of the closed union of codes `ProblemCode`, each of which MUST have an explanation (a title, what happened, the likely cause and the fix, none blank) in a registry that holds every code, and the codes MUST be of the shape Headless accepts.
- **FR-005**: The generators of a repository MUST be declared once, in its configuration (0009-repoctl-config FR-003), each with its id, its command or typed function, its check, the globs of what it reads and the globs of what it writes and the generators it comes after; the configuration MUST hold each generator of the repository that has a check, and nothing else MUST name a generator's command or output; the host holds no generator.
- **FR-006**: The checks that are not generators MUST be declared once, in the repository's configuration, each with its id, its command or typed function and the code of its findings.

## Acceptance scenarios

1. **Given** `"1.2"` or `"latest"`, **When** it is made a version, **Then** it is refused with a sentence, per FR-001.
2. **Given** a name with a capital or a name that begins with a digit, **When** it is made a library name, **Then** it is refused, per FR-001.
3. **Given** the table of verbs, **When** the rules of Headless' governance are applied to each, **Then** there is no problem, per FR-002.
4. **Given** the ladder, **When** a tier is looked for by its word, **Then** `releaser` is above `contributor` and `contributor` above `public`, per FR-003.
5. **Given** the registry of explanations, **When** it is checked, **Then** every code has all four fields and a shape of a code, per FR-004.
6. **Given** the table of generators, **When** it is read, **Then** each generator of the repository is there with its inputs and outputs, per FR-005.
7. **Given** the table of checks, **When** it is read, **Then** each has a command and a code, per FR-006.

## Out of scope

- The command line that draws the verbs: Physical.
- What a generator does: the generator's own specification.

## Edge cases

- A commit subject that ends with a full stop or holds two lines: refused, per FR-001.
- A code in the union with no explanation: the compiler refuses the registry, per FR-004.
- A generator that reads its own output: it does not wait for itself, per FR-005.

## Assumptions

- The libraries of commons that Repoctl calls (`libraries`, the tools of commons) are on the branch that holds it, and `git`, `bun` and `node` are installed.

## Open questions

- None.

## Key entities

- **Verb** - a command of the program with its facts.
- **Tier** - a rung of the ladder of who sees what.
- **Problem code** - a stable name for a finding.

## Success criteria

- **SC-001**: A text that is not a library name, a version or an issue is never held as one.
- **SC-002**: Every code that `repoctl explain` is asked for has all four parts.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
