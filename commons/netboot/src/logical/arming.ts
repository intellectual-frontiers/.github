// Spec: 0003-netboot-logical FR-002
/**
 * The arming of a host for one install: a host is armed with a token that the install's URLs carry, and stays armed until the installer says it is done, so that a machine is not reinstalled by its next network boot. The state is a plain value: what is armed, what has
 * installed (and from which MAC), and the progress of installs. Every change is a function that gives a new value.
 *
 * @example
 * ```ts
 * import { arm, emptyState, isArmed } from "./arming.ts";
 * isArmed(arm(emptyState(), "athens", { token: "t", at: "2026-11-21T00:00:00Z" }), "athens"); // true
 * ```
 *
 * @module
 */

/** What an arming carries. */
export type Arming = {
  readonly token: string;
  readonly at: string;
  /** A person said that a machine with data on its disks may be erased. */
  readonly confirmDestroy?: boolean;
  /** The MAC that the install is for, where it is known beforehand. */
  readonly mac?: string;
};

/** One line of an install's progress, as the installer reported it. */
export type Progress = { readonly at: string; readonly host: string; readonly level: string; readonly phase: string; readonly summary: string };

/** What the boot server remembers. */
export type BootState = {
  readonly armed: Readonly<Record<string, Arming>>;
  /** Hosts that installed, with the MAC they installed from. */
  readonly installed: Readonly<Record<string, { readonly mac?: string; readonly at: string }>>;
  readonly progress: readonly Progress[];
};

/** The state of a server that has done nothing yet. */
export function emptyState(): BootState {
  return { armed: {}, installed: {}, progress: [] };
}

/** The state with a host armed (a host armed again gets the new arming). */
export function arm(s: BootState, host: string, a: Arming): BootState {
  return { ...s, armed: { ...s.armed, [host]: a } };
}

/** The state with a host disarmed. */
export function disarm(s: BootState, host: string): BootState {
  const { [host]: _gone, ...rest } = s.armed;
  return { ...s, armed: rest };
}

/** Whether a host is armed. */
export function isArmed(s: BootState, host: string): boolean {
  return s.armed[host] !== undefined;
}

/** Whether a token is the one a host is armed with. */
export function tokenFits(s: BootState, host: string, token: string): boolean {
  const a = s.armed[host];
  if (a === undefined || a.token.length < 16) return false;
  // a comparison that takes the same time wherever the strings differ
  let diff = a.token.length ^ token.length;
  for (let i = 0; i < a.token.length; i++) diff |= a.token.charCodeAt(i) ^ (token.charCodeAt(i) || 0);
  return diff === 0;
}

/** The state when the installer says it is done: the host is disarmed and recorded as installed from the MAC it booted from. */
export function done(s: BootState, host: string, mac: string | undefined, at: string): BootState {
  const next = disarm(s, host);
  return { ...next, installed: { ...next.installed, [host]: { ...(mac === undefined ? {} : { mac }), at } } };
}

/** The state with one more line of progress (the last 200 are kept). */
export function note(s: BootState, p: Progress): BootState {
  return { ...s, progress: [...s.progress, p].slice(-200) };
}

/** The armed hosts as the chooser menu lists them, in the order of their names. */
export function armedHosts(s: BootState): ReadonlyArray<{ readonly host: { readonly name: string }; readonly token: string }> {
  return Object.keys(s.armed).sort().map((name) => ({ host: { name }, token: s.armed[name]?.token ?? "" }));
}

/** A new token: 32 hexadecimal digits from the system's random numbers. */
export function newToken(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...random(16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
