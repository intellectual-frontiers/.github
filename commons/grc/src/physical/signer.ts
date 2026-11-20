// Spec: 0006-grc-evidence FR-005, FR-006, FR-007
/**
 * The signer port and attestation (0006-grc-evidence): a signer signs and verifies a payload in an envelope and says how its keys are held; the evidence policy decides which custody is enough and
 * which roles may attest. The port is structural: the envelope is `{ payloadType, payload (base64), signatures }` and a key is whatever the signer takes, so that a signer of another kind
 * (a file of allowed signers, a hardware token) plugs in without this layer knowing it.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { CUSTODIES, type Custody, type EvidencePolicy, createRegistry, provenanceOf, type Registry } from "@intellectual-frontiers/grc/governance";
import { type Attestation, canonicalize } from "@intellectual-frontiers/grc/logical";

/** A signed payload. */
export type Envelope = {
  readonly payloadType: string;
  readonly payload: string;
  readonly signatures: readonly { readonly keyid?: string; readonly sig: string }[];
};

/** Why a signer did not sign or verify. */
export type SignProblem = { readonly kind: "key" | "signature" | "payload-type"; readonly message: string };

/** A signer. */
export type Signer = {
  readonly id: string;
  /** How its keys are held. */
  readonly custody: Custody;
  sign(payloadType: string, payload: Uint8Array, keys: readonly unknown[]): Promise<Result<Envelope, SignProblem>>;
  /** The payload, where at least one of the keys (public) verifies a signature. */
  verify(envelope: Envelope, payloadType: string, keys: readonly unknown[]): Promise<Result<Uint8Array, SignProblem>>;
};

/** A registry of signers. */
export type Signers = Registry<Signer>;

/** A registry of signers, empty. */
export function createSigners(): Signers {
  return createRegistry<Signer>("signer");
}

/** Whether the signer's custody is at least what the policy needs (`none < file < managed < hardware`). */
export function signerAllowed(policy: EvidencePolicy, signer: Signer): boolean {
  return CUSTODIES.indexOf(signer.custody) >= CUSTODIES.indexOf(policy.custody);
}

/** Whether a role may attest by the policy. */
export function mayAttest(policy: EvidencePolicy, role: string): boolean {
  return policy.attesters.includes(role);
}

/** Why an attestation was refused. */
export type AttestProblem = { readonly kind: "role" | "custody" | "signing"; readonly message: string };

/** What an attestation says. */
export type AttestInput = {
  readonly subject: string;
  readonly check: string;
  readonly claim: "pass" | "fail";
  readonly statement: string;
  readonly attester: string;
  readonly role: string;
  readonly evidence: readonly string[];
  readonly at: string;
};

/** The attestation, signed by `signer` with `keys` where the policy needs a key (custody above `none`); refused, saying which of the two failed, where the role may not attest or the signer's custody is too weak. */
export async function attest(policy: EvidencePolicy, signer: Signer | undefined, keys: readonly unknown[], input: AttestInput): Promise<Result<Attestation, AttestProblem>> {
  if (!mayAttest(policy, input.role)) return err({ kind: "role", message: `the role ${input.role} may not attest: ${policy.attesters.join(", ") || "no role"} may` });
  const base: Attestation = {
    kind: "grc.attestation",
    schema: "1",
    id: `attestation:${input.check}:${input.subject}:${input.at}`,
    createdAt: input.at,
    provenance: provenanceOf([...input.evidence], input.attester),
    subject: input.subject,
    check: input.check,
    claim: input.claim,
    statement: input.statement,
    attester: input.attester,
    role: input.role,
    evidence: input.evidence,
  };
  if (policy.custody === "none") return ok(base);
  if (signer === undefined || !signerAllowed(policy, signer)) {
    return err({ kind: "custody", message: `the policy needs custody of ${policy.custody}, and ${signer === undefined ? "no signer was given" : `the signer ${signer.id} has ${signer.custody}`}` });
  }
  const signed = await signer.sign("application/vnd.grc.attestation+json", new TextEncoder().encode(canonicalize(base)), keys);
  if (signed.kind === "err") return err({ kind: "signing", message: signed.error.message });
  return ok({ ...base, signer: signer.id, signature: JSON.stringify(signed.value) });
}
