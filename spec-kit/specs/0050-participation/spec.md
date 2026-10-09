# Feature Specification: Participation: work that invites the other side in

**Spec ID:** 0050-participation
**Status:** Draft

**Input:** How a platform lets a party take part in work that began somewhere else, and how use of the platform spreads from the work itself. A platform (0049-platforms)
already keeps a commitment ledger, and a loop in it has an open counterparty until that party joins. This spec turns that fact into a rule: any party may start a piece of
work, whoever starts it is only the first participant, and the other side is invited to finish it. The role of a party (customer, vendor, auditor, patient, clinician) belongs
to the party in one loop, not to its account. An invitation carries a task and a preview of the finished work, so that the recipient can finish it as a guest and keeps the
result by signing up. A platform that does this gets a network effect from its own use, and it needs no sales team to start. This spec states what every platform that offers
participation does, in plain domain-free words. What a platform verifies a party against, which journeys it offers first, the legal rules of its field and its targets stay in
the platform's own specs. The terms live in the ontology, which follows this spec once a person has accepted it.

## What participation is

- **FR-001**: A platform MAY offer participation. A platform that does MUST realize it by a named module (a **participation module**), named and coded under
  0049-platforms FR-011 and FR-012, in the platform-services layer, and MUST state in the record of that module the doors it offers (FR-004) and the sources it verifies
  against (FR-013). The module MUST depend only on the governed store, the commitment ledger and governed access, through their published interfaces, and MUST keep no store
  of its own (0049-platforms FR-008, FR-015).
- **FR-002**: A **journey** MUST be a loop of the commitment ledger (0049-platforms FR-022) that any party can start. The party that starts it is the first participant. The
  role of a party (a customer, a vendor, an auditor, a patient, a clinician) MUST belong to that party in that loop and MUST NOT belong to the party's account. One party MAY
  hold different roles in different loops. A role MUST NOT widen what the party's grants cover (0049-platforms FR-033).
- **FR-003**: A **journey kind** MUST be a loop type, held as data (0049-platforms FR-026). Each kind MUST end in a loop with a named counterparty and MUST say what finishing
  it means.
- **FR-004**: A **door** is a place where a journey starts: a public page, an advertisement, a piece of content, an invitation, a listing, or a message from a party's agent.
  The doors MUST be held as data, so that one is added without a change to the core.

## Invitations

- **FR-005**: An **invitation** MUST carry a task and MUST NOT carry an advertisement. It MUST state who sent it, what is to be done, the finished work or a preview of it,
  what the recipient would receive, how to refuse, and when it expires. The recipient MUST be able to finish the task as a **guest**, with no account, and MUST sign up only
  to keep the result.
- **FR-006**: An invitation MUST be sent by a known participant to a party that the sender names, for the purpose of the task. The platform MUST limit how many invitations
  one sender sends, MUST show the sender's identity, MUST give a plain way to refuse and to stop all further invitations, and MUST NOT reveal whether an address is already
  known to the platform.
- **FR-007**: An invitation MUST grant the recipient nothing beyond the task. Data of another party MUST NOT be shown to a recipient until the grants of the party that owns
  the data cover it and the recipient has accepted the terms that apply (0049-platforms FR-033).
- **FR-008**: One invitation MUST work in every direction between any two kinds of party. A handoff that a party sends to another (a referral, an evidence request, a work
  order) MUST be an invitation whose confirmation of receipt is the recipient's first step.
- **FR-009**: A refusal MUST end the invitation for that task and that sender, MUST carry no penalty, and MUST let the recipient block the sender or all invitations.
- **FR-010**: A recipient who keeps the result MUST be able to sign up by a link sent to an address they control, with no password at first. Further factors MAY be required
  as the data they can reach requires (0049-platforms FR-032, FR-033).
- **FR-011**: An invitation MUST NOT be used to advertise a third party, and a platform MUST NOT sell an invitation list.

## Verifying a standing

- **FR-012**: A platform MAY verify the standing of a party in **levels**, held as data: *unverified*, *registered* and *verified*. An unverified party MAY finish a guest task and
  nothing more. A party that owns data, or the platform's own specs, MAY require a level before another party sees that data.
- **FR-013**: A platform that verifies MUST name, in its own specs, each source a level rests on, and MUST say what each level proves and what it does not. A level MUST NOT be
  presented as proving more than its sources prove.
- **FR-014**: What a source returned MUST be kept as an external record reference with its source, the time it was checked and a cadence for checking again
  (0001-eidolon-architecture FR-024). A level MUST drop when a check fails, and the party MUST be told.
- **FR-015**: A party MUST be able to verify itself in a self-service flow through a source it already uses, by a standard sign-in protocol, where that source offers one. The
  source MUST NOT receive data of any other party through the sign-in, and the source's terms MUST be followed.

## Entry content

- **FR-016**: A platform that offers a public door of the page kind MUST generate each page from its catalog (0049-platforms FR-027). A page MUST state the question it answers,
  cite its sources with the date each was checked, carry structured data that a search engine and an answer engine can read, and end in one action: start a journey. A page
  whose source is overdue for checking MUST be marked and MUST NOT be presented as current (0049-platforms FR-028).
- **FR-017**: A page MUST NOT make a claim that its source does not support, and MUST state the evidence status of an item or an approach where the platform's domain requires it.

## Measuring

- **FR-018**: A platform MUST report from the ledger, for each door and each journey kind: journeys started, journeys with a second party, journeys closed, invited parties that
  finished a task, invited parties that signed up, and signed-up parties that started a journey of their own within a stated period.
- **FR-019**: A report under FR-018 MUST NOT carry the identity of a party. A small count MUST be suppressed or combined so that no party is singled out. A measure MUST NOT be
  computed by tracking a party across other sites.
- **FR-020**: A page after sign-in MUST NOT run a third-party advertising or tracking script. Data that the platform's domain calls sensitive MUST NOT be sent to an advertising
  platform, and the domain's specs MUST define what is sensitive.

## Abuse and assurance

- **FR-021**: A platform MUST resist abuse of invitations: limits on one sender, a takedown path, detection of one sender that invites many strangers, and no way to browse or
  harvest a directory of parties through the invitation flow.
- **FR-022**: The assurance environment MUST provide synthetic journeys, invited recipients, parties and sources, so that a journey can run from a door to a closed loop, an
  invitation can be sent, refused and left to expire, and a party can be verified, without real data (0049-platforms FR-019, FR-020).

## What stays in the platform's own specs

- **FR-023**: The sources a level rests on, the journey kinds a platform offers first, the doors it uses, its rules on rewards and on advertising where its field has law about
  them, and its goals and targets MUST stay in the platform's own specs and MUST cite this spec (0049-platforms FR-034, FR-041). A platform MUST NOT reward a party for sending
  an invitation where a rule of its field forbids that, and MUST have that rule reviewed by a person who can decide it before it offers any reward.

## Out of scope

- Whether participation becomes a tenth capability of the kernel (OQ-1).
- The design of a screen, an email or a page.
- Any platform's sources, journey kinds, doors or targets.

## Edge cases

- A party starts a journey for a counterparty that is not on the platform: the invitation carries the task, and nothing of the counterparty's is gathered until it joins, per
  FR-005 and FR-007.
- An invited party finishes the task as a guest and never signs up: the loop closes, they keep nothing, and the sender is told, per FR-005.
- An invited party refuses: the invitation ends and cannot be sent again for that task, per FR-009.
- A sender invites hundreds of strangers in an hour: the invitations are limited and held for review, per FR-006 and FR-021.
- A party has a registry entry whose name does not match: it stays unverified and can finish a guest task only, per FR-012.
- A level's source fails a later check: the level drops and the party is told, per FR-014.
- A page's source is overdue: the page is marked and not shown as current, per FR-016.
- An advertisement script is added to a signed-in page: refused, per FR-020.
- A vendor is asked by a customer for evidence it has already given to another customer: the platform offers the stored answer as the preview of the finished work, and the
  vendor confirms it, per FR-005 and FR-008.
- A platform has no field law about rewards: it still has the rule reviewed before it offers one, per FR-023.

## Assumptions

- A loop with an open counterparty is a reason for the other side to join, and a finished task is a stronger invitation than a message.
- Whether this helps a platform grow is tested by each platform's own bets, not by this spec (0049-platforms FR-034).

## Open questions

- **OQ-1**: Whether participation becomes a tenth capability of the kernel, so that the platform check requires a participation module. The working rule: when a second platform
  realizes this spec and a person accepts it, the kernel is amended.
- **OQ-2**: The terms the ontology needs (the doors, the verification levels, a way for a module to state its doors and sources), and which have an established equivalent. The
  invitation has one in a published vocabulary. The ontology follows once a person accepts this spec (0001-eidolon-architecture FR-037; 0019-controlled-vocabulary FR-004).
- **OQ-3**: Whether the verification levels are exactly three for every platform, or a platform may add a level between them.

## Key entities

- **A participation module** - the module of one platform that keeps journeys, invitations, verification and the doors.
- **A journey** - a loop that any party starts and the other side is invited to finish.
- **A journey kind** - a loop type, held as data.
- **A door** - a place where a journey starts.
- **An invitation** - a task sent to a party, carrying a preview of the finished work.
- **A guest** - a recipient that finishes a task with no account.
- **A level** - unverified, registered or verified: how far a party's standing has been checked, and against which sources.

## Success criteria

- **SC-001**: A journey of each kind of a platform runs from a door to a closed loop in a test.
- **SC-002**: A guest finishes a task from an invitation with no account in a test.
- **SC-003**: An invitation grants no data beyond its task in a test.
- **SC-004**: A refused invitation cannot be sent again for that task in a test.
- **SC-005**: A party's level follows its sources and drops when a check fails in a test.
- **SC-006**: A signed-in page loads no advertising script in a test.
- **SC-007**: A report carries no identity and suppresses a small count in a test.
- **SC-008**: A page with an overdue source is marked in a test.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Plain, literal English for a reader who is not a native speaker
