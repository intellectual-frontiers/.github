# The idea in one page

*Mizan* is Arabic for "balance" and "scale". We use it as the code name of the **IF Spec Profile**: the discipline that keeps what we *say* (specifications), what we *define* (the ontology) and what we *run* (code) in balance.

- **Spec Kit is the method.** We keep GitHub Spec Kit's commands, constitution and `spec.md`, `plan.md`, `tasks.md`. Mizan is a profile on top, not a replacement.
- **Two languages.** Natural language for specifications. TypeScript 7+ for ontology, code, tools and tests. Bun by default, Node 26 as backup.
- **One typed ontology.** Strongly, algebraically typed TypeScript on commons' RDF kernel. Turtle and the rest are generated, never edited. Four are published: `mz`, `ifccm`, `ifqs`, `ifr`.
- **Standards first.** No invented terms where a consensus standard exists. Law, then US and NIST standards, then ISO, then broadly used vocabularies.
- **An invention is drift.** A term no standard backs is `unaligned`: justified, recorded, counted, and the count only falls.
- **One ladder.** Eleven rungs: 0 to 7 required, 8 lifecycle (optional), 9 Evidence (observer), 10 Workspace (environment). A rung relies only on the rungs below it that it names.
- **Everything traces.** Code names its requirements, tests name what they prove, terms name their specifications.
- **Integrations module.** `commons/mizan/src/integrations/` brings standards in as typed TypeScript and turns our ontologies into well-known forms.
- **AI-first, AI-native.** Artifacts an agent can read, write and be checked on. Deterministic checks, not the agent, judge whether work is true to the spec.

**How to read this section.** [Why: the drift problem](mizan-why.md), [Two languages](mizan-languages.md) and [Mizan and GitHub Spec Kit](mizan-spec-kit.md) give the rationale. [How a specification is written](mizan-writing-a-spec.md), [The ladder](mizan-ladder.md), [Standards first](mizan-standards-first.md), [The typed ontology](mizan-ontology.md) and [IFC Mizan Integrations](mizan-integrations.md) are the substance: format, ladder, standards, ontology, integrations. [IFCCM: change control](mizan-ifccm.md) and [IFQS: the quality system](mizan-ifqs.md) are the two products written in Mizan's form. [AI-first, AI-native](mizan-ai.md) is how agents work in it, [Reducing drift: the controls](mizan-controls.md) is the list of controls against drift, and [Built, in progress and not verified](mizan-status.md) and [Decisions taken](mizan-decisions.md) say honestly what is built, what is not yet verified and what was decided. Every item is marked **Built**, **Specified** or **Planned**. The [glossary](mizan-glossary.md) defines the terms.
