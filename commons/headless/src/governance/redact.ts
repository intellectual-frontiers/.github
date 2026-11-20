// Spec: 0002-headless-governance FR-011
/**
 * Keeps a secret out of what a program prints, logs or returns (commons headless 0002-headless-governance FR-011): the password of a URL, the
 * value of a setting whose name says it is secret, and every secret value the program was given, whatever the text around it (an error from a
 * driver often quotes the URL it was given).
 *
 * @example
 * ```ts
 * import { redactor } from "./redact.ts";
 * const redact = redactor(["hunter22"]);
 * redact("connect postgres://app:hunter22@db/x failed"); // "connect postgres://app:***@db/x failed"
 * ```
 *
 * @module
 */

/** What replaces a secret. */
export const MASK = "***";

/** The shortest secret value that is replaced wherever it appears: a shorter one would mask ordinary words. */
export const MIN_SECRET = 4;

/** The names of settings whose values are secret. */
const SECRET_NAME = String.raw`(?:password|passwd|passphrase|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)`;

/** The text with the password of every URL, the value of every secret setting and every given secret replaced by `***`. */
export function redact(text: string, secrets: readonly string[] = []): string {
  let out = text
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^\s:/@]*):([^\s@/]+)@/gi, `$1:${MASK}@`)
    .replace(new RegExp(String.raw`(\b[\w-]*${SECRET_NAME}[\w-]*\s*[=:]\s*)('[^']*'|"[^"]*"|[^\s,;&]+)`, "gi"), `$1${MASK}`);
  const longestFirst = [...secrets].filter((s) => s.length >= MIN_SECRET).sort((a, b) => b.length - a.length);
  for (const s of longestFirst) out = out.split(s).join(MASK);
  return out;
}

/** A function that redacts with the secrets it was made with. */
export type Redactor = (text: string) => string;

/** A redactor for the secrets given (a program passes the values it holds: a token, a passphrase, the password of its URL). */
export function redactor(secrets: readonly string[] = []): Redactor {
  const copy = [...secrets];
  return (text) => redact(text, copy);
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
