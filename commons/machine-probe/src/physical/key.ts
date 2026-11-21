// Spec: 0002-machine-probe-contract FR-002
/**
 * The line of `authorized_keys` that restricts a public key to the probe: the inbound surface of Headless makes it (`restrict`, so no terminal, no forwarding and no other service; the probe forced as it is), and a key that is not one public
 * line, a private key in particular, is refused there.
 *
 * @example
 * ```ts
 * import { probeKeyLine } from "./key.ts";
 * probeKeyLine("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEXAMPLE probe@fleet").kind; // "ok"
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import { authorizedKeysLine } from "@intellectual-frontiers/headless/ssh-inbound";
import { PROBE_PATH, PROBE_PROGRAM } from "@intellectual-frontiers/machine-probe/governance";

/** The line for a public key (its own comment, which names it, included), limited to the addresses it may come from where they are given. */
export function probeKeyLine(publicKey: string, from?: readonly string[]): Result<string, string> {
  return authorizedKeysLine({ program: PROBE_PATH, mode: "program", key: { name: PROBE_PROGRAM, publicKey, role: "read-only", ...(from === undefined ? {} : { from }) } });
}
