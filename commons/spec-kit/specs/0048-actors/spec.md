# Feature Specification: Actors

**Spec ID:** 0048-actors
**Status:** Draft
**Owner:** if
**Domain:** commons
**Governs:** actor (a new library of the Kanon pattern), quality, grc, estate, dossier, planning

**Input:** In a regulated flow every act has to answer who began it, who made what it changed, what helped, who carried it out, who read it and who approved it. Persons, deterministic mechanisms and AI agents all take part now, and creators who are not engineers do work that only engineers did. The rule of this specification is that an **agent is an instrument, never the initiator and never the one who completes the act**: it prepares artifacts (code, documents, tests, plans) and assists the execution of a step that a validated mechanism carries out, under a directive and a tasking, in a configuration that was qualified; an agent that acts with no directive is untrained and uncontrolled, and its act is a nonconformance. The vocabulary is in the ontology (ontology 0007-actor-terms) and the definitions and what was not read are in `definitions.md`. The word agent is kept for the AI case; in PROV every actor is an agent, and the actor of this specification maps to it.

## The actor and its roles

- **FR-001**: An **actor** MUST be a person, a system or an agent (the ontology's `act:ActorKind`), identified by an id of its own, and MUST map to the PROV `Agent` (a person to `Person`, a system and an agent to `SoftwareAgent`). A **system** MUST be a deterministic mechanism that a person validated (a typed verb, the engine, a pipeline); an **agent** MUST be an AI agent: a model run under instructions with tools. Relies on audit rows: A1, A3.
- **FR-010**: An act MUST record the actors that held these roles, and only these words MUST name them: `initiatedBy`, `preparedBy`, `assistedBy`, `executedBy`, `reviewedBy` and `approvedBy`. Where a flow is regulated, the record MUST name an initiator, an executor and a preparer, and the roles reviewer and approver as the flow requires. Relies on audit rows: A1.
- **FR-011**: The library MUST enforce in its types which kind of actor may hold which role: the initiator MUST be a person or a directive owned by a person (FR-021); the reviewer and the approver MUST be persons; the executor MUST be a person or a system; the preparer MUST be any kind; the assistant MUST be an agent or a system. A program that builds an act with an agent as initiator, reviewer or approver MUST NOT type check, and a value that arrives from outside MUST be refused when it is decoded, with the error that names the role. Relies on audit rows: A1.
- **FR-012**: The meaning of a signature on a regulated record MUST be one of `review`, `approval`, `responsibility` or `authorship`, recorded with the signer, the time and the record it is linked to; an actor of the kind agent MUST NOT hold a signature of any meaning, and a system MAY sign only a record that it made, with the meaning authorship. Relies on audit rows: A4.
- **FR-013**: For a regulated act the reviewer MUST be a person who is not the preparer and who is not the person who tasked the agent that prepared the artifact (separation of duties, SP 800-53 AC-5); the approver MUST be a person with a key of their own, whose signature `grc 0020-grc-approval` verifies against the registry of keys of persons; where the same person is initiator, reviewer and approver, the record MUST say so as a finding that a person with the authority accepts. Relies on audit rows: A4.
- **FR-014**: The words that name what an agent did MUST be `prepared`, `assisted` and `drafted`. The words `wrote`, `completed`, `approved`, `signed`, `confirmed`, `initiated` and `owns` MUST NOT be used of an agent in a record, a rendering, a trailer or a document of the library, and a vocabulary lint MUST find them (FR-064). Relies on audit rows: A1.

## Directives

- **FR-020**: A **directive** MUST be a controlled instruction that an act is done under: a work order, a specification, a procedure, or a person's request kept by its digest. It MUST have an owner who is a person, a version, a digest of its text and, where it is a request, the time it was made. The instruction sets that govern an agent (the repository's AGENTS.md and CLAUDE.md, the system prompt, the tool descriptions) MUST be directives, and their digest MUST be part of what an act records. Relies on audit rows: A2.
- **FR-021**: The initiator of an act MUST be the owner of its directive. A standing directive (a work order that says what a kind of act is to be done under) MUST be owned by a person, and a person's signature of the directive is the initiation of every act done under it within its terms and its validity. Relies on audit rows: A1.
- **FR-022**: An act of an agent that names no directive MUST be **undirected**: the agent MAY read, and MUST NOT be allowed a verb that changes a regulated record or a system; the refusal MUST be recorded as a nonconformance (FR-050) that names the agent configuration, the verb and the time. A request that a person gave in a conversation MUST become a directive only when it is recorded by its digest. Relies on audit rows: A2, A6.
- **FR-023**: A controller and a tool server that expose regulated verbs MUST check FR-022 before the verb, not after, and MUST say in the refusal what directive to name and how a person gives one. Relies on audit rows: A6.

## The determinism boundary

- **FR-025**: A regulated act MUST be carried out by a person or by a validated deterministic mechanism: a typed verb that takes a plan by its hash. An agent MAY prepare the plan and MAY assist a step; it MUST NOT be the executor, and the executor of a step MUST be named in the record separately from the assistant. Relies on audit rows: A1, A6.
- **FR-026**: What an agent prepared MUST be a draft until it is cleared (FR-073 of quality 0001-quality-evidence): in a document the draft is a branch or a sandbox, in a record it is the prepared marker, and in a plan it is a proposal that waits for approval by its hash. Relies on audit rows: B1.

## Tasking

- **FR-030**: A **tasking** MUST be a record, signed by a person with a key of their own, that gives an agent configuration the authority to be used within a scope: the verbs, the assets or the boundaries, the tasking level (FR-040), the directive or kind of directive, an expiry, and the qualification it relies on (FR-035). It MUST be revocable by the person who signed it or by a person with the authority to; a revocation MUST be effective at the next act and recorded as a decision (0047-zero-trust FR-014). Relies on audit rows: A2, A5.
- **FR-031**: Tasking MUST NOT be delegation: the person who tasked an agent MUST remain the initiator of what is done under the directive and the accountable person of the record, and the agent MUST NOT be able to task another agent or to widen its own scope. An agent that uses another agent MUST name it as an assistant of the same act under the same tasking. Relies on audit rows: A2.
- **FR-032**: A tasking MUST be checked at each act, not at the start of a session: an expired, revoked, out of scope or unqualified tasking MUST end the act with a nonconformance (FR-050), and the check MUST be a pure function of the tasking, the qualification, the act and the time. Relies on audit rows: A5.

## Qualification

- **FR-035**: A **qualification** MUST be a record of an agent configuration, taken as a configuration item (SP 800-53 CM-3): the model identity and version, the digest of its instruction sets (FR-020), its tool permissions, the use it was qualified for, the evidence that it is fit for it (cases run with `test` and `validate`, with their grades), the period of validity, and the triggers that require it to be redone. It MUST be signed by a person. The record MUST follow the stages of equipment qualification (installation, operation and performance), as the practice of regulated life sciences does, and MUST NOT claim the text of a standard that was not read (`definitions.md`, section 4).
- **FR-036**: A change to the model identity, the instruction set digest or the tool permissions of a configuration MUST end the validity of its qualification at once; a configuration with no current qualification MUST be **unqualified**. Output of an unqualified configuration MUST NOT enter a regulated flow except through a review of the higher scrutiny that the tasking states, and the use MUST be recorded as a nonconformance (FR-050). Relies on audit rows: A5.
- **FR-037**: A qualification MAY be exported as an SPDX 3.0 AI package or a CycloneDX ML-BOM entry (the field `autonomyType` of the first is the nearest published name for the tasking level), and the export MUST NOT assert more than the record holds. It is not required for the first version.

## Tasking levels

- **FR-040**: The tasking levels MUST be T0 (suggest), T1 (prepare drafts in a branch or a sandbox), T2 (assist execution with a per step approval of the plan hash) and T3 (assist reversible, low risk steps under a standing directive and a current qualification). At every level the initiator MUST remain the owner of the directive and the executor MUST remain the validated mechanism. A level above T1 MUST require a current qualification, and a level of T3 MUST be limited to verbs that the catalog of the controller marks reversible and of low risk. Relies on audit rows: A5.
- **FR-041**: A level MUST NOT be raised by the agent or by another agent, and a raise MUST be a new tasking signed by a person; a lower level MAY be applied by any person who holds the authority, at once. Relies on audit rows: A5.

## Nonconformance

- **FR-050**: A breach of a rule of this specification MUST be recorded as a **nonconformance** of `quality` (the record `ifqs:Nonconformance` of quality 0001-quality-evidence, with its states and its corrective and preventive action), and the record MUST add the act, the actors by role and the rule broken, from the closed list of the ontology (`act:NonconformityRule`: undirected, outside tasking, unqualified, regulated verb refused, review skipped, reviewed by the preparer, vocabulary breach). No second record of the kind MUST exist. Its disposition (open, accepted with a reason by a person, corrected) MUST be a person's. Relies on audit rows: A6.
- **FR-051**: Nonconformances MUST be counted per rule and per agent configuration and shown in the posture of a boundary with their age, and a rise in them MUST be a finding; a nonconformance MUST NOT be removed, only closed with its disposition. Relies on audit rows: A6.

## Review that is real

- **FR-055**: A **review canary** MUST be a defect that a harness seeds into an artifact of a flow that opted in, with its location kept apart from the artifact, and MUST be removed or marked before the artifact is approved; the share of canaries that review caught MUST be reported beside the review debt (quality 0001-quality-evidence FR-028 and FR-077). This is a pilot, per flow, opt in, and unproven: it MUST NOT be used to judge a person, only the process. Relies on audit rows: B2.

## Statements and the PROV mapping

- **FR-060**: An act MUST map to the PROV `Activity`, its actors to `Agent` through `wasAssociatedWith`, the artifact it made to an `Entity` through `wasGeneratedBy` and `wasAttributedTo`, and the use of an agent for a person to `actedOnBehalfOf`; the directive MUST map to the plan of the association. The mapping MUST be total, and the library MUST NOT use the word provenance for its own terms. Relies on audit rows: A3.
- **FR-061**: The record of an act that prepared an artifact MUST be exportable as an in-toto statement whose subjects are the digests of the artifacts and whose predicate holds the actors by role, the directive and its digest, the tasking and the qualification by reference and the instruction set digests, so that a verifier that holds the statement and the artifact can check what was said about it; the build of an artifact by a pipeline MAY be exported as SLSA build provenance, where that standard's own term is used. Relies on audit rows: A3.
- **FR-062**: A record of an act MUST hold the digest of the transcript and of the prompts of an agent session, and MUST NOT hold their content; the retention period of the digests and of the content, if a fleet keeps it, MUST be stated by the fleet and the content MUST NOT be sent outside it. Relies on audit rows: A7.

## Commits and the trailer codec

- **FR-063**: A commit of a regulated repository MUST name as its author the accountable initiating person, and MUST carry the trailers `Prepared-by` (the actor and its kind), `Directive` (the directive and its digest) and `Reviewed-by` (the person, when a review is done) in the form that `git interpret-trailers` reads. `Signed-off-by` and a signature MUST be a person's alone, and an agent MUST NOT add either. A draft that no person reviewed MUST be marked prepared and MUST NOT be signed as reviewed. Relies on audit rows: A4, A8.
- **FR-064**: The library MUST encode and decode the trailers (the codec is pure), and a **vocabulary lint** MUST find in a text the words that FR-014 forbids of an agent, and a trailer that names an agent as author of record, a reviewer or an approver. Relies on audit rows: A8.
- **FR-065**: Declaration and capture MUST be the only means of knowing that an agent was used: the library MUST NOT attempt to detect the use of an agent by the style of a text, and a contribution that declares nothing and that capture cannot place MUST be given the lowest evidence weight (quality 0001-quality-evidence FR-071). Relies on audit rows: A8.

## People who are not engineers

- **FR-066**: A creator who is not an engineer MUST be able to hold the roles initiator, reviewer and approver on the same terms as an engineer; their request MUST be the directive (FR-020), the platform MAY act as the scribe that writes the commit, the record or the pull request in their name as author, and their signature of the review or of the approval, with a key or a passkey of their own, MUST be the act that makes the record theirs. The role MUST depend on the authority and the training a person holds (SP 800-53 AT-3), never on their job title. Relies on audit rows: A9.

## The dossier lens

- **FR-070**: A lens pack `actor` of the library `dossier` MUST show, for a boundary and a period, the acts by the roles their actors held, the share of acts with an agent as preparer or assistant, the directives and taskings in force, the qualifications and their validity, the nonconformances by rule with their age, the prepared markers still standing, and a statement of AI use for a regulator, in the form the regimes ask (the human oversight and transparency of the EU AI Act, ISO/IEC 42001 and NIST AI RMF, where read). It MUST show counts and names, not a score. Relies on audit rows: A10.
- **FR-071**: The pack MUST be built from signed records only, MUST be deterministic, and MUST say what it could not show because a record was missing. Relies on audit rows: A10.

## The library

- **FR-080**: The library `actor` MUST be a library of the Kanon pattern, with its governance (the kinds, the roles, the vocabulary, the rules of FR-011 to FR-014), its logical layer (the act, the directive, the tasking, the qualification, the nonconformance, the check of FR-032, the trailer codec and the lint, the statements of FR-061, all pure and typed) and its physical layer (reading and writing the records in a fleet's folders). It MUST add no layer to the libraries it governs, MUST hold no product name, and MUST stand on `grc` (signatures), `estate` (assets, boundaries), `quality` (evidence, grades) and `ontology`. Relies on audit rows: A1, A3.
- **FR-081**: The kinds of actor of `planning` (its list `ByPerson`, `ByAgent` and `ByTool`) MUST be replaced by the kinds of this specification, with the tool as a system and no alias, in the work that builds the library. Relies on audit rows: A3.

## Acceptance scenarios

1. **Given** an act in which an agent is named as initiator, reviewer or approver, **When** it is built in a program, **Then** it does not type check, and when it is decoded from outside it is refused with the role named, per FR-011.
2. **Given** an agent with no directive, **When** it asks for a verb that changes a regulated record, **Then** the verb is refused before it runs and a nonconformance is recorded, per FR-022 and FR-023.
3. **Given** an agent configuration whose model version changed, **When** it is used under a tasking that relied on the earlier qualification, **Then** the act ends with a nonconformance, per FR-032 and FR-036.
4. **Given** a commit prepared by an agent under a directive and reviewed by a person, **When** its trailers are read, **Then** the author is the person, the preparer is the agent with its kind, the directive and its digest are there, and no `Signed-off-by` names the agent, per FR-063.
5. **Given** a text in which an agent is said to have approved a plan, **When** the lint runs, **Then** it finds the word and the sentence, per FR-064.
6. **Given** a boundary and a period, **When** the lens pack is built, **Then** it lists the acts by role, the prepared markers that stand and the nonconformances by rule, with no score, per FR-070.

## Out of scope

- The signature of an approval and the registry of keys of persons: `grc 0020-grc-approval` owns them; this specification adds the meaning of a signature and states that an agent holds none (FR-012).
- The evidence side (source class, lineage and the prepared marker as an evidence state): `quality` quality 0001-quality-evidence FR-071 to FR-077.
- Content credentials for media (C2PA): a later version.
- Detecting the use of an agent by analysis of a text: refused by FR-065.

## Edge cases

- Per FR-065, a person uses an assistant on their own machine to draft a sentence and pastes it: the declaration is theirs. The sentence is human attested if the person signs it as their own authorship; the library cannot know otherwise, and says so (FR-065).
- Per FR-025, an agent re-runs a validated deterministic check and reports its result: the evidence is the check's run, `machine-observed`, with the agent as assistant; the agent's report of it is not evidence.
- Per FR-032, a standing directive that is revoked while an agent is mid-step: the step ends at the next check (FR-032) and the nonconformance records what had begun.

## Assumptions

- Qualification evidence is produced by the same acceptance machinery as any other case (`test` and `validate`), so no second harness is needed.
- `grc 0020-grc-approval` gives a person a key of their own and a registry of keys; until a fleet declares the signed mode, FR-013 and FR-030 rest on the person's presence and are marked so.

## Open questions

- The levels and the review canary are our own design; no regulator names them. A trial with a real assessor is needed before the pack claims more than the records.
- Whether the draft Annex 22 of the EU GMP and the FDA guidance on software assurance say more than `definitions.md` takes from 21 CFR Part 11: they were not read.

## Key entities

- **Actor** - a person, a system or an agent that takes part in an act.
- **Act** - a step of a regulated flow, with the actors by role and the directive.
- **Directive** - the controlled instruction an act is done under.
- **Tasking** - a person's signed authority to use an agent configuration.
- **Qualification** - the record that an agent configuration is fit for a use.
- **Nonconformance** - the record of an act that broke the rules.

## Success criteria

- **SC-001**: A regulator or an assessor can ask who began, prepared, assisted, executed, reviewed and approved any act of a fleet in a period, and which agent configurations were qualified and tasked for it, and get an answer from signed records that they can verify without the vendor.
- **SC-002**: No record of the fleet says of an agent that it initiated, completed, approved or signed anything.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
