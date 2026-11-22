// Spec: 0006-agents FR-001, FR-002
/**
 * The persona and the harness of a run (commons ergonex 0006-agents FR-001, FR-002): who drives Ergonex. The persona is the closed set `human` and `agent`; the harness is the closed set `claude-code`,
 * `codex`, `herdr` and `other`, with an optional session identifier. Resolved once at the boundary from the option, the variable and the manifest, in that order, into a typed value.
 *
 * @example
 * ```ts
 * import { resolveIdentity } from "./persona.ts";
 * resolveIdentity({ env: { ERGONEX_PERSONA: "agent" } }); // { kind: "ok", value: { persona: "agent", harness: "other" } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** `ergonex:Persona`: who is at the keyboard. */
export type Persona = "human" | "agent";
/** The personas, in the order they are named. */
export const PERSONAS: readonly Persona[] = ["human", "agent"];

/** `ergonex:Harness`: the program that drives Ergonex. */
export type Harness = "claude-code" | "codex" | "herdr" | "other";
/** The harnesses, in the order they are named. */
export const HARNESSES: readonly Harness[] = ["claude-code", "codex", "herdr", "other"];

/** Who drives a run. */
export type Identity = {
  readonly persona: Persona;
  readonly harness: Harness;
  /** The runtime that hosts the harness, where one is reported (herdr sets `HERDR_ENV=1`). */
  readonly runtime?: "herdr";
  readonly session?: string;
};

/** What a run says of itself. */
export type IdentityInput = {
  readonly persona?: string | undefined;
  readonly harness?: string | undefined;
  readonly session?: string | undefined;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** The `persona` the manifest names. */
  readonly manifestPersona?: string | undefined;
};

/** Whether a word is a persona. */
export function isPersona(word: string): word is Persona {
  return PERSONAS.some((p) => p === word);
}
/** Whether a word is a harness. */
export function isHarness(word: string): word is Harness {
  return HARNESSES.some((h) => h === word);
}

const SESSION_MAX = 128;

/** Whether a text is a session identifier: not empty, at most 128 characters, no control character. */
export function isSession(text: string): boolean {
  if (text === "" || [...text].length > SESSION_MAX) return false;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return false;
  }
  return true;
}

const nonEmpty = (s: string | undefined): string | undefined => (s === undefined || s === "" ? undefined : s);

/** The identity of a run, or the words that say what is wrong with what was given. */
export function resolveIdentity(input: IdentityInput): Result<Identity, string> {
  const personaWord = nonEmpty(input.persona) ?? nonEmpty(input.env["ERGONEX_PERSONA"]) ?? nonEmpty(input.manifestPersona) ?? "human";
  if (!isPersona(personaWord)) return err(`${JSON.stringify(personaWord)} is not a persona: use ${PERSONAS.join(" or ")}`);
  const harnessWord = nonEmpty(input.harness) ?? nonEmpty(input.env["ERGONEX_HARNESS"]) ?? "other";
  if (!isHarness(harnessWord)) return err(`${JSON.stringify(harnessWord)} is not a harness: use ${HARNESSES.join(", ")}`);
  const session = nonEmpty(input.session) ?? nonEmpty(input.env["ERGONEX_SESSION"]);
  if (session !== undefined && !isSession(session)) return err(`a session identifier is text of at most ${SESSION_MAX} characters with no control character`);
  const runtime = input.env["HERDR_ENV"] === "1" ? ("herdr" as const) : undefined;
  return ok({ persona: personaWord, harness: harnessWord, ...(runtime === undefined ? {} : { runtime }), ...(session === undefined ? {} : { session }) });
}

/** The attributes the evidence record of a run of an agent carries (FR-006); a human run carries none. */
export function identityAttributes(identity: Identity): Readonly<Record<string, string>> {
  if (identity.persona !== "agent") return {};
  return {
    "ergonex.persona": identity.persona,
    "ergonex.harness": identity.harness,
    ...(identity.runtime === undefined ? {} : { "ergonex.runtime": identity.runtime }),
    ...(identity.session === undefined ? {} : { "ergonex.session": identity.session }),
  };
}
