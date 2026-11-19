// Spec: 0046-arcactl FR-009
/**
 * Keeps a secret out of what `arcactl` prints (commons data 0046-arcactl FR-009): the password of a connection URL, a `password=` setting, and any secret value the program was given, whatever the text is
 * (an error from a driver often quotes the URL it was given).
 *
 * @module
 */

/** The text with the password of every URL, every `password=` and every given secret replaced by `***`. */
export function redact(text: string, secrets: readonly string[] = []): string {
  let out = text
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^\s:/@]*):([^\s@/]+)@/gi, "$1:***@")
    .replace(/(password\s*=\s*)('[^']*'|"[^"]*"|\S+)/gi, "$1***");
  for (const s of secrets) if (s.length >= 4) out = out.split(s).join("***");
  return out;
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
