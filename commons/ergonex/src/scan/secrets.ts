// Spec: 0002-workspace-model FR-031
/**
 * The plaintext-token scan (commons 0002-workspace-model FR-031, 0003-host FR-014, 0023 FR-035): a managed file or setting that holds a personal access token of GitHub or GitLab, a private
 * key block, a password or token in a URL, or an authorization header is an `ergonex:Error` from day one, naming the file and the line and never the secret.
 *
 * @remarks
 * The scanner reads text it is given and returns where it found what: the host layer (`host/scan.ts`) reads the generated files, the manifest and each repository's local Git configuration and hands
 * the text over. A finding's message names the KIND of secret and what to do; no function of this module returns a matched text, and a test holds that no finding mentions one. A value that is
 * plainly a placeholder (`${GITHUB_TOKEN}`, `$TOKEN`, `<token>`, `%TOKEN%`, `{{ token }}`) is not a secret: the credential then comes from the environment, which is what the policy asks.
 *
 * @limits It finds the shapes it knows (the prefixes of the hosts' tokens, PEM and OpenSSH key blocks, `user:password@` in a URL, the `Authorization` and `Private-Token` headers); an
 * arbitrary password in an arbitrary setting is not a shape, and entropy is not guessed at.
 *
 * @module
 */
import type { Finding } from "../findings.ts";

/** The kinds of secret the scan names. */
export type SecretKind = "github-token" | "gitlab-token" | "private-key" | "url-credential" | "authorization-header";

/** What a kind is called in a message. */
const NAMES: Readonly<Record<SecretKind, string>> = {
  "github-token": "a GitHub token",
  "gitlab-token": "a GitLab token",
  "private-key": "a private key",
  "url-credential": "a credential in a URL",
  "authorization-header": "an authorization header's credential",
};

/** One secret found: where, never what. */
export type SecretHit = {
  readonly file: string;
  readonly line: number;
  readonly kind: SecretKind;
};

/** The rule of the finding of a plaintext secret. */
export const SECRET_RULE = "ergonex/plaintext-token";

const GITHUB = /\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{20,255})\b/;
const GITLAB = /\b(?:glpat|glptt|gldt|glrt|glcbt|glimt|glsoat|glffct|glagent|glwt|gloas)-[A-Za-z0-9_-]{16,}/;
const KEY_BLOCK = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/;
const URL_CREDENTIAL = /\b[a-z][a-z0-9+.-]*:\/\/([^\s/@:'"`]+):([^\s/@'"`]+)@[^\s/'"`]+/gi;
const URL_TOKEN = /\bhttps?:\/\/([A-Za-z0-9_.~-]{20,})@[^\s/'"`]+/gi;
const HEADER = /\b(?:authorization|proxy-authorization)\b["']?\s*[:=]\s*["']?(?:bearer|basic|token)\s+([^\s"',;]+)/gi;
const PRIVATE_TOKEN_HEADER = /\b(?:private-token|job-token|deploy-token)\b["']?\s*[:=]\s*["']?([^\s"',;]+)/gi;

/** Whether a value is plainly a placeholder for a credential that comes from elsewhere. */
export function isPlaceholder(value: string): boolean {
  const v = value.replace(/^["'`]+|["'`]+$/g, "");
  if (v === "") return true;
  if (
    /^\$[{(]?[A-Za-z_]/.test(v) ||
    /^%[A-Za-z_][A-Za-z0-9_]*%$/.test(v) ||
    /^<[^>]*>?$/.test(v) ||
    /^\{\{.*\}\}$/.test(v) ||
    /^\[[^\]]*\]$/.test(v)
  )
    return true;
  if (/^(?:redacted|\*+|x{4,}|\.{3,}|changeme|example|token|password|secret|your[-_ ]?token)$/i.test(v)) return true;
  return /^[A-Z][A-Z0-9_]*(?:TOKEN|PASSWORD|SECRET|KEY)$/.test(v);
}

/** The kinds of secret one line holds (a line may hold more than one). */
export function secretsInLine(line: string): readonly SecretKind[] {
  const kinds: SecretKind[] = [];
  if (GITHUB.test(line)) kinds.push("github-token");
  if (GITLAB.test(line)) kinds.push("gitlab-token");
  if (KEY_BLOCK.test(line)) kinds.push("private-key");
  for (const m of line.matchAll(URL_CREDENTIAL)) {
    if (m[2] !== undefined && !isPlaceholder(m[2])) {
      kinds.push("url-credential");
      break;
    }
  }
  if (!kinds.includes("url-credential")) {
    for (const m of line.matchAll(URL_TOKEN)) {
      if (m[1] !== undefined && !isPlaceholder(m[1])) {
        kinds.push("url-credential");
        break;
      }
    }
  }
  for (const re of [HEADER, PRIVATE_TOKEN_HEADER]) {
    for (const m of line.matchAll(re)) {
      if (m[1] !== undefined && !isPlaceholder(m[1])) {
        kinds.push("authorization-header");
        break;
      }
    }
    if (kinds.includes("authorization-header")) break;
  }
  return kinds;
}

/** Every secret of a text, with its file and its line (counted from 1); one hit for each kind on a line. */
export function scanText(file: string, text: string): readonly SecretHit[] {
  const hits: SecretHit[] = [];
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    for (const kind of secretsInLine(line)) hits.push({ file, line: i + 1, kind });
  }
  return hits;
}

/** A hit as a finding: an `ergonex:Error` that names the file and the line and the kind, says what to do, and holds no part of the secret. */
export function secretFinding(hit: SecretHit, today: string): Finding {
  const subject = `${hit.file}:${hit.line}`;
  return {
    ruleId: SECRET_RULE,
    severity: "Error",
    message: `${subject} holds ${NAMES[hit.kind]} in plain text; remove it, revoke it where it was ever pushed, and give the credential through the environment or a credential helper instead`,
    subject,
    firstSeen: today,
  };
}

/** The findings of several files (each `{ file, text }`), in the order of the files and their lines. */
export function scanFiles(files: readonly { readonly file: string; readonly text: string }[], today: string): readonly Finding[] {
  return files.flatMap((f) => scanText(f.file, f.text).map((h) => secretFinding(h, today)));
}
