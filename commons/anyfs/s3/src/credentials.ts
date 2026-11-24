// Spec: 0002-anyfs-s3-store FR-005
/**
 * Where the keys of a service come from, a closed union: a pair given in code (what the tests use, throwaway keys of a server of their own), the environment (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and
 * `AWS_SESSION_TOKEN`, by a function that reads it so that nothing reads the process behind a caller's back), or a provider, a function that gives them or says why not, which is how a temporary key is fetched again and
 * how a secret is asked of a person through the credential port of Headless. A credential is never part of a place, never in a URL, and never in a sentence: what is written of one is `[redacted]`.
 *
 * @example
 * ```ts
 * import { staticCredentials } from "./credentials.ts";
 * const c = staticCredentials("AKIDEXAMPLE", "not-a-real-secret");
 * c.kind; // "ok"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { AwsCredentials } from "@intellectual-frontiers/crypto/sigv4";
import type { CredentialPort } from "@intellectual-frontiers/headless/logical";
import { parseCredentialId } from "@intellectual-frontiers/headless/logical";

/** Where the keys come from. */
export type CredentialSource =
  | { readonly kind: "static"; readonly credentials: AwsCredentials }
  | { readonly kind: "environment"; readonly env: (name: string) => string | undefined }
  | { readonly kind: "provider"; readonly fetch: () => Promise<Result<AwsCredentials, string>>; readonly ttlMs?: number };

const KEY_ID = /^[A-Za-z0-9._-]{3,128}$/u;

/** A pair of keys given in code, or why they are not a pair a service would take. */
export function staticCredentials(accessKeyId: string, secretAccessKey: string, sessionToken?: string): Result<CredentialSource, string> {
  if (!KEY_ID.test(accessKeyId)) return err("the access key id is not 3 to 128 letters, digits, dots, hyphens and underscores");
  if (secretAccessKey.length < 8 || /\s/u.test(secretAccessKey)) return err("the secret key is shorter than 8 characters or holds a space");
  return ok({ kind: "static", credentials: { accessKeyId, secretAccessKey, ...(sessionToken === undefined ? {} : { sessionToken }) } });
}

/** The keys of the environment: a function that reads a variable, which is the only place the process is touched. */
export const environmentCredentials = (env: (name: string) => string | undefined): CredentialSource => ({ kind: "environment", env });

/** The keys by a function: for temporary keys, which it gives again, and for a secret asked of a person. */
export const providedCredentials = (fetch: () => Promise<Result<AwsCredentials, string>>, ttlMs?: number): CredentialSource => ({ kind: "provider", fetch, ...(ttlMs === undefined ? {} : { ttlMs }) });

/** A source that asks a person for the secret key through the credential port of Headless, and has the access key id from the caller. The secret is revealed only to sign. */
export function promptedCredentials(port: CredentialPort, accessKeyId: string, options: { readonly id?: string; readonly prompt?: string; readonly timeoutMs?: number } = {}): Result<CredentialSource, string> {
  if (!KEY_ID.test(accessKeyId)) return err("the access key id is not 3 to 128 letters, digits, dots, hyphens and underscores");
  const id = parseCredentialId(options.id ?? "s3-secret-key");
  if (id.kind === "err") return id;
  const request = { kind: "password", id: id.value, prompt: options.prompt ?? `The secret access key for ${accessKeyId}` } as const;
  return ok({
    kind: "provider",
    ttlMs: 300_000,
    fetch: async () => {
      const asked = await port.ask(request, { timeoutMs: options.timeoutMs ?? 120_000, signal: AbortSignal.timeout(options.timeoutMs ?? 120_000) });
      if (asked.kind === "err") return err(`the secret key was not given (${asked.error.kind})`);
      return ok({ accessKeyId, secretAccessKey: asked.value.reveal() });
    },
  });
}

/** The keys a source gives now, or why it gives none. A sentence never holds a key. */
export async function resolveCredentials(source: CredentialSource): Promise<Result<AwsCredentials, string>> {
  switch (source.kind) {
    case "static":
      return ok(source.credentials);
    case "environment": {
      const id = source.env("AWS_ACCESS_KEY_ID");
      const secret = source.env("AWS_SECRET_ACCESS_KEY");
      if (id === undefined || id === "" || secret === undefined || secret === "") return err("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not both set");
      const token = source.env("AWS_SESSION_TOKEN");
      return ok({ accessKeyId: id, secretAccessKey: secret, ...(token === undefined || token === "" ? {} : { sessionToken: token }) });
    }
    case "provider":
      return source.fetch();
    default:
      return absurd(source);
  }
}

/** A source that asks its provider again only after `ttlMs` (never, for a static pair and the environment), so a person is asked once and a temporary key is fetched when it is about to lapse. */
export function cachedCredentials(source: CredentialSource, now: () => number = Date.now): () => Promise<Result<AwsCredentials, string>> {
  let held: { readonly at: number; readonly value: AwsCredentials } | undefined;
  return async () => {
    const ttl = source.kind === "provider" ? (source.ttlMs ?? 0) : Number.POSITIVE_INFINITY;
    if (held !== undefined && now() - held.at < ttl) return ok(held.value);
    const fresh = await resolveCredentials(source);
    if (fresh.kind === "ok") held = { at: now(), value: fresh.value };
    return fresh;
  };
}
