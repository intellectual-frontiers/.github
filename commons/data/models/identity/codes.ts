// Spec: 0030-identity FR-001, FR-004
/**
 * The code lists of the identity model (commons data 0030-identity): the kinds, statuses and methods that its concepts name. Each is closed (a new value is a change of the model), except where a
 * list says it is open.
 *
 * @module
 */
import { list } from "./kit.ts";

export const principalKind = list("principalKind", "What can be granted a role, own a key or act", {
  user: "A person who signs in",
  machine: "A service, a workload, a pipeline or an integration: a program that acts for itself",
  device: "A managed endpoint, a server or a thing: hardware that has an identity",
  agent: "An AI agent: software that decides for itself what to do, and is accountable to an owner",
  group: "A set of principals, granted what its members are",
});
export const principalStatus = list("principalStatus", "Where a principal is in its life", {
  pending: "Made, and not yet usable",
  active: "In use, and able to act",
  suspended: "Held by an administrator, with nothing lost",
  disabled: "Switched off: it can do nothing, and its credentials and delegations stop working",
  deleted: "Ended, with what is personal erased and the record kept for the audit trail",
});
export const decision = list("decision", "What an authorization decision was", { allow: "It was allowed", deny: "It was refused" });
export const createdVia = list("createdVia", "How a user account came to be", {
  invited: "By an invitation that was accepted",
  selfSignup: "By the person signing up",
  directory: "By a directory that pushed it",
  federated: "By signing in through an identity provider for the first time",
  admin: "By an administrator",
});
export const membershipStatus = list("membershipStatus", "Where a membership is", {
  invited: "Offered and not yet accepted",
  active: "In force, and the user is a member",
  suspended: "Held by an administrator, and nothing is lost",
  removed: "Ended, and the user is no longer a member",
});
export const membershipSource = list("membershipSource", "How a user came to be a member of a tenant", {
  invited: "By an invitation that was accepted",
  directory: "Pushed by a directory",
  domainCapture: "Captured by the tenant's verified domain",
  selfJoin: "Joined on their own",
  admin: "Added by an administrator",
});
export const groupSource = list("groupSource", "Where a group is kept", { local: "Made and kept here", directory: "Kept by a directory and mirrored here" });




export const credentialKind = list("credentialKind", "What a principal proves itself with", {
  password: "A secret the person remembers",
  passkey: "A key pair held by the person's device, signed with by WebAuthn",
  totp: "A code made from a shared secret and the time",
  securityKey: "A hardware key",
  smsOtp: "A code sent by text message",
  emailOtp: "A code sent by email",
  recoveryCode: "A code kept for when the other ways are lost",
  pushDevice: "A device that is asked to approve",
  apiKey: "A random secret that a program presents, kept as a keyed hash",
  clientSecret: "A secret that an OAuth client presents, kept as a hash",
  keyPair: "A key pair, of which only the public half is kept",
  certificate: "A certificate, of which only the public half is kept",
  workloadAttestation: "What a platform says of the workload that runs",
}, true);
export const credentialStatus = list("credentialStatus", "Where a credential is", { active: "In use, and trusted", revoked: "Ended by a person or a policy", expired: "Ended by time" });
export const passwordAlgorithm = list("passwordAlgorithm", "How a password is hashed", { argon2id: "The memory-hard Argon2id hash", scrypt: "The memory-hard scrypt hash", bcrypt: "The bcrypt hash", pbkdf2: "The PBKDF2 key derivation" }, true);
export const otpAlgorithm = list("otpAlgorithm", "The hash a one-time code is made with", { sha1: "The SHA-1 hash, the default of authenticator apps", sha256: "The SHA-256 hash", sha512: "The SHA-512 hash" });
export const challengePurpose = list("challengePurpose", "What a challenge is for", {
  login: "Signing in",
  emailVerification: "Proving an address is the person's",
  passwordReset: "Choosing a new password",
  magicLink: "Signing in by a link",
  stepUp: "Proving again before something that matters",
  passkeyRegistration: "Registering a passkey",
  passkeyAuthentication: "Signing in with a passkey",
});
export const loginOutcome = list("loginOutcome", "How a sign-in attempt ended", {
  success: "It succeeded",
  wrongSecret: "The secret was wrong",
  unknownUser: "There was no such user",
  locked: "The account was locked",
  mfaFailed: "The second factor failed",
  blocked: "A policy refused it",
});
export const sessionStatus = list("sessionStatus", "Where a session is", { active: "In use, and valid", expired: "Ended by time", revoked: "Ended by a person or a policy", signedOut: "Ended by the user" });
export const assuranceLevel = list("assuranceLevel", "How sure a session is of who it is for, in the sense of NIST SP 800-63B", {
  aal1: "One factor",
  aal2: "Two factors",
  aal3: "Two factors, one a hardware key",
});
export const authMethod = list("authMethod", "How a session was authenticated", {
  password: "By a password",
  passkey: "By a passkey",
  totp: "By a one-time code",
  federated: "Through an identity provider",
  recoveryCode: "By a recovery code",
  magicLink: "By a link",
});
export const revokedReason = list("revokedReason", "Why a session ended early", {
  user: "The user ended it",
  admin: "An administrator ended it",
  reuseDetected: "A refresh token was used twice",
  policy: "A policy ended it",
  passwordChange: "The password was changed",
  risk: "A risk signal ended it",
});
export const invitationStatus = list("invitationStatus", "Where an invitation is", { pending: "Sent, and waiting to be taken up", accepted: "Taken up by the person invited", expired: "Left until it ran out", revoked: "Withdrawn" });
export const claimMethod = list("claimMethod", "How a domain is proved to be a tenant's", { dnsTxt: "By a DNS TXT record", httpFile: "By a file on the domain's site", email: "By an email to an address of the domain" });
export const claimStatus = list("claimStatus", "Where a claim on a domain is", { pending: "Waiting to be proved", failed: "Not proved", expired: "Left until it ran out" });
export const domainPolicy = list("domainPolicy", "What a verified domain makes of those who sign in with it", {
  none: "Nothing follows from it",
  captureUsers: "Their accounts join the tenant",
  enforceSso: "They must sign in through the tenant's identity provider",
});
export const unlockMode = list("unlockMode", "How a locked account is freed", { timer: "By time passing", admin: "By an administrator", selfService: "By the user proving who they are" });
export const mfaRequirement = list("mfaRequirement", "Whether a second factor is needed", { none: "Never asked for", optional: "Asked for if the user chooses to", required: "Always asked for", adaptive: "Asked for when the risk calls for it" });
export const actorKind = list("actorKind", "What did something", { user: "A person acting for themselves", machine: "A program", device: "A device", agent: "An AI agent", system: "The platform itself, with no one acting", impersonator: "A person acting as another, with leave" });
export const auditOutcome = list("auditOutcome", "How something that was tried ended", { success: "It was done", failure: "It failed", denied: "It was refused" });

export const verificationMethod = list("verificationMethod", "How an address was proved to be a person's", {
  emailLink: "By a link sent to it",
  otp: "By a code sent to it",
  directoryAsserted: "By the directory it came from",
  admin: "By an administrator",
});

export const useStatus = list("useStatus", "Whether a thing is in use", { active: "In use, and applied", retired: "No longer applied, and kept for the record" });
