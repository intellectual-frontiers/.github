// Spec: 0002-git-governance FR-001, FR-002
/**
 * Who a commit is by and what its message says, as values a program sets and never as the configuration of a computer: an identity made only by its parser, a trailer made only by its parser, and a
 * message made by a function of what the commit changes (the default says it in a line), with the trailers after a blank line.
 *
 * @example
 * ```ts
 * import { parseIdentity, parseTrailer, messageOf, defaultSubject } from "./identity.ts";
 * const who = parseIdentity("collector", "collector@localhost");
 * const t = parseTrailer("Refs", "#21");
 * who.kind === "ok" && t.kind === "ok" && messageOf(defaultSubject, [{ kind: "put", path: "a/b" }], [t.value]); // "anyfs: write a/b\n\nRefs: #21\n"
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";

/** A name and an address that a commit is by. Made only by `parseIdentity`. */
export type Identity = Brand<{ readonly name: string; readonly email: string }, "anyfs git identity">;

const LINE = /^[^\u0000-\u001f\u007f<>]+$/u;

/** An identity from a name and an address, or why they are not one: each is one line with no angle bracket, and the address holds an `@`. */
export function parseIdentity(name: string, email: string): Result<Identity, string> {
  if (name.trim() === "" || name !== name.trim() || !LINE.test(name)) return err(`${JSON.stringify(name)} is not a name for a commit: one line with no angle bracket, no space around it`);
  if (!email.includes("@") || email !== email.trim() || !LINE.test(email) || /\s/u.test(email)) return err(`${JSON.stringify(email)} is not an address for a commit: no space, no angle bracket, and an @`);
  return ok({ name, email } as Identity);
}

/** A line at the end of a message: `Key: value`. Made only by `parseTrailer`. */
export type Trailer = Brand<{ readonly key: string; readonly value: string }, "anyfs git trailer">;

/** A trailer from a key and a value, or why they are not one: a key of letters, digits and hyphens that starts with a letter, and a value of one line. */
export function parseTrailer(key: string, value: string): Result<Trailer, string> {
  if (!/^[A-Za-z][A-Za-z0-9-]*$/u.test(key)) return err(`${JSON.stringify(key)} is not a trailer key: letters, digits and hyphens, starting with a letter`);
  // eslint-disable-next-line no-control-regex
  if (value.trim() === "" || value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) return err(`${JSON.stringify(value)} is not a trailer value: one line with no control character and no space around it`);
  return ok({ key, value } as Trailer);
}

/** What one change of a commit was, for the message. */
export type Changed =
  | { readonly kind: "put"; readonly path: string }
  | { readonly kind: "delete"; readonly path: string }
  | { readonly kind: "move"; readonly path: string; readonly to: string };

/** How the first line of a message is made from what a commit changes: a function a program writes. */
export type Subject = (changes: readonly Changed[]) => string;

/** The subject the library makes where none is given: one line saying the change, or the number of changes. */
export const defaultSubject: Subject = (changes) => {
  const [only] = changes;
  if (changes.length === 1 && only !== undefined) {
    switch (only.kind) {
      case "put":
        return `anyfs: write ${only.path}`;
      case "delete":
        return `anyfs: delete ${only.path}`;
      case "move":
        return `anyfs: move ${only.path} to ${only.to}`;
    }
  }
  return `anyfs: ${changes.length} changes`;
};

/** A message: the subject, and for a commit of several changes a line for each, then the trailers after a blank line, and a line ending. */
export function messageOf(subject: Subject, changes: readonly Changed[], trailers: readonly Trailer[]): string {
  const first = subject(changes).replaceAll(/[\r\n]+/gu, " ").trim();
  const lines = [first === "" ? defaultSubject(changes) : first];
  if (changes.length > 1) {
    lines.push("");
    for (const c of changes) lines.push(c.kind === "move" ? `- move ${c.path} to ${c.to}` : `- ${c.kind === "put" ? "write" : "delete"} ${c.path}`);
  }
  if (trailers.length > 0) {
    lines.push("");
    for (const t of trailers) lines.push(`${t.key}: ${t.value}`);
  }
  return `${lines.join("\n")}\n`;
}
