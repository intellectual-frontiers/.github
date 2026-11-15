// A network that fails now and works in a minute (009-machine-bootstrap FR-031 to FR-037): what is tried again and what is not, the waits, a download that
// resumes, one that is not the file expected, and the look at the network before the long installs. A local HTTP server stands in for the network.
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { classify, describe, downloadVerified, fetchTo, netWords, Retries, retryable, retryCommand } from "../bin/setup/net.ts";
import { retryPolicy } from "../bin/setup/options.ts";
import { deadUrl, exists, Fx, OFF, serve, sha256Hex } from "./helpers.ts";
import type { Sha256 } from "../bin/setup/result.ts";

const quick = (tries = 8) => {
  const said: string[] = [];
  const waits: number[] = [];
  const r = new Retries({ tries, base: 3, cap: 60 }, (l) => said.push(l), () => 0, (s) => {
    waits.push(s);
    return Promise.resolve();
  });
  return { r, said, waits };
};

Deno.test("the wait doubles to the cap, with up to two seconds more (FR-033)", () => {
  const r = new Retries({ tries: 8, base: 3, cap: 60 }, () => {}, () => 0);
  assertEquals([1, 2, 3, 4, 5, 6, 7].map((n) => r.wait(n)), [3, 6, 12, 24, 48, 60, 60]);
  const j = new Retries({ tries: 8, base: 3, cap: 60 }, () => {});
  for (let i = 0; i < 50; i++) assert(j.wait(1) >= 3 && j.wait(1) <= 5);
});

Deno.test("the knobs, --patient, and nonsense values (FR-034)", () => {
  assertEquals(retryPolicy({}, false), { tries: 8, base: 3, cap: 60 });
  assertEquals(retryPolicy({}, true), { tries: 15, base: 5, cap: 120 });
  assertEquals(retryPolicy({ ERGA_RETRIES: "3", ERGA_RETRY_DELAY: "1", ERGA_RETRY_MAX_DELAY: "9" }, true), { tries: 3, base: 1, cap: 9 });
  assertEquals(retryPolicy({ ERGA_RETRIES: "0", ERGA_RETRY_DELAY: "-1", ERGA_RETRY_MAX_DELAY: "x" }, false), { tries: 8, base: 3, cap: 60 });
});

Deno.test("what is tried again and what is not: a name, a connection, a busy server; never a refusal or a certificate (FR-032)", () => {
  for (
    const f of [{ kind: "dns" }, { kind: "connect" }, { kind: "broken" }, { kind: "timeout" }, { kind: "tls" }, { kind: "http", status: 503 }, { kind: "http", status: 429 }, {
      kind: "http",
      status: 416,
    }] as const
  ) {
    assert(retryable(f), JSON.stringify(f));
  }
  for (const f of [{ kind: "certificate" }, { kind: "http", status: 404 }, { kind: "http", status: 403 }, { kind: "other", message: "x" }] as const) {
    assert(!retryable(f), JSON.stringify(f));
  }
  assertStringIncludes(describe({ kind: "dns" }), "DNS");
  assertStringIncludes(describe({ kind: "http", status: 503 }), "busy");
  assertEquals(classify(new TypeError("error sending request: client error (Connect): dns error: failed to lookup address information")).kind, "dns");
  assertEquals(classify(new TypeError("error sending request: Connection refused (os error 111)")).kind, "connect");
  assertEquals(classify(new TypeError("invalid peer certificate: UnknownIssuer")).kind, "certificate");
  assertEquals(classify(new DOMException("x", "TimeoutError")).kind, "timeout");
});

Deno.test("the words of a command tell a failed network from a refusal (FR-032)", () => {
  for (
    const [words, want] of [
      ["fatal: unable to access 'https://github.com/x/': Could not resolve host: github.com", true],
      ["error: RPC failed; curl 56 Recv failure: Connection reset by peer", true],
      ["Temporary failure resolving 'deb.debian.org'", true],
      ["error: 503 Service Unavailable", true],
      ["remote: Repository not found.", false],
      ["certificate problem: self signed", false],
      ["permission denied", false],
      ["syntax error", false],
    ] as const
  ) assertEquals(netWords(words), want, words);
});

Deno.test("a busy server is tried again, said each time, and works; a refusal is not tried again (FR-032, FR-033)", async () => {
  await using fx = await Fx.make();
  let n = 0;
  const s = serve(() => ++n <= 2 ? new Response("busy", { status: 503 }) : new Response("payload"));
  try {
    const { r, said, waits } = quick();
    const got = await fetchTo(r, `${s.url}/a`, `${fx.tmp}/a`);
    assert(got.ok);
    assertEquals(Deno.readTextFileSync(`${fx.tmp}/a`), "payload");
    assertEquals(waits, [3, 6]);
    assertStringIncludes(said[0] ?? "", "the server answered 503 (busy or not ready); trying again in 3s (attempt 2 of 8)");
    assertEquals(r.notes.length, 2);
    assertStringIncludes(r.top(), "127.0.0.1");
  } finally {
    await s.close();
  }
  const refusing = serve(() => new Response("no", { status: 404 }));
  try {
    const { r, waits } = quick();
    const got = await fetchTo(r, `${refusing.url}/x`, `${fx.tmp}/x`);
    assert(!got.ok);
    assertStringIncludes(got.error, "the server answered 404 (after 1 of 8 attempts)");
    assertEquals(waits, []);
  } finally {
    await refusing.close();
  }
});

Deno.test("it gives up after the tries it was given, and says how many (FR-034)", async () => {
  await using fx = await Fx.make();
  const s = serve(() => new Response("busy", { status: 502 }));
  try {
    const { r } = quick(3);
    const got = await fetchTo(r, `${s.url}/a`, `${fx.tmp}/a`);
    assert(!got.ok);
    assertStringIncludes(got.error, "(after 3 of 3 attempts)");
  } finally {
    await s.close();
  }
  const { r } = quick(2);
  const dead = await fetchTo(r, `${deadUrl()}/x`, `${fx.tmp}/x`);
  assert(!dead.ok);
  assertStringIncludes(dead.error, "no connection could be made (after 2 of 2 attempts)");
});

Deno.test("a .part file is resumed where the server can, and starts again where it cannot (FR-035)", async () => {
  await using fx = await Fx.make();
  const ranges: string[] = [];
  const s = serve((req) => {
    const range = req.headers.get("range") ?? "";
    ranges.push(range);
    if (req.url.endsWith("/no-resume")) return range !== "" && ranges.filter((x) => x !== "").length === 1 ? new Response("", { status: 416 }) : new Response("whole");
    return range === "bytes=4-" ? new Response("oad", { status: 206 }) : new Response("payload");
  });
  try {
    const { r } = quick();
    Deno.writeTextFileSync(`${fx.tmp}/f.part`, "payl");
    assert((await fetchTo(r, `${s.url}/f`, `${fx.tmp}/f.part`)).ok);
    assertEquals(Deno.readTextFileSync(`${fx.tmp}/f.part`), "payload");
    assertEquals(ranges[0], "bytes=4-");
    Deno.writeTextFileSync(`${fx.tmp}/other`, "payl");
    assert((await fetchTo(r, `${s.url}/f`, `${fx.tmp}/other`)).ok);
    assertEquals(Deno.readTextFileSync(`${fx.tmp}/other`), "payload", "a name that is not .part is fetched whole");
    Deno.writeTextFileSync(`${fx.tmp}/g.part`, "xx");
    assert((await fetchTo(r, `${s.url}/no-resume`, `${fx.tmp}/g.part`)).ok);
    assertEquals(Deno.readTextFileSync(`${fx.tmp}/g.part`), "whole");
  } finally {
    await s.close();
  }
});

Deno.test("a download is kept only with the SHA-256 given; a wrong one is dropped and a stopped one is kept to resume (FR-025, FR-035)", async () => {
  await using fx = await Fx.make();
  const body = "a program";
  const good = await sha256Hex(body) as Sha256;
  Deno.writeTextFileSync(`${fx.tmp}/tool`, body);
  const cache = `${fx.home}/.cache/erga-setup`;
  const { r } = quick();
  const ok = await downloadVerified(r, `file://${fx.tmp}/tool`, good, cache);
  assert(ok.ok);
  assertEquals(Deno.readTextFileSync(ok.value), body);
  const again = await downloadVerified(r, `${deadUrl()}/never-fetched`, good, cache);
  assert(again.ok, "a file already in the cache with its checksum is not fetched again");
  const bad = await downloadVerified(r, `file://${fx.tmp}/tool`, "0".repeat(64) as Sha256, cache);
  assert(!bad.ok);
  assertStringIncludes(bad.error, "nothing was installed");
  assert(!exists(`${cache}/downloads/${"0".repeat(64)}`) && !exists(`${cache}/downloads/${"0".repeat(64)}.part`));
  const { r: one } = quick(1);
  const other = await sha256Hex("other") as Sha256;
  Deno.writeTextFileSync(`${cache}/downloads/${other}.part`, "oth");
  const stopped = await downloadVerified(one, `${deadUrl()}/x`, other, cache);
  assert(!stopped.ok);
  assert(exists(`${cache}/downloads/${other}.part`), "the part is kept for the next run");
});

Deno.test("a command whose words say the network failed is run again; a refused one is not; one that keeps failing stops after its tries (FR-032)", async () => {
  await using fx = await Fx.make();
  const count = `${fx.tmp}/count`;
  const cmd = (
    fails: number,
    words: string,
  ) => ["sh", "-c", `n=$(cat ${count} 2>/dev/null || echo 0); n=$((n+1)); echo $n >${count}; [ $n -gt ${fails} ] && echo done && exit 0; echo "${words}" >&2; exit 1`];
  const { r, said } = quick();
  const ok = await retryCommand(r, "git", cmd(2, "fatal: unable to access: Could not resolve host: github.com"));
  assertEquals(ok.code, 0);
  assertEquals(Deno.readTextFileSync(count).trim(), "3");
  assertStringIncludes(said[0] ?? "", "git: fatal: unable to access: Could not resolve host");
  Deno.removeSync(count);
  const refused = await retryCommand(quick().r, "git", cmd(9, "remote: Repository not found."));
  assertEquals(refused.code, 1);
  assertEquals(Deno.readTextFileSync(count).trim(), "1");
  Deno.removeSync(count);
  const keeps = await retryCommand(quick(3).r, "git", cmd(99, "Connection timed out"));
  assertEquals(keeps.code, 1);
  assertStringIncludes(keeps.output, "Connection timed out");
  assertEquals(Deno.readTextFileSync(count).trim(), "3");
});

Deno.test("an unreachable network stops before anything is installed, with what to try; the look can be skipped (FR-037)", async () => {
  await using fx = await Fx.make();
  // a proxy that answers every CONNECT with a refusal stands in for a network where nothing can be reached; it counts the hosts looked at
  const hosts: string[] = [];
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  (async () => {
    for await (const conn of listener) {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf).catch(() => null);
      const line = new TextDecoder().decode(buf.subarray(0, n ?? 0)).split("\r\n")[0] ?? "";
      if (line.startsWith("CONNECT ")) hosts.push(line.split(" ")[1]?.replace(/:443$/, "") ?? "");
      conn.close();
    }
  })().catch(() => {});
  try {
    const env = {
      ...OFF,
      BOOTSTRAP_NO_DOWNLOAD: "",
      BOOTSTRAP_NO_NETCHECK: "",
      ERGA_RETRIES: "1",
      HTTPS_PROXY: `http://127.0.0.1:${port}`,
      https_proxy: `http://127.0.0.1:${port}`,
    };
    const p = await fx.setup([], env);
    assertEquals(p.code, 3, p.stdout + p.stderr);
    for (const t of ["cannot reach", "github.com", "static.rust-lang.org", "--patient", "BOOTSTRAP_NO_NETCHECK=1"]) assertStringIncludes(p.stdout, t);
    assertEquals(new Set(hosts).size, 7, `seven hosts are looked at: GitHub's four, Rust's and the crates' (${hosts.join(" ")})`);
    assert(!exists(`${fx.home}/.local/share/erga-setup/tools`), "nothing was installed");
    hosts.length = 0;
    assertEquals((await fx.setup([], { ...env, BOOTSTRAP_NO_NETCHECK: "1", BOOTSTRAP_NO_DOWNLOAD: "1" })).code, 0);
    assertEquals(hosts, []);
  } finally {
    listener.close();
  }
});
