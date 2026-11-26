// Spec: 0005-reach-and-targets FR-008
/**
 * The inbound side of ssh (commons headless 0005-reach-and-targets FR-008): not a model of its own, but what is generated from the governance reach policy so that
 * the machine that is reached is configured to let in exactly what the policy allows: the lines of `authorized_keys` that force a key to one command (`restrict,
 * command="<program> mcp"`, or the run-json entry `<program> run --ssh`, with `--read-only` for a key that may only read), and the `Match` block of `sshd_config`
 * that takes away what a forced command does not need (a terminal, forwarding, an agent). It writes text and reads no file.
 *
 * @remarks
 * A public key is not a secret, but a private one MUST NOT reach this: a text that is not one public key line is refused, naming no part of it.
 *
 * @example
 * ```ts
 * import { authorizedKeysLine } from "./mod.ts";
 * authorizedKeysLine({ program: "ops", mode: "mcp", key: { name: "probe", publicKey: "ssh-ed25519 AAAAC3Nza probe", role: "full" } });
 * // { kind: "ok", value: 'restrict,command="ops mcp" ssh-ed25519 AAAAC3Nza probe' }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Channel, type Reached } from "@intellectual-frontiers/headless/governance";

/** What a key may do: only run what reads, or run what the policy lets its channel run. */
export type KeyRole = "read-only" | "full";

/** A key to let in: its name (for a person), the public key line, its role, and the addresses it may come from. */
export type InboundKey = { readonly name: string; readonly publicKey: string; readonly role: KeyRole; readonly from?: readonly string[] };

/** The forced commands: a tool server over ssh, one run of a verb with a JSON report, or a program that is not ours to run and that reads only (a probe script), forced as it is. */
export type InboundMode = "mcp" | "run" | "program";

const KEY = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+={0,2}(?: [^\n\r]*)?$/;
const PROGRAM = /^[A-Za-z0-9_./-]+$/;
const FROM = /^[A-Za-z0-9.:*?!/_-]+$/;

/** The command a mode forces, for a role: `<program> mcp` or `<program> run --ssh`, with `--read-only` for a key that may only read; for the mode `program`, the program alone, which is what it is that reads only. */
export function forcedCommand(program: string, mode: InboundMode, role: KeyRole): string {
  if (mode === "program") return program;
  return `${program} ${mode === "mcp" ? "mcp" : "run --ssh"}${role === "read-only" ? " --read-only" : ""}`;
}

/** One line of `authorized_keys`, or why it cannot be made: a program name that could break out of the quotes, an address pattern that is not one, or a text that is not one public key. */
export function authorizedKeysLine(i: { readonly program: string; readonly mode: InboundMode; readonly key: InboundKey }): Result<string, string> {
  if (!PROGRAM.test(i.program)) return err(`${JSON.stringify(i.program)} is not a program name that can stand in a forced command`);
  if (!KEY.test(i.key.publicKey.trim()) || /PRIVATE KEY/.test(i.key.publicKey)) return err(`the key ${i.key.name} is not one public key line`);
  for (const f of i.key.from ?? []) if (!FROM.test(f)) return err(`${JSON.stringify(f)} is not an address pattern`);
  const options = ["restrict", ...(i.key.from === undefined || i.key.from.length === 0 ? [] : [`from="${i.key.from.join(",")}"`]), `command="${forcedCommand(i.program, i.mode, i.key.role)}"`];
  return ok(`${options.join(",")} ${i.key.publicKey.trim()}`);
}

/** The modes the policy of the actions lets a key into: a tool server where any action is reached through `mcp`, a run of a verb where any is reached through `ssh`; for a read-only key, only by actions that read. */
export function modesFor(actions: readonly Reached[], role: KeyRole): readonly InboundMode[] {
  const reaches = (c: Channel): boolean => actions.some((a) => a.reach !== undefined && a.reach.channels.includes(c) && (role === "full" || a.reach.readOnly));
  return [...(reaches("mcp") ? (["mcp"] as const) : []), ...(reaches("ssh") ? (["run"] as const) : [])];
}

/** What is generated: the lines of `authorized_keys` (a key for each mode its policy allows), and what could not be made. */
export type InboundPlan = { readonly lines: readonly string[]; readonly problems: readonly string[] };

/** The `authorized_keys` lines for the keys, from the reach policy of the actions: no line for a mode no action is reached through, none at all where nothing is. */
export function inboundPlan(program: string, actions: readonly Reached[], keys: readonly InboundKey[]): InboundPlan {
  const lines: string[] = [];
  const problems: string[] = [];
  const unreached = actions.filter((a) => a.reach === undefined).map((a) => a.facts.id);
  for (const id of unreached) problems.push(`${id} has no reach policy, so no key is let in to it`);
  for (const key of keys) {
    const modes = modesFor(actions, key.role);
    if (modes.length === 0) problems.push(`the key ${key.name} (${key.role}) is let into nothing: no action is reached through ssh or mcp${key.role === "read-only" ? " that only reads" : ""}`);
    for (const mode of modes) {
      const line = authorizedKeysLine({ program, mode, key });
      if (line.kind === "ok") lines.push(line.value);
      else problems.push(line.error);
    }
  }
  return { lines, problems };
}

/** What a `Match` block is for: the account the keys log in as, and optionally the addresses it is limited to. */
export type MatchInput = { readonly user: string; readonly addresses?: readonly string[] };

/** The `Match` block of `sshd_config` for the account: only public keys, no terminal, no forwarding of any kind, no agent, no personal rc file. A user name that is not one is refused. */
export function matchBlock(i: MatchInput): Result<string, string> {
  if (!/^[a-z_][a-z0-9_-]*$/.test(i.user)) return err(`${JSON.stringify(i.user)} is not an account name`);
  for (const a of i.addresses ?? []) if (!FROM.test(a)) return err(`${JSON.stringify(a)} is not an address pattern`);
  const head = `Match User ${i.user}${i.addresses === undefined || i.addresses.length === 0 ? "" : ` Address ${i.addresses.join(",")}`}`;
  return ok(
    [head, "    AuthenticationMethods publickey", "    PasswordAuthentication no", "    PermitTTY no", "    AllowTcpForwarding no", "    AllowStreamLocalForwarding no", "    AllowAgentForwarding no", "    X11Forwarding no", "    PermitTunnel no", "    PermitUserRC no", ""].join("\n"),
  );
}

