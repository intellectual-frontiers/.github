# Definitions behind actors

**For:** 0048-actors. **Read:** the primary sources named in each row, on 2026-11-26, by fetching the document and reading the passage. Every definition below is in our own words. Where a row says **read**, the passage was read at the source; where it says **not read**, the source could not be fetched or was behind a paywall, and nothing here claims what it says. A row that says **read, in part** names what was read.

## What an actor is, in one place

An **actor** is whatever takes part in an act that a regulated record depends on: a **person**, a **system** (a deterministic mechanism that a person validated: the engine, a typed verb, a pipeline) or an **agent** (an AI agent, a model run under instructions with tools). The three kinds are not three degrees of the same thing. A person can be accountable; a system can be validated; an agent can only be instructed, and what it does is a draft until a person or a validated mechanism clears it.

The rule that this page and the specification follow: **an agent is an instrument in a regulated flow, never the initiator and never the one who completes it.** It prepares artifacts (code, documents, tests, plans) and it assists the execution of a step that a validated mechanism carries out; an agent that acts with no directive (a specification, an instruction, a procedure or a person's request that is on record) is uncontrolled, and an act of an uncontrolled actor is a nonconformance, not evidence. This is not a view about the quality of what agents produce. It is the same rule that a regulated organization applies to any tool: the tool is qualified, instructed and controlled, and a person answers for what it was used to do.

The terms that follow are the vocabulary of the specification. The words **provenance** and **agent** are used only where a cited standard uses them.

## 1. The shape of an act (W3C PROV)

| Item | Our wording | Source and status |
| --- | --- | --- |
| Agent (PROV) | Something that bears some form of responsibility for an activity taking place, for the existence of an entity, or for another agent's activity. In PROV every actor of any kind is an `Agent`; our **actor** maps to it, and our actor kind `agent` (an AI agent) maps to the software case only. | W3C PROV-DM, definition of agent; PROV-O. **Read.** |
| Attribution and association | The responsibility of an agent for an entity is `wasAttributedTo`; for an activity, `wasAssociatedWith`; an agent that acts for another is `actedOnBehalfOf`, and the plan that an association followed is `hadPlan`. | W3C PROV-O (the list of properties). **Read, in part:** the property names and the sentence on responsibility; the qualified forms were not read. |
| What we take from it | The shape (entity, activity, actor; who is responsible for what; on whose behalf; following which plan). We map `initiatedBy`, `preparedBy`, `assistedBy`, `executedBy`, `reviewedBy` and `approvedBy` onto attribution, association and delegation, and a **directive** onto the plan. We do not adopt PROV as the model, because PROV does not say which role a kind of actor may hold. | Our decision. |

## 2. Statements about what was done and by what (in-toto, SLSA)

| Item | Our wording | Source and status |
| --- | --- | --- |
| Statement | A signed claim that binds a set of subjects (artifacts, each with a digest) to a typed predicate. The subjects are taken to be immutable; the predicate type says how to read the rest. | in-toto attestation, statement layer. **Read.** |
| Build provenance | A predicate that says what built an artifact: the builder's id, the build type, the parameters given from outside, the parameters the platform set, and the dependencies that were resolved. The trust in it rests on the builder, not on the claim. | SLSA provenance v1. **Read.** |
| What we take from it | The pattern: a **tasking record** and a **preparation record** are statements over artifact digests, so that "prepared by an agent under directive D" can be checked against the artifact. We call them statements and mark SLSA and in-toto as the format they map to; we do not call our own term provenance. | Our decision. |

## 3. Statements about an AI system and about content (SPDX 3.0, CycloneDX, C2PA)

| Item | Our wording | Source and status |
| --- | --- | --- |
| SPDX 3.0 AI profile | A profile that describes an AI package, with fields that include `autonomyType` (whether a person is in any of the decisions of the software), a safety risk assessment, and the standards it complies with; a conformant package has a declared and a concluded licence. | SPDX 3.0.1 model, AI profile and the AIPackage class. **Read, in part:** the profile conformance rule and the names and types of the properties; the wording of each property was not read. |
| CycloneDX ML-BOM | A bill of materials for models and datasets, with the provenance of datasets, the methods of training and the configuration of the frameworks, to judge risks of bias, integrity and security. | CycloneDX capabilities page. **Read, in part:** the introduction only. |
| C2PA | A format that binds claims about how an asset was made to the asset. The action list (`c2pa.actions`) is the history of what was done and a claim generator may not redact it; a field, `digitalSourceType`, says whether a source was trained or algorithmic data. | C2PA specification 2.2. **Read, in part:** the rule on redaction, the action list and the changelog entries that name `digitalSourceType`; the standard assertions were not read. |
| What we take from it | An **agent qualification** can be exported as an AI package (SPDX) or an ML-BOM entry (CycloneDX); the field `autonomyType` is the nearest published name for what our **tasking level** says. Media content credentials (C2PA) are out of scope for the first version. | Our decision. |

## 4. Rules for AI use by regulators and standards bodies

| Item | Our wording | Source and status |
| --- | --- | --- |
| EU AI Act, human oversight (Article 14) | A high risk AI system must be designed so that natural persons can oversee it while it is in use. The measures must fit the risk, the autonomy and the context. The persons assigned must be able to understand its limits, to stay aware of automation bias (the tendency to over-rely on the output), to interpret the output, to decide not to use it or to override or reverse it, and to stop it. | Regulation (EU) 2024/1689, Article 14(1) to (4). **Read.** |
| EU AI Act, record keeping (Article 12) | A high risk system must technically allow automatic recording of events over its lifetime, with enough traceability for its purpose. | Article 12(1) and (2), first lines. **Read, in part.** |
| EU AI Act, deployers and literacy (Articles 26 and 4) | A deployer must give human oversight to natural persons who have the competence, the training and the authority, and the support they need; providers and deployers must take measures for a sufficient level of AI literacy of the staff and others who work with AI systems on their behalf. | Article 26(2) and Article 4. **Read.** |
| EU AI Act, transparency (Article 50) | A system meant to interact with persons must make them aware that it is an AI system; a provider of a system that generates synthetic text, image, audio or video must mark the outputs in a machine readable form; a deployer who publishes AI generated text to inform the public on matters of public interest must disclose it, with exceptions. | Article 50(1), (2), (4), (5). **Read, in part.** |
| NIST AI RMF 1.0 | Govern 3.2: policies and procedures define and differentiate the roles and responsibilities for human and AI configurations and for oversight of AI systems. The framework treats human and AI configurations as something to be measured and managed. | NIST AI 100-1, Govern 3.2 and the text on human and AI configurations. **Read, in part.** |
| ISO/IEC 42001 | The management system standard for AI. | **Not read:** the standard is sold; the page returned a refusal. Nothing in the specification claims its text. |
| FDA computer software assurance, EU GMP Annex 22 (draft on AI), GAMP 5 | The regulated life sciences guidance on risk based assurance of software, on AI in medicines manufacturing, and on computerised systems validation. | **Not read:** the FDA page and the European Commission file could not be fetched, and GAMP 5 is sold. The specification takes the practice (equipment qualification as installation, operation and performance qualification; risk based review) from the quality specification of this repository, which cites the FDA guidance, and from 21 CFR Part 11 below. |

## 5. Records and signatures of regulated electronic records

| Item | Our wording | Source and status |
| --- | --- | --- |
| 21 CFR 11.10 (closed systems) | Procedures and controls so that the signer cannot readily repudiate a signed record: validation of the system; audit trails that are secure, computer generated and time stamped, that record who did what to a record and that do not obscure earlier entries; authority checks so that only authorized individuals use the system, sign, or change a record; device checks on the source of input; people who develop or use the system have the education, training and experience for their tasks; written policies that hold individuals accountable for actions begun under their signatures; controls over system documentation, with revision control. | 21 CFR 11.10 (a), (e), (g), (h), (i), (j), (k). **Read.** |
| 21 CFR 11.50 and 11.70 | A signed record shows the signer's name, the time and the **meaning** of the signature (review, approval, responsibility or authorship), and the signature is linked to its record so that it cannot be copied to another. | 21 CFR 11.50, 11.70. **Read.** |
| What we take from it | The **meaning** of a signature is a typed field: review, approval, responsibility, authorship. An agent holds none of them: `reviewedBy` and `approvedBy` name a person, and the statement of a draft names the preparer and the directive. The audit of an act records the actor of each role. | Our decision. |

## 6. Controls of NIST SP 800-53 that the roles rest on

All rows are from the catalog of this repository (`catalog-nist-sp800`, SP 800-53 5.2.0); identifiers and statements were read there, and the paraphrase is ours.

| Control | Our wording | Status |
| --- | --- | --- |
| AC-5, Separation of duties | Duties of individuals are identified and documented, and system access is set to support their separation. We use it for the rule that the reviewer of a regulated act is not its preparer, and that an agent and the person who tasked it are not both author and approver. | **Read.** |
| AU-10, Non-repudiation | Irrefutable evidence that an individual, or a process acting for an individual, performed given actions. The words "a process acting for an individual" are the nearest the catalog has to our agents; we keep the individual named. | **Read.** |
| CM-3 and CM-5, Configuration change control and access restrictions for change | Changes to configuration are determined, reviewed and approved with security and privacy in mind, and the right to change is limited. The configuration of an agent (model, instruction set, tools) is a configuration item. | **Read:** CM-3 statement; CM-5 title only. |
| AT-2 and AT-3, Literacy and role based training | Training before access is authorized and when the system changes. Applied to the persons who task, review and approve for an agent. | **Read:** AT-3 statement, AT-2 title. |
| IA-9, Service identification and authentication | System services and applications are uniquely identified and authenticated before communication. An agent and a system are identified actors of their own. | **Read.** |
| PL-2 and PL-4, plans and rules of behavior | The security plan names how the system works; rules of behavior say what persons may do. The directive of an agent is its rules of behavior. | **Read:** titles only. |
| NIST SP 800-63 | Digital identity guidance for persons. | **Read, in part:** the section searched for non-person entities and found none; the guideline is about persons, and the system and agent kinds are therefore named in IA-9 and not here. |

## 7. Trailers and signing in Git

| Item | Our wording | Source and status |
| --- | --- | --- |
| Trailers | A trailer is a key and a value at the end of a commit message, after a blank line; the key is ASCII letters, digits and hyphens. A trailer block can be read and written by the tool. | git-interpret-trailers manual. **Read.** |
| Co-authored-by | A host reads this trailer as an extra author, if the address belongs to an account. | GitHub documentation on commits with several authors. **Read.** |
| AI use in the Linux kernel | Agents must not add `Signed-off-by`: only a person can certify the Developer Certificate of Origin, and the person answers for the contribution, having reviewed it. An agent that finds and fixes a bug must reproduce it, verify the fix, say what could not be done, and leave the sending to the person. | Linux kernel documentation, "AI Coding Assistants". **Read.** The page carries no `Assisted-by` trailer in the text read; a convention for it was **not read**. |
| gitsign | Keyless signing of commits with a short lived certificate bound to an identity of the signer; it needs network access at signing time. | Sigstore gitsign README. **Read.** |
| What we take from it | The commit carries `Prepared-by`, `Directive` and `Reviewed-by` trailers (a codec in the library, a lint in the check), the **author** is the accountable person, `Signed-off-by` and a signature are a person's alone, and an agent never writes `Co-authored-by` as if it were an author of record. | Our decision. |

## 8. Our terms

| Term | Our wording |
| --- | --- |
| Actor | A person, a system or an agent that takes part in an act. |
| Initiator | The person whose request, or whose standing directive, is why the act happens. An actor of kind agent can never be one. |
| Preparer | The actor that made the artifact (a document, a change, a test, a plan). Any kind. |
| Assistant | An agent or a system that operated a tool during a step, under a directive and a tasking. |
| Executor | The person or the validated mechanism that carried the step out. |
| Reviewer | A person, independent of the preparer for a regulated act, who read the artifact and signed that review, with the meaning review. |
| Approver | A person with a key whose signature, with the meaning approval, bound the plan hash. See the approval specification. |
| Directive | A controlled instruction that an act is done under: a work order, a specification, a procedure, or a person's request kept by its digest; with an owner who is a person, a version and a digest. The instruction sets of an agent (AGENTS.md, CLAUDE.md, the system prompt) are directives, and their digest is part of what is recorded. |
| Tasking | A person signed authority for an agent configuration: the scope (verbs, assets, boundaries), the tasking level, the expiry, the qualification it relies on, and its revocation. Tasking is not delegation: the person keeps the initiative and the accountability. |
| Tasking level | T0 suggest; T1 prepare drafts in a branch or a sandbox; T2 assist execution with a per step plan hash approval; T3 assist reversible, low risk steps under a standing directive and a current qualification. At every level the initiator stays the owner of the directive and the executor stays the engine. |
| Qualification | A record that an agent configuration (model identity and version, instruction set digest, tool permissions) was shown fit for a use: installation, operation and performance evidence (cases run with `opsfolio test` and `validate`), a validity period and the triggers that require requalification. |
| Nonconformance | A record of an act that did not meet the rules: undirected, outside tasking, unqualified, unreviewed, or a regulated verb refused; with a disposition and a corrective action, in the manner of a corrective and preventive action. |
| Review canary | A seeded defect that a review should catch, used to measure whether review is real. A pilot, opt in per flow, and unproven. |

## 9. Evidence side (not actors)

The following are properties of evidence, not of actors, and are specified in `quality` (0001-quality-evidence) and `grc`, which already hold the grades and the signed attestations: the **source class** of an evidence item (machine observed, human attested, agent prepared, third party, derived), its **lineage** (what it was derived from) and the **prepared marker** (an evidence state: a draft that an agent prepared and nobody has cleared). The quality specification already says that a review made by an agent is recorded as an agent's and graded no higher than `ifqs:E2` (0001-quality-evidence FR-029) and that evidence of grade `ifqs:E1` is stated by a person or an agent; this work adds the rules for clearing and for sole basis.

## 10. Not verified

ISO/IEC 42001, GAMP 5, the FDA guidance on computer software assurance, the draft Annex 22 of the EU GMP, the `Assisted-by` convention, the qualified forms of PROV, the standard assertions of C2PA, and the wording of each SPDX AI property. A requirement that depends on one of them is marked so in the specification and in the reuse audit, and an entry of a catalog that depends on one MUST be `unread`.
