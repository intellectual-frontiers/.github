# For an AI agent starting a new SpecKit here

This file is for an AI agent (or a person) about to write a new spec or
plan for Intellectual Frontiers — a unit initiative, a Studios venture, a
Capital fund decision, a research program — anywhere this constitution
should govern the work. It is not for editing this repository itself;
see the root [`README.md`](../README.md) for that.

## This repository is Intellectual Frontiers' own Eidolon

Shahid N. Shah's research names this exact repository "Intellectual
Frontiers' own Eidolon." An Eidolon, in that research, is a working
digital reflection of a person, company, customer, product, or system:
read reference material an AI agent consults, not a live agent that acts
on its own. The full argument lives at
[intellectualfrontiers.com/research/eidolons](https://www.intellectualfrontiers.com/research/eidolons);
read it there rather than here, the same way this repository cites a
source instead of restating it everywhere else (see the root README's
"Canonical source, going forward").

That research describes an Eidolon as existing at different tiers:
public, internal, confidential, and highly restricted. This repository
is the public tier only. Everything under `context/` and `spec-kit/` is
written for the audience that can read a public GitHub repository;
nothing internal, confidential, or highly restricted belongs here, the
same boundary the root README's "Editing this repository" section
already draws, for the same reason.

## Read in this order

1. [`memory/constitution.md`](memory/constitution.md) — the governing
   doctrine. Every requirement you write has to trace back to something
   here, or to a decision your project's own decision authority makes and
   records openly, the way the constitution itself says amendments should
   happen.
2. Your unit's spec, if one exists — `specs/0002-if-ip/spec.md` through
   `specs/0006-if-network/spec.md`. It's the testable version of your
   unit's charter; your own spec should cite it, not restate it.
3. [`specs/0001-intellectual-frontiers/spec.md`](specs/0001-intellectual-frontiers/spec.md)
   — the company itself, specified. Cite its requirements the same way.
4. [`../context/glossary.md`](../context/glossary.md) — defined terms.
   Use them exactly as defined; don't quietly redefine one.
5. [`../context/writing-guide.md`](../context/writing-guide.md) — the
   voice rules for anything you write, including this kind of document.

## Writing a new spec

Copy [`templates/spec-template.md`](templates/spec-template.md) to
`specs/NNNN-kebab-case-slug/spec.md`, where `NNNN` is the next unused
number across this whole repository — check `specs/` before picking one.
Follow the template's own instructions. Two rules that matter most:

- Source every requirement from the constitution, a unit spec, or
  something your own project has actually established. If you're
  inventing a new rule to fill a gap, that's a decision for whoever holds
  authority over your project, not something a spec should introduce
  quietly.
- Mark a real gap `[NEEDS CLARIFICATION]` instead of guessing. A spec
  that admits what it doesn't know is more useful than one that guessed
  and sounded finished.

## Writing a new plan

Copy [`templates/plan-template.md`](templates/plan-template.md) to
`specs/NNNN-kebab-case-slug/plan.md`, next to the spec it implements.
Work through its Constitution Check before writing Phase 0 — a plan that
can't pass its own Constitution Check isn't ready, whatever the spec
says. This is the actual mechanism that makes "built on this
constitution" true rather than aspirational: nothing here stops you from
skipping the check, but skipping it means what you're building doesn't
inherit Intellectual Frontiers' gates, just its vocabulary.

## Corporate, unit, and venture SpecKits — who owns what

This repository is the **corporate SpecKit**: the constitution, the
company spec, and each unit's spec. A **unit SpecKit** — if IP, Press,
Capital, Studios, or Network ever needs one deeper than its single spec
file here — inherits this constitution and deepens its own unit's
operating detail; it does not redefine Native Alpha, the unit boundaries,
or another unit's charter. A **venture or project SpecKit** — a Studios
company, a research program, a fund decision — inherits both the
constitution and its relevant unit's spec, and adds only what's specific
to that one venture: its own spec, its own plan, its own tasks. Nothing
downstream overrides what it inherits; a downstream spec that finds this
constitution genuinely insufficient escalates that as an amendment
proposal (see the constitution's own amendment process), not as a silent
local override.

## Versioning

This constitution carries its own version number (see its header). Note
which version your spec or plan was written against. If the constitution
changes, that's a signal to re-check your own spec against what changed —
not to assume nothing downstream was affected.
