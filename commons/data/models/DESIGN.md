<!-- Design proposal from the research of the Universal Data Models and identity systems; the specs numbered 0024 onward in it are renumbered in the data spec-kit: 0028 is modules. -->
# New Arca data models, composability, identity and operations: design

Status: proposal for review. Nothing in `/home/user/.github` was changed. Everything said about the library below was read from `commons/data` at the time of writing (paths are relative to it); everything said about Silverston's books comes from the public outlines listed in section 8, in my own words.

## 1 Summary and recommendation

**What exists today (read, not assumed).**
- Arca is a plain governance value, `partyDomain: Result<Domain, DomainError[]>` (`models/arca/party.ts`), exported by one `exports` entry (`./models/arca`). It is **not** an engine extension: nothing registers it, `compose` never sees it, and no contribution point takes a domain.
- `domain()` accepts a relationship only to a concept of the *same* domain (`concepts.includes(target)`, else `unresolved`), and a code attribute only to a code list of the same domain. `projectDomain(domain, projection)` takes exactly one `Domain`. Element identity is domain-qualified (`conceptId(domainName, conceptName)`), and 0001-layers FR-004 says a model imports governance and the engine only, so one model may not import another.
- The engine (`engine/compose.ts`) does have what composability needs for *extensions*: `requires`, topological order, `missing`/`cycle`/`duplicate` errors as values, lazy activation, and an explicit list with no scanning (0002 FR-005).
- Routines (0009 FR-011 to FR-013, `sql/extensions/routines`) are PostgreSQL only: the dialect feature `routines` is declared by `dialects/postgres` alone, DuckDB and SQLite return an error value ("has no routines"). A body is text plus typed references; the SQL between references is not read. They are repeatable statements of the group `routine` (0011 FR-009), and the suite runs one on PGlite (`suite/features.test.ts`).
- The lifecycle `Driver` has `exec(sql)` and `query(sql)` with **no bind parameters**.

**Recommendation in one paragraph.**
1. Make every subject area a **module**: one folder in `models/`, one domain, one engine extension that `requires` only `arca-party` and named modules. Add a contribution point for modules and a `composeDomains` function that merges the *selected* modules into one domain keeping each element's original identity. A project selects modules by listing them; unselected tables are never projected, so never created. No pruning step is needed. (Spec 0024.)
2. Cross-module references are allowed only downward along `requires`; optional links between two peers (invoice to order) live in a small **bridge module** that requires both, never as an optional column in either. Tenant scoping is a **composition-time overlay**, not a dependency of every module.
3. Build **identity** as a core module (`identity`) plus four optional modules (`identity-federation`, `identity-oauth`, `identity-machine`, `identity-privileged`) on top of `arca-party` and a small `arca-tenancy`. A principal supertype (user, service account, group) plays the role `party` plays in Arca.
4. **Operations**: do not put bodies in governance and do not make stored procedures the main path. Declare each operation's **contract** in governance (typed inputs and outputs, what it reads and writes, permission it needs, audit event it emits). Implement **reads** as declarative typed queries rendered per dialect (PostgreSQL function, DuckDB table macro, and for SQLite a prepared statement in the generated client, which is also the path on every engine). Implement **commands** (anything with branching or several writes) as TypeScript transaction scripts over the typed row API and a parameterised driver, run in one transaction on all three engines. PostgreSQL procedures stay what 0009 made them: a hand-written, opt-in escape hatch for callers that may not hold table rights, checked against the TypeScript command by a differential test on PGlite.
5. Build order: modules (0024), vocabulary gaps (0025), tenancy and scope overlay (0026), identity core (0027), operations contract and runtime (0028, 0029), then the other modules by value (section 6).

The contrarian points I would defend: (a) no auto-resolved dependencies and no optional columns across modules; (b) `tenant` is an overlay, so ledger and catalog do not import identity-shaped things; (c) not a single business rule of identity is written in plpgsql first; SQL is good at set-based reads and bad at portable control flow; (d) store no JWT access tokens, no plaintext of any secret, and make audit append-only and hash-chained like the lifecycle ledger (0011 FR-010).

## 2 Module map

Silverston's models, summarised from the outlines (section 8): Volume 1 covers parties, products, orders, shipments, work efforts, invoicing, accounting and budgeting, human resources; Volume 2 is industry models (manufacturing, telecoms, health care, insurance, financial services, professional services, travel, retail e-commerce); Volume 3 is a library of patterns (roles, classification, contact mechanisms and the like). Arca already holds the Volume 1 party chapter: party, person, organization, party role, relation, identifier, electronic contact, postal address. Not taken: human resources (employment is not general B2B/B2B2C), shipments (physical goods; add later as a bridge), data warehouse chapters (the library has `transforms`), and all of Volume 2 (industry packs, later, each its own module family).

Naming rule: a concept name is unique across the modules a project might compose (the logical projection reports a `collision` otherwise), so each module prefixes where a bare word is likely to clash (`userAccount`, `oauthConsent`, `ledgerEntry`, `orderItem`).

| Module (folder, domain) | Subject area | Key concepts | Depends on |
|---|---|---|---|
| `arca-party` (exists, `arcaParty`) | people, organizations, roles, relations, identifiers, contact points, addresses | party, person, organization, partyRole, partyRelation, partyIdentifier, electronicContact, postalAddress | none |
| `arca-tenancy` (`arcaTenancy`) | isolation boundary and hierarchy for B2B and B2B2C | tenant, tenantKind (platform, reseller, business, consumerPool), parent link, path | arca-party |
| `identity` (`arcaIdentity`) | who may do what, proved how | section 4 | arca-party, arca-tenancy |
| `identity-federation` | IdPs, SSO, directory sync | identityProvider, federatedIdentity, directory, directoryUser, directoryGroup | identity |
| `identity-oauth` | OAuth 2.x/OIDC provider side | oauthClient, resourceServer, oauthScope, oauthConsent, authorizationCode | identity |
| `identity-machine` | service accounts, API keys, workload identity | serviceAccount, apiKey, workloadBinding | identity |
| `identity-privileged` | JIT/elevated access, impersonation, risk | privilegedGrant, impersonation, riskSignal | identity |
| `arca-consent` | purposes, consent and data-subject requests | consentPurpose, consentRecord, dataSubjectRequest | arca-party |
| `arca-catalog` | what is sold or offered | product, productKind, category, categoryMember, feature, productFeature, productAssociation (bundle, substitute), priceComponent, priceList | arca-party (suppliers, manufacturers) |
| `arca-order` | quotes and orders | quote, quoteItem, order, orderItem, orderRole, orderAdjustment, orderStatusHistory | arca-party, arca-catalog |
| `arca-agreement` | contracts and terms | agreement, agreementKind, agreementItem, agreementRole, term, termKind | arca-party |
| `arca-billing` | invoices and payments | invoice, invoiceItem, invoiceRole, payment, paymentMethod, paymentApplication, billingAccount | arca-party |
| `arca-subscription` | recurring plans and usage | plan, planPrice, subscription, subscriptionItem, usageRecord, renewal | arca-party, arca-catalog, arca-billing |
| `arca-ledger` | accounting and budgets | ledgerAccount, accountingPeriod, journalEntry, journalLine, budget, budgetLine | arca-party (internal organization) |
| `arca-work` | tasks, projects, time | workEffort, workEffortKind, assignment, dependency, timeEntry | arca-party |
| `arca-facility` | physical and logical places | facility, facilityKind, facilityRole, geographicArea | arca-party |
| `arca-content` | documents and versions | document, documentVersion, documentLink, documentRole | arca-party |
| `arca-communication` | interactions | communicationEvent, communicationEventRole, supportCase | arca-party |
| bridges: `arca-order-billing`, `arca-order-agreement`, `arca-billing-ledger`, `arca-subscription-ledger` | the optional links | link concepts only (invoice-from-order, posting-of-invoice) | the two modules each names |

Decisions behind the table:
- **Ledger does not know invoices.** Silverston links billing to accounting through posting rules; here `arca-billing-ledger` holds `ledgerPosting(source concept name, source key, journalEntry)`. A loose reference (concept name plus key text) is acceptable in a bridge only; core modules never use polymorphic references except `auditEvent`.
- **Subscription is separate from billing.** A project that invoices by hand needs billing and not plans.
- **Consent is separate from identity.** Authentication needs no marketing consent; a B2C project wants consent without a login system.
- **Tenancy is its own module** because order, billing and content all want a scope, and none should import `identity`.

## 3 Composability design

### 3.1 The module manifest (what must be built)

A module is an engine extension with a typed payload. In governance (layer 1, imports the engine only):

```ts
// governance/module.ts (proposed)
export interface ModuleDef {
  readonly name: string;               // "identity" -- also the domain name, so element identities never change
  readonly domain: Domain;             // its own concepts, code lists, annotations
  readonly requires: readonly string[];// module names, mirrored into the extension's `requires`
}
export const modulePoint = point<ModuleDef>("governance.module");
```

A model folder exports `export const extension = defineExtension({ id: "model.identity", version, requires: [extensionId("model.arca-party"), extensionId("model.arca-tenancy")], contributes: [contribute(modulePoint, { name: "arcaIdentity", domain, requires: [...] })] })`. `compose` already reports a missing dependency, a cycle, a duplicate and a wrong contract version as values, so *the dependency expression needs no new engine code*; only the point and the composer below are new.

0001-layers FR-004 must be amended: a model may import the public surface of another model that it `requires`; imports among models stay acyclic, and the layers check (`tools/layers.ts`) learns the rule (`layers/around` is the finding today).

### 3.2 Merging (what must be built, why)

Today a project could write `domain("app", { concepts: [...partyDomain.concepts, ...identity.concepts], codeLists: [...] })`. It type-checks and passes `domain()` because the concept values are shared objects, **but** it re-qualifies every element identity to `app.*`, breaking 0001 FR-006 ("identity never changes") and every `renamedFrom`/lifecycle match, and it drops the domain-level annotations (`ownership.owner`, `quality.audited`) of each module.

Build `composeDomains(name, modules)` returning `Result<Domain, ComposeDomainError[]>`:
- The result `Domain` gains `parts: readonly { module: string; concepts; codeLists; annotations }[]` and `elementsOf`, `project` and `conceptId` take the identity from the part, not from the composed name. (This touches `governance/elements.ts`, `model.ts` and `sql/logical/project.ts`; it is the one invasive change.)
- `domain()` validates relationships and code lists against the union of the parts, and **each cross-part reference must point to a part the referencing module `requires`** (error `undeclaredDependency`).
- Errors as values: duplicate concept name across parts, module missing, cycle (already by `compose`), a module requiring a version range the composition does not have.
- Domain-level annotations stay per part (an `audited` of one module does not apply to another).

### 3.3 Selecting modules; unselected tables are not created

The project's list is the selection:

```ts
const c = compose([partyExt, tenancyExt, identityExt, catalogExt /* no order, no billing */]);
const modules = c.value.contributions(modulePoint);
const app = composeDomains("shop", modules);   // only these parts
const projected = projectDomain(app.value);    // only their tables
```

Because projection starts from the composed domain, a table of a module that was not listed never exists in the logical schema, so no statement is bound for it. There is nothing to prune and nothing that could leave an orphan foreign key (a missing required module is a compose error before any projection). The engine rule that nothing is auto-added (0002 FR-005) stays. For convenience, models export `withRequired(...names)` returning the closure in order, so a project can write one name and see the full list it gets; it is a plain function, not engine magic.

Contrarian points:
- **No optional references.** If invoice could optionally point at order, the invoice table would carry a column to a table that may not exist. Use bridge modules (section 2).
- **Schema per module is rejected for v1.** 0013 gives qualified names, but SQLite and DuckDB would write the prefix into names; keep the one-namespace rule and the `collision` check, and add a lint rule (`module/name-prefix`) for clashes.
- **Removing a module later** is a plan of `destructive` table drops (0011 FR-006); the safety extension (0015, quarantine) already turns them into renames away first. Say so in the spec; build nothing.

### 3.4 Subsets of an existing domain (exists? no)

Governance has no subset function; the logical projection filters nothing. A projection is a function `Domain -> Projected` and one *could* wrap `normalized` and filter tables afterwards, but foreign keys and the report of the flow (0006) would then lie. Build instead `subsetDomain(domain, conceptNames)` in governance: it returns a domain of the named concepts plus those they identify by or require (closure over `identifiedBy` and required relationships) and the code lists they use, as an error value naming what an excluded concept needed. Size S, in 0024. This lets a project adopt `party` and `person` without the rest of Arca. It is secondary to modules: modules are the contract, subsets are a convenience.

### 3.5 Tenant scope as an overlay

`security.scope` is an attribute annotation and 0009 FR-008 turns it into row security. If every module declared a `tenant` relationship, every module would depend on `arca-tenancy` and a single-tenant project would carry the column anyway. Instead `composeDomains` accepts `overlays: [scoped({ by: tenantConcept, as: "tenant", concepts: [...] })]` which, at composition time, adds a required relationship `tenant` and `security.scope` (name `tenant`) to the named concepts (default: every concept whose module declares `scopeable: true`). Unscoped projects skip it; the model source stays tenant-free. Size M, in 0026.

## 4 Identity model (`arcaIdentity` and its optional modules)

Conventions (same as `arca-party`): names lower camel case; every element has a definition; each personal attribute has `privacy.personal` with a DPV-PD category and purposes; each concept has `security.classification`; ownership `arca`; domain `quality.audited` with removal `mark` except where stated; every concept cites its spec requirements. Time columns are `instant()`; sensitive booleans and codes are code lists. A key under "Notes" is what governance can express today unless flagged **gap**.

Standards are references only; none is implemented by this text: NIST SP 800-63-4 (identity proofing, authenticators, federation assurance: IAL, AAL, FAL; 800-63B guidance against forced periodic password change and for breached-password checks), ISO/IEC 27001 Annex A access control and logging, ICAM/FICAM (identity, credential and access management as a federal practice), OpenID Connect Core, OAuth 2.0 (RFC 6749) and its Security Best Current Practice (refresh token rotation, PKCE), SAML 2.0, SCIM (RFC 7643, 7644), WebAuthn, TOTP (RFC 6238), SPIFFE, and Google's Zanzibar paper for relationship-based access. These are cited from general knowledge, not fetched for this document.

### 4.1 `arca-tenancy` (prerequisite)

- `tenant`: tenantId, kind (`tenantKind`: platform, reseller, business, consumerPool), slug (unique), displayName, organization (relationship to Arca `organization`, optional: a consumer pool has none), parent (relationship to tenant, optional), ancestry (text, materialized path for subtree queries; maintained by the operation that moves a tenant), status (active, suspended, closed), isolation (shared, dedicated), createdAt. Unique: slug. Differs: tenant and parent (`quality.differs`). Notes: depth limit and acyclicity are an operation precondition (**gap**: no acyclic-hierarchy annotation; keep as lint in the operation's contract).
- Mapping of other products' words: a WorkOS organization or an Okta org maps to a `business` tenant; an Auth0 tenant is an environment (put `environment` in deployment configuration, not data); a B2C user pool of a B2B customer is a `consumerPool` tenant whose parent is that business. The platform vendor is the root `platform` tenant.

### 4.2 `identity` core

**Principals and accounts**
- `principal` (supertype, like `party`): principalId, kind (`principalKind`: user, serviceAccount, group), displayName (personal, Name, only for users), createdAt. Everything that can be granted a role, own a key or appear as an actor references `principal`. Classification confidential.
- `userAccount` (identified by its principal): person (relationship to Arca `person`, one), homeTenant (relationship to tenant, optional: set for per-pool users, empty for global users who join tenants by membership), loginIdentifier (text, personal AccountIdentifier, unique with homeTenant), primaryEmail (relationship to `electronicContact`, optional), status (`userStatus`: pending, active, suspended, locked, deprovisioned, deleted), lockedUntil, lastAuthenticatedAt, createdVia (invited, selfSignup, directory, federated, admin), locale, timeZone. Classification confidential. Notes: global-identity-with-memberships is the default; per-pool users use `homeTenant`. A deleted user keeps the row with personal fields erased (operation), because audit refers to it.
- `contactVerification`: electronicContact, verifiedAt, method (emailLink, otp, directoryAsserted, admin), unique per contact. Arca's `electronicContact` has no verified flag, so identity adds it without changing Arca.
- `membership`: userAccount, tenant, status (invited, active, suspended, removed), source (invited, directory, domainCapture, selfJoin, admin), joinedAt, removedAt. Unique (userAccount, tenant).
- `group`: identified by its principal (kind group): tenant, name, source (local, directory), externalId (optional, from a directory). Unique (tenant, name).
- `groupMember`: group, member (relationship to principal: user or nested group), addedAt. Unique (group, member). Notes: nesting depth is an operation limit; **gap**: no no-self-membership annotation beyond `differs` (use it).

**Authorization**
- `permission`: permissionKey (text, `resource:action`, unique), definition, ownerModule (text). Open code-like list stored as rows so each module registers its own.
- `role`: tenant (optional: empty means a system role usable everywhere), key, name, isSystem, definition, kind (`roleKind`: system, custom). Unique (tenant, key).
- `rolePermission`: role, permission. Unique pair.
- `roleAssignment`: principal, role, tenant (scope of the grant), resourceType and resourceId (optional text: a grant limited to one resource), validFrom, validTo (optional), grantedBy (principal), reason (optional). Unique (principal, role, tenant, resourceType, resourceId) (**gap**: uniqueness with nullable members; set empty-string sentinels in the operation or a sentinel code).
- `entitlement`: tenant, featureKey, limitValue (optional integer), validFrom, validTo (optional), source (text: a plan, a contract). Decides what a tenant may use as distinct from what a user may do.
- ABAC hook: `accessPolicy`: tenant (optional), name, effect (allow, deny), resourceType, action, condition (text), conditionLanguage (code: cedar, cel, rego, jsonLogic), priority, status, version. Evaluated by the application, not by SQL; the table stores and versions the text.
- ReBAC: `authorizationModel`: tenant (optional), version, definition (structured, the type and relation definitions in the Zanzibar style), status. `relationTuple`: tenant, objectType, objectId, relation, subjectType, subjectId, subjectRelation (optional), createdAt. Unique over all of them. Indexed by (objectType, objectId, relation) and by subject (`usage.lookup`). Notes: the check algorithm is an operation, never a view.

**Credentials (secrets never in the clear)**
- `credential` (supertype): principal, kind (`credentialKind`: password, passkey, totp, securityKey, smsOtp, emailOtp, recoveryCode, pushDevice), status (active, revoked, expired), label (optional), createdAt, lastUsedAt, revokedAt. Classification restricted.
- `passwordCredential` (identified by its credential): hash (text, PHC string that carries the algorithm, parameters and salt), algorithm (argon2id, scrypt, bcrypt, pbkdf2), changedAt, mustChange (boolean). Never the password, never reversible.
- `passkeyCredential`: credentialIdValue (binary, unique), publicKey (binary, COSE key: public by nature), signCount, aaguid (optional), transports (many text), backupEligible, backedUp, attestationFormat (optional), userVerified. The private key never leaves the authenticator.
- `otpSecret`: secretCiphertext (binary: encrypted under a key held outside the database), keyReference (text, names the key), algorithm (sha1, sha256, sha512), digits, periodSeconds, lastUsedStep (integer, to refuse replay). Encrypted, not hashed, because the server must compute codes from it.
- `recoveryCode`: hash, usedAt (optional). A batch is a set of credentials of kind recoveryCode.
- `challenge`: principal (optional), purpose (login, emailVerification, passwordReset, magicLink, stepUp, passkeyRegistration, passkeyAuthentication), secretHash, destination (relationship to electronicContact, optional), attempts, maxAttempts, expiresAt, consumedAt. Retention 1 day after expiry. Covers password reset links, magic links, email codes and WebAuthn challenges, always as hashes.
- `loginAttempt`: loginIdentifierHash (the identifier hashed with a pepper, so unknown users leave no personal data), principal (optional), ip (personal IPAddress), outcome (success, wrongSecret, unknownUser, locked, mfaFailed, blocked), at. Retention 30 days. Used for lockout windows and risk.

**Sessions**
- `device`: principal, fingerprintHash (personal BrowserFingerprint, hashed), label, firstSeenAt, lastSeenAt, trustedUntil (optional: "remember this device" for MFA). Retention 180 days after last seen.
- `session`: principal, tenant (active tenant, optional), device (optional), authenticatedAt, lastSeenAt, idleExpiresAt, absoluteExpiresAt, assuranceLevel (`assuranceLevel`: aal1, aal2, aal3 in the sense of NIST 800-63B), authMethods (many code: password, passkey, totp, federated, recoveryCode, magicLink), federatedProvider (optional text key; the relationship exists only in `identity-federation`), ip (personal), userAgent (personal, DeviceBased), status (active, expired, revoked, signedOut), revokedAt, revokedReason (user, admin, reuseDetected, policy, passwordChange, risk), stepUpAt (optional). Retention 90 days after end.
- `refreshToken`: session, familyId (identifier: all tokens rotated from one issue share it), tokenHash (unique), issuedAt, expiresAt, usedAt (optional), replacedBy (relationship to refreshToken, optional), revokedAt (optional). Reuse of a token with `usedAt` set revokes the family and the session (operation `rotateRefreshToken`). Retention 30 days after expiry. No JWT access token is stored: they are short-lived and stateless. If revocation before expiry is needed, `tokenRevocation` (jti unique, tenant, expiresAt, revokedAt, reason) holds a deny list and is purged at `expiresAt`.

**Invitation and domains**
- `invitation`: tenant, email (text, personal EmailAddress), invitedBy (principal), tokenHash, status (pending, accepted, expired, revoked), expiresAt, acceptedBy (user, optional), acceptedAt (optional), message (optional). `invitationRole`: invitation, role (roles to grant on acceptance). One pending invitation per tenant and email is an operation rule (**gap**: partial unique).
- `domainClaim`: tenant, domain (text), challengeValue (a DNS TXT token or file content: public by design, so not a secret), method (dnsTxt, httpFile, email), status (pending, failed, expired), requestedAt, expiresAt. `verifiedDomain`: tenant, domain (**unique across all tenants**), verifiedAt, policy (`domainPolicy`: none, captureUsers, enforceSso), lastCheckedAt. Splitting pending from verified turns the "unique among verified" rule into a plain unique that governance can say.

**Policies** (each typed, not a JSON bag; tenant optional, empty is the platform default; most specific wins)
- `passwordPolicy`: tenant, minLength, maxLength, requireBreachCheck, historyCount, maxAgeDays (optional; off by default, in line with 800-63B), allowedAlgorithms (many).
- `lockoutPolicy`: tenant, failedAttempts, windowMinutes, lockMinutes, unlockMode (timer, admin, selfService).
- `sessionPolicy`: tenant, idleMinutes, absoluteMinutes, concurrentSessionLimit (optional), bindToDevice, stepUpMinutes.
- `mfaPolicy`: tenant, requirement (none, optional, required, adaptive), allowedKinds (many), graceDays, rememberDeviceDays, requiredForRoles (many text, role keys).
- `retentionOverride`: tenant, conceptName (text), days. The annotations below give the default; this lets a tenant lengthen or shorten within bounds the operation enforces.

**Audit**
- `auditEvent`: occurredAt, tenant (optional), actor (principal, optional), actorKind (user, serviceAccount, system, impersonator), action (open code list: `user.signedIn`, `session.revoked`, `role.assigned`, ... each module adds its own), outcome (success, failure, denied), targetConcept (text) and targetKey (text) (the second loose reference allowed), sessionKey (optional text, not a foreign key: the audit trail must survive the session's purge), requestId, ip (personal), userAgent (personal), reason (optional), detail (structured, no secrets; the operation redacts), previousHash, eventHash (SHA-256 chain, like the lifecycle ledger 0011 FR-010). Retention default 365 days. **Append only**: **gap**, no vocabulary term says it (see 4.5).

### 4.3 `identity-federation`
- `identityProvider` (Auth0 and WorkOS call it a connection): tenant, kind (oidc, saml, oauthSocial, ldap), name, status (draft, active, disabled), issuer (OIDC issuer or SAML entity id), metadataUrl (optional), clientId (optional), secretReference (text naming a secret in a vault: the client secret is **not** stored), authorizationEndpoint, tokenEndpoint, jwksUri (optional), signInUrl (SAML), allowJustInTime (boolean), defaultRole (optional relationship to role), enforceForDomains (many text). Unique (tenant, name).
- `providerCertificate`: identityProvider, certificate (text, public PEM), use (sign, encrypt), notBefore, notAfter, status.
- `claimMapping`: identityProvider, sourceClaim, targetAttribute (text), transform (none, lowercase, regex, groupsToRoles). `groupRoleMapping`: identityProvider, externalGroup, role.
- `federatedIdentity`: userAccount, identityProvider, subject (text, the `sub` or NameID, personal Identifier), emailAtLink (personal), linkedAt, lastSignInAt. Unique (identityProvider, subject).
- `directory` (SCIM and directory sync): tenant, kind (scim, azureAd, okta, googleWorkspace, ldap), name, status, lastSyncAt, tokenHash (optional: the SCIM bearer secret, hashed), syncMode (push, pull).
- `directoryUser`: directory, externalId, userName (personal), displayName (personal), active, userAccount (optional once matched), payloadHash, syncedAt. Unique (directory, externalId). `directoryGroup`: directory, externalId, displayName, group (optional). `directoryGroupMember`: directoryGroup, directoryUser.
- `directorySyncRun`: directory, startedAt, finishedAt (optional), status (running, succeeded, partial, failed), created, updated, deactivated (integers), error (optional text).

### 4.4 `identity-oauth`, `identity-machine`, `identity-privileged`
- `resourceServer`: tenant (optional), audience (unique text), name, signingAlgorithm (RS256, ES256, EdDSA), accessTokenTtlSeconds. `oauthScope`: resourceServer, scopeKey, definition. Unique (resourceServer, scopeKey).
- `oauthClient`: tenant (owner, optional), clientId (public text, unique), name, kind (confidential, public, machine), firstParty (boolean), tokenEndpointAuth (clientSecretBasic, privateKeyJwt, none, mtls), pkceRequired (default true), grantTypes (many: authorizationCode, refreshToken, clientCredentials, deviceCode), status. `clientRedirectUri`: client, uri (exact match only), kind (redirect, postLogout). `clientSecret`: client, secretHash, createdAt, expiresAt, revokedAt (several at once, so a secret can rotate without downtime). `clientScope`: client, scope (allowed).
- `oauthConsent`: principal, client, grantedAt, expiresAt (optional), revokedAt (optional), scopes via `oauthConsentScope` (consent, scope). Named `oauthConsent` so it never clashes with the `arca-consent` module.
- `authorizationCode`: client, principal, session, secretHash, redirectUri, codeChallenge, codeChallengeMethod (S256 only), scopes (many text), nonce (optional), expiresAt, consumedAt. Retention 1 day.
- `serviceAccount` (identified by its principal): tenant, name, ownerPrincipal (accountable human or group), purpose, status, isBreakGlass (boolean). `apiKey`: owner principal (service account or user), tenant, name, prefix (non-secret lookup part, unique), secretHash (keyed hash of a high-entropy random secret; shown once), createdAt, lastUsedAt, expiresAt (optional), revokedAt (optional), rotatedFrom (optional), allowedCidrs (many text). Permissions come from the owner's `roleAssignment`s, not from a copy on the key, so one rule decides. `workloadBinding`: serviceAccount, kind (spiffe, kubernetes, oidcFederation, mtlsCertificate), issuer, subject (the SPIFFE ID, the Kubernetes service account, the cert thumbprint), audience (optional), status.
- `privilegedGrant`: principal, role, tenant, justification, ticketReference (optional), requestedAt, approvedBy (optional), approvedAt (optional), startsAt, endsAt, maxSessionMinutes, status (requested, approved, active, expired, revoked, denied). A grant materializes a time-boxed `roleAssignment` when activated (operation).
- `impersonation`: actor (principal), target (principal), tenant, reason, ticketReference, startedAt, endedAt (optional), tenantNotified (boolean). Each action under it is audited with `actorKind = impersonator`.
- `riskSignal`: principal (optional), session (optional), kind (impossibleTravel, newDevice, breachedPassword, bruteForce, credentialStuffing, anomalousVolume, torExit, botScore), score (decimal), severity (low, medium, high, critical), source (text), detectedAt, expiresAt, status (open, dismissed, actioned). Policy decisions that read it (step-up, block) are operations and `accessPolicy` rules.

### 4.5 Governance vocabulary gaps this model exposes (spec 0025)

1. `security.secretStorage` (hash, ciphertext, publicKey, reference) on attributes: says the attribute never holds a secret in the clear, and the lint rule `security/secret-in-clear` flags a restricted attribute with a secret-looking name (`*Secret`, `*Token`, `*Password`) that lacks it. Today only `classification` and `mask` exist.
2. `quality.appendOnly` on concepts (insert allowed, update and delete refused). Expressible today only as `security.access` write roles, which the PostgreSQL grant path expresses for tables but not "insert only"; the access extension (0009 FR-009) must grant `INSERT` alone for append-only concepts and a trigger refuses the rest where the engine has them.
3. A way to say a concept is **never readable by application roles**: `security.access` with empty read roles works, but 0014 FR-002 makes a view of every table. Add an `exposure: "none"` (no view) for credentials, refresh tokens and challenges.
4. Conditional uniqueness (one pending invitation per tenant and email) and "exactly one of" over relationships are not expressible; the model avoids them (split concepts, principal supertype) and states the remaining ones as operation preconditions.
5. `quality.retention` exists (days) and applies to concepts and attributes: use it on every row above that names a retention; the tenant override table is data, read by the purge operation.

Classification and privacy summary: restricted: credential, passwordCredential, passkeyCredential, otpSecret, recoveryCode, challenge, refreshToken, authorizationCode, clientSecret, apiKey, directory.tokenHash, auditEvent (it holds IPs and behaviour). Confidential: principal, userAccount, membership, session, device, invitation, federatedIdentity, loginAttempt, riskSignal. Internal: policies, roles, permissions, scopes, tenant. Personal categories used: Name, AccountIdentifier, EmailAddress, IPAddress, BrowserFingerprint, DeviceBased, Identifier (names confirmed in `governance/vocabularies/dpv.auto.ts`; the exact term for the user agent must be checked against that file when written).

## 5 Operations layer design

### 5.1 The question and the constraints found in the code

- Governance must "name no database, no kind of database and no engine" (0001 FR-001). A procedural body does not belong there; a *contract* does.
- 0009 routines: one dialect (PostgreSQL), SQL text with typed references, repeatable. DuckDB has table macros (`CREATE MACRO f(x) AS TABLE ...`) and scalar macros but no procedures; SQLite has neither (views and a prepared statement are all there is, and views take no parameters).
- Portable control flow in SQL does not exist. Even the simple, important case, refresh token rotation with reuse detection, needs "update, and if no row changed look why, and if reused then revoke the family and still commit and return a *result*, not an exception" (an exception would roll back the revocation).
- The lifecycle `Driver` takes no bind parameters; operations need them (or `dialect.literal` for every value, which is a risk worth removing).
- Protected access (0014): tables are in the `data` schema with no right granted; applications use views in `api`; the row-security policy on a scoped table is one policy that names no role, so a role without a scope sees nothing.

### 5.2 Recommended design

**Layer.** Three pieces, none in a model folder:
1. **Contract, in governance** (layer 1, new element kind `operation`, spec 0028): `operation("acceptInvitation", { definition, kind: "command" | "query", input: { token: text(), password: optional text() }, output: union of named results, reads: [concepts], writes: [concepts], requires: "identity:invitation.accept" (a permission key), emits: ["user.invitationAccepted"], runsAs: "caller" | "service", idempotent: boolean })`. It names no SQL. Lint checks that reads and writes name real concepts, the emitted action exists in the audit code list, each command that writes a concept classified restricted says `runsAs: "service"`, and trace links the operation to the requirement it serves (0001 FR-006). Documentation and the register generators (0010) get operations for free.
2. **Implementation, in a new SQL extension `sql/extensions/operations`** (above the logical schema, importing the lifecycle's `Driver` type; spec 0029). Two forms:
   - `query`: a typed SELECT, text plus references exactly like 0009 bodies, with named parameters (effective permissions of a user in a tenant, check permission, domain lookup). Rendered by dialect: PostgreSQL `CREATE OR REPLACE FUNCTION ... LANGUAGE sql STABLE` (late-bound string body, not `BEGIN ATOMIC`, so that 0014's drop and recreate of a view never blocks on it); DuckDB `CREATE OR REPLACE MACRO ... AS TABLE`; SQLite: no object, only the prepared statement. **Every engine also runs the query through the generated client** as one prepared statement from the same text, so the client path is identical everywhere and the database objects are optional extras for SQL-side callers (BI, another service).
   - `command`: a TypeScript function `(tx, input, ctx) => Promise<Result>` written once against typed row operations (`tx.insert(table, row)`, `tx.update(...)`, `tx.select(...)`, with `RowOf`, `InsertOf` and `KeyOf` from 0006 FR-012) and run inside one transaction on a **parameterised driver** (new: `Driver` gains `query(sql, params)`; the three drivers in the suite already have bind support). Business outcomes are returned as a union (`{ status: "reuse-detected", revokedSessions }`), never thrown, so a branch that must commit (the revocation) does. The runner sets the scope setting (`SET LOCAL app.tenant` where the dialect has it) from the contract's scope input, checks the permission through the `checkPermission` query, runs the body, writes the declared audit event in the **same** transaction, and returns the union.
3. **Generated typed client** (a generator of the 0010 family, spec 0029): input and output types from the contract, a function per operation, the prepared statements for queries, and a **state check** at connection time that compares the hash of the database's state (0011 `stateHash`) to the hash the client was generated for and refuses to run on another (cheap, uses what exists). It is also what a REST or RPC layer wraps; the library does not ship a server.

**PostgreSQL-native commands stay an opt-in.** For a deployment whose callers must not hold table rights at all (a PostgREST-style exposure), a command may name a hand-written 0009 routine `SECURITY DEFINER` as its `database` placement; the library then grants `EXECUTE` on it to the roles the contract names and nothing else (a small extension to 0014, spec 0030). A **differential test** on PGlite runs the same scenario through the TypeScript command and through the routine and compares the rows left behind, so the two never drift. Default placement is `application`.

### 5.3 Where each identity operation lands

| Operation | Form | Runs as | Notes |
|---|---|---|---|
| createOrganisation (tenant, party, root role, owner membership) | command | service | one transaction, 6 inserts, audit |
| inviteUser, acceptInvitation | command | caller / service | accept is before the user has a session; token compared as hash, constant-time in TS |
| createSession (check lockout, credential, MFA state, policy, insert session, refresh token, audit) | command | service | returns union: signedIn, mfaRequired, locked, denied |
| rotateRefreshToken | command | service | single conditional update first; zero rows then look-up and, if used, revoke family and commit; returns `reuse-detected` |
| revokeSession, revokeAllSessions | command | caller / service | update by principal, revoke refresh tokens, audit |
| checkPermission(principal, tenant, permission, resource?) | query | caller | roles via groups (closure), entitlement and ReBAC tuples are separate queries the application combines; ABAC is application-side |
| effectivePermissions(principal, tenant) | query | caller | recursive CTE over groupMember (all three engines support it), union of direct and group roleAssignments, intersect validity window |
| recordAuditEvent | command (internal) | service | reads the last hash, inserts the chained row; serialized per tenant (see 5.5) |
| verifyDomain | command | service | resolves DNS in the application (never SQL), then moves `domainClaim` to `verifiedDomain` |
| lockUser, unlockUser | command | caller | status, lockedUntil, revoke sessions |
| issueApiKey, revokeApiKey | command | caller | generates the secret in TS, returns it once, stores the keyed hash |

### 5.4 Interaction with the rest of the library

- **Lifecycle (0011).** Database objects of an operation (a PostgreSQL function or a DuckDB macro) are statements of group `routine`, thus repeatable objects with a key and the hash of their text; `dueRepeatables` re-applies them when the text changes and the 0014 transform drops and recreates views in the same transaction. Because they are late-bound strings, a column change cannot be blocked by them; the cost is that a body naming a dropped column fails at call time, so the operations suite below calls every operation. Commands are code and have no database object; their only link is the state check.
- **Protected access (0014).** A `caller` query reads the **`api` views**, so scope and masks apply; a command with `runsAs: service` needs the `data` tables. 0014 FR-005 grants only on views and its policy names no role, so **a service role cannot today see across tenants** (login happens before the tenant is known). Spec 0030 adds a role flag in `security.access` (`unscoped`, with `BYPASSRLS` or a second policy) and an `exposure: none` for credential tables, as 4.5 lists. Without it the identity service must connect as the table owner, which defeats the guard; I would not build identity before this lands.
- **Row security.** The runner sets `app.tenant` per transaction with `SET LOCAL`; PGlite is single-connection, so tests prove the policy, not connection pooling.
- **Privacy and audit.** `emits` is checked by lint and enforced by the runner: a command that writes without its audit event is a failing test, not a convention.

### 5.5 Testing on the real engines in the suite

`suite/engines-fixture.ts` already opens SQLite (`node:sqlite`), DuckDB and PGlite with the library's dialects. Add `suite/operations.test.ts`: a scenario table (arrange rows, call operation, assert rows and returned union) executed on **all three engines** through the generated client; queries additionally through the PostgreSQL function (PGlite) and the DuckDB macro; the differential test for any `database` placement on PGlite; the contract lint; the generated client's types compile (`bun run verify`). Not provable on these engines: real concurrency (two simultaneous refresh requests). The test header says so (as AGENTS.md requires for what cannot be tested), and the operation makes the single conditional `UPDATE ... WHERE used_at IS NULL` the arbiter, so the database's row lock decides; for the audit chain the runner takes a per-tenant advisory lock where the dialect has one and otherwise serializes in the process (SQLite and DuckDB are single-writer anyway).

### 5.6 Rejected alternatives

1. **Bodies in governance as typed operations that name SQL steps.** Breaks FR-001 and would make governance describe databases. Kept: the contract only.
2. **Everything as stored procedures, PostgreSQL first, "others later".** The fallback for SQLite and DuckDB would be nothing, and 0009 SC-001 says no engine silently loses a feature. It also puts security-critical branching in plpgsql the TypeScript suite cannot step through on three engines.
3. **A neutral procedural IR rendered to plpgsql, TypeScript and macros.** The truest reading of "write once, render per dialect", and I rejected it for v1: it is a language to design, test and keep in step with three engines' differences (`RETURNING`, locking, error model) for little benefit while the caller can be a TypeScript service. Revisit if a real consumer needs database-side commands on more than PostgreSQL; the contract and the scenario suite are the part that would survive.
4. **Views for parameterised reads.** SQLite and DuckDB views take no parameters; effective permissions per user needs one.
5. **Business logic in triggers.** Hidden, untestable by scenario, and the 0014 guard and the lifecycle's drop and recreate make them fragile.
6. **Operations as a model concern (in `models/identity`).** Models import governance only (0001 FR-004) and must name no database; operations need the logical schema and a driver, so they are an extension above both.

## 6 Proposed specs and build order

Numbering continues the data registry (last is 0023); every spec is added to `spec-kit/registry.tsv` and `enforcement.tsv` and written before the code, as AGENTS.md requires. Sizes: S about a day, M about a week, L more.

| # | Spec | What | Size | Needs |
|---|---|---|---|---|
| 0024 | model-modules | `governance.module` point, `ModuleDef`, `composeDomains` with element origin and cross-part references along `requires`, `subsetDomain`, amendment of 0001 FR-004 for model-to-model imports, layers check | L | none |
| 0025 | governance-secrets | `security.secretStorage`, `quality.appendOnly`, `exposure`, lint rules, retention checks; access extension grants insert-only | M | none |
| 0026 | arca-tenancy | tenant and hierarchy, `scoped` overlay | M | 0024 |
| 0027 | arca-identity | core module of 4.2 with tests as 0004 (lint clean, every personal attribute categorised, snake-case names) | L | 0024, 0025, 0026 |
| 0028 | operations-contract | governance `operation` element, lint, trace, documentation | M | 0024 |
| 0029 | sql-operations | parameterised `Driver`, query forms (PostgreSQL function, DuckDB macro, SQLite prepared), command runner, generated client with state check, scenario suite on three engines | L | 0028 |
| 0030 | sql-service-access | `unscoped` service role, `EXECUTE` grants, no-view exposure, opt-in PostgreSQL command placement with differential test | M | 0014, 0025, 0029 |
| 0031 | identity-operations | the operations of 5.3 for `identity` | L | 0027, 0029, 0030 |
| 0032 | identity-federation | 4.3 and its operations | M | 0031 |
| 0033 | identity-machine | serviceAccount, apiKey, workloadBinding | S | 0031 |
| 0034 | identity-oauth | 4.4 oauth part | M | 0031 |
| 0035 | identity-privileged | grants, impersonation, risk | M | 0031 |
| 0036 | arca-consent | purposes, records, requests | S | 0024 |
| 0037 | arca-catalog | product and price | M | 0024 |
| 0038 | arca-order | quote and order | M | 0037 |
| 0039 | arca-agreement | agreement, terms | M | 0024 |
| 0040 | arca-billing | invoice, payment | M | 0024 |
| 0041 | arca-subscription | plan, subscription, usage | M | 0037, 0040 |
| 0042 | arca-ledger | accounts, journal, budget | M | 0024 |
| 0043 | arca-work, arca-facility, arca-content, arca-communication | one spec each | S each | 0024 |
| 0044 | arca-bridges | the four bridge modules | S | the modules each names |

Order by value and risk: 0024 and 0025 first (the rest cannot be written cleanly without them); identity (0026 to 0031) is the user's priority; billing, order, catalog next because B2B software always needs them; then the small ones. 0024 is the one that deserves a review before anything else, since it changes what an element's identity is.

## 7 Open questions

1. **Identity continuity (0024).** Is `part.module` the right identity prefix, or should composed elements stay `arcaParty.person` and `arcaIdentity.userAccount` exactly as written (my recommendation, so existing `arcaParty` golden SQL under `suite/**/golden/` does not change)? Changing the 0004 domain name is not acceptable.
2. **Global user vs pooled user.** I default to global users with memberships and `homeTenant` for consumer pools. If the product wants Auth0-style strict per-pool isolation as the default, `loginIdentifier` uniqueness changes.
3. **Does `arca-tenancy` merge into `identity`?** Merging is simpler for a project that wants only identity; separate is better for billing and content without logins. I chose separate; the overlay makes either work.
4. **Where does the service role come from?** 0014 never creates roles. Who provisions `identity_service` (the lifecycle, the project, an extension)? Needs an owner before 0030.
5. **Secret storage.** Do we model the pepper and key references only (names), or provide a key-management hook? I model references only; envelope encryption is the application's.
6. **Parameter binding in the lifecycle driver.** Changing `Driver` touches 0011 consumers; alternatively a separate `ParamDriver` for operations. I prefer the separate type to keep 0011 unchanged.
7. **Retention execution.** `quality.retention` is declarative; nothing purges. Is a `purge` operation per concept generated from it (an extension of the retention annotation), or hand-written? I would generate it.
8. **Numbering and naming.** Folder and domain names (`arca-identity` vs `identity`), spec numbers, and whether the five identity modules should be one spec each or one spec of five sections.
9. **Silverston's licence.** No book text or figures were reproduced; the models here are designed from structure at the level of subject areas. Confirm this satisfies the position taken for `arca-party` ("Arca's own work, written from documentation, not copied").
10. **Industry models** (Volume 2) and human resources are deliberately out; confirm.
11. **Real Postgres for concurrency.** Do we accept untested concurrency on PGlite (header says so), or add an opt-in suite against a real server in CI?

## 8 Sources

Read in the repository (relative to `commons/data` unless stated): `about.ts`, `library.ts`, `/home/user/.github/AGENTS.md`, `models/arca/mod.ts`, `models/arca/party.ts`, `engine/compose.ts`, `engine/manifest.ts`, `engine/point.ts`, `governance/model.ts`, `governance/api.ts`, `governance/vocabularies/{security,quality,privacy,lifecycle,ownership,usage}.ts` and `dpv.auto.ts` (term list), `sql/logical/api.ts`, `sql/logical/project.ts`, `sql/logical/rows.ts`, `sql/extensions/routines/{mod,routine}.ts`, `sql/dialects/postgres/mod.ts`, `sql/lifecycle/run.ts`, `suite/engines-fixture.ts`, `suite/features.test.ts`, and specs `0001-layers`, `0002-engine`, `0004-arca`, `0009-sql-features`, `0011-sql-lifecycle`, `0014-sql-protected-access`, `0022-sql-integrations`, `0023-sql-transforms`, `0018-sql-history`, `registry.tsv`.

Fetched or searched on the web for Task A (summaries only; no book text reproduced):
- Wiley, list of models of the three volumes: https://books.wiley.com/authors/len-silverston/models
- Library catalogue record, contents of the 1997 Volume 1 (title list through Ordering Products): found through a web search of https://libexplorer.upnm.edu.my/home/Record/50304/TOC (the page itself returned an error when fetched; the search summary was used)
- O'Reilly Learning, Volume 1 and its revised edition, chapter list pages: https://www.oreilly.com/library/view/the-data-model/9780471380238/ and https://www.oreilly.com/library/view/the-data-model/9780470178454 (seen in search results only)
- TDAN, on universal data models: https://tdan.com/?p=5271 (search result only)
- O'Reilly, party and party role structure as summarised by the search result: https://www.oreilly.com/library/view/the-data-model/9780470178454/chapter-32.html

Not fetched, cited from general knowledge in section 4 as references only: NIST SP 800-63, ISO/IEC 27001, ICAM/FICAM, OpenID Connect Core, RFC 6749 and the OAuth Security BCP, SAML 2.0, SCIM RFCs 7643/7644, WebAuthn, RFC 6238, SPIFFE, the Zanzibar paper. Volume 3's outline could not be retrieved in detail; the pattern-library description comes from a search summary.
