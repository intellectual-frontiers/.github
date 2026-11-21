// Spec: 0002-change-control-policy FR-001, FR-002
/**
 * What a fleet decides about its own changes, as data: who the signers are (a name, a role, a public key), which paths are controlled and the roles whose approval a change to them needs. Nothing here reads Git or a key.
 *
 * @example
 * ```ts
 * import { SIGNER_NAME } from "./policy.ts";
 * SIGNER_NAME.test("snshah-daily"); // true
 * ```
 *
 * @module
 */

/** A name of a signer or a role: lowercase letters, digits, dots and dashes, starting with a letter or a digit (it stands as the principal of an `allowed_signers` line). */
export const SIGNER_NAME = /^[a-z0-9][a-z0-9._-]{0,62}$/;

/** The public keys that Git can verify a signature with. */
export const KEY_LINE = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+={0,2}(?: [^\n\r]*)?$/;

/** A signer of the fleet: its name (the principal of its signature), its role and its public key. */
export type Signer = { readonly name: string; readonly role: string; readonly key: string; readonly added?: string };

/** A path (or a family of paths) whose changes need approval, and the roles of the signers who may approve a change to it. A `*` stands for any characters but `/` and `**` for any characters. */
export type Controlled = { readonly path: string; readonly approvers: readonly string[] };

/** What a fleet decides about its changes. */
export type Policy = { readonly signers: readonly Signer[]; readonly controlled: readonly Controlled[] };

/** The state of the signature of a commit as Git says it: `G` good, `B` bad, `U` good by a key that is not trusted, `X` good but expired, `Y` good by an expired key, `R` good by a revoked key, `E` it could not be checked, `N` none. */
export type SignatureState = "G" | "B" | "U" | "X" | "Y" | "R" | "E" | "N";
