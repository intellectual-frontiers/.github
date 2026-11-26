// Spec: 0007-ssh-server-dedupe-and-forward FR-008
// Spec: 0007-ssh-server-dedupe-and-forward FR-009
/**
 * The decision of a forward, pure. A device with an enrolled key may open one forward to one loopback port its policy names, and nothing else: no other host, no other port, no socket, no remote forward, no second forward and none before its key is proven.
 *
 * @module
 */
import { MAX_FORWARDS_PER_DEVICE } from "@intellectual-frontiers/ssh-server/governance";
import type { Fingerprint, ForwardRule, ServerPolicy, ServiceAccount } from "@intellectual-frontiers/ssh-server/governance";

/** What the client asked for: `direct-tcpip` is `ssh -L`; the others are named so that they are refused with a reason. */
export type ForwardKind = "direct-tcpip" | "streamlocal" | "tcpip-forward";

/** What the server knows when a forward is asked for. */
export type ForwardRequest = {
  readonly kind: ForwardKind;
  /** The account the connection authenticated as. */
  readonly account: ServiceAccount | undefined;
  /** The key the connection proved with a verified signature, if any. */
  readonly proven: Fingerprint | undefined;
  /** Whether that key belongs to an enrolled device that is not revoked. */
  readonly enrolled: boolean;
  readonly destHost: string;
  readonly destPort: number;
  /** How many forwards this device holds now, over all its connections. */
  readonly open: number;
};

/** The decision: accept with the rule that allows it, or refuse with the reason that goes in the audit. */
export type ForwardDecision = { readonly kind: "accept"; readonly rule: ForwardRule } | { readonly kind: "refuse"; readonly reason: string };

/** Decide a forward. The reasons never name a key. */
export function forwardDecision(policy: Pick<ServerPolicy, "forwards">, request: ForwardRequest): ForwardDecision {
  if (request.kind === "tcpip-forward") return { kind: "refuse", reason: "a remote forward is refused: this door has no remote forward" };
  if (request.kind === "streamlocal") return { kind: "refuse", reason: "a socket forward is refused" };
  if (request.proven === undefined) return { kind: "refuse", reason: "a forward before the key is proven is refused" };
  if (request.account !== "s-device") return { kind: "refuse", reason: "only an enrolled device may forward" };
  if (!request.enrolled) return { kind: "refuse", reason: "the key is not an enrolled device's, or it is revoked" };
  const rule = policy.forwards.find((r) => r.account === request.account);
  if (rule === undefined) return { kind: "refuse", reason: "no forward is allowed by the policy" };
  if (request.destHost !== "127.0.0.1" || request.destPort !== rule.port) return { kind: "refuse", reason: `the forward goes to 127.0.0.1:${rule.port} only, not ${request.destHost}:${request.destPort}` };
  if (request.open >= MAX_FORWARDS_PER_DEVICE) return { kind: "refuse", reason: "this device holds a forward already" };
  return { kind: "accept", rule };
}
