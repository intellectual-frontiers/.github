# Feature Specification: Headless exit, style and consent

**Spec ID:** 0008-exit-style-consent
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** An increment from the first real program on Headless, which found four things that a program could not say: a command could not end its run as `usage` (2) or `environment` (3), because a run only came to 0, 1 or 4 from its problems; the marks were emoji in CI where colour was off; the redactor turned a sentence that merely names an environment variable into `***`; and a mutating action could not go on with no terminal, there being no way to pass a consent a person had given earlier. Each is settled here without a shim: the outcome carries the exit it names, the style of the marks is an explicit decision with a stable plain default, the redactor replaces only what is a secret, and consent is a class of confirmation of the reach policy.

## What a command can say

- **FR-001**: An outcome MUST carry the exit its command names, as a closed union (`ok`, `pending`, `findings`, `environment`, `usage`), or none; the status of a run MUST be that of the problems found where it names none or names `ok`, 4 where it names `pending` (unless something failed, which is `findings`), and 1, 3 or 2 where it names `findings`, `environment` or `usage`, however little else was found; the merge of two outcomes MUST keep the more severe name (usage, environment, findings, pending, ok); and the status and the JSON envelope MUST agree, the envelope carrying the status the run ends with and its name from the one table.

## How the marks look

- **FR-002**: The style of the marks MUST be an explicit decision, `Io.marks` (`plain`, `emoji` or `auto`, the default): `plain` is the ASCII marks and `emoji` the palette's emoji; `auto` MUST be plain unless the stream written to is a terminal that shows emoji and nothing asks for plain, and `NO_COLOR` set, `--no-color` given and the program's `<PREFIX>_PLAIN` each ask for plain; the program's `<PREFIX>_EMOJI` MUST turn emoji on where nothing asks for plain. So a run in CI, in a pipe, or with colour off MUST write the same plain text wherever it runs, and the locale alone MUST NOT turn emoji on where the stream is not a terminal.

## What is redacted

- **FR-003**: The redactor MUST replace only what is a secret and MUST leave prose alone: the secret values the program holds (four characters or more), the password of a URL, a `password=` (or `passwd=`, `pwd=`) assignment, a token of a known shape (GitHub `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` and `github_pat_`, GitLab `glpat-`, Slack `xox`, AWS `AKIA`, npm, `sk-`, a `Bearer` token of sixteen characters or more, a JWT, a private-key block), and the value of a key that the program declares secret (`KEY=value`, or `"KEY": "value"`); it MUST NOT replace the text after `KEY:` or `KEY=` for a key that was not declared, so that a sentence that names an environment variable (`APP_GITHUB_TOKEN: the token is not set`) is unchanged; it MUST NOT replace the value of a declared key where that value is a reference to one that a shell or a script expands (`$(command)`, `${name}`, `$name`, `($expression)`, each with or without a quote before it), because a reference is where a secret comes from and is not one, so that a program that prints a script that sets a secret from a command (`APP_GITHUB_TOKEN="$(gh auth token)"`) prints that script whole; redacting twice MUST be redacting once.

## Consent

- **FR-004**: The reach policy's confirmation class MUST include `consent`: the identifier of an approval a person gave earlier, passed as `--consent <id>` (an option the action has only where its class is `consent` and it changes something); for such an action the decision MUST be to proceed where a consent is given and the surface accepts it (`acceptsConsent`, the surface's `flagConfirms` where it does not say), to ask a person where there is one and no consent, and to refuse (`consent-needed`) otherwise; an action that only reads MUST NOT be of this class (`reach/consent-on-read`); a preview MUST need no consent; and a run that went on by a consent MUST record it in the run's log, the identifier written through the redactor.

## Acceptance scenarios

1. **Given** a command whose outcome names `usage`, **When** its run ends, **Then** its status is 2 and the JSON envelope says status 2 named `usage`, per FR-001.
2. **Given** an outcome that names `ok` and holds a failure, **When** its run ends, **Then** its status is 1, per FR-001.
3. **Given** a pipe with a UTF-8 locale, **When** the marks are chosen, **Then** they are plain; given a terminal with a UTF-8 locale they are emoji, and `--no-color` or `NO_COLOR` makes them plain, per FR-002.
4. **Given** the sentence `APP_GITHUB_TOKEN: the token is not set`, **When** it is redacted, **Then** it is unchanged, and `APP_GITHUB_TOKEN=abc` is `***` only where the key is declared, per FR-003.
5. **Given** a GitHub token in a message with nothing declared, **When** it is redacted, **Then** it is replaced by its shape, per FR-003.
6. **Given** an action whose class is `consent` run with no terminal, **When** it is run with no consent, **Then** it is refused; with `--consent c-1` it proceeds and the log records the consent, per FR-004.

## Out of scope

- How a consent is obtained or checked (a person's approval, its expiry): the program's, which gives the identifier; Headless carries it and records that it was used.

## Edge cases

- A named exit `pending` with a failure found: the status is 1, per FR-001.
- A consent given to an action that only reads: no `--consent` option exists for it, per FR-004.
- `--dry-run` with no consent: a preview, per FR-004.

## Assumptions

- A program that wants the old behaviour of the key pattern declares its keys; there is no setting to bring back the broad pattern.

## Open questions

- None.

## Key entities

- **Run exit** - the verdict a command names for its run.
- **Mark style** - plain or emoji, decided once for a run.
- **Consent** - the identifier of an approval given earlier, which stands for the answer of a person.

## Success criteria

- **SC-001**: A real program ends its runs with the right status, writes the same text in CI everywhere, never hides a sentence, and runs a changing action unattended on a consent.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
