// Spec: 0003-server-policy FR-001, FR-002, FR-003
/**
 * The decision of an authentication, pure. The server accepts one username. A public key is proof only where its signature was verified over this session: the offer of a key without a signature is a query, answered as one and never taken as proof.
 *
 * @module
 */
import { accountOf } from "@intellectual-frontiers/ssh-server/governance";
import type { Fingerprint, ServerPolicy } from "@intellectual-frontiers/ssh-server/governance";

/** An authentication method as the protocol names it. */
export type AuthMethod = "none" | "publickey" | "password" | "keyboard-interactive" | "hostbased";

/** What a client attempted. For a public key: its fingerprint, whether a signature came with it and whether that signature verified. */
export type AuthAttempt = {
  readonly username: string;
  readonly method: AuthMethod;
  readonly key?: { readonly fingerprint: Fingerprint; readonly signed: boolean; readonly verified: boolean; /** Whether a store knows the key as an enrolled device's. Needed only for accounts that require a proven key. */ readonly known?: boolean };
};

/** What the connection has done so far. */
export type AuthState = { readonly failures: number };

/** The decision. `accept` carries the fingerprint the client proved, if it proved one. */
export type AuthDecision =
  | { readonly kind: "accept"; readonly proven?: Fingerprint }
  | { readonly kind: "accept-query" }
  | { readonly kind: "prompt" }
  | { readonly kind: "reject"; readonly methods: readonly AuthMethod[]; readonly reason: string; readonly disconnect: boolean };

/** Decide an authentication. */
export function authDecision(policy: Pick<ServerPolicy, "accounts" | "anonymous" | "maxAuthTries">, attempt: AuthAttempt, state: AuthState): AuthDecision {
  const spec = accountOf(attempt.username);
  const open = spec?.name === "s-enroll";
  const methods: AuthMethod[] = ["publickey", ...(open && policy.anonymous === "keyboard-interactive" ? (["keyboard-interactive"] as const) : [])];
  if (state.failures >= policy.maxAuthTries) return { kind: "reject", methods: [], reason: "too many attempts", disconnect: true };
  if (spec === undefined || !spec.built || !policy.accounts.includes(spec.name)) return { kind: "reject", methods: ["publickey"], reason: "unknown username", disconnect: false };
  switch (attempt.method) {
    case "none":
      return open && policy.anonymous === "none" ? { kind: "accept" } : { kind: "reject", methods, reason: "a method is needed", disconnect: false };
    case "publickey": {
      const k = attempt.key;
      if (k === undefined) return { kind: "reject", methods, reason: "no key", disconnect: false };
      if (!open && k.known !== true) return { kind: "reject", methods, reason: "this key is not an enrolled device's", disconnect: false };
      if (!k.signed) return { kind: "accept-query" };
      return k.verified ? { kind: "accept", proven: k.fingerprint } : { kind: "reject", methods, reason: "the signature did not verify", disconnect: false };
    }
    case "keyboard-interactive":
      return open && policy.anonymous === "keyboard-interactive" ? { kind: "prompt" } : { kind: "reject", methods, reason: "refused method", disconnect: false };
    default:
      return { kind: "reject", methods, reason: "refused method", disconnect: false };
  }
}
