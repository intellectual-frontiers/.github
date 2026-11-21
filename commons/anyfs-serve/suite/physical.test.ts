/**
 * Tests of the server of AnyFS Serve (commons anyfs-serve 0004-anyfs-serve-physical FR-001 to FR-003): the handler hosted on a real socket over a store in memory and a store in a folder, the token it makes, and the hosts it answers.
 *
 * @module
 */
import { request } from "node:http";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { fs } from "@intellectual-frontiers/system";
import { expose, type ServeEvent, serveStore } from "../src/mod.ts";
import { full } from "./world.ts";

/** One request with a `Host` of the test's choosing, which `fetch` does not let a test set. */
function raw(port: number, method: string, target: string, headers: Record<string, string>, body?: string): Promise<{ readonly status: number; readonly text: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, method, path: target, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

proves(["0004-anyfs-serve-physical FR-001"], "serveStore hosts a store on the loopback, gives its address and a way to stop it, and gives an error value where it cannot listen", async () => {
  const a = await serveStore(full(), { onToken: () => undefined });
  assert(a.kind === "ok");
  try {
    assert(/^http:\/\/127\.0\.0\.1:\d+\/$/u.test(a.value.url), a.value.url);
    assert(a.value.port > 0);
    const taken = await serveStore(full(), { port: a.value.port });
    assert(taken.kind === "err", "the port is taken");
    assertStringIncludes(taken.error, `127.0.0.1:${a.value.port}`);
  } finally {
    await a.value.close();
  }
  const dead = await fetch(a.value.url).then(
    () => "answered",
    () => "closed",
  );
  assertEquals(dead, "closed");
});

proves(["0004-anyfs-serve-physical FR-001"], "over a store in memory and a store in a folder, a client with fetch writes, reads, lists, copies, moves and deletes through a real socket", async () => {
  const dir = await fs.makeTempDir({ prefix: "anyfs-serve-" });
  try {
    const local = await localStore(dir);
    assert(local.kind === "ok");
    for (const store of [full(), local.value]) {
      const s = await serveStore(store as never, { token: "t0k3n" });
      assert(s.kind === "ok");
      try {
        const auth = { authorization: "Bearer t0k3n" };
        const url = (p: string): string => `${s.value.url}${p.replace(/^\//u, "")}`;
        assertEquals((await fetch(url("/"))).status, 401, "no credentials");
        assertEquals((await fetch(url("/"), { headers: { authorization: "Bearer other" } })).status, 401);
        assertEquals((await fetch(url("/docs"), { method: "MKCOL", headers: auth })).status, 201);
        assertEquals((await fetch(url("/docs/a.txt"), { method: "PUT", body: "héllo wörld", headers: auth })).status, 201);
        const got = await fetch(url("/docs/a.txt"), { headers: auth });
        assertEquals([got.status, await got.text()], [200, "héllo wörld"]);
        const big = new Uint8Array(3 * 1024 * 1024).map((_, i) => i % 251);
        assertEquals((await fetch(url("/docs/big.bin"), { method: "PUT", body: big, headers: auth })).status, 201);
        const back = new Uint8Array(await (await fetch(url("/docs/big.bin"), { headers: auth })).arrayBuffer());
        assertEquals(back.length, big.length);
        assert(back.every((b, i) => b === big[i]), "the bytes are the same");
        const listing = await fetch(url("/docs/"), { method: "PROPFIND", headers: { ...auth, depth: "1" } });
        assertEquals(listing.status, 207);
        assertStringIncludes(await listing.text(), "/docs/big.bin");
        assertEquals((await fetch(url("/docs/a.txt"), { method: "COPY", headers: { ...auth, destination: url("/docs/b.txt") } })).status, 201);
        assertEquals((await fetch(url("/docs/b.txt"), { method: "MOVE", headers: { ...auth, destination: url("/docs/c.txt") } })).status, 201);
        assertEquals(await (await fetch(url("/docs/c.txt"), { headers: auth })).text(), "héllo wörld");
        assertEquals((await fetch(url("/docs"), { method: "DELETE", headers: auth })).status, 204);
        assertEquals((await fetch(url("/docs/a.txt"), { headers: auth })).status, 404);
      } finally {
        await s.value.close();
      }
    }
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

proves(["0004-anyfs-serve-physical FR-002"], "with no way to know who asks the server makes a 64-digit token, tells the program once, accepts it as Bearer and as the password of Basic, and never logs it", async () => {
  const told: string[] = [];
  const events: ServeEvent[] = [];
  const s = await serveStore(full(), { onToken: (t) => told.push(t), onEvent: (e) => events.push(e) });
  assert(s.kind === "ok");
  try {
    assertEquals(told.length, 1);
    const token = told[0] ?? "";
    assert(/^[0-9a-f]{64}$/u.test(token));
    assertEquals(s.value.token, token);
    assertEquals((await fetch(s.value.url)).status, 401);
    assertEquals((await fetch(s.value.url, { headers: { authorization: `Bearer ${token}` } })).status, 200);
    assertEquals((await fetch(s.value.url, { headers: { authorization: `Basic ${btoa(`anyone:${token}`)}` } })).status, 200);
    assertEquals((await fetch(s.value.url, { headers: { authorization: `Basic ${btoa(`anyone:${token}x`)}` } })).status, 401);
    assert(events.length >= 4);
    assert(!JSON.stringify(events).includes(token), "an event holds no credential");
    for (const e of events) assertEquals(Object.keys(e).sort(), ["fidelity", "method", "milliseconds", "path", "status"]);
  } finally {
    await s.value.close();
  }
  const own = await serveStore(full(), { authenticator: async (c) => c?.scheme === "bearer" && c.secret === "mine", onToken: () => told.push("unexpected") });
  assert(own.kind === "ok");
  try {
    assertEquals(own.value.token, undefined, "the program's own way to know who asks");
    assertEquals(told.length, 1);
    assertEquals((await fetch(own.value.url, { headers: { authorization: "Bearer mine" } })).status, 200);
  } finally {
    await own.value.close();
  }
});

proves(["0004-anyfs-serve-physical FR-003"], "the server answers only the hosts it was given: the loopback names, or the hosts of an exposure, so a page of another site cannot reach it", async () => {
  const s = await serveStore(full(), { token: "tok" });
  assert(s.kind === "ok");
  try {
    const auth = { authorization: "Bearer tok" };
    for (const host of [`127.0.0.1:${s.value.port}`, `localhost:${s.value.port}`, "LOCALHOST", `[::1]:${s.value.port}`]) assertEquals((await raw(s.value.port, "GET", "/", { ...auth, host })).status, 200, host);
    for (const host of ["attacker.example.test", `attacker.example.test:${s.value.port}`, "127.0.0.1.attacker.test", "0.0.0.0"]) assertEquals((await raw(s.value.port, "GET", "/", { ...auth, host })).status, 403, host);
  } finally {
    await s.value.close();
  }
  const exposure = expose("127.0.0.1", ["files.example.test"]);
  assert(exposure.kind === "ok");
  const e = await serveStore(full(), { token: "tok", exposure: exposure.value });
  assert(e.kind === "ok");
  try {
    const auth = { authorization: "Bearer tok" };
    assertEquals((await raw(e.value.port, "GET", "/", { ...auth, host: "files.example.test" })).status, 200);
    assertEquals((await raw(e.value.port, "GET", "/", { ...auth, host: "localhost" })).status, 403, "the loopback names are not listed by an exposure that does not name them");
    assertEquals((await raw(e.value.port, "GET", "/", { ...auth, host: "other.example.test" })).status, 403);
  } finally {
    await e.value.close();
  }
});
