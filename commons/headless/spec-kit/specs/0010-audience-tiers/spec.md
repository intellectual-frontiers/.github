# Feature Specification: Headless audience tiers

**Spec ID:** 0010-audience-tiers
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** One command on a PC and on a server (issue #11): which verbs a caller sees is governance. An action already says who it is for (`audience`) and what it does (`effect`); it did not say how much its caller must be trusted with. A tier is that: a name on a ladder the program declares as data, a tier on each action, a tier held by each caller, and one pure function that says whether the caller may see the action, asked by every surface, so that a command line, a tool server and a REST interface expose the same verbs to the same caller.

## Tier and gate

- **FR-001**: An action's facts MUST hold a `tier` (`TierName`, a branded type made only by `parseTierName`: lower-case words joined by hyphens), the lowest tier of the default ladder (`public`) where the action declares none; the program MUST declare its ladder as data (`TierLadder`: the names, lowest first, and the tier of a caller who says nothing; `defineLadder` returns every problem of a ladder as a value: `tier/name`, `tier/empty`, `tier/duplicate`, `tier/default-unknown`), the default ladder being `public`, `operator`, `administrator`.
- **FR-002**: `tierGate(ladder, required, held)` MUST be the one function that decides visibility, pure, and MUST give `visible` where the held tier is at or above the required one on the ladder, `hidden` with the reason `tier-too-low` where it is below, and `hidden` with the reason `tier-unknown` where either tier is not on the ladder, so that a mistake in a tier hides an action and never exposes it. A surface MUST NOT decide visibility any other way.
- **FR-003**: A surface MUST show a caller only what its tier may see: a verb the gate hides MUST be absent from the help (every level), the completion script of every shell, the man page, the list of tools of a tool server and the routes of a REST interface, and a branch with no visible verb below it MUST be absent as well (`visibleProgram`, drawn once).
- **FR-004**: Invoking a hidden verb MUST be refused with the typed reason of the gate (`hiddenVerb`, `tierMessage`) and MUST NOT run it; a word that is no verb of the program MUST remain an unknown word, not that refusal.
- **FR-005**: The tier and the audience MUST both be applied: a machine surface (a tool server, a REST interface) MUST still refuse an action whose audience is `human` (0002-headless-governance FR-005) whatever the caller's tier, and the tier MUST NOT change what `decide` says of the effect: a destructive action of a high tier is still confirmed.
- **FR-006**: The command line MUST take the caller's tier from its `Io` (`Io.tier`, the program's default where it is not given), so that one binary on a PC and on a server shows what each caller may see; where the tier comes from (a key, a login, an environment) is the host's.

## Acceptance scenarios

1. **Given** an `operator` verb and a caller that holds `public`, **When** the gate is asked, **Then** it is `hidden` for `tier-too-low`, per FR-002.
2. **Given** an action whose tier is not on the ladder, **When** the gate is asked, **Then** it is hidden for `tier-unknown` for every caller, per FR-002.
3. **Given** a program with a verb of each tier, **When** a `public` caller asks for the help, the completions and the man page, **Then** none names the hidden verbs, per FR-003.
4. **Given** the same caller, **When** it runs a hidden verb, **Then** nothing runs and the refusal names `tier-too-low`, per FR-004.
5. **Given** `server wipe` hidden and `server status` visible, **When** the caller types `server wip`, **Then** the word is unknown, per FR-004.

## Out of scope

- How a caller proves its tier: authentication is the host's (`auth`); Headless takes the tier as data.

## Edge cases

- A branch whose only verbs are hidden: absent, per FR-003.
- A ladder with one tier: every action is visible to every caller whose tier is that one, per FR-002.

## Assumptions

- A host that declares a ladder without `public` gives every action a tier, because the default tier is `public`; an action with none is then hidden for `tier-unknown` and `compose` reports it.

## Open questions

- None.

## Key entities

- **Tier** - a name on the program's ladder.
- **Gate** - the one pure function that decides visibility.

## Success criteria

- **SC-001**: One program serves a person, an operator and an administrator, and no surface shows a caller a verb it may not run.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
