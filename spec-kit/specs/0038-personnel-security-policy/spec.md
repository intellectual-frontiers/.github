# Feature Specification: Personnel security policy

**Spec ID:** 0038-personnel-security-policy
**Status:** Draft

**Input:** What the company asks of the people who work on systems in a
compliance boundary: conduct, conflicts of interest, screening, training,
and what happens when they join and leave. Everything here concerns real
people, so every record of it is held outside the Eidolon, and only
counts and references are held inside it (0030-policies FR-011). It is a
policy under 0030-policies, owned by the decision authority in effect.

## Conduct

- **FR-001**: Each person a policy binds (0030-policies FR-009) MUST
  acknowledge the company's code of conduct, with the policies, before
  their first access and again each year. The code states the company's
  expectations of integrity, confidentiality, and the fair treatment of
  others.
- **FR-002**: Each person MUST disclose any conflict of interest when they
  join and whenever one arises. A disclosure MUST be decided on by the
  decision authority in effect, and that decision MUST be recorded
  outside the Eidolon.
- **FR-003**: A breach of a policy or of the code MUST be handled through a
  documented process that a person decides. The outcome is held outside
  the Eidolon.

## Joining

- **FR-004**: Each person MUST sign a confidentiality agreement before
  their first access to anything beyond Public data.
- **FR-005**: Each person MUST be screened, as far as the law where they
  work allows, before their first access to a system holding Restricted
  data, federal contract information, or health information
  (0033-systems-and-data-policy FR-002). The screening is proportionate
  to what they will be able to reach.
- **FR-006**: Each role MUST have its security responsibilities stated,
  where the person in it can read them.

## Training

- **FR-007**: Each person MUST complete security awareness training before
  their first access, and again each year. The training covers phishing,
  handling each data class, reporting incidents
  (0035-incident-response-policy FR-002), and these policies. A person
  with administrative access, or who changes software, MUST also complete
  training for that role each year.

## Leaving

- **FR-008**: When a person leaves, their access MUST be removed under
  0031-access-control-policy FR-005. Company devices and media MUST be
  returned or wiped (0032-endpoint-and-media-policy FR-005), and the
  person MUST be reminded of their continuing confidentiality
  obligations.

## Records

- **FR-009**: Records of acknowledgment, disclosure, screening, training,
  and leaving MUST be held outside every Eidolon repository, each
  represented only by a `RestrictedDataReference`. The Eidolon MAY state,
  for each requirement here, how many people have met it and how many
  have not yet, with the date of the count.

## Carried out by

- The vault circle's confidentiality agreements and reviews are the
  vault's own governance; its rules are held in the vault.
- How acknowledgments are counted: 0030-policies FR-010 and FR-011.
- Access is removed within a day of leaving:
  0031-access-control-policy FR-005.

## Out of scope

- Employment terms, pay, and benefits, which are personal financial terms
  under 0001-eidolon-architecture FR-016(d).
- Disclosure of a published work's funding. That belongs to the Press's
  own rules.

## Edge cases

- A contractor starting next week on a system holding federal contract
  information: they sign a confidentiality agreement, are screened, and
  are trained before their first access, per FR-004, FR-005, and FR-007.
- A person with a stake in a vendor the company is considering: they
  disclose it, and the decision authority decides on it, per FR-002.
- A country whose law forbids a criminal record check: the screening is
  only as far as that law allows, per FR-005.
- A person who has not completed this year's training: they appear in the
  count of people who have not yet met FR-007, never by name, per FR-009.
- A person leaving with a company laptop: it is returned or wiped, per
  FR-008.

## Assumptions

- The company uses a system, outside the Eidolon, to keep personnel
  records and training completions.

## Open questions

- **OQ-1**: What screening covers for each data class, and who performs
  it, is not yet stated.
- **OQ-2**: Which training the company provides, and how completion is
  recorded, is not yet stated.
- **OQ-3**: Whether the code of conduct is a spec in this repository, or
  a document held elsewhere and cited, is not decided.

## Key entities

- **The code of conduct**: the company's expectations of the people who
  work for it.
- **A disclosure**: a person's statement of a conflict of interest, and
  the decision on it, held outside the Eidolon.
- **A training completion**: a person's completion of security training,
  counted but never named in the Eidolon.

## Success criteria

- **SC-001**: No person reaches anything beyond Public data before signing
  a confidentiality agreement and completing training.
- **SC-002**: No personnel record appears in any Eidolon repository.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
