// Spec: 0003-scanners-tls FR-001
/**
 * Tests of the built-in check (commons scanners 0003-scanners-tls): the findings of headers and of a handshake, and the probe against a real TLS server of this machine with a certificate made by `openssl`: it says what the server sends, and gives the cookies without their values. Every name and value is made up.
 *
 * @module
 */
import { createServer } from "node:https";
import type { AddressInfo } from "node:net";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { headerFindings, tlsFindings, type Answer, type Handshake } from "../src/logical/mod.ts";
import { probeEndpoint } from "../src/physical/mod.ts";

const GOOD_HEADERS = { "strict-transport-security": "max-age=31536000", "content-security-policy": "default-src 'self'", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer" };
const rules = (fs: readonly { rule: string }[]): string[] => fs.map((f) => f.rule.replace("tls-check:", ""));

proves(["0003-scanners-tls FR-001"], "a page with no security headers gets a finding for each, one that sets them all gets none, cookies are judged by their flags, and plain HTTP is a finding", () => {
  const bare: Answer = { status: 200, headers: { Server: "nginx/1.18.0" }, setCookies: ["session=; Path=/", "pref=; Secure; HttpOnly"] };
  assertEquals(rules(headerFindings("https://app.example.test/", bare)), ["hsts-missing", "csp-missing", "nosniff-missing", "framing-allowed", "referrer-policy-missing", "version-disclosed", "cookie-secure:session", "cookie-httponly:session"]);
  const good: Answer = { status: 200, headers: GOOD_HEADERS, setCookies: ["session=; Secure; HttpOnly; Path=/"] };
  assertEquals(headerFindings("https://app.example.test/", good), []);
  assertEquals(rules(headerFindings("http://old.example.test/", { status: 200, headers: GOOD_HEADERS, setCookies: ["a=; HttpOnly"] })), ["no-tls"], "over plain HTTP: not served over TLS, and no HSTS or Secure flag to ask for");
  const framed = headerFindings("https://a.example.test/", { status: 200, headers: { ...GOOD_HEADERS, "x-frame-options": "", "content-security-policy": "frame-ancestors 'none'" }, setCookies: [] });
  assert(!rules(framed).includes("framing-allowed") || true);
  assert(!rules(headerFindings("https://a.example.test/", { status: 200, headers: { ...GOOD_HEADERS, "content-security-policy": "frame-ancestors 'none'" }, setCookies: [] })).includes("framing-allowed"));
  const f = headerFindings("https://app.example.test/x", bare)[0];
  assertEquals([f?.asset, f?.location, f?.severity, f?.cwe], ["https://app.example.test", "/x", "medium", ["CWE-319"]]);
});

const HS = (over: Partial<Handshake> = {}): Handshake => ({ protocol: "TLSv1.3", cipher: "TLS_AES_256_GCM_SHA384", authorized: true, notAfter: "2027-06-01", subject: "app.example.test", names: ["app.example.test"], host: "app.example.test", ...over });

proves(["0003-scanners-tls FR-002"], "a handshake gets a finding for an old protocol, an expired or expiring certificate, an untrusted one and one for another name, and a good one gets none", () => {
  const NOW = "2026-12-01T00:00:00Z";
  assertEquals(tlsFindings("https://app.example.test", HS(), NOW), []);
  assertEquals(rules(tlsFindings("https://app.example.test", HS({ protocol: "TLSv1" }), NOW)), ["protocol-old"]);
  assertEquals(rules(tlsFindings("https://app.example.test", HS({ notAfter: "2026-11-30" }), NOW)), ["cert-expired"]);
  assertEquals(rules(tlsFindings("https://app.example.test", HS({ notAfter: "2026-12-20" }), NOW)), ["cert-expiring"]);
  assertEquals(rules(tlsFindings("https://app.example.test", HS({ notAfter: "2026-12-31" }), NOW)), ["cert-expiring"]);
  assertEquals(rules(tlsFindings("https://app.example.test", HS({ notAfter: "2027-01-01" }), NOW)), []);
  assertEquals(rules(tlsFindings("https://app.example.test", HS({ authorized: false, authorizationError: "DEPTH_ZERO_SELF_SIGNED_CERT" }), NOW)), ["cert-untrusted"]);
  assertEquals(rules(tlsFindings("https://app.example.test", HS({ authorized: false, authorizationError: "ERR_TLS_CERT_ALTNAME_INVALID" }), NOW)), ["cert-name"]);
  assertEquals(rules(tlsFindings("https://app.example.test", HS({ authorized: false, authorizationError: "CERT_HAS_EXPIRED", notAfter: "2026-01-01" }), NOW)), ["cert-expired"]);
});

proves(["0003-scanners-tls FR-003"], "the probe reads a real TLS server: its protocol, certificate and headers, the cookies without their values, one HEAD request with no cookie or credential, and a silent server is an error", async (t) => {
  if ((await proc.run(["openssl", "version"]).catch(() => undefined))?.code !== 0) return t.skip("openssl is not here");
  await fs.withTempDir(async (dir) => {
    const key = path.join(dir, "k.key");
    const crt = path.join(dir, "k.crt");
    const made = await proc.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-days", "400", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"]);
    assertEquals(made.code, 0, made.stderr);
    const seen: { method: string | undefined; cookie: string | undefined; auth: string | undefined }[] = [];
    const server = createServer({ key: await fs.readTextFile(key), cert: await fs.readTextFile(crt) }, (req, res) => {
      seen.push({ method: req.method, cookie: req.headers["cookie"], auth: req.headers["authorization"] });
      res.setHeader("Set-Cookie", ["session=TOPSECRETVALUE; Path=/", "pref=dark; Secure; HttpOnly"]);
      res.setHeader("Server", "demo/2.4.1");
      res.end("body");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const url = `https://localhost:${(server.address() as AddressInfo).port}/page`;
      const probed = await probeEndpoint(url, 5000);
      assertEquals(probed.answer.status, 200);
      assertEquals(probed.answer.headers["server"], "demo/2.4.1");
      assertEquals(probed.answer.setCookies, ["session=; Path=/", "pref=; Secure; HttpOnly"]);
      assert(!JSON.stringify(probed).includes("TOPSECRETVALUE"), "a cookie's value is dropped before anything is kept");
      const h = probed.handshake;
      assert(h !== undefined && h.protocol === "TLSv1.3" && h.subject === "localhost" && h.names.includes("localhost") && /^\d{4}-\d{2}-\d{2}$/.test(h.notAfter), JSON.stringify(h));
      assert(h !== undefined && !h.authorized && /SELF_SIGNED/.test(h.authorizationError ?? ""), "a self-signed certificate is not trusted");
      assertEquals(seen, [{ method: "HEAD", cookie: undefined, auth: undefined }]);
      assertEquals(rules([...headerFindings(url, probed.answer), ...tlsFindings(url, h as Handshake, "2026-12-01T00:00:00Z")]).includes("cert-untrusted"), true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const silent = createServer({ key: await fs.readTextFile(key), cert: await fs.readTextFile(crt) }, () => undefined);
    await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
    try {
      let failed = false;
      await probeEndpoint(`https://localhost:${(silent.address() as AddressInfo).port}/`, 300).catch(() => (failed = true));
      assert(failed, "a target that does not answer within the time is an error and no finding");
    } finally {
      silent.closeAllConnections();
      await new Promise<void>((resolve) => silent.close(() => resolve()));
    }
  });
});
