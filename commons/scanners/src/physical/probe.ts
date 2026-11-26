// Spec: 0003-scanners-tls FR-003
/**
 * The built-in check's one contact with a target: one TLS handshake and one HEAD request, with the answer's status, headers and cookies (names and flags; the values are dropped here, before anything leaves this function) and the handshake's protocol, cipher and certificate. The request carries no body,
 * no credential and no cookie; the connection is closed after the answer's headers.
 *
 * @example
 * ```ts
 * import { probeEndpoint } from "./probe.ts";
 * // await probeEndpoint("https://app.example.test/", 10_000) // { answer, handshake }
 * ```
 *
 * @module
 */
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { checkServerIdentity, type TLSSocket } from "node:tls";
import type { Answer, Handshake } from "@intellectual-frontiers/scanners/logical";

/** What the probe saw. */
export type Probed = { readonly answer: Answer; readonly handshake: Handshake | undefined };

/** A cookie without its value: the name and the attributes. */
function withoutValue(cookie: string): string {
  const [pair, ...attrs] = cookie.split(";");
  return [`${(pair ?? "").split("=")[0]}=`, ...attrs].join(";");
}

/** One HEAD request to `url`, over TLS where the address is https, as the user agent given (a product gives its own). */
export async function probeEndpoint(url: string, timeoutMs: number, userAgent = "ifc-tls-check"): Promise<Probed> {
  const u = new URL(url);
  const tls = u.protocol === "https:";
  const port = u.port === "" ? (tls ? 443 : 80) : Number(u.port);
  return await new Promise<Probed>((resolve, reject) => {
    const options = { method: "HEAD", host: u.hostname, port, path: `${u.pathname}`, timeout: timeoutMs, headers: { "user-agent": userAgent, accept: "*/*", connection: "close" }, ...(tls ? { rejectUnauthorized: false, servername: u.hostname } : {}) };
    const req = (tls ? httpsRequest : httpRequest)(options, (res) => {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) if (k !== "set-cookie" && v !== undefined) headers[k] = Array.isArray(v) ? v.join(", ") : v;
      const answer: Answer = { status: res.statusCode ?? 0, headers, setCookies: (res.headers["set-cookie"] ?? []).map(withoutValue) };
      let handshake: Handshake | undefined;
      if (tls) {
        const s = res.socket as TLSSocket;
        const cert = s.getPeerCertificate();
        const san = (cert.subjectaltname ?? "").split(/,\s*/).flatMap((x) => (x.startsWith("DNS:") ? [x.slice(4)] : []));
        const named = checkServerIdentity(u.hostname, cert);
        handshake = {
          protocol: s.getProtocol() ?? "unknown",
          cipher: s.getCipher()?.name ?? "unknown",
          authorized: s.authorized && named === undefined,
          ...(s.authorized ? (named === undefined ? {} : { authorizationError: "ERR_TLS_CERT_ALTNAME_INVALID" }) : { authorizationError: String(s.authorizationError) }),
          notAfter: new Date(cert.valid_to).toISOString().slice(0, 10),
          subject: String((cert.subject as { CN?: string } | undefined)?.CN ?? ""),
          names: san,
          host: u.hostname,
        };
      }
      res.destroy();
      resolve({ answer, handshake });
    });
    req.on("timeout", () => req.destroy(new Error(`no answer from ${u.host} within ${timeoutMs} ms`)));
    req.on("error", reject);
    req.end();
  });
}
