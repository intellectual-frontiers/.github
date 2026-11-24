# Mizan

Mizan (Arabic *mizan*, "balance, scale") is the IF Spec Profile: a profile of GitHub Spec Kit, four strongly typed TypeScript ontologies and a shared ladder of eleven rungs, held together by one rule: take the standard before you invent a term, and keep specifications, ontology and code in balance. It carries two products written in its form: IFCCM for change and IFQS for quality. It is the format every harness keeps for its specifications, its register of numbers and its register of what enforces each requirement, with one tool that checks a folder against it ([commons 0003-mizan](../../spec-kit/specs/0003-mizan/spec.md)). The work is tracked in [issue #10](https://github.com/intellectual-frontiers/.github/issues/10).

**In practice.** A specification is a folder with a `spec.md`: a title, a status, an `**Input:**` that says what it is for, numbered requirements (`FR-001`, written with MUST or MUST NOT so each can be tested), success criteria and open questions. The register (`registry.tsv`) lists the numbers and `enforcement.tsv` says who checks each requirement. A test names the requirement it proves, and a requirement in force with no test is a finding.

**Where to see it.** The Specifications section of this site is made from these files. The check is `commons/tools/mizan-check.ts`, and [the Mizan library](../../mizan/) holds its model. What a specification must say depends on what it specifies, which is the subject of [commons 0029-subject-profiles](../../spec-kit/specs/0029-subject-profiles/spec.md). Mizan weighs a harness against its specifications; [Kanon](concept-kanon.md) is the rule a library is built to.

## In this section

1. [The idea in one page](mizan-idea.md)
2. [Why: the drift problem](mizan-why.md)
3. [Two languages](mizan-languages.md)
4. [Mizan and GitHub Spec Kit](mizan-spec-kit.md)
5. [How a specification is written](mizan-writing-a-spec.md)
6. [The ladder](mizan-ladder.md)
7. [Standards first](mizan-standards-first.md)
8. [The typed ontology](mizan-ontology.md)
9. [IFC Mizan Integrations](mizan-integrations.md)
10. [IFCCM: change control](mizan-ifccm.md)
11. [IFQS: the quality system](mizan-ifqs.md)
12. [AI-first, AI-native](mizan-ai.md)
13. [Reducing drift: the controls](mizan-controls.md)
14. [Built, in progress and not verified](mizan-status.md)
15. [Decisions taken](mizan-decisions.md)
16. [Glossary](mizan-glossary.md)
