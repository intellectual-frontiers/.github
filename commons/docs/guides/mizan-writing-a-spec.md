# How a specification is written

Mizan adds a small, strict layer on Spec Kit's format. The checker enforces it; new rules start as warnings.

## The folder and its registers **Built**

- `registry.tsv`: every specification number ever assigned, `in force` or `retired`, with no number twice and no gap.
- `specs/NNNN-slug/spec.md`: one folder per specification. Requirements are `- **FR-nnn**:`, numbered in order and never reused; every edge case cites the requirements it exercises.
- `enforcement.tsv`: exactly one row per requirement, naming its mechanism: `check`, `gate`, `review` or `none` (with the reason). This is the *proof register*.
- Citing another repository's specification always names the repository: `commons 0027-commons-libraries FR-004`.

## One status vocabulary **Built**

| Status | Meaning |
| --- | --- |
| Draft | Written, not yet built. |
| Active | In force: every requirement is proven by a test or declared as reviewed. |
| Deferred | Out of scope until its owner decides. |
| Superseded | Another specification takes its place. |
| Adopted | The word commons used before Mizan. Accepted until every specification has moved to Active. |

## Requirement syntax: RFC 2119 and EARS **Built, warn-only**

A vague requirement cannot be tested, and a requirement that is not testable cannot be proven. We write requirements with RFC 2119 keywords (`MUST`, `SHOULD`, `MAY`) in one of the six EARS patterns (Easy Approach to Requirements Syntax). EARS is small enough for an agent to follow and regular enough for a checker to parse.

| Pattern | Form | Example |
| --- | --- | --- |
| Ubiquitous | The <system> MUST … | The checker MUST write nothing. |
| Event-driven | WHEN <event>, the <system> MUST … | WHEN a source file has no `// Spec:` line, the check MUST report `trace/no-spec-line`. |
| State-driven | WHILE <state>, the <system> MUST … | WHILE a term is `unaligned` and its Decision is missing, the check MUST warn until 90 days have passed. |
| Unwanted behaviour | IF <condition>, THEN the <system> MUST … | IF an imported source's SHA-256 differs from its record, THEN the import MUST be refused. |
| Optional feature | WHERE <feature present>, the <system> MUST … | WHERE a harness has no windowed hosts, rung 6 MUST hold only the headless hosts. |
| Complex | A combination of the above | WHEN a term is added, WHILE it is `unaligned`, the check MUST count it. |

## Scenarios: Gherkin's shape **Built, warn-only**

Spec Kit's acceptance scenarios already use Given, When, Then. Mizan requires each scenario to cite the requirements it exercises, so a reader can walk from a story to its rules, and a checker can verify that the rules exist.

```text
Scenario: an unaligned term with no Decision after the grace period
  Given a term added on day 0 whose basis is unaligned
  And no Decision records why
  When the check runs on day 91
  Then it fails and names the term, per 0018-standards-first FR-005
```

## The Standards considered section **Built, warn-only**

A feature's `plan.md` has a required section naming the standards looked at and the one chosen. It makes "did you check whether a standard exists?" a question with a written answer.

## Conformance levels **Built**

A subject does not have to meet all of Mizan on the first day. Four levels, stated once as typed data in the ontology (`mz:ConformanceLevel`, each with an `mz:levelRank`), each add to the one below: **L0 registered** (a manifest, a verify command, a version), **L1 core** (its own spec kit and verify, EARS requirements, Gherkin scenarios that cite them, one proof row for each requirement, the `Spec:` and `Proves:` trace, baselines that only shrink, the check of citations), **L2 standards** (the audit of terms, with a decision for each that stays unaligned) and **L3 governed** (every commit names an issue, every work has a release record, the quality records are kept). A harness declares its `level` and the check runs only the rules that level entails; where it declares none it is at L3, which is what every harness is held to today. Each library of commons declares itself with a manifest, `library.ts`, whose level is L1 where it names none, and `check.ts --all` also runs every library's `verify`.

## Subject profiles **Built, warn-only**

What a specification must say depends on what it specifies. A specification may declare `**Subject:**` (library, service, application, integration or platform) and `**Audience:**` (b2b or b2b2c) in its head, and its profile asks for sections, with requirement templates, a form of proof and the standards it rests on: a service its contract (OpenAPI 3.1, AsyncAPI, JSON Schema), the tests of it, objectives as OpenTelemetry metrics and ISO/IEC 25010 qualities mapped to proofs; an application its journeys in Gherkin, WCAG 2.2 accessibility and its design system; a business-to-business subject tenant isolation, agreements, an audit trail, data processing and the controls of SOC 2, ISO/IEC 27001 and NIST SP 800-53; a business-to-business-to-consumer subject also three actor roles, consumer privacy and consent under the laws that apply, and the boundary between what a partner and an end user see. A missing section is a warning held by the baseline; a specification that declares nothing is a specification of a library and is asked for nothing more.

## The proof register and OSCAL **Built**

Where OSCAL can say it, the register maps to OSCAL; where it cannot, it stays as `enforcement.tsv`, so no proof is written twice. The proposal: a requirement is an `implemented-requirement` of a `component-definition` of the harness; a passing proof is an `assessment-results` observation; a reviewed requirement carries its reason there; an open finding is a `plan-of-action-and-milestones` item. The command that proves it, and the harness path, stay in the TSV. `bun commons/mizan/src/oscal-register.ts` writes the component definition and the assessment results to `commons/generated/`, and `--check` fails where they differ from what the folder makes.
