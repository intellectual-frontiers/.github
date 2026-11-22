// Spec: 0002-headless-governance FR-011
// Spec: 0008-exit-style-consent FR-003
/**
 * Keeps a secret out of what a program prints, logs or returns (commons headless 0002-headless-governance FR-011, 0008-exit-style-consent FR-003). It redacts only what is a secret and
 * never what merely looks like a line about one: the secret values the program holds, the password of a URL and a `password=` assignment, the shapes of the tokens that have a known
 * form (GitHub, GitLab, Slack, AWS, npm, `sk-`, bearer and JWT tokens, private-key blocks), and the value of a key that the program declared secret (`KEY=value`, or
 * `"KEY": "value"`). A sentence that names a variable (`ERGONEX_GITHUB_TOKEN: the token is not set`) is prose and is left as it is, and so is a value that a shell expands (`KEY="$(command)"`),
 * which is a reference to a secret and not one (0008-exit-style-consent FR-003).
 *
 * @example
 * ```ts
 * import { redactor } from "./redact.ts";
 * const redact = redactor(["hunter22"], { keys: ["APP_TOKEN"] });
 * redact("connect postgres://app:hunter22@db/x failed"); // "connect postgres://app:***@db/x failed"
 * redact("APP_TOKEN: the token is not set"); // unchanged: it is prose
 * redact("APP_TOKEN=abc123"); // "APP_TOKEN=***"
 * ```
 *
 * @module
 */

/** What replaces a secret. */
export const MASK = "***";

/** The shortest secret value that is replaced wherever it appears: a shorter one would mask ordinary words. */
export const MIN_SECRET = 4;

/** What a redactor is told besides the secret values. */
export type RedactOptions = {
  /** The names of the keys that are secret in this program (`APP_TOKEN`): the value of `KEY=value` or `"KEY": "value"` is replaced. */
  readonly keys?: readonly string[];
  /** Whether the tokens of a known shape are replaced wherever they appear (true by default). */
  readonly shapes?: boolean;
};

/** The shapes of tokens that have a known form; each is replaced whole, but for `Bearer ` which stays. */
const SHAPES: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{16,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bnpm_[A-Za-z0-9]{30,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
];

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const VALUE = String.raw`('[^']*'|"[^"]*"|[^\s,;&'"]+)`;

/** Whether a value is a reference that a shell or a script expands (`$(command)`, `${name}`, `$name`, `($expression)`, with or without a quote before it): where a secret comes from, and not one. */
const REFERENCE = /^["']?\(?\$[({A-Za-z_]/;

/** The text with the password of every URL, a `password=` assignment, every token of a known shape, the value of every declared key and every given secret replaced by `***`. */
export function redact(text: string, secrets: readonly string[] = [], options: RedactOptions = {}): string {
  let out = text
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^\s:/@]*):([^\s@/]+)@/gi, `$1:${MASK}@`)
    .replace(new RegExp(String.raw`(\b(?:password|passwd|pwd)\s*=\s*)${VALUE}`, "gi"), `$1${MASK}`);
  if (options.shapes !== false) {
    for (const shape of SHAPES) out = out.replace(shape, MASK);
    out = out.replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/g, `$1${MASK}`);
  }
  const keys = (options.keys ?? []).filter((k) => k !== "");
  if (keys.length > 0) {
    const alt = keys.map(escape).join("|");
    out = out
      .replace(new RegExp(String.raw`(\b(?:${alt})\s*=\s*)${VALUE}`, "g"), (all: string, head: string, value: string) => (REFERENCE.test(value) ? all : `${head}${MASK}`))
      .replace(new RegExp(String.raw`("(?:${alt})"\s*:\s*)("[^"]*")`, "g"), `$1"${MASK}"`);
  }
  const longestFirst = [...secrets].filter((s) => s.length >= MIN_SECRET).sort((a, b) => b.length - a.length);
  for (const s of longestFirst) out = out.split(s).join(MASK);
  return out;
}

/** A function that redacts with the secrets it was made with. */
export type Redactor = (text: string) => string;

/** A redactor for the secrets given (a program passes the values it holds: a token, a passphrase, the password of its URL) and the keys it declares secret. */
export function redactor(secrets: readonly string[] = [], options: RedactOptions = {}): Redactor {
  const copy = [...secrets];
  return (text) => redact(text, copy, options);
}

/** The password of a URL, where it has one, so that it can be redacted wherever it turns up. */
export function passwordOf(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  try {
    const p = new URL(url).password;
    return p === "" ? undefined : decodeURIComponent(p);
  } catch {
    return undefined;
  }
}
