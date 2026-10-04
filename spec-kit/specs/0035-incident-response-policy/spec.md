# Feature Specification: Incident response policy

**Spec ID:** 0035-incident-response-policy
**Status:** Draft

**Input:** How the company recognizes, records, contains, and learns from
security incidents in a compliance boundary, and how it meets the
notification deadlines its contracts and the law set. It is a policy under
0030-policies, owned by the decision authority in effect. Incident
details are sensitive more often than not, so the Eidolon records that an
incident happened and what it touched, never its specifics.

## Recognizing and reporting

- **FR-001**: An incident is any event that compromises, or may have
  compromised, the confidentiality, integrity, or availability of a
  system or data in a boundary. Examples:
  - a lost device;
  - an exposed credential;
  - access by someone not authorized;
  - malicious code;
  - a vendor's breach that reaches the company's data;
  - data found in a system not declared for its class.
- **FR-002**: Anyone a policy binds (0030-policies FR-009) MUST report a
  suspected incident, as soon as they notice it, to the incident contact
  the company publishes internally. A report made in good faith MUST NOT
  be held against the person who made it.

## Recording

- **FR-003**: Each incident MUST be recorded as an incident record. The
  record names the boundary, the systems affected, the data classes
  involved (0033-systems-and-data-policy FR-002), its severity from the
  ontology's incident severity scheme, and when it was discovered,
  contained, and closed. Anything that names a person or would be
  sensitive under 0001-eidolon-architecture FR-016 MUST be held only by
  `RestrictedDataReference`.
- **FR-004**: Each incident MUST be triaged within one day of its report:
  given a severity, an owner role, and the notification obligations it
  may trigger (FR-005).

## Notification deadlines

- **FR-005**: Each obligation to notify someone of an incident within a
  set time MUST be recorded as ontology data, naming its source, what
  triggers it, whom it requires notice to, and its deadline. Sources
  include a contract, a business associate agreement, a law, and a
  regulation, such as DFARS 252.204-7012's seventy-two hours for covered
  defense information. When an incident may trigger an obligation, the
  obligation's deadline runs from the incident's discovery, and the
  compliance status report MUST show it until it is met or decided not
  to apply.
- **FR-006**: Whether to notify, and what a notice says, MUST be decided
  by the decision authority in effect and recorded as a `Decision`. No
  tool MAY send a notice by itself.

## Containing and recovering

- **FR-007**: An incident MUST be contained before the systems it affected
  return to normal use. A credential it may have exposed MUST be rotated,
  and a repository it affected is handled under
  0001-eidolon-architecture FR-036.
- **FR-008**: Logs and other evidence about an incident MUST be kept until
  its review is complete (FR-009), and longer wherever an obligation
  requires it.

## Learning

- **FR-009**: An incident of high or critical severity MUST be reviewed
  within thirty days of being contained. The review MUST be recorded as a
  `Decision` that names the incident by `schema:about`, and states its
  cause and the changes that prevent it from recurring. Each change is
  made as a spec amendment or a disposition, never only as a note.
- **FR-010**: This policy MUST be exercised at least once a year, through
  a walk-through of a plausible incident, and each exercise MUST be
  recorded as evidence (0028-compliance-controls FR-018).

## Carried out by

- An exposed secret is removed from history and rotated:
  0001-eidolon-architecture FR-036.
- Domain security failures are reported to the decision authority:
  0023-domain-security FR-018.
- Certificates issued for company domains are watched:
  0023-domain-security FR-023.

## Out of scope

- How the incident contact is reached, which is internal.
- The content of any notice, which is decided case by case, per FR-006.

## Edge cases

- A personal laptop holding company email is stolen: it is an incident,
  and it is reported, recorded, and the device wiped, per FR-001 through
  FR-003 and 0032-endpoint-and-media-policy FR-004.
- An API token is pasted into a public chat: the token is rotated before
  anything else returns to normal, per FR-007.
- A vendor reports a breach of its own systems: it is an incident for the
  company if the company's data was in them, per FR-001.
- A customer contract requiring notice within forty-eight hours: the
  obligation is recorded with its deadline, and the report shows it from
  discovery until it is met, per FR-005.
- An incident whose details name an employee: the record says what
  happened by role, and the details stay outside the Eidolon, per FR-003.
- A low-severity incident: it is recorded and triaged, and needs no
  thirty-day review, per FR-003, FR-004, and FR-009.

## Assumptions

- The company can publish an incident contact internally that is
  monitored every day.
- Each notification obligation the company has accepted is known when the
  contract containing it is signed.

## Open questions

- **OQ-1**: Who the incident contact is, and who covers when the decision
  authority is unreachable, is not stated. The second part is
  0001-eidolon-architecture OQ-1.
- **OQ-2**: The definitions of each incident severity level are not yet
  stated.

## Key entities

- **An incident record**: what happened, to which boundary and systems,
  how severe it was, and when it was discovered, contained, and closed.
- **A notification obligation**: a deadline for telling someone about an
  incident, with its source and trigger.
- **An incident review**: the cause of a serious incident, and the changes
  that prevent it from recurring.

## Success criteria

- **SC-001**: Every incident is triaged within a day of its report.
- **SC-002**: No notification deadline passes unseen.
- **SC-003**: Every high or critical incident leads to a recorded change.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
