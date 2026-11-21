// Spec: 0002-anyfs-githost-store FR-003
/**
 * Where the token of a host comes from, a closed union: none (what is public), a token given in code (what the tests use, a throwaway of a server of their own), the environment through a function that
 * reads it so that nothing reads the process behind a caller's back, or a provider, a function that gives it or says why not, which is how a short-lived token is fetched and how a secret is asked of a person
 * through the credential port of Headless. A token is never part of a place, never in a URL and never in a sentence: it travels in one header of one request, and what is written of one is `[redacted]`.
 *
 * @example
 * ```ts
 * import { anonymous, staticToken, redactor } from "./token.ts";
 * const t = staticToken("ghp_exampleexampleexample");
 * t.kind === "ok" && t.value.kind; // "static"
 * redactor(["ghp_exampleexampleexample"])("the host said ghp_exampleexampleexample"); // "the host said [redacted]"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";

/** Where the token comes from. */
export type TokenSource =
  | { readonly kind: "none" }
  | { readonly kind: "static"; readonly token: string }
  | { readonly kind: "environment"; readonly env: (name: string) => string | undefined; readonly name: string }
  | { readonly kind: "provider"; readonly fetch: () => Promise<Result<string, string>>; readonly ttlMs?: number };

/** No token: only what is public can be read. */
export const anonymous: TokenSource = { kind: "none" };

// a token is one line with no space and no control character: a header could be split by anything else
// eslint-disable-next-line no-control-regex
const USABLE = /^[^\s\u0000-\u001f\u007f]{8,512}$/u;

/** Whether a text can be a token in a header. */
export const usable = (token: string): boolean => USABLE.test(token);

/** A token given in code, or why it is not one a host would take. */
export function staticToken(token: string): Result<TokenSource, string> {
  return usable(token) ? ok({ kind: "static", token }) : err("the token is shorter than 8 characters, longer than 512, or holds a space or a control character");
}

/** The token of a variable of the environment: a function that reads it, which is the only place the process is touched. */
export const environmentToken = (env: (name: string) => string | undefined, name: string): TokenSource => ({ kind: "environment", env, name });

/** The token by a function: for a short-lived token, which it gives again, and for a secret asked of a person. */
export const providedToken = (fetch: () => Promise<Result<string, string>>, ttlMs?: number): TokenSource => ({ kind: "provider", fetch, ...(ttlMs === undefined ? {} : { ttlMs }) });

/** The token a source gives now: none for the source that has none, or why it gives none. A sentence never holds a token. */
export async function resolveToken(source: TokenSource): Promise<Result<string | undefined, string>> {
  switch (source.kind) {
    case "none":
      return ok(undefined);
    case "static":
      return ok(source.token);
    case "environment": {
      const v = source.env(source.name)?.trim();
      if (v === undefined || v === "") return err(`${source.name} is not set`);
      return usable(v) ? ok(v) : err(`${source.name} does not hold a token a host would take`);
    }
    case "provider": {
      const t = await source.fetch();
      if (t.kind === "err") return t;
      return usable(t.value.trim()) ? ok(t.value.trim()) : err("the provider gave something that is not a token a host would take");
    }
    default:
      return absurd(source);
  }
}

/** A source that asks its provider again only after `ttlMs` (never, for a token in code and the environment), so a person is asked once and a short-lived token is fetched when it is about to lapse. */
export function cachedToken(source: TokenSource, now: () => number = Date.now): () => Promise<Result<string | undefined, string>> {
  let held: { readonly at: number; readonly value: string | undefined } | undefined;
  return async () => {
    const ttl = source.kind === "provider" ? (source.ttlMs ?? 0) : Number.POSITIVE_INFINITY;
    if (held !== undefined && now() - held.at < ttl) return ok(held.value);
    const fresh = await resolveToken(source);
    if (fresh.kind === "ok") held = { at: now(), value: fresh.value };
    return fresh;
  };
}

/** A function that takes every token it is given out of a sentence, so that no failure, no detail and no log line holds one. */
export function redactor(tokens: readonly string[]): (text: string) => string {
  const secrets = tokens.filter((t) => t.length >= 4);
  return (text) => secrets.reduce((acc, t) => acc.split(t).join("[redacted]"), text);
}
