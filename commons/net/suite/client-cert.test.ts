/**
 * Tests of the client certificate (spec 0002-net-client-certificate FR-001 to FR-003): a client presents a certificate and key together, a TLS listener and `serve` ask for one and say the verified subject, and a client with none is refused where one
 * is required. The certificates are made for the test by `openssl` with a root of their own.
 *
 * @module
 */
import { errors } from "@intellectual-frontiers/system/errors";
import { readTextFile, withTempDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { must, which } from "@intellectual-frontiers/system/proc";
import { serve } from "../src/serve.ts";
import { type Conn, connectTls, listenTls } from "../src/tcp.ts";
import { assert, assertEquals, assertRejects, proves } from "@intellectual-frontiers/test";

const OPENSSL = which("openssl");
const enc = new TextEncoder();
const dec = new TextDecoder();
const skip = { skip: OPENSSL === undefined ? "openssl is not on PATH" : false, timeout: 30_000 };

type Pems = { readonly root: string; readonly stranger: string; readonly cert: string; readonly key: string; readonly clientCert: string; readonly clientKey: string; readonly strangerCert: string; readonly strangerKey: string };

async function makeCerts(dir: string): Promise<Pems> {
  const openssl = OPENSSL ?? "openssl";
  const ec = ["-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes"];
  const root = async (name: string): Promise<void> => {
    await must([openssl, "req", "-x509", ...ec, "-keyout", join(dir, `${name}.key`), "-out", join(dir, `${name}.pem`), "-subj", `/CN=test-only ${name}`, "-days", "2", "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign"]);
  };
  const leaf = async (name: string, subject: string, signer: string, ext: string): Promise<void> => {
    await must([openssl, "req", ...ec, "-keyout", join(dir, `${name}.key`), "-out", join(dir, `${name}.csr`), "-subj", subject]);
    await writeTextFile(join(dir, `${name}.ext`), ext);
    await must([openssl, "x509", "-req", "-in", join(dir, `${name}.csr`), "-CA", join(dir, `${signer}.pem`), "-CAkey", join(dir, `${signer}.key`), "-set_serial", "1", "-days", "2", "-extfile", join(dir, `${name}.ext`), "-out", join(dir, `${name}.pem`)]);
  };
  await root("root");
  await root("stranger");
  await leaf("server", "/CN=127.0.0.1", "root", "basicConstraints=CA:FALSE\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n");
  await leaf("client", "/CN=device-01", "root", "basicConstraints=CA:FALSE\nkeyUsage=digitalSignature\nextendedKeyUsage=clientAuth\n");
  await leaf("intruder", "/CN=device-99", "stranger", "basicConstraints=CA:FALSE\nkeyUsage=digitalSignature\nextendedKeyUsage=clientAuth\n");
  const r = (n: string): Promise<string> => readTextFile(join(dir, n));
  return { root: await r("root.pem"), stranger: await r("stranger.pem"), cert: await r("server.pem"), key: await r("server.key"), clientCert: await r("client.pem"), clientKey: await r("client.key"), strangerCert: await r("intruder.pem"), strangerKey: await r("intruder.key") };
}

async function readAll(conn: Conn): Promise<string> {
  let out = "";
  const reader = conn.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  return out + dec.decode();
}

/** Ask the HTTPS server for `/` over `connectTls` and give the whole answer, or what went wrong (a refused handshake shows when the connection is read or written). */
async function get(port: number, pem: Pems, withCert: { readonly cert: string; readonly key: string } | undefined): Promise<string> {
  try {
    using conn = await connectTls({ port, caCerts: [pem.root], ...(withCert === undefined ? {} : { clientCert: withCert.cert, clientKey: withCert.key }) });
    const w = conn.writable.getWriter();
    await w.write(enc.encode("GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"));
    const answer = await readAll(conn);
    return answer === "" ? "refused: closed" : answer;
  } catch (e) {
    return `refused: ${e instanceof Error ? e.name : "error"}`;
  }
}

proves(["0002-net-client-certificate FR-001"], "a client certificate and its key are given together or not at all, and the key is in no error", async () => {
  const e1 = await assertRejects(() => connectTls({ port: 9, clientCert: "-----BEGIN CERTIFICATE-----" }), errors.InvalidData);
  const e2 = await assertRejects(() => connectTls({ port: 9, clientKey: `${"-----BEGIN"} ${"PRIVATE KEY"}-----\nSECRETSECRET` }), errors.InvalidData);
  assert(!String((e1 as Error).message).includes("BEGIN") && !String((e2 as Error).message).includes("SECRETSECRET"), "no key in an error");
});

proves(["0002-net-client-certificate FR-002"], "a TLS listener that requires a client certificate refuses a client with none or with one of another root, and says the verified subject of a good one", async () => {
  await withTempDir(async (dir) => {
    const pem = await makeCerts(dir);
    const listener = await listenTls({ port: 0, cert: pem.cert, key: pem.key, clientCa: [pem.root], requestClientCert: "require" });
    const seen: (string | undefined)[] = [];
    const serving = (async () => {
      for await (const conn of listener) {
        seen.push(conn.peerSubject);
        const w = conn.writable.getWriter();
        await w.write(enc.encode("hi")).catch(() => undefined);
        await w.close().catch(() => undefined);
      }
    })();
    try {
      using good = await connectTls({ port: listener.addr.port, caCerts: [pem.root], clientCert: pem.clientCert, clientKey: pem.clientKey });
      assertEquals(await readAll(good), "hi");
      let none = "";
      try {
        using c = await connectTls({ port: listener.addr.port, caCerts: [pem.root] });
        none = (await readAll(c)) === "" ? "refused" : "answered";
      } catch {
        none = "refused";
      }
      assertEquals(none, "refused", "no certificate is refused at the handshake");
      let stranger = "";
      try {
        using c = await connectTls({ port: listener.addr.port, caCerts: [pem.root], clientCert: pem.strangerCert, clientKey: pem.strangerKey });
        stranger = (await readAll(c)) === "" ? "refused" : "answered";
      } catch {
        stranger = "refused";
      }
      assertEquals(stranger, "refused", "a certificate of another root is refused");
      assertEquals(seen, ["CN=device-01"], "only the good client was taken, with its subject");
    } finally {
      listener.close();
      await serving;
    }
  });
}, skip);

proves(["0002-net-client-certificate FR-002"], "a listener asks for a certificate only with roots to check it against", async () => {
  await withTempDir(async (dir) => {
    const pem = await makeCerts(dir);
    await assertRejects(() => listenTls({ port: 0, cert: pem.cert, key: pem.key, requestClientCert: "require" }), errors.InvalidData);
  });
}, skip);

const onBun = "Bun" in globalThis;

proves(["0002-net-client-certificate FR-005"], "on Bun serve says plainly that it cannot name a client certificate, and on Node it can", async () => {
  await withTempDir(async (dir) => {
    const pem = await makeCerts(dir);
    const ask = (): Promise<unknown> => serve({ port: 0, tls: { cert: pem.cert, key: pem.key, clientCa: [pem.root], requestClientCert: "require" } }, () => new Response("x"));
    if (onBun) {
      const e = await assertRejects(ask, errors.NotSupported);
      assert(String((e as Error).message).includes("Bun"), "the error names the runtime");
    } else await (await ask() as { shutdown(): Promise<void> }).shutdown();
  });
}, skip);

proves(["0002-net-client-certificate FR-003"], "serve answers HTTPS and tells the handler the verified subject of the client certificate, and where one is required runs no handler for a client with none", async () => {
  if (onBun) return;
  await withTempDir(async (dir) => {
    const pem = await makeCerts(dir);
    const calls: (string | undefined)[] = [];
    const required = await serve({ port: 0, tls: { cert: pem.cert, key: pem.key, clientCa: [pem.root], requestClientCert: "require" } }, (_req, info) => {
      calls.push(info.clientSubject);
      return new Response(`subject ${info.clientSubject ?? "none"}`);
    });
    const asked = await serve({ port: 0, tls: { cert: pem.cert, key: pem.key, clientCa: [pem.root], requestClientCert: "request" } }, (_req, info) => new Response(`subject ${info.clientSubject ?? "none"}`));
    const plain = await serve({ port: 0, tls: { cert: pem.cert, key: pem.key } }, (_req, info) => new Response(`subject ${info.clientSubject ?? "none"}`));
    try {
      const good = await get(required.addr.port, pem, { cert: pem.clientCert, key: pem.clientKey });
      assert(good.includes("200") && good.includes("subject CN=device-01"), good);
      assertEquals(calls, ["CN=device-01"]);
      const without = await get(required.addr.port, pem, undefined);
      assert(without.startsWith("refused"), without);
      assertEquals(calls.length, 1, "no handler ran for the client with no certificate");
      const intruder = await get(required.addr.port, pem, { cert: pem.strangerCert, key: pem.strangerKey });
      assert(intruder.startsWith("refused"), intruder);
      const optional = await get(asked.addr.port, pem, undefined);
      assert(optional.includes("subject none"), optional);
      const optionalGood = await get(asked.addr.port, pem, { cert: pem.clientCert, key: pem.clientKey });
      assert(optionalGood.includes("subject CN=device-01"), optionalGood);
      assert((await get(plain.addr.port, pem, undefined)).includes("subject none"), "HTTPS with no client certificate asked");
    } finally {
      await Promise.all([required.shutdown(), asked.shutdown(), plain.shutdown()]);
    }
  });
}, skip);
