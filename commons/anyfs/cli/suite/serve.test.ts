/**
 * Tests of the verb that serves a store (commons anyfs-cli 0006-anyfs-cli-serve FR-001 to FR-004): a real server on the loopback, asked with real HTTP, over a real folder.
 *
 * @module
 */
import process from "node:process";
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
  for (let i = 0; i < 200 && !/stop with/u.test(err); i++) {
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

/** One call of the mount protocol (MNT of `/`) over TCP, written out by hand from RFC 5531 and RFC 1813: the status it answers with. */
async function mountStatus(port: number, uid: number): Promise<number> {
  const { connect } = await import("node:net");
  const u32 = (...n: number[]): number[] => n.flatMap((x) => [(x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255]);
  const machine = [...new TextEncoder().encode("test")];
  const cred = [...u32(0), ...u32(machine.length), ...machine, ...u32(uid, uid, 0)];
  const args = [...u32(1), 47, 0, 0, 0];
  const call = [...u32(9, 0, 2, 100005, 3, 1, 1, cred.length), ...cred, ...u32(0, 0), ...args];
  const framed = Uint8Array.from([...u32((0x80000000 | call.length) >>> 0), ...call]);
  return await new Promise<number>((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () => socket.write(framed));
    socket.on("data", (d: Buffer) => {
      resolve(d.readUInt32BE(4 + 24));
      socket.destroy();
    });
    socket.on("error", reject);
  });
}

/** MNT of `/` then SETATTR of the mode of the root, over TCP and written out by hand from RFC 1813: the status SETATTR answers with (0 accepted, 10004 not supported). */
async function setModeStatus(port: number, uid: number): Promise<number> {
  const { connect } = await import("node:net");
  const u32 = (...n: number[]): number[] => n.flatMap((x) => [(x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255]);
  const machine = [...new TextEncoder().encode("test")];
  const cred = [...u32(0), ...u32(machine.length), ...machine, ...u32(uid, uid, 0)];
  const socket = await new Promise<import("node:net").Socket>((resolve, reject) => {
    const x = connect(port, "127.0.0.1", () => resolve(x));
    x.on("error", reject);
  });
  const call = (xid: number, program: number, proc: number, args: number[]): Promise<Uint8Array> =>
    new Promise((resolve) => {
      const body = [...u32(xid, 0, 2, program, 3, proc, 1, cred.length), ...cred, ...u32(0, 0), ...args];
      const framed = Uint8Array.from([...u32((0x80000000 | body.length) >>> 0), ...body]);
      let got = Buffer.alloc(0);
      const on = (d: Buffer): void => {
        got = Buffer.concat([got, d]);
        if (got.length >= 4 && got.length >= 4 + (got.readUInt32BE(0) & 0x7fffffff)) {
          socket.off("data", on);
          resolve(new Uint8Array(got.subarray(4)));
        }
      };
      socket.on("data", on);
      socket.write(framed);
    });
  try {
    const path = [...new TextEncoder().encode("/")];
    const mnt = await call(1, 100005, 1, [...u32(path.length), ...path, 0, 0, 0]);
    const view = new DataView(mnt.buffer, mnt.byteOffset, mnt.byteLength);
    if (view.getUint32(24) !== 0) return view.getUint32(24);
    const fhLength = view.getUint32(28);
    const fh = [...mnt.subarray(32, 32 + fhLength)];
    const pad = (4 - (fhLength % 4)) % 4;
    // SETATTR3: the handle, then sattr3 with a mode set to 0o600 and nothing else, then no guard
    const args = [...u32(fhLength), ...fh, ...Array(pad).fill(0), ...u32(1, 0o600, 0, 0, 0, 0, 0), ...u32(0)];
    const set = await call(2, 100003, 2, args);
    return new DataView(set.buffer, set.byteOffset, set.byteLength).getUint32(24);
  } finally {
    socket.destroy();
  }
}

proves(["0006-anyfs-cli-serve FR-005"], "serve --nfs accepts and counts a mode that a client sets by default, and refuses it where --nfs-attributes refuse says so, and says which applies", () =>
  withLab(async (l) => {
    const mine = process.getuid?.() ?? 0;
    const plain = await start(l, ["--nfs", "docs:/"]);
    try {
      assertStringIncludes(plain.stderr(), "accepted without effect and counted");
      const port = Number(/on 127\.0\.0\.1:(\d+)/u.exec(plain.stderr())?.[1]);
      assertEquals(await setModeStatus(port, mine), 0, "the default of the command line is ignore: SETATTR of a mode is accepted");
    } finally {
      assertEquals(await plain.stop(), 0, plain.stderr());
    }
    const strict = await start(l, ["--nfs", "--nfs-attributes", "refuse", "docs:/"]);
    try {
      assertStringIncludes(strict.stderr(), "refused");
      const port = Number(/on 127\.0\.0\.1:(\d+)/u.exec(strict.stderr())?.[1]);
      assertEquals(await setModeStatus(port, mine), 10004, "with refuse the same SETATTR is NFS3ERR_NOTSUPP");
    } finally {
      assertEquals(await strict.stop(), 0, strict.stderr());
    }
  }),
);

proves(["0006-anyfs-cli-serve FR-005"], "serve --nfs hosts the store as NFS on the loopback for the uid of the account and root, says the mount command on standard error, and refuses what does not fit", () =>
  withLab(async (l) => {
    const s = await start(l, ["--nfs", "docs:/"]);
    try {
      assertStringIncludes(s.stderr(), "NFS version 3");
      assertStringIncludes(s.stderr(), "mount: mount -t nfs -o vers=3,proto=tcp,port=");
      const port = Number(/on 127\.0\.0\.1:(\d+)/u.exec(s.stderr())?.[1]);
      assert(port > 0, s.stderr());
      const mine = process.getuid?.() ?? 0;
      assertEquals(await mountStatus(port, mine), 0);
      assertEquals(await mountStatus(port, 0), 0);
      if (mine !== 4242) assertEquals(await mountStatus(port, 4242), 13);
    } finally {
      assertEquals(await s.stop(), 0, s.stderr());
    }
    assertEquals((await l.run(["serve", "--nfs", "--listen", "0.0.0.0", "--allow-host", "x", "docs:/"])).code, 2);
    assertEquals((await l.run(["serve", "--nfs-attributes", "ignore", "docs:/"])).code, 2);
    assertEquals((await l.run(["serve", "--nfs", "--nfs-attributes", "maybe", "docs:/"])).code, 2);
    assertEquals((await l.run(["serve", "--nfs", "--dry-run", "docs:/"])).code, 0);
  }),
);
