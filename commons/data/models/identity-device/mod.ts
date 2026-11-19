// Spec: 0038-identity-device FR-001, FR-002, FR-003
/**
 * Device identities as a module (commons data 0038-identity-device): a laptop, a phone, a server or a thing is a principal with an owner; what it can prove about itself (attestations); how it is
 * doing (posture, with typed columns for the common checks); and which sessions it carries. Decisions about a person can use the posture of the device they are on, and posture that has expired is
 * unknown, never compliant.
 *
 * @module
 */
import { type AnyConcept, boolean, codeOf, concept, defineModule, instant, integer, structured, text } from "@intellectual-frontiers/data/governance";
import { identityPkiModule } from "@intellectual-frontiers/data/models/identity-pki";
import { citing, confidential, held, key, keep, list, lookup, one, opt, loginSession, principal, req } from "@intellectual-frontiers/data/models/identity";

const cites = citing("0038-identity-device");
export const deviceKind = list("deviceKind", "What kind of device it is", { laptop: "A laptop", phone: "A phone", tablet: "A tablet", server: "A server", iot: "A thing with a network connection", other: "Something else" });
export const platform = list("platform", "What a device runs", { windows: "Windows", macos: "Apple's macOS", linux: "Linux, of any distribution", ios: "Apple's iOS", android: "Android", other: "Something else" }, true);
export const managementState = list("managementState", "How far an organization manages a device", { unmanaged: "Not known to the organization", registered: "Known, and not managed", managed: "Managed by the organization", retired: "No longer in use" });
export const ownership = list("ownership", "Whose a device is", { corporate: "The organization's", personal: "The person's own", shared: "Shared by several people" });
export const attestationKind = list("attestationKind", "What a device proves about itself", { tpm: "A trusted platform module's quote", platformAttestation: "The platform's attestation", webauthnAttestation: "A WebAuthn authenticator's attestation", spiffeNode: "A SPIFFE node attestation", cloudInstance: "A cloud instance's identity document", mdmEnrollment: "An enrollment in device management" });
export const attestationResult = list("attestationResult", "How an attestation was judged", { passed: "It passed", failed: "It failed", unknown: "It could not be judged" });
export const postureSource = list("postureSource", "What reported a device's posture", { mdm: "Device management", edr: "Endpoint detection and response", agent: "An agent on the device", manual: "A person" });
export const compliance = list("compliance", "Whether a device meets what is asked of it", { compliant: "It does", noncompliant: "It does not", unknown: "It is not known whether it does" });

/** A device: hardware that has an identity and an owner. Its identity is its principal's. */
export const device = concept("device", {
  definition: "Hardware that has an identity and an owner: an endpoint, a server or a thing",
  attributes: {
    deviceKind: req(codeOf(deviceKind), "What kind of device it is"),
    platform: req(codeOf(platform), "What it runs"),
    hardwareHash: req(text(), "A hash of its serial number or hardware identifier", held("DeviceBased", "tell one device from another")),
    label: opt(text(), "What it is called"),
    managementState: req(codeOf(managementState), "How far it is managed"),
    ownership: req(codeOf(ownership), "Whose it is"),
    enrolledAt: req(instant(), "When it was enrolled"),
    lastSeenAt: opt(instant(), "When it was last seen"),
    trustedUntil: opt(instant(), "Until when it is trusted without a fresh attestation"),
  },
  identifiedBy: ["principal"],
  relationships: { principal: one(principal, "The principal the device is") },
  annotations: [confidential, cites("FR-001"), lookup("hardwareHash")],
});

/** What a device proved about itself. */
export const deviceAttestation = concept("deviceAttestation", {
  definition: "What a device proved about itself, and how it was judged",
  attributes: {
    deviceAttestationId: key("the attestation"),
    kind: req(codeOf(attestationKind), "What was proved"),
    evidenceHash: req(text(), "A hash of the evidence; the evidence is kept by the verifier"),
    verifier: req(text(), "What judged it"),
    result: req(codeOf(attestationResult), "How it was judged"),
    attestedAt: req(instant(), "When it was judged"),
    expiresAt: req(instant(), "When it stops counting"),
    nonceHash: req(text(), "A hash of the nonce the device was challenged with"),
  },
  identifiedBy: ["deviceAttestationId"],
  relationships: { device: one(device, "The device") },
  annotations: [confidential, keep(90), cites("FR-002"), lookup("device", "attestedAt")],
});

/** How a device was doing when it last reported: typed columns for the usual checks, a bag only for the rest. */
export const devicePosture = concept("devicePosture", {
  definition: "How a device was doing when it last reported; after its time is up it reads as unknown, never as compliant",
  attributes: {
    devicePostureId: key("the report"),
    source: req(codeOf(postureSource), "What reported it"),
    compliance: req(codeOf(compliance), "Whether the device meets what is asked of it"),
    osVersion: opt(text(), "The version of what it runs"),
    diskEncrypted: opt(boolean(), "Whether its storage is encrypted"),
    screenLock: opt(boolean(), "Whether it locks its screen"),
    firewall: opt(boolean(), "Whether its firewall is on"),
    jailbroken: opt(boolean(), "Whether it has been broken out of its platform's protections"),
    edrActive: opt(boolean(), "Whether endpoint detection is running"),
    patchAgeDays: opt(integer(), "How many days old its latest patch is"),
    riskScore: opt(integer(), "A score from its reporter"),
    details: opt(structured(), "What else was reported"),
    reportedAt: req(instant(), "When it was reported"),
    validUntil: req(instant(), "When the report stops counting"),
  },
  identifiedBy: ["devicePostureId"],
  relationships: { device: one(device, "The device") },
  annotations: [confidential, keep(30), cites("FR-003"), lookup("device", "reportedAt")],
});

/** A session of a person that is on a device, so that a decision about the person can use the device's posture. */
export const deviceSession = concept("deviceSession", {
  definition: "A session of a person that is on a device, so that a decision about the person can use the device's posture",
  attributes: { boundAt: req(instant(), "When the session was bound to the device") },
  identifiedBy: ["device", "session"],
  relationships: { device: one(device, "The device"), session: one(loginSession, "The session") },
  annotations: [confidential, keep(90), cites("FR-003")],
});

export const concepts: readonly AnyConcept[] = [device, deviceAttestation, devicePosture, deviceSession];
export const identityDeviceModule = defineModule({
  name: "identityDevice",
  definition: "Device identities: endpoints, servers and things",
  requires: [identityPkiModule.name],
  concepts,
  codeLists: [deviceKind, platform, managementState, ownership, attestationKind, attestationResult, postureSource, compliance],
});
