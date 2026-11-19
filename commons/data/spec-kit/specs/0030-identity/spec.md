# Feature Specification: Identity

**Spec ID:** 0030-identity
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** What a modern B2B or B2B2C identity system (WorkOS, Okta, Auth0, and identity, credential and access management in general) has to keep: who may do what, how they prove who they are, from where, for how long, and what was done. This is the core of that, as a module (0028-modules) on top of Arca's party model (0004-arca) and tenancy (0029-arca-tenancy): principals (of five kinds, 0032), user accounts and memberships of tenants, groups, credentials (passwords, passkeys, one-time-code secrets, recovery codes), challenges and sign-in attempts, devices, sessions and refresh tokens, invitations and verified domains, the policies for passwords, lockout, sessions and second factors, and an audit trail kept in a chain of hashes. Role-based, attribute-based and relationship-based access, machines, devices, delegation and AI agents are modules of their own on top of this one (0032 to 0043); federation, OAuth and privileged access are still to come. Secrets are never kept in the clear: a password is a hash, a one-time-code secret is ciphertext under a key held outside the database, a token or a challenge is a hash of a secret that was shown once. Short-lived things (sessions, tokens, challenges, attempts, devices) say how long they are kept. Every concept says how private and how secret it is. The standards it is written towards (NIST SP 800-63, ISO/IEC 27001, OpenID Connect, OAuth 2.0, SAML 2.0, SCIM, WebAuthn, TOTP) are references, not claims of conformance. The stored procedures and functions that do the business operations are a later specification.

## The module

- **FR-001**: The identity core MUST be a module (0028-modules) named `identity` that requires `arcaParty` and `arcaTenancy`, holds the concepts of FR-002 and FR-005 to FR-010, and is composed with the modules of access, attributes, relationships, keys, machines, devices, delegation and agents (0034 to 0043) that a project needs, into one domain that projects and binds for each of the three dialects and loads into the real engines, with no table of a module that is not listed.
- **FR-002**: A user account MUST be identified by its principal, refer to the person (Arca's) it is for and optionally to a home tenant, and have a login identifier unique within its home tenant; a membership MUST place a user in a tenant once; a group MUST be a principal in a tenant with a unique name, whose members are principals of any kind, once each; and a contact verification MUST say when and how an address was proved to be a person's.

## Vocabulary

- **FR-004**: Every kind, status and method that the concepts name MUST be a code list with a definition of each code, closed unless it says it is open, so that a value outside it is refused by the database.

## Credentials

- **FR-005**: A credential MUST belong to a principal and have a kind and a status; a password credential MUST hold only a hash that carries its algorithm, parameters and salt; a passkey MUST hold the public key and what an authenticator says of itself, with its credential identifier unique; a one-time-code secret MUST hold ciphertext and the name of the key that encrypted it, and the time step of the last code taken so that none is taken twice; a recovery code MUST hold a hash and when it was used; a challenge MUST hold a hash, how many times it was tried and when it stops being valid; and a sign-in attempt MUST hold the identifier only as a hash, so that an unknown user leaves nothing personal.
- **FR-006**: A device MUST hold a hash of what the browser says it is; a session MUST say who is signed in, to which tenant, from which device, how sure it is of who it is for (assurance level), how it was authenticated, when it ends if unused and when whatever, and why it was ended early; a refresh token MUST hold a hash, be unique, belong to a family of tokens rotated from one issue, and say which token replaced it, so that a reuse can end the family and the session.
- **FR-007**: Every concept that holds a secret in any form (a name that holds `secret`, `token` or `ciphertext`, or a hash that is the whole of a credential) MUST be classified `restricted`; and no concept MUST hold a password, a token or a key in a form that is not a hash, ciphertext or a public key.

## Invitations and domains

- **FR-008**: An invitation MUST say the tenant, the address it was sent to, a hash of its secret, where it is, when it stops being valid and who took it up, and the roles it grants (a role once); a domain claim MUST say how it is to be proved and when it stops being valid; a verified domain MUST be unique across every tenant and say what it means for those who sign in with it.

## Policies

- **FR-009**: Policies MUST be typed concepts (not a bag of settings) for passwords, lockout, sessions and second factors, each of a tenant or, with no tenant, of the platform.

## Audit

- **FR-010**: An audit event MUST say when, who (a principal, where there is one, and what kind of actor), what was done, how it ended, what it was done to (a loose reference, so that the trail outlives what it names) and the hash of the event and of the one before it in the chain, unique.

## Privacy, classification and keeping

- **FR-011**: Every concept MUST carry a classification and the requirement it cites; every attribute that holds something personal (a name, a login identifier, an address, an IP address, a browser's fingerprint or user agent) MUST carry its category and purpose; and every concept of short-lived data (challenge, sign-in attempt, device, session, refresh token, audit event) MUST say how many days it is kept.

## Out of scope

- The operations (create a tenant, invite a user, rotate a refresh token, check a permission): a later specification.
- Federation, OAuth, machine identities, privileged access: modules of their own.
- Enforcing that a secret is never in the clear by the engine: a vocabulary term for how a secret is stored, and a lint, are a later specification; for now the model says it in definitions and this one checks the names.
- Conditional uniqueness (one pending invitation per tenant and address) and exactly-one-of rules over relationships: governance cannot say them; they are preconditions of the operations.
- No JWT access token is stored: they are short-lived and stateless.

## Edge cases

- A user who joins several tenants: one account, a membership of each, per FR-002.
- A deleted user: the row stays with what is personal erased, so that the audit trail still refers to it (an operation), per FR-010.

## Assumptions

- The application makes identifiers, hashes and ciphertext; the database stores them.

## Open questions

- **OQ-1**: A vocabulary term for how a secret is stored, and one for append-only concepts (the audit trail) that the access extension would turn into `INSERT`-only grants.
- **OQ-2**: Whether the uniqueness of a role grant (principal, role, tenant, resource) can be said where two members are optional.

## Key entities

- **Principal** - a user, a service account or a group.
- **Credential** - what a principal proves itself with, in the form of its kind.
- **Session** - a principal's being signed in.
- **Audit event** - something that was done, in a chain.

## Success criteria

- **SC-001**: A project can store what Okta, Auth0 or WorkOS store for a B2B or B2B2C customer, with no secret in the clear and nothing kept longer than it is of use.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
