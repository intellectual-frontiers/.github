// Spec: 0030-identity FR-001, FR-002, FR-003, FR-005, FR-006, FR-007
/**
 * The concepts of the identity model (commons data 0030-identity): who may do what, and how they prove it. A principal (a user, a service account or a group) plays the part for identity that a
 * party plays for Arca. Secrets are never stored in the clear: a password is a hash, a one-time-code secret is ciphertext under a key kept outside the database, and a token or a key is a hash of a
 * secret that was shown once. Sessions and tokens are short-lived and are kept only as long as they are of use. Every concept says how private and how secret it is, and what it is kept for.
 *
 * @module
 */
import {
  type AnyConcept,
  annotate,
  attribute,
  binary,
  boolean,
  codeOf,
  concept,
  identifier,
  instant,
  integer,
  relationship,
  structured,
  text,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import { electronicContact, person } from "@intellectual-frontiers/data/models/arca";
import { tenant } from "@intellectual-frontiers/data/models/arca-tenancy";
import * as c from "./codes.ts";

const { quality, requirements, security, usage, privacy } = vocabularies;
const cites = (...frs: readonly string[]) =>
  annotate(
    requirements.cites,
    frs.map((fr) => `0030-identity ${fr}`),
  );
const restricted = annotate(security.classification, "restricted");
const confidential = annotate(security.classification, "confidential");
const internal = annotate(security.classification, "internal");
const keep = (days: number) => annotate(quality.retention, { days });
const held = (category: vocabularies.privacy.PdTerm, ...purposes: readonly string[]) => annotate(privacy.personal, { category, purposes });
const unique = (...members: readonly string[]) => annotate(quality.unique, { members });
const lookup = (...members: readonly string[]) => annotate(usage.lookup, { members });

type Attr = ReturnType<typeof attribute>;
const req = (type: Parameters<typeof attribute>[0], definition: string, ...annotations: readonly ReturnType<typeof annotate>[]): Attr => attribute(type, { definition, annotations });
const opt = (type: Parameters<typeof attribute>[0], definition: string, ...annotations: readonly ReturnType<typeof annotate>[]): Attr =>
  attribute(type, { definition, multiplicity: "optional", annotations });
const many = (type: Parameters<typeof attribute>[0], definition: string, ...annotations: readonly ReturnType<typeof annotate>[]): Attr =>
  attribute(type, { definition, multiplicity: "many", annotations });
const key = (what: string): Attr => attribute(identifier(), { definition: `What identifies ${what}, made by the application` });
const one = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "one", definition });
const maybe = (to: AnyConcept | (() => AnyConcept), definition: string) => relationship(to, { cardinality: "optional", definition });

// ---------------------------------------------------------------- principals and accounts

/** Anyone or anything that can be granted a role, own a key or act: a user, a service account or a group. */
export const principal = concept("principal", {
  definition: "Anyone or anything that can be granted a role, own a key or act: a user, a service account or a group",
  attributes: {
    principalId: key("the principal"),
    kind: req(codeOf(c.principalKind), "Whether the principal is a user, a service account or a group"),
    displayName: opt(text(), "The name the principal is shown by", held("Name", "show who did something")),
    createdAt: req(instant(), "When the principal was made"),
  },
  identifiedBy: ["principalId"],
  annotations: [confidential, cites("FR-001", "FR-002")],
});

/** A user account: a person's way in. Its identity is its principal's. */
export const userAccount = concept("userAccount", {
  definition: "A person's way in: who signs in, and where it stands",
  attributes: {
    loginIdentifier: req(text(), "What the user signs in by, unique within its home tenant", held("Username", "let the user sign in")),
    status: req(codeOf(c.userStatus), "Where the account is in its life"),
    createdVia: req(codeOf(c.createdVia), "How the account came to be"),
    lockedUntil: opt(instant(), "Until when the account is locked, where it is"),
    lastAuthenticatedAt: opt(instant(), "When the user last proved who they are"),
    locale: opt(text(), "The language the user wants to be spoken to in"),
    timeZone: opt(text(), "The time zone the user's times are shown in"),
  },
  identifiedBy: ["principal"],
  relationships: {
    principal: one(principal, "The principal the account is"),
    person: one(person, "The person the account is for"),
    homeTenant: maybe(tenant, "The tenant whose pool of users it is in; empty for a user who joins tenants by membership"),
    primaryEmail: maybe(electronicContact, "The address the user is written to"),
  },
  annotations: [confidential, cites("FR-001", "FR-002"), unique("homeTenant", "loginIdentifier"), lookup("person")],
});

/** The proof that an address is a person's: Arca's electronic contact does not say, so identity does. */
export const contactVerification = concept("contactVerification", {
  definition: "The proof that an address is a person's",
  attributes: {
    contactVerificationId: key("the verification"),
    verifiedAt: req(instant(), "When the address was proved to be the person's"),
    method: req(codeOf(c.verificationMethod), "How it was proved"),
  },
  identifiedBy: ["contactVerificationId"],
  relationships: { contact: one(electronicContact, "The address that was proved") },
  annotations: [confidential, cites("FR-001"), unique("contact")],
});

/** A user's place in a tenant. */
export const membership = concept("membership", {
  definition: "A user's place in a tenant",
  attributes: {
    membershipId: key("the membership"),
    status: req(codeOf(c.membershipStatus), "Where the membership is"),
    source: req(codeOf(c.membershipSource), "How the user came to be a member"),
    joinedAt: opt(instant(), "When the user became a member"),
    removedAt: opt(instant(), "When the membership ended"),
  },
  identifiedBy: ["membershipId"],
  relationships: { userAccount: one(userAccount, "The user"), tenant: one(tenant, "The tenant") },
  annotations: [confidential, cites("FR-001", "FR-002"), unique("userAccount", "tenant"), lookup("tenant")],
});

/** A group: a set of principals that is granted what its members are. Its identity is its principal's. */
export const userGroup = concept("userGroup", {
  definition: "A set of principals that is granted what its members are",
  attributes: {
    name: req(text(), "What the group is called, unique within its tenant"),
    source: req(codeOf(c.groupSource), "Where the group is kept"),
    externalId: opt(text(), "What a directory calls the group, where it keeps it"),
  },
  identifiedBy: ["principal"],
  relationships: { principal: one(principal, "The principal the group is"), tenant: one(tenant, "The tenant the group is in") },
  annotations: [internal, cites("FR-001"), unique("tenant", "name")],
});

/** A principal's place in a group: a user, or another group. */
export const groupMember = concept("groupMember", {
  definition: "A principal's place in a group: a user, or another group",
  attributes: { addedAt: req(instant(), "When the principal was added") },
  identifiedBy: ["group", "member"],
  relationships: { group: one(userGroup, "The group"), member: one(principal, "The user or the group that is a member") },
  annotations: [internal, cites("FR-001"), lookup("member")],
});

// ---------------------------------------------------------------- authorization

/** A thing that can be done, named `resource:action`; each module registers its own. */
export const permission = concept("permission", {
  definition: "A thing that can be done, named by its resource and its action",
  attributes: {
    permissionId: key("the permission"),
    permissionKey: req(text(), "The permission as `resource:action`, unique"),
    definition: req(text(), "What the permission lets a principal do"),
    ownerModule: req(text(), "The module that registered the permission"),
  },
  identifiedBy: ["permissionId"],
  annotations: [internal, cites("FR-003"), unique("permissionKey")],
});

/** A role: a set of permissions that is granted together. */
export const accessRole = concept("accessRole", {
  definition: "A set of permissions that is granted together",
  attributes: {
    roleId: key("the role"),
    key: req(text(), "The role's short name, unique within its tenant"),
    name: req(text(), "What the role is called"),
    kind: req(codeOf(c.roleKind), "Whether the platform or a tenant made it"),
    definition: req(text(), "What a holder of the role does"),
  },
  identifiedBy: ["roleId"],
  relationships: { tenant: maybe(tenant, "The tenant that made the role; empty for a role of the platform, usable in every tenant") },
  annotations: [internal, cites("FR-003"), unique("tenant", "key")],
});

/** A permission that a role holds. */
export const rolePermission = concept("rolePermission", {
  definition: "A permission that a role holds",
  attributes: {},
  identifiedBy: ["role", "permission"],
  relationships: { role: one(accessRole, "The role"), permission: one(permission, "The permission") },
  annotations: [internal, cites("FR-003")],
});

/** A role granted to a principal, in a tenant, perhaps for one resource and for a time. */
export const roleAssignment = concept("roleAssignment", {
  definition: "A role granted to a principal, in a tenant, perhaps for one resource and for a time",
  attributes: {
    roleAssignmentId: key("the grant"),
    resourceType: opt(text(), "The kind of the one resource the grant is limited to, where it is"),
    resourceId: opt(text(), "The one resource the grant is limited to, where it is"),
    validFrom: req(instant(), "When the grant starts"),
    validTo: opt(instant(), "When the grant ends, where it does"),
    reason: opt(text(), "Why it was granted"),
  },
  identifiedBy: ["roleAssignmentId"],
  relationships: {
    principal: one(principal, "Who holds the role"),
    role: one(accessRole, "The role"),
    tenant: one(tenant, "The tenant the grant is in"),
    grantedBy: one(principal, "Who granted it"),
  },
  annotations: [confidential, cites("FR-003"), lookup("principal", "tenant")],
});

/** What a tenant may use, as distinct from what a user may do. */
export const entitlement = concept("entitlement", {
  definition: "What a tenant may use, as distinct from what a user may do",
  attributes: {
    entitlementId: key("the entitlement"),
    featureKey: req(text(), "The feature the tenant may use"),
    limitValue: opt(integer(), "How much of it, where it is limited"),
    validFrom: req(instant(), "When it starts"),
    validTo: opt(instant(), "When it ends, where it does"),
    source: req(codeOf(c.entitlementSource), "Where it comes from"),
  },
  identifiedBy: ["entitlementId"],
  relationships: { tenant: one(tenant, "The tenant") },
  annotations: [internal, cites("FR-003"), lookup("tenant", "featureKey")],
});

/** A rule of attribute-based access control: stored and versioned here, decided by the application. */
export const accessPolicy = concept("accessPolicy", {
  definition: "A rule of attribute-based access control: stored and versioned here, decided by the application",
  attributes: {
    accessPolicyId: key("the policy"),
    name: req(text(), "What the policy is called"),
    effect: req(codeOf(c.effect), "What the policy decides"),
    resourceType: req(text(), "The kind of resource it is about"),
    action: req(text(), "The action it is about"),
    condition: req(text(), "When it applies, written in its language"),
    conditionLanguage: req(codeOf(c.conditionLanguage), "The language of the condition"),
    priority: req(integer(), "Which policy wins where two apply: the lower number"),
    status: req(codeOf(c.enabledStatus), "Whether it is in use"),
    version: req(integer(), "Which version of the policy this is"),
  },
  identifiedBy: ["accessPolicyId"],
  relationships: { tenant: maybe(tenant, "The tenant it is for; empty for the platform's") },
  annotations: [internal, cites("FR-003"), unique("tenant", "name", "version")],
});

/** The definition of a relationship-based access model, in the style of Zanzibar. */
export const authorizationModel = concept("authorizationModel", {
  definition: "The definition of a relationship-based access model: its types and relations",
  attributes: {
    authorizationModelId: key("the model"),
    version: req(integer(), "Which version of the model this is"),
    definition: req(structured(), "The types and relations"),
    status: req(codeOf(c.enabledStatus), "Whether it is in use"),
  },
  identifiedBy: ["authorizationModelId"],
  relationships: { tenant: maybe(tenant, "The tenant it is for; empty for the platform's") },
  annotations: [internal, cites("FR-003")],
});

/** A fact of relationship-based access: this subject has this relation to this object. */
export const relationTuple = concept("relationTuple", {
  definition: "A fact of relationship-based access: this subject has this relation to this object",
  attributes: {
    relationTupleId: key("the fact"),
    tupleKey: req(text(), "A hash of the tenant, the object, the relation and the subject, unique, so that a fact is not recorded twice"),
    objectType: req(text(), "The kind of the object"),
    objectId: req(text(), "The object"),
    relation: req(text(), "The relation"),
    subjectType: req(text(), "The kind of the subject"),
    subjectId: req(text(), "The subject"),
    subjectRelation: opt(text(), "The relation of the subject that is meant, where a set is"),
    createdAt: req(instant(), "When the fact was recorded"),
  },
  identifiedBy: ["relationTupleId"],
  relationships: { tenant: one(tenant, "The tenant the fact is in") },
  annotations: [
    internal,
    cites("FR-003"),
    unique("tupleKey"),
    lookup("objectType", "objectId", "relation"),
  ],
});

// ---------------------------------------------------------------- credentials

/** What a principal proves itself with. The secret is in the kind of credential, never here. */
export const credential = concept("credential", {
  definition: "What a principal proves itself with; the secret is in the kind of credential",
  attributes: {
    credentialId: key("the credential"),
    kind: req(codeOf(c.credentialKind), "What sort of proof it is"),
    status: req(codeOf(c.credentialStatus), "Where it is"),
    label: opt(text(), "What the person calls it"),
    createdAt: req(instant(), "When it was made"),
    lastUsedAt: opt(instant(), "When it was last used"),
    revokedAt: opt(instant(), "When it ended, where it did"),
  },
  identifiedBy: ["credentialId"],
  relationships: { principal: one(principal, "Whose it is") },
  annotations: [restricted, cites("FR-005", "FR-007"), lookup("principal")],
});

/** A password, as a hash that carries its algorithm, parameters and salt. */
export const passwordCredential = concept("passwordCredential", {
  definition: "A password, kept only as a hash that carries its algorithm, its parameters and its salt",
  attributes: {
    hash: req(text(), "The hash in the PHC string form; never the password, never reversible"),
    algorithm: req(codeOf(c.passwordAlgorithm), "How it was hashed"),
    changedAt: req(instant(), "When the password was set"),
    mustChange: req(boolean(), "Whether the user must choose another at the next sign-in"),
  },
  identifiedBy: ["credential"],
  relationships: { credential: one(credential, "The credential it is") },
  annotations: [restricted, cites("FR-005", "FR-007")],
});

/** A passkey: the public half of a key pair whose private half never leaves the person's device. */
export const passkey = concept("passkey", {
  definition: "A passkey: the public half of a key pair whose private half never leaves the person's device",
  attributes: {
    credentialIdValue: req(binary(), "What the authenticator calls the key, unique"),
    publicKey: req(binary(), "The public key, in COSE form"),
    signCount: req(integer(), "How many times the authenticator says it has signed"),
    aaguid: opt(text(), "What kind of authenticator it is"),
    transports: many(text(), "How the authenticator can be reached"),
    backupEligible: req(boolean(), "Whether the key can be backed up"),
    backedUp: req(boolean(), "Whether it has been"),
    userVerified: req(boolean(), "Whether the person was verified when it was made"),
    attestationFormat: opt(text(), "The form of the proof of what made it"),
  },
  identifiedBy: ["credential"],
  relationships: { credential: one(credential, "The credential it is") },
  annotations: [restricted, cites("FR-005", "FR-007"), unique("credentialIdValue")],
});

/** The secret of a one-time-code factor, encrypted under a key that is kept outside the database. */
export const otpSecret = concept("otpSecret", {
  definition: "The secret of a one-time-code factor, kept as ciphertext under a key held outside the database",
  attributes: {
    secretCiphertext: req(binary(), "The secret, encrypted: the server must make codes from it, so it cannot be only hashed"),
    keyReference: req(text(), "Names the key that encrypted it"),
    algorithm: req(codeOf(c.otpAlgorithm), "The hash the codes are made with"),
    digits: req(integer(), "How many digits a code has"),
    periodSeconds: req(integer(), "How long a code lasts"),
    lastUsedStep: opt(integer(), "The time step of the last code taken, so that none is taken twice"),
  },
  identifiedBy: ["credential"],
  relationships: { credential: one(credential, "The credential it is") },
  annotations: [restricted, cites("FR-005", "FR-007")],
});

/** A recovery code, kept as a hash and used once. */
export const recoveryCode = concept("recoveryCode", {
  definition: "A code kept for when the other ways are lost, kept as a hash and used once",
  attributes: { hash: req(text(), "The hash of the code"), usedAt: opt(instant(), "When it was used") },
  identifiedBy: ["credential"],
  relationships: { credential: one(credential, "The credential it is") },
  annotations: [restricted, cites("FR-005", "FR-007")],
});

/** Something a person is asked to prove, once: a reset link, a magic link, an emailed code or a passkey challenge, always kept as a hash. */
export const challenge = concept("challenge", {
  definition: "Something a person is asked to prove, once: a reset link, a magic link, a code or a passkey challenge, kept as a hash",
  attributes: {
    challengeId: key("the challenge"),
    purpose: req(codeOf(c.challengePurpose), "What it is for"),
    secretHash: req(text(), "The hash of what was sent"),
    attempts: req(integer(), "How many times it was tried"),
    maxAttempts: req(integer(), "How many times it may be"),
    expiresAt: req(instant(), "When it stops being valid"),
    consumedAt: opt(instant(), "When it was used"),
  },
  identifiedBy: ["challengeId"],
  relationships: {
    principal: maybe(principal, "Who it is for, where that is known"),
    destination: maybe(electronicContact, "Where it was sent"),
  },
  annotations: [restricted, keep(1), cites("FR-005", "FR-007")],
});

/** A sign-in attempt, for lockout and for risk; the identifier is hashed so that an unknown user leaves nothing personal. */
export const loginAttempt = concept("loginAttempt", {
  definition: "A sign-in attempt, kept for lockout and for risk, with the identifier hashed so that an unknown user leaves nothing personal",
  attributes: {
    loginAttemptId: key("the attempt"),
    loginIdentifierHash: req(text(), "The identifier, hashed with a pepper"),
    ip: req(text(), "Where it came from", held("IPAddress", "limit guessing and spot abuse")),
    outcome: req(codeOf(c.loginOutcome), "How it ended"),
    at: req(instant(), "When it was"),
  },
  identifiedBy: ["loginAttemptId"],
  relationships: { principal: maybe(principal, "Who it was for, where that is known") },
  annotations: [confidential, keep(30), cites("FR-005", "FR-007"), lookup("loginIdentifierHash", "at")],
});

// ---------------------------------------------------------------- sessions

/** A device a principal signs in from. */
export const device = concept("device", {
  definition: "A device a principal signs in from",
  attributes: {
    deviceId: key("the device"),
    fingerprintHash: req(text(), "A hash of what the browser says it is", held("BrowserFingerprint", "recognise a device the user has used")),
    label: opt(text(), "What the person calls it"),
    firstSeenAt: req(instant(), "When it was first seen"),
    lastSeenAt: req(instant(), "When it was last seen"),
    trustedUntil: opt(instant(), "Until when it is trusted not to be asked for a second factor"),
  },
  identifiedBy: ["deviceId"],
  relationships: { principal: one(principal, "Whose it is") },
  annotations: [confidential, keep(180), cites("FR-006")],
});

/** A session: a principal's being signed in, from a device, for a time. */
export const loginSession = concept("loginSession", {
  definition: "A principal's being signed in, from a device, for a time",
  attributes: {
    sessionId: key("the session"),
    authenticatedAt: req(instant(), "When the principal proved who they are"),
    lastSeenAt: req(instant(), "When the session was last used"),
    idleExpiresAt: req(instant(), "When it ends if it is not used"),
    absoluteExpiresAt: req(instant(), "When it ends whatever"),
    assuranceLevel: req(codeOf(c.assuranceLevel), "How sure it is of who it is for"),
    authMethods: many(codeOf(c.authMethod), "How it was authenticated"),
    federatedProvider: opt(text(), "The identity provider it was signed in through, where it was"),
    ip: req(text(), "Where it came from", held("IPAddress", "spot a session used from somewhere new")),
    userAgent: req(text(), "What the browser says it is", held("UserAgent", "show the user where they are signed in")),
    status: req(codeOf(c.sessionStatus), "Where the session is"),
    revokedAt: opt(instant(), "When it was ended early"),
    revokedReason: opt(codeOf(c.revokedReason), "Why it was ended early"),
    stepUpAt: opt(instant(), "When the principal last proved who they are again"),
  },
  identifiedBy: ["sessionId"],
  relationships: {
    principal: one(principal, "Who is signed in"),
    tenant: maybe(tenant, "The tenant the session is working in"),
    device: maybe(device, "The device it is on"),
  },
  annotations: [confidential, keep(90), cites("FR-006"), lookup("principal", "status")],
});

/** A refresh token, kept as a hash: used once, and replaced by the next in its family. */
export const refreshToken: AnyConcept = concept("refreshToken", {
  definition: "A token that renews a session, kept as a hash, used once and replaced by the next one of its family",
  attributes: {
    refreshTokenId: key("the token"),
    familyId: req(identifier(), "What every token rotated from one issue shares, so that a reuse ends them all"),
    tokenHash: req(text(), "The hash of the token"),
    issuedAt: req(instant(), "When it was made"),
    expiresAt: req(instant(), "When it stops being valid"),
    usedAt: opt(instant(), "When it was exchanged for the next"),
    revokedAt: opt(instant(), "When it was ended early"),
  },
  identifiedBy: ["refreshTokenId"],
  relationships: {
    session: one(loginSession, "The session it renews"),
    replacedBy: maybe(() => refreshToken, "The token that took its place"),
  },
  annotations: [restricted, keep(30), cites("FR-006", "FR-007"), unique("tokenHash"), lookup("familyId")],
});

// ---------------------------------------------------------------- invitations and domains

/** An invitation to join a tenant, with the roles to grant on acceptance. */
export const invitation = concept("invitation", {
  definition: "An invitation to join a tenant",
  attributes: {
    invitationId: key("the invitation"),
    email: req(text(), "The address it was sent to", held("EmailAddress", "invite the person")),
    tokenHash: req(text(), "The hash of the secret in the link"),
    status: req(codeOf(c.invitationStatus), "Where it is"),
    expiresAt: req(instant(), "When it stops being valid"),
    acceptedAt: opt(instant(), "When it was taken up"),
    message: opt(text(), "What the inviter wrote"),
  },
  identifiedBy: ["invitationId"],
  relationships: {
    tenant: one(tenant, "The tenant the person is invited to"),
    invitedBy: one(principal, "Who invited"),
    acceptedBy: maybe(userAccount, "Who took it up"),
  },
  annotations: [restricted, cites("FR-008"), lookup("tenant", "email")],
});

/** A role that an invitation grants when it is accepted. */
export const invitationRole = concept("invitationRole", {
  definition: "A role that an invitation grants when it is accepted",
  attributes: {},
  identifiedBy: ["invitation", "role"],
  relationships: { invitation: one(invitation, "The invitation"), role: one(accessRole, "The role") },
  annotations: [internal, cites("FR-008")],
});

/** A claim on a domain, waiting to be proved. */
export const domainClaim = concept("domainClaim", {
  definition: "A claim on a domain, waiting to be proved",
  attributes: {
    domainClaimId: key("the claim"),
    domain: req(text(), "The domain claimed"),
    challengeValue: req(text(), "What is to be published to prove it; public by design"),
    method: req(codeOf(c.claimMethod), "How it is to be proved"),
    status: req(codeOf(c.claimStatus), "Where it is"),
    requestedAt: req(instant(), "When it was asked for"),
    expiresAt: req(instant(), "When it stops being valid"),
  },
  identifiedBy: ["domainClaimId"],
  relationships: { tenant: one(tenant, "The tenant that claims it") },
  annotations: [internal, cites("FR-008")],
});

/** A domain that a tenant has proved to be its own: one tenant only. */
export const verifiedDomain = concept("verifiedDomain", {
  definition: "A domain that a tenant has proved to be its own, and what that means for those who sign in with it",
  attributes: {
    verifiedDomainId: key("the domain"),
    domain: req(text(), "The domain, unique across every tenant"),
    verifiedAt: req(instant(), "When it was proved"),
    policy: req(codeOf(c.domainPolicy), "What it means for those who sign in with it"),
    lastCheckedAt: opt(instant(), "When it was last checked still to be the tenant's"),
  },
  identifiedBy: ["verifiedDomainId"],
  relationships: { tenant: one(tenant, "The tenant it is proved for") },
  annotations: [internal, cites("FR-008"), unique("domain")],
});

// ---------------------------------------------------------------- policies

const scoped = { tenant: maybe(tenant, "The tenant the policy is for; empty for the platform's, which a tenant's replaces") };

/** The rules for passwords. */
export const passwordPolicy = concept("passwordPolicy", {
  definition: "The rules for passwords",
  attributes: {
    passwordPolicyId: key("the policy"),
    minLength: req(integer(), "The fewest characters"),
    maxLength: req(integer(), "The most characters"),
    requireBreachCheck: req(boolean(), "Whether a password is refused that is known from a breach"),
    historyCount: req(integer(), "How many earlier passwords may not be used again"),
    maxAgeDays: opt(integer(), "After how many days a password must change; empty, in line with NIST SP 800-63B"),
    allowedAlgorithms: many(codeOf(c.passwordAlgorithm), "The algorithms a hash may use"),
  },
  identifiedBy: ["passwordPolicyId"],
  relationships: scoped,
  annotations: [internal, cites("FR-009")],
});

/** The rules for locking an account. */
export const lockoutPolicy = concept("lockoutPolicy", {
  definition: "The rules for locking an account after failed sign-ins",
  attributes: {
    lockoutPolicyId: key("the policy"),
    failedAttempts: req(integer(), "How many failures lock it"),
    windowMinutes: req(integer(), "The time they are counted in"),
    lockMinutes: req(integer(), "How long it stays locked"),
    unlockMode: req(codeOf(c.unlockMode), "How it is freed"),
  },
  identifiedBy: ["lockoutPolicyId"],
  relationships: scoped,
  annotations: [internal, cites("FR-009")],
});

/** The rules for sessions. */
export const sessionPolicy = concept("sessionPolicy", {
  definition: "The rules for sessions",
  attributes: {
    sessionPolicyId: key("the policy"),
    idleMinutes: req(integer(), "How long a session lasts unused"),
    absoluteMinutes: req(integer(), "How long it lasts at most"),
    concurrentSessionLimit: opt(integer(), "How many a principal may have at once"),
    bindToDevice: req(boolean(), "Whether a session is tied to the device it began on"),
    stepUpMinutes: req(integer(), "How long a second proof counts for"),
  },
  identifiedBy: ["sessionPolicyId"],
  relationships: scoped,
  annotations: [internal, cites("FR-009")],
});

/** The rules for second factors. */
export const mfaPolicy = concept("mfaPolicy", {
  definition: "The rules for second factors",
  attributes: {
    mfaPolicyId: key("the policy"),
    requirement: req(codeOf(c.mfaRequirement), "Whether a second factor is needed"),
    allowedKinds: many(codeOf(c.credentialKind), "The factors that may be used"),
    graceDays: req(integer(), "How long a user may go without one when it becomes required"),
    rememberDeviceDays: req(integer(), "How long a device is trusted not to be asked"),
    requiredForRoles: many(text(), "The roles whose holders must always use one, by key"),
  },
  identifiedBy: ["mfaPolicyId"],
  relationships: scoped,
  annotations: [internal, cites("FR-009")],
});

// ---------------------------------------------------------------- audit

/** Something that was done, or tried, kept in a chain of hashes so that it cannot be changed without showing. */
export const auditEvent = concept("auditEvent", {
  definition: "Something that was done, or tried, kept in a chain of hashes so that it cannot be changed without showing",
  attributes: {
    auditEventId: key("the event"),
    occurredAt: req(instant(), "When it happened"),
    actorKind: req(codeOf(c.actorKind), "What did it"),
    action: req(text(), "What was done, named `subject.verb`; each module adds its own"),
    outcome: req(codeOf(c.auditOutcome), "How it ended"),
    targetConcept: opt(text(), "The kind of thing it was done to"),
    targetKey: opt(text(), "The thing it was done to; a loose reference, so that the trail outlives what it names"),
    sessionKey: opt(text(), "The session it was done in; not a reference, because sessions are purged"),
    requestId: opt(text(), "The request it was part of"),
    ip: opt(text(), "Where it came from", held("IPAddress", "investigate what happened")),
    userAgent: opt(text(), "What the client says it is", held("UserAgent", "investigate what happened")),
    reason: opt(text(), "Why, where a reason was given"),
    detail: opt(structured(), "What else matters, with no secret in it"),
    previousHash: req(text(), "The hash of the event before it in the chain"),
    eventHash: req(text(), "The hash of this event and the one before"),
  },
  identifiedBy: ["auditEventId"],
  relationships: { tenant: maybe(tenant, "The tenant it was in"), actor: maybe(principal, "Who did it, where a principal did") },
  annotations: [restricted, keep(365), cites("FR-010"), unique("eventHash"), lookup("occurredAt")],
});

/** Every concept of the model, in the order they are written. */
export const concepts: readonly AnyConcept[] = [
  principal, userAccount, contactVerification, membership, userGroup, groupMember,
  permission, accessRole, rolePermission, roleAssignment, entitlement, accessPolicy, authorizationModel, relationTuple,
  credential, passwordCredential, passkey, otpSecret, recoveryCode, challenge, loginAttempt,
  device, loginSession, refreshToken,
  invitation, invitationRole, domainClaim, verifiedDomain,
  passwordPolicy, lockoutPolicy, sessionPolicy, mfaPolicy,
  auditEvent,
];
