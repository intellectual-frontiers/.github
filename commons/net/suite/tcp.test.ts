/**
 * Tests of `runtime/tcp.ts` (commons 0001-net FR-006): an echo server on a free local port answers over web streams, with
 * half-close; a port with nothing on it refuses; a taken port is `AddrInUse`; a listener closes by call, abort signal and `using`; and a TLS
 * listener's certificate, made for the test by `openssl` with a root of its own, is accepted with that root and refused without it.
 *
 * @module
 */
import { errors } from "@intellectual-frontiers/system/errors";
import { readTextFile, withTempDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { must, which } from "@intellectual-frontiers/system/proc";
import { type Conn, connect, connectTls, listen, listenTls, type Listener } from "../src/tcp.ts";
import { assert, assertEquals, assertInstanceOf, assertRejects, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const TCP = "0001-net FR-006";
const enc = new TextEncoder();
const dec = new TextDecoder();

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

/** Serve each connection by echoing what it reads, until the listener closes; settles once every connection is done. */
function echo(listener: Listener): Promise<void> {
  return (async () => {
    const served: Promise<void>[] = [];
    for await (const conn of listener) {
      served.push(conn.readable.pipeTo(conn.writable).finally(() => conn.close()));
    }
    await Promise.allSettled(served);
  })();
}

async function send(conn: Conn, text: string): Promise<void> {
  const writer = conn.writable.getWriter();
  await writer.write(enc.encode(text));
  writer.releaseLock();
  await conn.closeWrite();
}

proves(
  [TCP],
  "an echo server on a free port: addresses, web streams both ways, half-close, then the listener closes",
  async () => {
    const listener = await listen({ port: 0 });
    assert(listener.addr.port > 0, "port 0 gives a free port");
    assertEquals(listener.addr.hostname, "127.0.0.1");
    const serving = echo(listener);
    try {
      using conn = await connect({ port: listener.addr.port });
      assertEquals(conn.remoteAddr, listener.addr);
      assertEquals(conn.localAddr.hostname, "127.0.0.1");
      assert(conn.localAddr.port > 0);
      const big = `hello ${"x".repeat(1 << 20)}`;
      const [, back] = await Promise.all([send(conn, big), readAll(conn)]);
      assertEquals(back.length, big.length, "all of it came back, after the half-close");
      assert(back === big, "the same text");
    } finally {
      // A failure above must not leave the listener open: a test process with a listener open never ends.
      listener.close();
    }
    listener.close();
    await serving;
    await assertRejects(() => listener.accept(), errors.ConnectionAborted);
  },
  { timeout: 30_000 },
);

proves(
  [TCP],
  "a port nothing listens on refuses: ConnectionRefused, with the address",
  async () => {
    const listener = await listen({ port: 0 });
    const port = listener.addr.port;
    listener.close();
    // Refused at once on Linux and macOS, after a few retries on Windows; the signal ends a connect that never settles as a failure here,
    // not as a hung test run.
    const signal = AbortSignal.timeout(20_000);
    const e = await assertRejects(() => connect({ hostname: "127.0.0.1", port, signal }), errors.ConnectionRefused);
    assertEquals(e.code, "ECONNREFUSED");
  },
  { timeout: 30_000 },
);

proves([TCP], "a port already taken is AddrInUse; `await using` frees it", async () => {
  let port = 0;
  {
    await using listener = await listen({ port: 0 });
    port = listener.addr.port;
    const e = await assertRejects(() => listen({ port }), errors.AddrInUse);
    assertEquals(e.code, "EADDRINUSE");
  }
  const again = await listen({ port });
  assertEquals(again.addr.port, port);
  again.close();
});

proves(
  [TCP],
  "an abort signal closes a listener and ends its iteration; a connect aborted gives up, as TimedOut for a timeout",
  async () => {
    const stop = new AbortController();
    const listener = await listen({ port: 0, signal: stop.signal });
    const seen: number[] = [];
    const iterating = (async () => {
      for await (const conn of listener) {
        seen.push(conn.remoteAddr.port);
        conn.close();
      }
    })();
    let port: number | undefined;
    try {
      using conn = await connect({ port: listener.addr.port });
      port = conn.localAddr.port;
      assertEquals(await readAll(conn), "", "the server closed it");
    } finally {
      // Closed whatever happened above, so that a failure is reported rather than a test process that never ends.
      stop.abort();
    }
    await iterating;
    assertEquals(seen, [port ?? -1]);
    await assertRejects(() => connect({ port: listener.addr.port, signal: AbortSignal.abort() }));
    const late = AbortSignal.abort(new DOMException("too late", "TimeoutError"));
    await assertRejects(() => connect({ port: listener.addr.port, signal: late }), errors.TimedOut);
  },
  { timeout: 30_000 },
);

const OPENSSL = which("openssl");

async function makeCerts(
  dir: string,
): Promise<{ readonly root: string; readonly other: string; readonly cert: string; readonly key: string }> {
  const openssl = OPENSSL ?? "openssl";
  const ec = ["-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes"];
  const root = async (name: string): Promise<void> => {
    await must([
      openssl,
      "req",
      "-x509",
      ...ec,
      "-keyout",
      join(dir, `${name}.key`),
      "-out",
      join(dir, `${name}.pem`),
      "-subj",
      `/CN=test-only ${name}`,
      "-days",
      "2",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign",
    ]);
  };
  await root("root");
  await root("other");
  await must([openssl, "req", ...ec, "-keyout", join(dir, "server.key"), "-out", join(dir, "server.csr"), "-subj", "/CN=127.0.0.1"]);
  await writeTextFile(
    join(dir, "server.ext"),
    "basicConstraints=CA:FALSE\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1,DNS:localhost\n",
  );
  await must([
    openssl,
    "x509",
    "-req",
    "-in",
    join(dir, "server.csr"),
    "-CA",
    join(dir, "root.pem"),
    "-CAkey",
    join(dir, "root.key"),
    "-set_serial",
    "1",
    "-days",
    "2",
    "-extfile",
    join(dir, "server.ext"),
    "-out",
    join(dir, "server.pem"),
  ]);
  return {
    root: await readTextFile(join(dir, "root.pem")),
    other: await readTextFile(join(dir, "other.pem")),
    cert: await readTextFile(join(dir, "server.pem")),
    key: await readTextFile(join(dir, "server.key")),
  };
}

proves(
  [TCP],
  "a TLS listener from a PEM certificate and key: accepted with the root that signed it, refused with another root or the system's",
  () =>
    withTempDir(async (dir) => {
      const pem = await makeCerts(dir);
      const listener = await listenTls({ port: 0, cert: pem.cert, key: pem.key });
      const serving = echo(listener);
      try {
        for (const hostname of ["127.0.0.1", "localhost"]) {
          if (hostname === "localhost" && !(await resolvesLocally(listener.addr.port))) continue;
          using conn = await connectTls({ hostname, port: listener.addr.port, caCerts: [pem.root] });
          const [, back] = await Promise.all([send(conn, "over TLS"), readAll(conn)]);
          assertEquals(back, "over TLS");
        }
        const other = await assertRejects(() => connectTls({ port: listener.addr.port, caCerts: [pem.other] }), errors.InvalidData);
        assertInstanceOf(other, errors.RuntimeError);
        await assertRejects(() => connectTls({ port: listener.addr.port }), errors.InvalidData);
        await assertRejects(
          () => connectTls({ port: listener.addr.port, caCerts: [pem.root], serverName: "elsewhere.example.com" }),
          errors.InvalidData,
        );
      } finally {
        listener.close();
        await serving;
      }
    }),
  { skip: OPENSSL === undefined ? "openssl is not on PATH" : false },
);

/** Whether `localhost` reaches 127.0.0.1 here (it may be `::1` first, where nothing listens). */
async function resolvesLocally(port: number): Promise<boolean> {
  try {
    const c = await connect({ hostname: "localhost", port });
    const v4 = c.remoteAddr.hostname === "127.0.0.1";
    c.close();
    return v4;
  } catch {
    return false;
  }
}
