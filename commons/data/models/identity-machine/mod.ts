// Spec: 0037-identity-machine FR-001, FR-002, FR-003
/**
 * Machine identities as a module (commons data 0037-identity-machine): services, workloads, pipelines and integrations, each a principal with an accountable owner; the workload identity that
 * a platform vouches for (a SPIFFE ID, a Kubernetes service account, an OIDC subject, a certificate), API keys that are never wider than their owner, and public keys.
 *
 * @module
 */
import { type AnyConcept, boolean, codeOf, concept, defineModule, instant, integer, structured, text } from "@intellectual-frontiers/data/governance";
import { identityPkiModule } from "@intellectual-frontiers/data/models/identity-pki";
import { citing, confidential, credential, key, list, lookup, many, maybe, one, opt, principal, req, restricted, unique, useStatus } from "@intellectual-frontiers/data/models/identity";

const cites = citing("0037-identity-machine");
export const machineKind = list("machineKind", "What kind of program a machine is", { service: "A service that others call", workload: "A workload that a platform runs", pipeline: "A pipeline that builds or deploys", integration: "An integration with another system", bot: "A bot that acts on a schedule or an event" });
export const environment = list("environment", "Where a machine runs", { production: "Production", staging: "Staging", development: "Development", test: "Testing, with nothing real in it" }, true);
export const issuerKind = list("issuerKind", "What vouches for a workload", { spiffe: "A SPIFFE trust domain", kubernetes: "A Kubernetes cluster", oidc: "An OpenID Connect issuer", cloud: "A cloud provider's workload identity", mtls: "A certificate" });

/** A machine: a program that acts for itself, with a person or a group accountable for it. Its identity is its principal's. */
export const machine = concept("machine", {
  definition: "A program that acts for itself, with a person or a group accountable for it",
  attributes: {
    machineKind: req(codeOf(machineKind), "What kind of program it is"),
    purpose: req(text(), "What it is for"),
    environment: opt(codeOf(environment), "Where it runs"),
    isBreakGlass: req(boolean(), "Whether it is an account kept for emergencies, whose every use is reviewed"),
    maxCredentialDays: opt(integer(), "The longest a credential of the machine may live"),
    reviewBy: opt(instant(), "When the machine must next be reviewed by its owner"),
  },
  identifiedBy: ["principal"],
  relationships: { principal: one(principal, "The principal the machine is") },
  annotations: [confidential, cites("FR-001"), lookup("reviewBy")],
});

/** What a platform vouches for about a workload: a machine proves itself by this instead of by a secret. */
export const workloadIdentity = concept("workloadIdentity", {
  definition: "What a platform vouches for about a workload, so that a machine proves itself by it instead of by a secret",
  attributes: {
    workloadIdentityId: key("the binding"),
    issuerKind: req(codeOf(issuerKind), "What vouches for it"),
    issuer: req(text(), "The issuer"),
    subject: req(text(), "The workload's name for the issuer: a SPIFFE ID, a service account, a subject, a thumbprint"),
    trustDomain: opt(text(), "The trust domain"),
    audience: opt(text(), "The audience the proof must be for"),
    selectors: many(text(), "What must all match, as SPIRE's selectors do"),
    status: req(codeOf(useStatus), "Whether the binding is applied"),
    bindingKey: req(text(), "A hash of the issuer and the subject, unique"),
  },
  identifiedBy: ["workloadIdentityId"],
  relationships: { machine: one(machine, "The machine the workload is") },
  annotations: [confidential, cites("FR-002"), unique("bindingKey")],
});

/** An API key: a random secret kept as a keyed hash, never wider in authority than its owner. Its identity is its credential's. */
export const apiKey: AnyConcept = concept("apiKey", {
  definition: "A random secret that a program presents, kept as a keyed hash and shown once, never wider in authority than its owner",
  attributes: {
    prefix: req(text(), "The part that is not secret, by which the key is found, unique"),
    secretHash: req(text(), "The keyed hash of the secret"),
    scopes: many(text(), "The permissions the key may use: the owner's, narrowed to these"),
    allowedCidrs: many(text(), "The networks it may be used from"),
    lastUsedAt: opt(instant(), "When it was last used"),
  },
  identifiedBy: ["credential"],
  relationships: { credential: one(credential, "The credential it is"), rotatedFrom: maybe(() => apiKey, "The key it replaced") },
  annotations: [restricted, cites("FR-003"), unique("prefix")],
});

/** A public key that a principal proves itself with by signing; the private half is never kept. */
export const keyCredential = concept("keyCredential", {
  definition: "A public key that a principal proves itself with by signing; the private half is never kept",
  attributes: {
    publicJwk: req(structured(), "The public key as a JSON Web Key"),
    thumbprint: req(text(), "The RFC 7638 thumbprint of the key, unique; it is also what a proof of possession binds a token to"),
    algorithm: req(text(), "The signing algorithm"),
  },
  identifiedBy: ["credential"],
  relationships: { credential: one(credential, "The credential it is") },
  annotations: [restricted, cites("FR-003"), unique("thumbprint")],
});

export const concepts: readonly AnyConcept[] = [machine, workloadIdentity, apiKey, keyCredential];
export const identityMachineModule = defineModule({
  name: "identityMachine",
  definition: "Machine identities: services, workloads, pipelines and integrations",
  requires: [identityPkiModule.name],
  concepts,
  codeLists: [machineKind, environment, issuerKind],
});
