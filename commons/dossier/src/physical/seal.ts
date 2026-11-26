// Spec: 0002-dossier-core FR-012
/**
 * The seal of a dossier (0046-dossiers FR-063): a person's signature of the digest of its manifest with an SSH key, in the namespace `ifc-dossier` (so that a signature made for something else does not verify here), made with the signer of `grc`, and verified without a program.
 * A seal covers a manifest: where the manifest has changed, the seal is refused.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Json, Manifest, Seal } from "@intellectual-frontiers/dossier/governance";
import { manifestDigest } from "@intellectual-frontiers/dossier/logical";
import { canonicalize } from "@intellectual-frontiers/grc/logical";
import type { Envelope } from "@intellectual-frontiers/grc/physical";
import { parseNamespace, type SignKey, sshsigSignerFor } from "@intellectual-frontiers/grc/signers/sshsig";

/** The payload type of a seal. */
export const SEAL_TYPE = "application/vnd.ifc.dossier-seal+json";

/** The namespace of the signature of a seal. */
export const SEAL_NAMESPACE = "ifc-dossier";

const signer = () => {
  const ns = parseNamespace(SEAL_NAMESPACE);
  if (ns.kind === "err") throw new Error(ns.error);
  return sshsigSignerFor(ns.value);
};

/** The person who seals, and in what role. */
export interface Authority {
  readonly person: string;
  readonly role: string;
  readonly signedAt: string;
}

/** The seal of a manifest by a person with their key. Only a person's act: the caller is the command of a person, and an agent has no such call. */
export async function sealManifest(m: Manifest, who: Authority, key: SignKey): Promise<Result<Seal, string>> {
  const digest = await manifestDigest(m);
  const payload = new TextEncoder().encode(canonicalize({ manifest: digest, authority: who.person, role: who.role, signedAt: who.signedAt }));
  const signed = await signer().sign(SEAL_TYPE, payload, [key]);
  if (signed.kind === "err") return err(signed.error.message);
  return ok({ manifest: digest, authority: who.person, role: who.role, signedAt: who.signedAt, envelope: signed.value as unknown as Json });
}

/** Whether a seal covers this manifest and was signed by the key given: the digest of the manifest is the seal's, the payload names the same person, role and date, and the signature verifies in the namespace. */
export async function verifySeal(seal: Seal, m: Manifest, publicKey: string): Promise<Result<true, string>> {
  const digest = await manifestDigest(m);
  if (digest !== seal.manifest) return err(`the manifest has changed since it was sealed (${seal.manifest} then, ${digest} now)`);
  const payload = await signer().verify(seal.envelope as unknown as Envelope, SEAL_TYPE, [{ publicKey }]);
  if (payload.kind === "err") return err(`the signature does not verify: ${payload.error.message}`);
  const said = canonicalize({ manifest: digest, authority: seal.authority, role: seal.role, signedAt: seal.signedAt });
  return new TextDecoder().decode(payload.value) === said ? ok(true) : err("the signature covers other words than the seal states");
}
