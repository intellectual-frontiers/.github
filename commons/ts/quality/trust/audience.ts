/**
 * Audiences and redaction (commons 0022-trust FR-007 to FR-009): each rendering of evidence is for one audience (`ifqs:Audience`), and what
 * it leaves out follows from who reads it.
 *
 * - `Public`: a figure, an identifier, a grade and a failure's requirement and reason. Left out: what 0006-signals FR-006 redacts (secrets),
 *   the names of people, customers and hosts, the paths and names of private repositories, and any value a failure message holds beyond its
 *   requirement and reason. The rendering says how many values it redacted.
 * - `Assessor`: the full records, with secrets and personal data (an e-mail address) redacted only.
 * - `Internal`: the harness's own people through its console: secrets only.
 *
 * Redaction is deterministic and changes no figure: the same text and the same rules give the same bytes and the same count, and the count of a
 * grade, a digest or a total of a narrower audience is the wider audience's (`withheld` is how a value dropped whole is counted).
 *
 * @remarks
 * `terms` are the names the harness knows must never be public: its customers, its people, its hosts and its private repositories. A pattern cannot
 * tell a person's name from a word, so a name is removed where the harness lists it; the patterns find what has a shape (an address, a URL, an IP
 * address, an absolute path, a secret). The audience words are the keys of `ifqs:Audience` (`ifqs-ontology.test.ts` asserts it).
 *
 * @example
 * ```ts
 * import { redactFor } from "./audience.ts";
 * redactFor("Public", { terms: ["Acme Ltd"] }, "failed for Acme Ltd at https://db.acme.example/x").text;
 * // "failed for REDACTED at REDACTED"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { redactText } from "../../kernel/otel.ts";

/** Who a rendering is for (`ifqs:Public`, `ifqs:Assessor`, `ifqs:Internal`). */
export type Audience = "Public" | "Assessor" | "Internal";

/** Every audience, widest first. */
export const AUDIENCES: readonly Audience[] = ["Internal", "Assessor", "Public"];

/** Whether a text is an audience. */
export function isAudience(text: string): text is Audience {
  return (AUDIENCES as readonly string[]).includes(text);
}

/** What a harness lists besides the patterns: names that must never reach the public (customers, people, hosts, private repositories). */
export type RedactionRules = { readonly terms: readonly string[] };

/** A text redacted for an audience, and how many values were redacted. */
export type Redacted = { readonly text: string; readonly count: number };

const REDACTED = "REDACTED";
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const URL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)]+/gi;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g;
const POSIX_PATH = /(?<![\w.])\/(?:home|root|Users|var|etc|opt|srv|mnt|tmp|private|workspace|workspaces)\/[^\s"'<>)]+/g;
const WINDOWS_PATH = /\b[A-Za-z]:\\[^\s"'<>)]+/g;

function replaceCounted(text: string, re: RegExp): Redacted {
  let count = 0;
  const out = text.replace(re, () => {
    count += 1;
    return REDACTED;
  });
  return { text: out, count };
}

function secretsOf(text: string): Redacted {
  const out = redactText(text);
  return { text: out, count: out.split(REDACTED).length - text.split(REDACTED).length };
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A text redacted for an audience (FR-008, FR-009): see the module's account of what each audience leaves out. */
export function redactFor(audience: Audience, rules: RedactionRules, text: string): Redacted {
  const steps: ((t: string) => Redacted)[] = [secretsOf];
  switch (audience) {
    case "Internal":
      break;
    case "Assessor":
      steps.push((t) => replaceCounted(t, EMAIL));
      break;
    case "Public": {
      steps.push(
        (t) => replaceCounted(t, EMAIL),
        (t) => replaceCounted(t, URL),
        (t) => replaceCounted(t, IPV4),
      );
      steps.push(
        (t) => replaceCounted(t, POSIX_PATH),
        (t) => replaceCounted(t, WINDOWS_PATH),
      );
      const terms = [...new Set(rules.terms.map((x) => x.trim()).filter((x) => x.length > 0))].sort(
        (a, b) => b.length - a.length || (a < b ? -1 : 1),
      );
      if (terms.length > 0) steps.push((t) => replaceCounted(t, new RegExp(terms.map(escapeRegExp).join("|"), "gi")));
      break;
    }
    default:
      return absurd(audience);
  }
  let out = text;
  let count = 0;
  for (const step of steps) {
    const r = step(out);
    out = r.text;
    count += r.count;
  }
  return { text: out, count };
}

/** Whether a rendering for this audience carries the words of a failure's message (FR-008: the public does not). */
export function showsMessages(audience: Audience): boolean {
  switch (audience) {
    case "Public":
      return false;
    case "Assessor":
    case "Internal":
      return true;
    default:
      return absurd(audience);
  }
}
