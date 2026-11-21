// Spec: 0002-findings-model FR-001, FR-002, FR-003
/**
 * What a finding is, whichever tool found it: a rule, a title, a severity, the asset it is about and where on it, a description, a way to fix it, the weaknesses (CWE) and vulnerabilities (CVE) it names, a short redacted piece of evidence, and where it was read from. Its identity is the fingerprint
 * of what makes it the same finding in the next report: the tool, the rule, the asset and the place (without its query), so that a retest recognizes it. The evidence is cut short and anything that looks like a credential in it is replaced, because a report holds what the tool saw, and the tool saw secrets.
 *
 * @example
 * ```ts
 * import { SEVERITIES, redact } from "./model.ts";
 * SEVERITIES[0]; // "critical"
 * redact("Authorization: Bearer abc.def.ghi"); // "Authorization: [redacted]"
 * ```
 *
 * @module
 */

/** The severities, from the worst. */
export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
/** A severity. */
export type Severity = (typeof SEVERITIES)[number];

/** Where a finding was read from. */
export type Source = { readonly tool: string; readonly version?: string; readonly file: string };

/** A finding as a reader gives it, before it has an identity. */
export type RawFinding = {
  readonly rule: string;
  readonly title: string;
  readonly severity: Severity;
  /** What it is about, as the report names it: a host, a URL's origin, a repository. */
  readonly asset: string;
  /** Where on the asset: a path, a port, a file and line. */
  readonly location?: string;
  readonly description: string;
  readonly solution?: string;
  readonly cwe: readonly string[];
  readonly cve: readonly string[];
  readonly evidence?: string;
  readonly source: Source;
};

/** A finding. */
export type Finding = RawFinding & { readonly id: string };

/** The most characters of evidence kept. */
export const MAX_EVIDENCE = 500;

/** Evidence with what looks like a credential replaced and cut short: credentials in headers, assignments and long tokens. */
export function redact(text: string): string {
  const cleaned = text
    .replace(/\b(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|api[-_]?key|password|passwd|secret|token)(\s*[:=]\s*)[^\r\n]+/gi, "$1: [redacted]")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[redacted private key]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*)\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9+/_-]{40,}={0,2}\b/g, "[redacted]");
  return cleaned.length > MAX_EVIDENCE ? `${cleaned.slice(0, MAX_EVIDENCE)}...` : cleaned;
}

/** The place of a finding without what varies between runs: a URL without its query and fragment, a path as it is. */
export function normalizeLocation(location: string | undefined): string {
  if (location === undefined) return "";
  return location.replace(/[?#].*$/, "").replace(/\/+$/, "");
}

/** The identity of a finding: the first 16 hexadecimal digits of the SHA-256 of the tool, the rule, the asset and the place. */
export async function fingerprintOf(f: Pick<RawFinding, "source" | "rule" | "asset" | "location">): Promise<string> {
  const text = [f.source.tool, f.rule, f.asset.toLowerCase(), normalizeLocation(f.location)].join("\u0000");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The findings with their identities. Two findings that make one identity are one: the first is kept and the count of the repeats is given. */
export async function identify(raw: readonly RawFinding[]): Promise<{ readonly findings: readonly Finding[]; readonly repeats: number }> {
  const seen = new Set<string>();
  const out: Finding[] = [];
  let repeats = 0;
  for (const f of raw) {
    const id = await fingerprintOf(f);
    if (seen.has(id)) {
      repeats += 1;
      continue;
    }
    seen.add(id);
    out.push({ ...f, id });
  }
  return { findings: out, repeats };
}

/** A weakness identifier as `CWE-79`, from a number or a text that holds one; nothing where there is none (0 and -1 are what tools write for none). */
export function cweOf(text: string | number | undefined): string | undefined {
  const t = String(text ?? "").trim();
  const m = /cwe[-_ ]?(\d{1,5})\b/i.exec(t) ?? /^(\d{1,5})$/.exec(t);
  return m === null || Number(m[1]) <= 0 ? undefined : `CWE-${Number(m[1])}`;
}

/** The vulnerability identifiers in a text, as `CVE-2024-12345`, without repeats. */
export function cvesIn(text: string): readonly string[] {
  return [...new Set((text.match(/CVE-\d{4}-\d{4,7}/gi) ?? []).map((x) => x.toUpperCase()))];
}
