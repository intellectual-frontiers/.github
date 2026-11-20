// Spec: 0011-credential-prompt FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The credential prompt, as a port (commons headless 0011-credential-prompt): how a command asks a person for a passphrase, a password, a PIN or a yes without the program ever
 * keeping it. A command asks its `Credentials` (`get`), which is one session for one command: it asks the port at most once for each credential, holds the answer in memory only until
 * the command ends (`close`), refuses where there is no person to ask (a typed reason, never a guess), stops asking after a hard time limit, and tells the redactor every value it handed out
 * so that no output of the run can carry one. What draws the prompt is a surface's (`@intellectual-frontiers/headless/askpass`).
 *
 * @remarks
 * A value is a `Secret`: an object whose text, JSON and inspected forms are `[redacted]`, and whose value is read only by `reveal()`. The port is a record of functions, so that a terminal, a helper that
 * `SSH_ASKPASS` runs, a window or a test each give their own. The session logs the fact of a prompt and how it ended through `onEvent`, never a value. The redactor of a run does not replace a value
 * shorter than `MIN_SECRET` (commons headless 0008-exit-style-consent FR-003), so a credential of fewer characters is refused as `too-short`.
 *
 * @limits
 * A string cannot be wiped from the memory of a JavaScript runtime: `close` drops every reference this session holds, and what the runtime does with the memory after that is its own.
 *
 * @example
 * ```ts
 * import { secretOf } from "./credentials.ts";
 * String(secretOf("hunter2!")); // "[redacted]"
 * JSON.stringify({ k: secretOf("hunter2!") }); // '{"k":"[redacted]"}'
 * ```
 *
 * @module
 */
import { absurd, err, ok, refine, string, type Brand, type Result } from "@intellectual-frontiers/core";
import { MIN_SECRET, problem, type Problem } from "@intellectual-frontiers/headless/governance";

/** What is asked for: a passphrase of a key, a password, a PIN of a token, or a yes (which is not secret, and is still asked once). */
export type CredentialKind = "passphrase" | "password" | "pin" | "confirm";

/** Every kind, for a program that walks them. */
export const CREDENTIAL_KINDS: readonly CredentialKind[] = ["passphrase", "password", "pin", "confirm"];

/** The identity of a credential within one command, the key of its one prompt (`ssh-key:~/.ssh/id_ed25519`): made only by `parseCredentialId`. */
export type CredentialId = Brand<string, "credential id">;

const idDecoder = refine(string, "credential id", (t) => t.length > 0 && t.length <= 200 && !/[\u0000-\u001f\u007f]/.test(t));

/** A credential id from text, or why the text is not one: the one way a `CredentialId` is made. */
export function parseCredentialId(text: string): Result<CredentialId, string> {
  const r = idDecoder(text, "id");
  return r.kind === "ok" ? ok(r.value) : err("a credential id is 1 to 200 characters with no control character");
}

/** What a command asks: the kind, the id and the words shown to the person (which never hold the value). */
export type CredentialRequest = { readonly kind: CredentialKind; readonly id: CredentialId; readonly prompt: string };

const REDACTED = "[redacted]";

/** A value that is never written: its text, its JSON and its inspected form are `[redacted]`; only `reveal()` gives it. */
export type Secret = {
  readonly reveal: () => string;
  readonly toString: () => string;
  readonly toJSON: () => string;
  readonly [inspect: symbol]: () => string;
};

/** A secret over a value: the value is held in a closure and is on no property. */
export function secretOf(value: string): Secret {
  return Object.freeze({
    reveal: () => value,
    toString: () => REDACTED,
    toJSON: () => REDACTED,
    [Symbol.for("nodejs.util.inspect.custom")]: () => REDACTED,
  });
}

/** Why a credential was not given. */
export type CredentialRefusal =
  | { readonly kind: "non-interactive" }
  | { readonly kind: "timeout"; readonly afterMs: number }
  | { readonly kind: "cancelled" }
  | { readonly kind: "unavailable"; readonly why: string }
  | { readonly kind: "empty" }
  | { readonly kind: "too-short"; readonly minimum: number }
  | { readonly kind: "closed" };

/** Every reason by name. */
export const CREDENTIAL_REFUSALS: readonly CredentialRefusal["kind"][] = ["non-interactive", "timeout", "cancelled", "unavailable", "empty", "too-short", "closed"];

/** One sentence for a refusal, with no value in it. */
export function refusalMessage(r: CredentialRefusal, id: string): string {
  switch (r.kind) {
    case "non-interactive":
      return `${id} needs a person to type it, and there is none: run it from a terminal`;
    case "timeout":
      return `${id} was not given within ${Math.round(r.afterMs / 1000)} s`;
    case "cancelled":
      return `${id} was not given: the person cancelled`;
    case "unavailable":
      return `${id} cannot be asked for here: ${r.why}`;
    case "empty":
      return `${id} was empty`;
    case "too-short":
      return `${id} is shorter than ${r.minimum} characters`;
    case "closed":
      return `${id} was asked for after the command ended`;
    default:
      return absurd(r);
  }
}

/** The stable code of a refusal, for the problem a command reports. */
export function refusalCode(r: CredentialRefusal): string {
  switch (r.kind) {
    case "non-interactive":
      return "E3-CRED-NOTTY";
    case "timeout":
      return "E3-CRED-TIMEOUT";
    case "cancelled":
      return "E3-CRED-CANCELLED";
    case "unavailable":
      return "E3-CRED-UNAVAILABLE";
    case "empty":
      return "E3-CRED-EMPTY";
    case "too-short":
      return "E3-CRED-SHORT";
    case "closed":
      return "E3-CRED-CLOSED";
    default:
      return absurd(r);
  }
}

/** The failure a command reports for a refusal. */
export function refusalProblem(r: CredentialRefusal, id: string): Problem {
  return problem("fail", refusalMessage(r, id), { code: refusalCode(r) });
}

/** What a port is given to ask with: the time it has and a signal that is aborted when it has none left or the run is stopped. */
export type AskLimits = { readonly timeoutMs: number; readonly signal: AbortSignal };

/** The port: asks a person, and gives the secret or why not. A record of functions. */
export type CredentialPort = {
  readonly ask: (request: CredentialRequest, limits: AskLimits) => Promise<Result<Secret, CredentialRefusal>>;
};

/** A timer as a port: calls `fn` once after `ms` and gives the function that cancels it. */
export type Clock = { readonly after: (ms: number, fn: () => void) => () => void };

/** What a session tells its watcher (the run log): that a prompt happened and how it ended, never a value. */
export type CredentialEvent =
  | { readonly kind: "asked"; readonly id: string; readonly credential: CredentialKind }
  | { readonly kind: "given"; readonly id: string }
  | { readonly kind: "refused"; readonly id: string; readonly refusal: CredentialRefusal["kind"] };

/** The one session a command asks through. */
export type Credentials = {
  /** The credential, asked once per command for each id (concurrent asks for one id share the one prompt, a refusal is held as well); prompts of different ids go one at a time. */
  readonly get: (request: CredentialRequest) => Promise<Result<Secret, CredentialRefusal>>;
  /** The values handed out so far, for the redactor. */
  readonly values: () => readonly string[];
  /** Drops every answer and every value; a later `get` is refused as `closed`. */
  readonly close: () => void;
};

/** The longest a prompt may wait, whatever is asked for: ten minutes. */
export const MAX_TIMEOUT_MS = 600_000;
/** How long a prompt waits where nothing is said: two minutes. */
export const DEFAULT_TIMEOUT_MS = 120_000;

/** The time a prompt may take: what was asked for, held to between a second and `MAX_TIMEOUT_MS`; `DEFAULT_TIMEOUT_MS` where nothing was asked or the number is not one. */
export function limitOf(ms: number | undefined): number {
  if (ms === undefined || !Number.isFinite(ms)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(1000, Math.floor(ms)));
}

/** What a session is given. */
export type SessionOptions = {
  /** What asks the person; none where there is none (every ask is then `unavailable`). */
  readonly port?: CredentialPort;
  /** Whether a person can be asked at all (a terminal on both ends, not `--non-interactive`). */
  readonly interactive: boolean;
  readonly clock: Clock;
  readonly timeoutMs?: number;
  /** Aborted when the run is stopped: the prompt in hand ends as `cancelled`. */
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: CredentialEvent) => void;
};

/** A session that gives nothing: every ask is `unavailable`. */
export const NO_CREDENTIALS: Credentials = {
  get: (r) => Promise.resolve(err({ kind: "unavailable", why: `no way to ask for ${r.id} was given` })),
  values: () => [],
  close: () => undefined,
};

/** The session of one command. */
export function credentialSession(o: SessionOptions): Credentials {
  const asked = new Map<string, Promise<Result<Secret, CredentialRefusal>>>();
  const handed: string[] = [];
  let closed = false;
  let line: Promise<unknown> = Promise.resolve();
  const timeoutMs = limitOf(o.timeoutMs);
  const tell = (e: CredentialEvent): void => o.onEvent?.(e);

  const refuse = (r: CredentialRequest, refusal: CredentialRefusal): Result<Secret, CredentialRefusal> => {
    tell({ kind: "refused", id: r.id, refusal: refusal.kind });
    return err(refusal);
  };

  const ask = async (r: CredentialRequest): Promise<Result<Secret, CredentialRefusal>> => {
    if (closed) return refuse(r, { kind: "closed" });
    if (!o.interactive) return refuse(r, { kind: "non-interactive" });
    const port = o.port;
    if (port === undefined) return refuse(r, { kind: "unavailable", why: "no way to ask was given" });
    tell({ kind: "asked", id: r.id, credential: r.kind });
    const controller = new AbortController();
    let stopped: () => void = () => undefined;
    const interrupted = new Promise<"cancelled">((resolve) => {
      stopped = () => resolve("cancelled");
    });
    const stop = (): void => {
      stopped();
      controller.abort();
    };
    if (o.signal?.aborted === true) stop();
    o.signal?.addEventListener("abort", stop, { once: true });
    let cancel: () => void = () => undefined;
    const late = new Promise<"timeout">((resolve) => {
      cancel = o.clock.after(timeoutMs, () => {
        resolve("timeout");
        controller.abort();
      });
    });
    try {
      const got = await Promise.race([port.ask(r, { timeoutMs, signal: controller.signal }), late, interrupted]);
      if (got === "timeout") return refuse(r, { kind: "timeout", afterMs: timeoutMs });
      if (got === "cancelled") return refuse(r, { kind: "cancelled" });
      if (got.kind === "err") return refuse(r, got.error);
      const value = got.value.reveal();
      if (value === "") return refuse(r, { kind: "empty" });
      if (r.kind !== "confirm" && value.length < MIN_SECRET) return refuse(r, { kind: "too-short", minimum: MIN_SECRET });
      if (closed) return refuse(r, { kind: "closed" });
      if (r.kind !== "confirm") handed.push(value);
      tell({ kind: "given", id: r.id });
      return got;
    } catch (e) {
      return refuse(r, { kind: "unavailable", why: e instanceof Error ? e.name : "the port failed" });
    } finally {
      cancel();
      o.signal?.removeEventListener("abort", stop);
    }
  };

  return {
    get: (r) => {
      const held = asked.get(r.id);
      if (held !== undefined) return held;
      const next = line.then(() => ask(r));
      line = next;
      asked.set(r.id, next);
      return next;
    },
    values: () => [...handed],
    close: () => {
      closed = true;
      asked.clear();
      handed.length = 0;
    },
  };
}
