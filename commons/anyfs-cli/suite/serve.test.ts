/**
 * Tests of the verb that serves a store (commons anyfs-cli 0006-anyfs-cli-serve FR-001 to FR-004): a real server on the loopback, asked with real HTTP, over a real folder.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { main } from "../src/anyfs.ts";
import { fill, lab, mountsOf, type Lab } from "./world.ts";

type Running = { readonly url: string; readonly token: string; readonly stderr: () => string; readonly stop: () => Promise<number>; readonly exited: Promise<number> };

/** Runs `anyfs serve` in the lab until the test stops it, and waits for the address and the token on standard error. */
async function start(l: Lab, args: readonly string[]): Promise<Running> {
  const controller = new AbortController();
  let err = "";
  const exited = main(["serve", ...args], { cwd: l.dir, env: {}, stateDir: l.state, out: () => undefined, err: (t) => void (err += t), notice: (t) => void (err += `${t}\n`), stop: controller.signal });
  for (let i = 0; i < 200 && !/token: \S+/u.test(err); i++) {
    await new Promise((r) => setTimeout(r, 25));
    if (/not\b/u.test(err) && !err.includes("serving")) break;
  }
  const url = /at (http:\/\/\S+)/u.exec(err)?.[1] ?? "";
  const token = /token: (\S+)/u.exec(err)?.[1] ?? "";
  return { url, token, stderr: () => err, exited, stop: () => (controller.abort(), exited) };
}

const propfind = (url: string, token: string | undefined): Promise<Response> =>
  fetch(url, { method: "PROPFIND", headers: { depth: "1", ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) } });

async function withLab<T>(body: (l: Lab) => Promise<T>): Promise<T> {
  const l = await lab();
  try {
    await l.config(mountsOf(l.dir, ["docs"]));
    await fill(l.dir, { "docs/hello.txt": "hello\n", "docs/sub/inner.txt": "inner\n" });
    return await body(l);
  } finally {
    await l.cleanup();
  }
}

proves(["0006-anyfs-cli-serve FR-001", "0006-anyfs-cli-serve FR-002", "0006-anyfs-cli-serve FR-004"], "serve hosts a mount as WebDAV on the loopback, tells the address and the token on standard error only, refuses a request without the token, and stops when it is told to", () =>
  withLab(async (l) => {
    const s = await start(l, ["docs:/"]);
    try {
      assert(s.url.startsWith("http://127.0.0.1:"), s.stderr());
      assert(s.token.length >= 16, s.stderr());
      assertEquals((await propfind(s.url, undefined)).status, 401);
      const ok = await propfind(s.url, s.token);
      assertEquals(ok.status, 207);
      assertStringIncludes(await ok.text(), "hello.txt");
      const got = await fetch(`${s.url}hello.txt`, { headers: { authorization: `Bearer ${s.token}` } });
      assertEquals(await got.text(), "hello\n");
    } finally {
      assertEquals(await s.stop(), 0, s.stderr());
    }
    await assertRefusesAfterStop(s.url);
  }),
);

async function assertRefusesAfterStop(url: string): Promise<void> {
  let reached = true;
  try {
    await fetch(url, { method: "PROPFIND" });
  } catch {
    reached = false;
  }
  assertEquals(reached, false, "the server is closed");
}

proves(["0006-anyfs-cli-serve FR-001"], "a directory below the root of a store is served as the root, and a port that is not a port is a usage error", () =>
  withLab(async (l) => {
    const s = await start(l, ["docs:/sub"]);
    try {
      const listing = await (await propfind(s.url, s.token)).text();
      assertStringIncludes(listing, "inner.txt");
      assert(!listing.includes("hello.txt"), "nothing above the directory is served");
    } finally {
      await s.stop();
    }
    const bad = await l.run(["serve", "--port", "99999", "docs:/"]);
    assertEquals(bad.code, 2, bad.err);
    assertStringIncludes(bad.err, "--port");
  }),
);

proves(["0006-anyfs-cli-serve FR-003"], "--read-only serves nothing that changes the store, and an exposed address needs the hosts it may be asked for", () =>
  withLab(async (l) => {
    const s = await start(l, ["--read-only", "docs:/"]);
    try {
      const put = await fetch(`${s.url}new.txt`, { method: "PUT", body: "x", headers: { authorization: `Bearer ${s.token}` } });
      assert(put.status >= 400, `a write is refused, got ${put.status}`);
      assertEquals(await fs.exists(path.join(l.dir, "docs", "new.txt")), false);
    } finally {
      await s.stop();
    }
    const exposed = await l.run(["serve", "--listen", "0.0.0.0", "docs:/"]);
    assertEquals(exposed.code, 2, exposed.err);
    assertStringIncludes(exposed.err, "--allow-host");
    const stray = await l.run(["serve", "--allow-host", "example.org", "docs:/"]);
    assertEquals(stray.code, 2, stray.err);
  }),
);

proves(["0006-anyfs-cli-serve FR-004"], "--dry-run says what it would serve and listens on nothing, and the verb is not a tool of the tool server", () =>
  withLab(async (l) => {
    const dry = await l.run(["serve", "--dry-run", "docs:/"]);
    assertEquals(dry.code, 0, dry.err);
    assertStringIncludes(dry.out, "would serve");
    const { VERBS } = await import("../src/governance/mod.ts");
    assertEquals([...VERBS["serve"].channels], ["local"]);
  }),
);
