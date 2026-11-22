// Spec: 0006-agents FR-007
/**
 * What is pure of the token (commons ergonex 0006-agents FR-007): the word that stands where a secret was, the rule of the mode of a token file, the words that say why a file is refused and the redaction of
 * a text. Nothing here reads a file or the environment; `host/token-source.ts` does.
 *
 * @example
 * ```ts
 * import { redact } from "./redact.ts";
 * redact("a ghp_x b", ["ghp_x"]); // "a [secret] b"
 * ```
 *
 * @module
 */

/** What stands where a secret was. */
export const REDACTED = "[secret]";

/** Why no token could be used. */
export type TokenError = { readonly kind: "mode"; readonly path: string; readonly mode: string } | { readonly kind: "unreadable"; readonly path: string; readonly reason: string } | { readonly kind: "empty"; readonly path: string };

/** Whether a mode lets anyone but the owner read or write the file. */
export function modeIsPrivate(mode: number): boolean {
  return (mode & 0o077) === 0;
}

/** The words that say why a token file is refused, without the token. */
export function describeTokenError(e: TokenError): string {
  switch (e.kind) {
    case "mode":
      return `${e.path} has mode ${e.mode} and can be read by others: run \`chmod 600 ${e.path}\``;
    case "unreadable":
      return `${e.path} cannot be read (${e.reason})`;
    case "empty":
      return `${e.path} is empty`;
  }
}

/** A text with every secret written `[secret]`; the longest secret first, so that one that holds another is hidden whole. An empty secret is ignored. */
export function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const s of [...secrets].filter((x) => x !== "").sort((a, b) => b.length - a.length)) out = out.split(s).join(REDACTED);
  return out;
}
