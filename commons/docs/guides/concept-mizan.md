# Mizan

Mizan (Arabic *mizan*, "balance, scale") is the IF Spec Profile: a profile of GitHub Spec Kit that adds what Spec Kit lacks. It is the format every harness keeps for its specifications, its register of numbers and its register of what enforces each requirement, with one tool that checks a folder against it ([commons 0003-mizan](../../spec-kit/specs/0003-mizan/spec.md)).

**In practice.** A specification is a folder with a `spec.md`: a title, a status, an `**Input:**` that says what it is for, numbered requirements (`FR-001`, written with MUST or MUST NOT so each can be tested), success criteria and open questions. The register (`registry.tsv`) lists the numbers and `enforcement.tsv` says who checks each requirement. A test names the requirement it proves, and a requirement in force with no test is a finding.

**Where to see it.** The Specifications section of this site is made from these files. The check is `commons/tools/mizan-check.ts`, and [the Mizan library](../../mizan/) holds its model. What a specification must say depends on what it specifies, which is the subject of [commons 0029-subject-profiles](../../spec-kit/specs/0029-subject-profiles/spec.md).

Mizan weighs a harness against its specifications; [Kanon](concept-kanon.md) is the rule a library is built to.
