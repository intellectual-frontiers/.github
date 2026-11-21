// Spec: 0003-scanners-tls FR-001, FR-002
/**
 * The judgement of what the built-in check saw: the headers and the cookie flags of one answer, and the protocol and certificate of one handshake, as findings. The rules are the plain ones that a browser and an auditor agree on: a page that is not served over TLS, no strict transport security, no content security
 * policy, no `nosniff`, no protection against framing, no referrer policy, a cookie without `Secure` or `HttpOnly`, a server header that says its version; a protocol older than TLS 1.2, a certificate that is expired, expires within 30 days, is not trusted or is not for the name. Cookies are read for their names and flags only:
 * their values are dropped before anything is kept.
 *
 * @example
 * ```ts
 * import { headerFindings } from "./tls.ts";
 * headerFindings("https://a.example.test", { status: 200, headers: {}, setCookies: [] }).length > 0; // true
 * ```
 *
 * @module
 */
import type { RawFinding, Severity } from "@intellectual-frontiers/findings/governance";

/** What one answer said. */
export type Answer = { readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly setCookies: readonly string[] };

/** What one handshake said. */
export type Handshake = { readonly protocol: string; readonly cipher: string; readonly authorized: boolean; readonly authorizationError?: string; readonly notAfter: string; readonly subject: string; readonly names: readonly string[]; readonly host: string };

const finding = (url: string, rule: string, title: string, severity: Severity, description: string, cwe: string, solution: string): RawFinding => ({ rule: `tls-check:${rule}`, title, severity, asset: new URL(url).origin, location: new URL(url).pathname === "/" ? undefined : new URL(url).pathname, description, solution, cwe: [cwe], cve: [], source: { tool: "tls-check", file: "built-in" } } as RawFinding);

/** The findings of the headers of one answer from `url`. */
export function headerFindings(url: string, a: Answer): readonly RawFinding[] {
  const h = Object.fromEntries(Object.entries(a.headers).map(([k, v]) => [k.toLowerCase(), v]));
  const tls = new URL(url).protocol === "https:";
  const out: RawFinding[] = [];
  if (!tls) out.push(finding(url, "no-tls", "Served over HTTP", "medium", "The address answers without TLS, so what it carries can be read and changed on the way.", "CWE-319", "Serve it over HTTPS and redirect HTTP to it."));
  if (tls && h["strict-transport-security"] === undefined) out.push(finding(url, "hsts-missing", "Strict-Transport-Security is not set", "medium", "A browser is not told to use only TLS for this site.", "CWE-319", "Send Strict-Transport-Security with a max-age of at least a year."));
  if (h["content-security-policy"] === undefined) out.push(finding(url, "csp-missing", "Content-Security-Policy is not set", "low", "No policy limits where scripts and other content may come from.", "CWE-693", "Send a Content-Security-Policy."));
  if ((h["x-content-type-options"] ?? "").toLowerCase() !== "nosniff") out.push(finding(url, "nosniff-missing", "X-Content-Type-Options is not nosniff", "low", "A browser may guess the type of content and run it as something else.", "CWE-693", "Send X-Content-Type-Options: nosniff."));
  if (h["x-frame-options"] === undefined && !/frame-ancestors/i.test(h["content-security-policy"] ?? "")) out.push(finding(url, "framing-allowed", "The page can be framed by any site", "low", "Neither X-Frame-Options nor frame-ancestors forbids another site to frame it.", "CWE-1021", "Send X-Frame-Options or a frame-ancestors policy."));
  if (h["referrer-policy"] === undefined) out.push(finding(url, "referrer-policy-missing", "Referrer-Policy is not set", "info", "The full address of a page may go to other sites.", "CWE-200", "Send Referrer-Policy: strict-origin-when-cross-origin or stricter."));
  const server = h["server"] ?? h["x-powered-by"];
  if (server !== undefined && /\d+\.\d+/.test(server)) out.push(finding(url, "version-disclosed", "The server says its version", "info", `A header names a product and its version (${server.slice(0, 60)}).`, "CWE-200", "Do not send the version in the Server or X-Powered-By header."));
  for (const raw of a.setCookies) {
    const [pair, ...attrs] = raw.split(";").map((x) => x.trim());
    const name = (pair ?? "").split("=")[0] ?? "cookie";
    const flags = attrs.map((x) => x.toLowerCase());
    if (tls && !flags.includes("secure")) out.push(finding(url, `cookie-secure:${name}`, `Cookie ${name} has no Secure flag`, "low", "The cookie may be sent over an unprotected connection.", "CWE-614", "Set the Secure flag."));
    if (!flags.includes("httponly")) out.push(finding(url, `cookie-httponly:${name}`, `Cookie ${name} has no HttpOnly flag`, "low", "A script in the page can read the cookie.", "CWE-1004", "Set the HttpOnly flag unless a script needs the cookie."));
  }
  return out;
}

const OLD = new Set(["SSLv2", "SSLv3", "TLSv1", "TLSv1.1"]);

/** The findings of one handshake with `url`, at the instant `now`. */
export function tlsFindings(url: string, t: Handshake, now: string): readonly RawFinding[] {
  const out: RawFinding[] = [];
  if (OLD.has(t.protocol)) out.push(finding(url, "protocol-old", `The connection uses ${t.protocol}`, "high", `The server negotiated ${t.protocol}, which is obsolete and broken.`, "CWE-326", "Allow TLS 1.2 and 1.3 only."));
  const left = Math.floor((Date.parse(`${t.notAfter}T00:00:00Z`) - Date.parse(now)) / 86_400_000);
  if (left < 0) out.push(finding(url, "cert-expired", "The certificate has expired", "high", `The certificate ended on ${t.notAfter}.`, "CWE-295", "Renew the certificate."));
  else if (left <= 30) out.push(finding(url, "cert-expiring", "The certificate ends within 30 days", "medium", `The certificate ends on ${t.notAfter} (${left} days).`, "CWE-295", "Renew the certificate."));
  const err = t.authorizationError;
  if (!t.authorized && err !== undefined && !/CERT_HAS_EXPIRED/.test(err)) {
    const mismatch = /HOSTNAME_MISMATCH|ERR_TLS_CERT_ALTNAME_INVALID/.test(err);
    out.push(finding(url, mismatch ? "cert-name" : "cert-untrusted", mismatch ? "The certificate is not for this name" : "The certificate is not trusted", "medium", `The check could not trust the certificate: ${err}.`, "CWE-295", mismatch ? "Get a certificate that names the host." : "Use a certificate from an authority clients trust."));
  }
  return out;
}
