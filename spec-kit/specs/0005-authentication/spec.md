# Feature Specification: Authentication and authorization

**Spec ID:** 0005-authentication
**Status:** Draft

**Input:** What must be true before a request is evaluated against a content
document's declared audience (0001-eidolon-architecture FR-011 – FR-014),
and how membership in an audience is granted, checked, and revoked — for
requesters outside the vault, per 0004-addressing's deferral.

## Identity

- **FR-001**: A request for anything beyond `Public`-audience content MUST
  be bound to exactly one identified agent before it is evaluated against
  0001-eidolon-architecture FR-011. A request with no identified agent MUST
  be treated as satisfying only the `Public` audience.
- **FR-002**: How an agent's identity is established — the specific
  authentication mechanism — is not specified here. This spec constrains
  what must be true of the result, not how the result is produced.

## Grants

- **FR-003**: Membership in any audience other than `Public` MUST be
  represented as a Grant: an explicit link from an identified agent to a
  specific audience, valid from a given date and, where applicable, until a
  given date.
- **FR-004**: A request MUST be evaluated only against the agent's currently
  valid grants at the time of the request. A grant that has not yet started,
  or has already ended, MUST NOT be counted.
- **FR-005**: Grant membership MUST be checked fresh on every request. It
  MUST NOT be cached for a session's lifetime in a way that would let a
  revoked grant keep authorizing requests until the session separately
  expires.
- **FR-006**: Creating or revoking a grant is a decision and MUST follow
  0001-eidolon-architecture's decision-authority rules (FR-029, FR-030) —
  by default, the founder, unless delegated.

## Sessions

- **FR-007**: A session MAY persist an agent's proven identity for a bounded
  period, so identity does not need re-proving on every request. A session
  MUST NOT persist which audiences the agent satisfies — that is
  re-evaluated per FR-005 on every request.
- **FR-008**: Every session MUST expire. A session with no expiry MUST NOT
  be issued.
- **FR-009**: No session token, password, or other authentication
  credential MAY be stored as a literal in any Eidolon repository, public
  or private — consistent with 0001-eidolon-architecture FR-023's treatment
  of credentials generally.

## Accountability

- **FR-010**: Access to any content beyond the `Public` audience MUST be
  logged: which agent, which document, and when.
- **FR-011**: An access log entry is itself subject to the same
  confidentiality rules as any other fact (0001-eidolon-architecture
  FR-011) — a record of who viewed what MAY itself need restricting,
  depending on what was viewed. Where and how logs are stored is
  implementation detail; log entries are not committed to any Eidolon
  repository as ontology data.

## Out of scope

- The specific authentication mechanism (password, SSO, magic link, or
  anything else) a requester uses to establish identity.
- The specific technology used to store sessions, grant records, or access
  logs.
- A vault member's direct access to the `eidolon` repository — governed
  already by 0001-eidolon-architecture FR-008 and FR-009, not by this spec.

## Edge cases

- A grant is revoked while an agent's session is still open: the next
  request is evaluated only against grants valid at that moment, so the
  revoked grant no longer counts, per FR-004, FR-005, and FR-007.
- A grant whose start date has not yet arrived: it is not counted for any
  request until that date, per FR-004.
- A session has expired and the requester proves no identity again: the
  request has no identified agent and satisfies only the `Public`
  audience, per FR-001 and FR-008.
- A request for `Public`-audience content only: it needs no identified
  agent and no access log entry, per FR-001 and FR-010.
- A vault member reaches content through a mediated request rather than
  through the repository: the request is evaluated against grants like
  any other, per FR-003; clone access is governed separately, per
  0001-eidolon-architecture FR-008 and FR-009.

## Assumptions

- Content beyond the `Public` audience reaches an outside requester only
  through a service that evaluates each request, never as a file read
  directly from a repository.
- An established identity belongs to one agent and is not shared among
  several people.
- The service evaluating a request has a trustworthy clock to compare
  against grant dates and session expiry.

## Open questions

- **OQ-1**: No mechanism yet defines how an agent is notified before a
  time-bound grant expires, or whether renewal requires a fresh decision
  under FR-006.
- **OQ-2**: No requirement states whether a request for content beyond
  the `Public` audience may proceed when its access cannot be logged
  under FR-010.

## Key entities

- **An identified agent** — a requester whose identity has been established
  for the current request, distinct from the audiences they may or may not
  satisfy.
- **A grant** — an explicit, time-bounded link between an identified agent
  and a specific audience.
- **A session** — a bounded-lifetime proof of identity; never a cache of
  audience membership.

## Success criteria

- **SC-001**: A request with no identified agent is evaluated only against
  `Public`-audience content.
- **SC-002**: Revoking a grant blocks the very next request that depends on
  it, without waiting for any session to expire.
- **SC-003**: No credential, session token, or password appears as a
  literal value in any Eidolon repository.
- **SC-004**: Every grant has a start date; a grant with an end date is not
  counted for any request after that date.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (a specific auth provider, a specific session
      store) — those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
