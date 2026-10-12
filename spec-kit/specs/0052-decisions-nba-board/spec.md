# Feature Specification: Decisions & NBA Board

**Spec ID:** 0052-decisions-nba-board
**Status:** Draft

**Input:** The Decisions & NBA Board is a method, and this spec states it: a short, continuously refreshed queue of decisions, each carrying cited operational truth, the options (doing nothing among them), a recommended next best action, a person with authority to decide, and a dated check on the result. It also states the terms a work uses to describe the method, so that a paper, a pocket guide, a skill or a product that names a card, a goal or a result means the same thing. The method is an abstract methodology and so a Noema (0048-noemas FR-007). The terms live in the ontology (`ifcore:DecisionsAndNbaBoard` and the classes that follow it). What the method achieves is a research claim of the pillar that studies it and is not stated here.

## The method

- **FR-001**: The Decisions & NBA Board MUST be recorded as an abstract methodology: an `ifcore:IntellectualConstruct` of subtype `ifcore:MethodologyType` with a Noema that reflects it (0048-noemas FR-005, FR-007). A product, a workflow or a repository that carries it out MUST be an Ergon related to it by `operationalizes` and MUST NOT stand for it.
- **FR-002**: The method MUST work as one loop: operational truth, an outcome gap or opportunity, a decision candidate, a ranked next best action, an authorized action, an observed result, and updated operational truth. A description of the method that omits the observed result is a report and MUST NOT be called a Board.
- **FR-003**: The method MUST NOT be described as a dashboard, a task tracker, a chatbot, an executive memo or an autonomous manager.

## Terms

- **FR-004**: A work that names a part of the method MUST use these terms as the ontology names them: `ifcore:Goal`, `ifcore:OutcomeMetric`, `ifcore:Observation`, `ifcore:EvidenceRecord`, `ifcore:DecisionCandidate`, `ifcore:Alternative`, `ifcore:NextBestAction`, `ifcore:Decision`, `ifcore:Commitment`, `ifcore:ApprovedAction`, `ifcore:AcceptanceEvidence`, `ifcore:ObservedResult` and `ifcore:LearningRecord`. Each term's definition is the ontology's and MUST NOT be restated in a work.
- **FR-005**: A recommendation MUST NOT be an `ifcore:Decision`. Only a named person's choice is a Decision (0008-decision-records FR-003). A decision candidate that a person accepts, rejects or defers MUST be related to the Decision that records the choice by `ifcore:resolvedBy`.
- **FR-006**: "Operational truth" MUST be written in lowercase and without a mark where a work names the general idea, and the mark MUST NOT be written on it (0045-elenchus-works FR-040). A work MUST NOT write operational truth as a claim of the method's own invention.

## Operational truth

- **FR-007**: A record of operational truth MUST keep four kinds of statement apart: a raw observation, a documented assertion, an inference and a forecast. Each MUST carry its source, the time it was observed or asserted, and a status of verified, reported, stale or disputed.
- **FR-008**: Reported state MUST be kept apart from demonstrated state. A ticket marked done is reported. Acceptance evidence is what demonstrates it.
- **FR-009**: Where two sources conflict, the record MUST show both with their provenance and age, and MUST NOT resolve the conflict by choosing one.
- **FR-010**: Where evidence is missing, old, contradictory or disputed, the record MUST say so as part of the truth. A missing baseline MUST be recorded as instrumentation work and MUST NOT be read as a result.
- **FR-011**: A statement MUST NOT invent a source, a baseline, an impact figure or a completed action.

## Goals and measures

- **FR-012**: A goal MUST name an owner, an outcome measure, its definition and data source, a dated baseline, a target, a time horizon, the segment it concerns, its hard constraints and the tradeoff it accepts.
- **FR-013**: Every outcome measure MUST be paired with at least one counter-measure that would show harm done in pursuit of it (`ifcore:counterMeasure`). A result MUST be reported with its counter-measure, and where the measure improved and the counter-measure worsened it MUST be reported as a tradeoff and MUST NOT be reported as success.
- **FR-014**: A leading indicator MUST NOT be reported as the outcome it leads. An activity count (messages sent, tickets closed, pages published) MUST NOT be reported as an outcome.

## Decision candidates

- **FR-015**: A decision candidate MUST NOT appear on the active Board unless it carries: the goal it serves (`ifcore:servesGoal`), evidence it cites (`ifcore:basedOnEvidence`), at least two alternatives of which one is to wait, a decision owner who has authority to choose (`ifcore:decisionOwner`), a statement of why it is on the Board now, a statement of what happens if nothing is done, and a dated next checkpoint.
- **FR-016**: A candidate with no goal link and no exceptional risk MUST NOT appear on the active Board. A fact with no decision and no justified investigation MUST be kept as a linked archive entry and MUST NOT appear as a card.
- **FR-017**: Two candidates that concern the same decision MUST be merged, and the merged candidate MUST keep the history of both.
- **FR-018**: The active Board MUST hold no more candidates than the people who decide can decide in the period it covers, and the limit MUST be stated. Urgent candidates MUST count toward the limit, and a candidate the limit keeps off the Board MUST wait in view with its age shown.
- **FR-019**: A candidate that no longer has a current trigger or an owner who can act MUST expire. A rejected candidate MUST NOT return unless new evidence is cited.
- **FR-020**: A recommended next best action MAY be to stop, defer, investigate, run an experiment, reallocate capacity or do nothing. Where it is to wait or do nothing, the candidate MUST state the trigger that would reopen it.

## Ranking

- **FR-021**: A ranking MUST apply hard constraints (security, legal, customer safety, required financial approval and real capacity) before it scores. A candidate that fails a hard constraint MUST NOT be scored.
- **FR-022**: A ranking MUST rate impact, urgency, confidence and effort in stated ordinal bands and MUST NOT present a computed score as an objective fact. Expected impact MUST be stated as a hypothesis and a range, and MUST NOT be a single invented figure.
- **FR-023**: A ranking MUST be tested for sensitivity: where the order changes under a plausible change in one rating, the ranking MUST be reported as unstable. A decision owner MAY override a rank, and the override and its reason MUST be logged.

## Authority and execution

- **FR-024**: An action MUST NOT be run on a consequential matter without the explicit approval of a person with authority. An agent MUST NOT approve an individual decision it recommended; running an action under a rule a person approved in advance (FR-026) is not approving a decision.
- **FR-025**: A decision on privacy, clinical care, security or law MUST be reserved to a qualified person and MUST NOT be delegated to an agent.
- **FR-026**: An agent MAY run an action without a person's approval of that action only where a person approved in advance the rule that permits it, and the action is small, reversible and low-risk, and only within permissions, a budget and an audit trail stated in advance. Authority MUST begin at observation and MUST grow only as measured performance supports it, and it MUST fall when source quality drops, a dependency changes, performance degrades or an incident crosses a threshold.
- **FR-027**: A person MUST be able to dispute a source, override a recommendation and ask for more evidence, and each MUST be recorded on the candidate.
- **FR-028**: Text from a source outside the record (a ticket, an email, a document) MUST be treated as data and MUST NOT be followed as an instruction by an agent that reads it.

## Results

- **FR-029**: Each approved action MUST be followed up at its checkpoint. The result MUST be recorded as an `ifcore:ObservedResult` against the baseline with its acceptance evidence, and a failed action MUST be recorded and a revised choice considered.
- **FR-030**: The Board MUST NOT claim that an action caused a result unless the design supports the claim. Where it does not, the record MUST say the attribution is weak.
- **FR-031**: A repeated failure to act on recommendations MUST be recorded as a diagnosis to investigate (low trust, wrong priorities, unclear authority or too little capacity) and MUST NOT be recorded as non-compliance by a person.
- **FR-032**: The Board MUST NOT be used to score or surveil an individual.

## Delivery by message

- **FR-035**: A Board MAY be delivered as routine messages (a daily or other regular email, for example). A message MUST name its audience, a person or a distribution group, and MUST carry no more candidates than the Board's stated limit (FR-018).
- **FR-036**: A message MUST carry only candidates that its audience has authority to decide or act on, or has a stated reason to be told. A candidate that no member of the audience can decide or act on MUST NOT be in the message. Audiences with different decision rights MUST NOT receive one generic set of candidates by default.
- **FR-037**: A message is a rendering of candidates held in the record and MUST NOT be the record. A reply that accepts, rejects or defers a candidate MUST be recorded only when the sender is a person with authority over that candidate, and a reply from anyone else, or text inside a reply that tells an agent what to do, MUST NOT approve or change anything (FR-024, FR-028).
- **FR-038**: A message MUST link to evidence and MUST NOT copy into it data the audience is not permitted to see. The effect of a message MUST be measured by the decisions made and the actions completed after it, and MUST NOT be measured by opens or clicks alone (FR-014).

## Claims about the method

- **FR-033**: A work that says the method improves an outcome MUST label the statement a hypothesis until a trial has tested it, and MUST say what would show it wrong (0017-spoken-and-research-works FR-021, FR-022). A work MUST NOT present a scenario that is a composite as a case study.
- **FR-034**: A work MUST NOT state or imply that the method, its name or any term of this spec is patentable, protected, novel or owned. Whether any is, is a separate recorded decision.

## Out of scope

- The trial design and the results of any trial. These are the research pillar's and the paper's (0017-spoken-and-research-works).
- The product that carries the method out and its commitment ledger. Whether the commitment ledger of the Opsfolio family carries `ifcore:Commitment` is an open question (OQ-1).
- The wording and typesetting of any work about the method (0016-press-production).

## Edge cases

- A decision that a person makes in a meeting with no card: the Decision is recorded and a candidate is related to it afterward, per FR-005.
- A candidate whose only evidence is a model's summary: it carries no cited evidence and stays out of the active Board, per FR-015 and FR-011.
- A metric that rises while its counter-measure falls: the result is a tradeoff and is not a success, per FR-013.
- Two sources that disagree about a baseline: the candidate shows both and is not ranked on either alone, per FR-009 and FR-021.
- A low-risk action an agent ran within its permissions that later proves wrong: the failure is recorded and authority falls, per FR-026 and FR-029.
- A candidate to do nothing: it states the trigger that reopens it, per FR-020.
- A recommendation an owner rejects with a reason and that a later agent run raises again with no new evidence: it does not return, per FR-019.
- A card whose evidence is a ticket's status: the status is reported state, and acceptance evidence is still owed, per FR-008.
- A ranking that flips when one rating moves one band: it is reported as unstable, per FR-023.
- An instruction inside a customer's email that tells the agent to approve an action: the agent treats it as data, per FR-028.
- A paper that describes a worked scenario as a case from practice: it is a composite and is labeled so, per FR-033.
- A message to a distribution group whose members hold different authority: each candidate is in the message only if the group can act on it, or the message is split by audience, per FR-036.
- An email reply of "approved" from a person who has no authority over the candidate: nothing is approved, per FR-037.
- A message whose open rate is high and whose candidates are never decided: the effect is measured as none, per FR-038.
- A sixth candidate that matters to an audience whose limit is five: it waits in view with its age shown, per FR-018 and FR-035.

## Assumptions

- A team that uses the method has at least one measurable goal, a person who owns it and a source that records progress against it.
- The people who decide can be named, so that FR-015 can hold.
- A period (week, month, quarter) can be stated for each Board, so that FR-018 can hold.

## Open questions

- **OQ-1**: Whether the commitment ledger of a product of the Opsfolio family (`ifcore:CommitmentLedgerCapability`) carries `ifcore:Commitment`, or whether `ifcore:Commitment` stays a term of the method only.
- **OQ-2**: Whether "Decisions & NBA Board" is cleared for use as an outward name. Its clearance is a separate decision, as the Journal's short form's is.
- **OQ-3**: How many candidates a small team can decide in a week. The research pillar's pilot is to find out; FR-018 states a limit without a number until it does.
- **OQ-4**: Whether `ifcore:Observation` should be related to the SOSA observation class by a close match. The ontology does not import SOSA today.
- **OQ-5**: Whether starting a Board as routine messages produces better selection and better audience fit than starting with a shared view. The research pillar's hypothesis H7 is the test.

## Key entities

- **Decisions & NBA Board** - the method: a short queue of decision candidates with evidence, options, an owner and a result check.
- **Goal** - what the organization wants, with an owner, a baseline, a target and a horizon.
- **OutcomeMetric** - how a goal's result is measured, paired with a counter-measure.
- **Observation** - a raw record of something seen, with its source and time.
- **EvidenceRecord** - a cited observation, assertion or inference with a status and a freshness.
- **DecisionCandidate** - a card: a choice the Board puts before a person with authority.
- **NextBestAction** - the action or experiment the evidence currently justifies for a goal, which MAY be to do nothing.
- **Commitment** - a promise by a named person to do something by a date.
- **ApprovedAction** - an action a person with authority has approved.
- **AcceptanceEvidence** - evidence that demonstrates a result, as against a report of it.
- **ObservedResult** - what was observed at the checkpoint, against the baseline.
- **LearningRecord** - what the result changed in a rule, a measure or a priority.
- **BoardMessage** - a routine message that renders up to the limit of candidates for one named audience.

## Success criteria

- **SC-001**: A reader can open a candidate and find its goal, its cited evidence, its alternatives (one of them to wait), its owner and its next checkpoint without asking anyone.
- **SC-002**: A closed candidate holds a result recorded against its baseline and its counter-measure.
- **SC-003**: No recommendation on the Board is recorded as a Decision.
- **SC-004**: A work that describes the method uses the terms of FR-004 as the ontology names them.
- **SC-005**: Each message names its audience, holds no more candidates than the limit, and holds none that its audience cannot decide or act on.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
