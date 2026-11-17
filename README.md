<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="profile/logos/if-logo-dark-672x189-2026-Sept.png">
    <img alt="Intellectual Frontiers" src="profile/logos/if-logo-672x189-2026-Sept.png" width="336">
  </picture>
</p>

# Intellectual Frontiers — `.github`

**Documentation: <https://intellectual-frontiers.github.io/.github/>** · **Strategy: [`MIZAN.html`](MIZAN.html)** (open it in a browser)

This public repository holds the organization's landing page ([`profile/README.md`](profile/README.md)), the one-command installers of agora ([`bin/`](bin/),
`agora-install.sh` and `agora-install.ps1`, which sign GitHub CLI in and run the installer of the private `erga` repository), and
[`commons/`](commons/about.ts), what any company or harness of Intellectual Frontiers may use. The documentation site is made from commons' TypeScript
and its specifications. Everything else lives in the private `erga` repository.

## Mizan: how we keep specifications, ontology and code in balance

*Mizan* (Arabic, "balance, scale") is the **IF Spec Profile**: a profile of [GitHub Spec Kit](https://github.com/github/spec-kit) that adds what Spec Kit lacks. Its aim is to reduce **drift**, the slow separation of what a specification says, what the ontology defines and what the code does. These are its tenets.

1. **Spec Kit is the method; Mizan is the profile.** We keep Spec Kit's commands, constitution and `spec.md` / `plan.md` / `tasks.md`, and add registers, requirement-to-proof tracing, the ladder and the rules below. We do not replace it.
2. **Two languages.** Natural language for specifications; TypeScript 7+ (Bun by default, Node 26 as backup) for the ontology, code, tools and tests. TypeScript is strongly typed, portable, interpreted or compiled, and known to people and to every AI agent. Where it cannot do an integration job and a hand-written parser would not be good enough, we choose the best tool for the job and record it as a typed exception.
3. **One strongly, algebraically typed ontology** in TypeScript on commons' RDF kernel. Turtle, JSON-LD and the rest are generated from it, never edited.
4. **Standards first.** We do not invent terms, schemas or ontologies where a consensus standard exists. Order: law, then US and NIST standards, then ISO standards, then broadly used vocabularies, then state and local standards where they do not conflict. Most of what we make is regulated by US law, so US federal, state and local law and standards get special weight. First domains: NIST and FedRAMP, the FDA's QMSR (21 CFR Part 820) and 21 CFR Part 11.
5. **An invention is drift.** A term no standard backs is `unaligned`: it carries a justification and a typed `Decision` within 90 days, is counted, and the count only goes down.
6. **The ladder.** One architecture of rungs 0 to 7 (ontology, specifications, governed data, data operations, infrastructure rules, business rules, application, documentation) plus an optional rung 8 for what is retired and archived. A rung relies only on the rungs below it, and work goes lowest rung first.
7. **Everything traces.** Source files name the requirements they implement, tests name what they prove, ontology terms name their specifications, and a specification names only terms the ontology defines.
8. **Warn first, never hide.** New rules start as warnings with a baseline that only shrinks. Prose cannot be type-checked against code, so what only a person can judge is declared as reviewed, with the reason.
9. **IFC Mizan Integrations** (`commons/ts/mizan/integrations/`) brings standards into our typed form and turns ours into well-known forms (SHACL, JSON Schema, SKOS, SSSOM and more). Imports are made only when a term is needed, and nothing is ever published upstream without a person's decision.
10. **AI-first, AI-native.** An agent reads `AGENTS.md`, the specification and the typed ontology, and the deterministic checks, not the agent, are the judge of whether the work is true to them.

**Status:** Mizan is being built in the open. The plan, its tasks and its progress are in [issue #10](https://github.com/intellectual-frontiers/.github/issues/10); the specifications are `0003-mizan` and `0016` to `0019` in [`commons/spec-kit/`](commons/spec-kit/), and the first audit is in [`commons/spec-kit/audits/`](commons/spec-kit/audits/2026-11-standards-audit.md). [`MIZAN.html`](MIZAN.html) is the full strategy and implementation document.
