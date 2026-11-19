// Spec: 0036-identity-pki FR-001, FR-002
/**
 * Public-key credentials as a module (commons data 0036-identity-pki): the trust anchors that certificates and keys are checked against, and the X.509 certificate as a credential of any principal,
 * a machine's or a device's. Only the public half is ever kept.
 *
 * @module
 */
import { type AnyConcept, codeOf, concept, defineModule, instant, text } from "@intellectual-frontiers/data/governance";
import { tenant } from "@intellectual-frontiers/data/models/arca-tenancy";
import { citing, credential, internal, key, list, lookup, many, maybe, one, opt, req, restricted, unique, useStatus } from "@intellectual-frontiers/data/models/identity";

const cites = citing("0036-identity-pki");
export const trustAnchorKind = list("trustAnchorKind", "What a trust anchor is", { x509: "A certificate authority's certificate", jwks: "A set of public keys published at an address" });

/** What certificates and keys are checked against. */
export const trustAnchor = concept("trustAnchor", {
  definition: "What certificates and keys are checked against: a certificate authority, or a set of public keys",
  attributes: {
    trustAnchorId: key("the trust anchor"),
    trustDomain: req(text(), "The domain of trust it anchors, such as a SPIFFE trust domain"),
    kind: req(codeOf(trustAnchorKind), "What it is"),
    material: req(text(), "The public certificate, or the address of the public keys; public by nature"),
    notAfter: opt(instant(), "When it stops being trusted"),
    status: req(codeOf(useStatus), "Whether it is trusted"),
  },
  identifiedBy: ["trustAnchorId"],
  relationships: { tenant: maybe(tenant, "The tenant it is for; empty for the platform's") },
  annotations: [internal, cites("FR-001")],
});

/** A certificate that a principal proves itself with; its identity is its credential's. */
export const certificate = concept("certificate", {
  definition: "A certificate that a principal proves itself with: only the public half is kept",
  attributes: {
    fingerprint: req(text(), "The SHA-256 thumbprint of the certificate, unique; it is also the value mutual TLS binds a token to"),
    serial: req(text(), "The certificate's serial number"),
    subjectName: req(text(), "The name the certificate is for"),
    sanUri: opt(text(), "The identifier in the certificate's alternative name, such as a SPIFFE ID"),
    sanDns: many(text(), "The domain names in the certificate's alternative name"),
    notBefore: req(instant(), "When the certificate starts to be valid"),
    notAfter: req(instant(), "When it stops"),
    keyAlgorithm: req(text(), "The algorithm of its key"),
    revokedReason: opt(text(), "Why it was revoked, where it was"),
  },
  identifiedBy: ["credential"],
  relationships: { credential: one(credential, "The credential it is"), issuer: maybe(trustAnchor, "The anchor that vouches for it") },
  annotations: [restricted, cites("FR-002"), unique("fingerprint"), lookup("notAfter")],
});

export const concepts: readonly AnyConcept[] = [trustAnchor, certificate];
export const identityPkiModule = defineModule({ name: "identityPki", definition: "Public-key credentials", requires: ["identity"], concepts, codeLists: [trustAnchorKind] });
