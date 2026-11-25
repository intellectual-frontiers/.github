/**
 * Tests of Netboot (commons netboot 0002-netboot-pins, 0003-netboot-logical, 0004-netboot-physical): the pinned files, the GRUB menus, the arming of a host, the blank-disk guard's decision, the packets of TFTP and the classification of a request (all pure), and, with real
 * sockets on the loopback, the pinned fetch (a file that does not match its pin is not kept), an HTTP server that writes canonical header names, keeps the connection and serves a range, a TFTP server read by a client written here (options, a refused path, a refused write, block numbers that
 * roll over), and the whole server: a host armed, its menu, its install data under the token with the secrets put in as it is served, the guard's answers, the progress, and `done`, which disarms the host. Every name is made up.
 *
 * @module
 */
import { createHash } from "node:crypto";
import dgram from "node:dgram";
import net from "node:net";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { BASE_PLACEHOLDER, PASSWORD_PLACEHOLDER, UBUNTU_26_04, UBUNTU_26_04_PROFILE, DEBIAN_13_PROFILE, ROCKY_9_PROFILE, PROFILES, profileById, type BootPins, type BootProfile } from "../src/governance/mod.ts";
import { agreedOptions, arm, armedHosts, chooserMenu, classify, decide, describeFacts, disarm, done, emptyState, hostMenu, isArmed, mainMenu, newToken, note, parseFacts, parseRequest, servedPath, tokenFits } from "../src/logical/mod.ts";
import { assetStatus, bootHandler, ensureAssets, httpServer, parseRange, readState, sha256File, startBoot, tftpServer, updateState, type BootProvider } from "../src/physical/mod.ts";

const sha = (b: string | Uint8Array): string => createHash("sha256").update(b).digest("hex");

proves(["0002-netboot-pins FR-001", "0002-netboot-pins FR-002"], "the pins name each boot file and the image by a SHA-256 of 64 hexadecimal digits, and the placeholders are the ones a render may hold", () => {
  assertEquals(Object.keys(UBUNTU_26_04.files), ["bootx64.efi", "grubx64.efi", "linux", "initrd"]);
  for (const v of [...Object.values(UBUNTU_26_04.files), UBUNTU_26_04.iso?.sha256 ?? ""]) assert(/^[0-9a-f]{64}$/.test(v), v);
  assert((UBUNTU_26_04.iso?.url ?? "").startsWith("https://") && UBUNTU_26_04.netboot.startsWith("https://"));
  assertEquals([BASE_PLACEHOLDER, PASSWORD_PLACEHOLDER], ["@archon:base@", "@archon:password-hash@"]);
});

proves(["0003-netboot-logical FR-001"], "the menus boot the local disk for a host that is not armed and for a machine nobody knows, and install only an armed host, by its token and the MAC GRUB reports", () => {
  const base = "http://192.0.2.10:8080/";
  assert(mainMenu().includes("configfile /boot/hosts/${net_default_mac}.cfg"));
  const off = hostMenu({ name: "synthetic-server-02" }, UBUNTU_26_04_PROFILE, base, undefined);
  assert(off.includes("not armed") && !off.includes("autoinstall"));
  const on = hostMenu({ name: "synthetic-server-02" }, UBUNTU_26_04_PROFILE, base, "t".repeat(32));
  assert(on.includes("autoinstall") && on.includes(`iso-url=${base}iso/${UBUNTU_26_04.iso?.name}`) && on.includes("ds=nocloud-net\\;s=http://192.0.2.10:8080/install/synthetic-server-02/" + "t".repeat(32) + "/${net_default_mac}/"), on);
  assert(on.includes("erases this machine's disk") && on.includes("boot the local disk instead"));
  assert(chooserMenu([], UBUNTU_26_04_PROFILE, base).includes("nothing armed: boot the local disk"));
  const pick = chooserMenu([{ host: { name: "synthetic-server-02" }, token: "a".repeat(32) }], UBUNTU_26_04_PROFILE, base);
  assert(pick.startsWith("# Unknown machine") && pick.indexOf("boot the local disk") < pick.indexOf("Install synthetic-server-02") && pick.includes("set default=0"), "the disk is the first entry and the default");
});

proves(["0003-netboot-logical FR-002"], "a host is armed with a token and stays armed until the installer is done, a token is compared whole, and what installed is remembered by MAC", () => {
  let s = emptyState();
  const t = newToken();
  assert(/^[0-9a-f]{32}$/.test(t) && t !== newToken());
  s = arm(s, "synthetic-server-02", { token: t, at: "2026-11-21T00:00:00Z" });
  assert(isArmed(s, "synthetic-server-02") && !isArmed(s, "synthetic-server-03"));
  assert(tokenFits(s, "synthetic-server-02", t) && !tokenFits(s, "synthetic-server-02", `${t.slice(0, 31)}${t.endsWith("0") ? "1" : "0"}`) && !tokenFits(s, "synthetic-server-02", t.slice(0, 31)) && !tokenFits(s, "synthetic-server-03", t));
  assert(!tokenFits(arm(s, "short", { token: "abc", at: "x" }), "short", "abc"), "a short token is no token");
  assertEquals(armedHosts(arm(s, "baker", { token: "b".repeat(32), at: "x" })).map((a) => a.host.name), ["baker", "synthetic-server-02"]);
  s = done(s, "synthetic-server-02", "aa:bb:cc:dd:ee:ff", "2026-11-21T01:00:00Z");
  assertEquals([isArmed(s, "synthetic-server-02"), s.installed["synthetic-server-02"]?.mac], [false, "aa:bb:cc:dd:ee:ff"]);
  assertEquals(isArmed(disarm(arm(emptyState(), "x", { token: t, at: "x" }), "x"), "x"), false);
  let n = emptyState();
  for (let i = 0; i < 250; i++) n = note(n, { at: String(i), host: "h", level: "info", phase: "p", summary: String(i) });
  assertEquals([n.progress.length, n.progress[0]?.summary], [200, "50"]);
});

proves(["0003-netboot-logical FR-003"], "the guard goes on for blank disks, for a confirmed erase and for a host that installed from this MAC, and stops, with the way on, for anything else", () => {
  const blank = parseFacts("sys_vendor=To Be Filled By O.E.M.\nproduct_name=Test Box\nmem_kib=8388608\ncpus=4\ndisk=sda 500107862016 sata\n");
  assertEquals([blank.vendor, blank.model, blank.disks, blank.signatures], [undefined, "Test Box", [{ name: "sda", bytes: 500107862016, transport: "sata" }], []]);
  assert(describeFacts(blank).includes("Test Box") && describeFacts(blank).includes("sda 500 GB sata"));
  assertEquals(decide("synthetic-server-02", blank, {}, undefined).go, true);
  const used = parseFacts("disk=sda 500107862016 sata\nsignature=/dev/sda gpt\nsignature=/dev/sda2 ext4\n");
  const stopped = decide("synthetic-server-02", used, {}, "aa:bb:cc:dd:ee:ff");
  assert(!stopped.go && stopped.why.includes("not blank") && stopped.fix.includes("confirm-destroy"));
  assertEquals(decide("synthetic-server-02", used, { confirmDestroy: true }, undefined).go, true);
  assertEquals(decide("synthetic-server-02", used, { installedMac: "AA:BB:CC:DD:EE:FF" }, "aa:bb:cc:dd:ee:ff").go, true);
  assertEquals(decide("synthetic-server-02", used, { installedMac: "aa:bb:cc:dd:ee:00" }, "aa:bb:cc:dd:ee:ff").go, false);
  assertEquals(decide("synthetic-server-02", parseFacts("cpus=2\n"), { confirmDestroy: true }, undefined).go, false, "no disk, no install, whatever was confirmed");
});

proves(["0003-netboot-logical FR-004"], "a read request is parsed with its options, the options agreed are within bounds, and a path that climbs out of the tree is refused", () => {
  const req = new TextEncoder().encode(["\x00\x01/grubx64.efi", "OCTET", "blksize", "1468", "tsize", "0", ""].join("\x00"));
  const p = parseRequest(req);
  assertEquals([p.op, p.request?.file, p.request?.mode, p.request?.options], [1, "/grubx64.efi", "octet", { blksize: "1468", tsize: "0" }]);
  assertEquals(parseRequest(new Uint8Array([0, 2, 0x61, 0, 0x6f, 0x63, 0x74, 0])).op, 2);
  assertEquals(agreedOptions({ blksize: "65000", tsize: "0", timeout: "3" }, 99, 1468), { blksize: 1468, timeoutMs: 3000, oack: { blksize: "1468", tsize: "99", timeout: "3" } });
  assertEquals(agreedOptions({ blksize: "4" }, 1).oack, {}, "a block size below 8 is not agreed");
  assertEquals(agreedOptions({}, 10), { blksize: 512, timeoutMs: 1000, oack: {} });
  assertEquals([servedPath("grub/../linux"), servedPath("../etc/passwd"), servedPath("/boot//./linux"), servedPath("a\0b"), servedPath("a\\b")], [undefined, undefined, "/boot/linux", undefined, undefined]);
});

proves(["0003-netboot-logical FR-005"], "a path is a boot file, a menu, the image or an install file, and nothing else", () => {
  assertEquals(classify("/linux"), { kind: "boot-file", name: "linux" });
  assertEquals(classify("/boot/initrd"), { kind: "boot-file", name: "initrd" });
  assertEquals(classify("/grub/grub.cfg"), { kind: "main-menu" });
  assertEquals(classify("/boot/hosts/AA-BB-CC-DD-EE-FF.cfg"), { kind: "mac-menu", mac: "aa:bb:cc:dd:ee:ff" });
  assertEquals(classify("/boot/synthetic-server-02/bootx64.efi"), { kind: "host-boot-file", host: "synthetic-server-02", name: "bootx64.efi" });
  assertEquals(classify("/iso/x.iso"), { kind: "iso", name: "x.iso" });
  const tok = "ab".repeat(16);
  assertEquals(classify(`/install/synthetic-server-02/${tok}/aa:bb:cc:dd:ee:ff/user-data`), { kind: "install", host: "synthetic-server-02", token: tok, mac: "aa:bb:cc:dd:ee:ff", file: "user-data" });
  for (const bad of ["/install/synthetic-server-02/short/aa:bb:cc:dd:ee:ff/user-data", `/install/synthetic-server-02/${tok}/nonsense/user-data`, `/install/synthetic-server-02/${tok}/aa:bb:cc:dd:ee:ff/passwd`, "/etc/passwd", "/boot/hosts/zz.cfg", "/boot/../linux", "/iso/a/b"]) assertEquals(classify(bad).kind, "unknown", bad);
});

async function scratch<T>(f: (dir: string) => Promise<T>): Promise<T> {
  return fs.withTempDir(f);
}

proves(["0004-netboot-physical FR-001"], "the state is kept in a file that a second writer never sees half of, and one change at a time", async () => {
  await scratch(async (dir) => {
    const file = path.join(dir, "s", "state.json");
    assertEquals((await readState(file)).armed, {});
    await Promise.all(Array.from({ length: 20 }, (_, i) => updateState(file, (s) => ({ state: arm(s, `h${i}`, { token: "t".repeat(32), at: "x" }), value: 0 }))));
    assertEquals(Object.keys((await readState(file)).armed).length, 20, "no change was lost");
    assertEquals(((await fs.stat(file)).mode ?? 0) & 0o077, 0, "kept for its owner alone");
    await fs.writeTextFile(file, "not json");
    assertEquals((await readState(file)).armed, {});
  });
});

proves(["0004-netboot-physical FR-002"], "a file is fetched once and kept, and one that does not match its pin is not kept and nothing is served from it", async () => {
  await scratch(async (dir) => {
    const bodies: Record<string, string> = { "bootx64.efi": "shim bytes", "linux": "kernel bytes", "initrd": "initrd bytes", "grubx64.efi": "grub bytes", "x.iso": "image bytes" };
    const pins: BootPins = { release: "0", point: "0.1", netboot: "https://boot.example.test/", iso: { name: "x.iso", url: "https://iso.example.test/x.iso", sha256: sha(bodies["x.iso"] ?? "") }, files: Object.fromEntries(["bootx64.efi", "grubx64.efi", "linux", "initrd"].map((n) => [n, sha(bodies[n] ?? "")])) };
    const asked: string[] = [];
    const fetcher = async (url: string): Promise<Response> => {
      asked.push(url);
      return new Response(bodies[url.split("/").pop() ?? ""] ?? "", { status: bodies[url.split("/").pop() ?? ""] === undefined ? 404 : 200 });
    };
    const first = await ensureAssets(dir, pins, fetcher);
    assert(first.kind === "ok");
    assertEquals(asked.length, 5);
    assertEquals(await fs.readTextFile(first.value.files["linux"] ?? ""), "kernel bytes");
    assertEquals(await sha256File(first.value.iso ?? ""), pins.iso?.sha256);
    const again = await ensureAssets(dir, pins, fetcher);
    assert(again.kind === "ok");
    assertEquals(asked.length, 5, "nothing is fetched again");
    assertEquals((await assetStatus(dir, pins)).missing, []);
    await scratch(async (other) => {
      const bad = await ensureAssets(other, pins, async (u) => new Response(u.endsWith("linux") ? "tampered" : bodies[u.split("/").pop() ?? ""] ?? ""));
      assert(bad.kind === "err" && bad.error.includes("does not match the pin"), JSON.stringify(bad));
      assertEquals(await fs.exists(path.join(other, "linux")), false, "the tampered file is not kept");
      assertEquals(await fs.exists(path.join(other, "linux.partial")), false);
      assert((await assetStatus(other, pins)).missing.includes("linux"));
      const missing = await ensureAssets(other, pins, async () => new Response("", { status: 404 }));
      assert(missing.kind === "err" && missing.error.includes("HTTP 404"));
    });
  });
});

function rawHttp(port: number, request: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const s = net.connect(port, "127.0.0.1", () => s.write(request));
    let got = "";
    s.on("data", (d) => {
      got += d.toString("latin1");
      if (got.length > 1e6) s.end();
    });
    s.on("close", () => resolve(got));
    s.on("error", reject);
    setTimeout(() => s.destroy(), 3000);
  });
}

proves(["0004-netboot-physical FR-004"], "the HTTP server writes header names in canonical case, keeps the connection for HEAD and then GET, streams a file and gives a range", async () => {
  await scratch(async (dir) => {
    const file = path.join(dir, "big.bin");
    const bytes = new Uint8Array(100_000).map((_, i) => i % 251);
    await fs.writeFile(file, bytes);
    const server = await httpServer({ port: 0, hostname: "127.0.0.1", handle: async (r) => (r.path === "/big" ? { status: 200, headers: {}, body: { file, size: bytes.length } } : { status: 200, headers: { "Content-Type": "text/plain" }, body: `you asked for ${r.path}` }) });
    try {
      const two = await rawHttp(server.port, `HEAD /big HTTP/1.1\r\nHost: x\r\n\r\nGET /small HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
      assert(two.includes("Content-Length: 100000\r\n") && !two.includes("content-length"), two.slice(0, 300));
      assert(two.includes("Content-Length: 20\r\n") && two.endsWith("you asked for /small"), "the second request on the same connection was answered");
      const res = await fetch(`http://127.0.0.1:${server.port}/big`, { headers: { Range: "bytes=1000-1999" } });
      assertEquals([res.status, res.headers.get("content-range"), res.headers.get("content-length")], [206, "bytes 1000-1999/100000", "1000"]);
      assertEquals(new Uint8Array(await res.arrayBuffer()), bytes.subarray(1000, 2000));
      const all = await fetch(`http://127.0.0.1:${server.port}/big`);
      assertEquals((await all.arrayBuffer()).byteLength, 100000);
      assertEquals((await fetch(`http://127.0.0.1:${server.port}/big`, { headers: { Range: "bytes=999999-" } })).status, 416);
    } finally {
      await server.stop();
    }
    assertEquals([parseRange(undefined, 10), parseRange("bytes=2-4", 10), parseRange("bytes=-3", 10), parseRange("bytes=7-", 10), parseRange("bytes=0-99", 10), parseRange("bytes=10-", 10), parseRange("junk", 10)], ["none", { start: 2, end: 4 }, { start: 7, end: 9 }, { start: 7, end: 9 }, { start: 0, end: 9 }, "unsatisfiable", "none"]);
  });
});

/** A TFTP client: asks for a file and gives the bytes, or the error packet. */
function tftpGet(port: number, file: string, options: Record<string, string> = {}, mode = "octet"): Promise<{ readonly bytes?: Uint8Array; readonly error?: { code: number; message: string }; readonly oack?: Record<string, string> }> {
  return new Promise((resolve) => {
    const s = dgram.createSocket("udp4");
    const chunks: Uint8Array[] = [];
    let oack: Record<string, string> | undefined;
    let blksize = 512;
    let done = false;
    const finish = (r: { bytes?: Uint8Array; error?: { code: number; message: string } }): void => {
      if (done) return;
      done = true;
      setTimeout(() => s.close(), 100);
      resolve({ ...r, ...(oack === undefined ? {} : { oack }) });
    };
    const rrq = Buffer.concat([Buffer.from([0, 1]), Buffer.from(`${file}\0${mode}\0${Object.entries(options).map(([k, v]) => `${k}\0${v}\0`).join("")}`)]);
    s.on("error", () => finish({ error: { code: -1, message: "the server went away" } }));
    s.on("message", (m, r) => {
      if (done) return;
      const op = m.readUInt16BE(0);
      if (op === 6) {
        const parts = m.subarray(2).toString().split("\0");
        oack = {};
        for (let i = 0; i + 1 < parts.length; i += 2) oack[parts[i] ?? ""] = parts[i + 1] ?? "";
        if (oack["blksize"] !== undefined) blksize = Number(oack["blksize"]);
        s.send(Buffer.from([0, 4, 0, 0]), r.port, r.address);
      } else if (op === 3) {
        const data = new Uint8Array(m.subarray(4));
        chunks.push(data);
        s.send(Buffer.from([0, 4, m[2] ?? 0, m[3] ?? 0]), r.port, r.address);
        if (data.length < blksize) {
          const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
          let off = 0;
          for (const c of chunks) {
            out.set(c, off);
            off += c.length;
          }
          finish({ bytes: out });
        }
      } else if (op === 5) finish({ error: { code: m.readUInt16BE(2), message: m.subarray(4).toString().replace(/\0$/, "") } });
    });
    s.send(rrq, port, "127.0.0.1");
    setTimeout(() => finish({ error: { code: -1, message: "no answer" } }), 20000);
  });
}

proves(["0004-netboot-physical FR-003"], "the TFTP server gives a file with the options asked for, refuses a missing file, a path out of the tree, a write and a mode that is not octet, and rolls the block numbers over", async () => {
  const tree: Record<string, Uint8Array> = {
    "/small": new TextEncoder().encode("hello"),
    "/exact": new Uint8Array(1024).fill(7),
    "/medium": new Uint8Array(5000).map((_, i) => i % 256),
    "/rolled": new Uint8Array(8 * 65537 + 3).map((_, i) => (i * 7) % 256),
  };
  const events: string[] = [];
  const server = await tftpServer({ port: 0, hostname: "127.0.0.1", read: async (p) => tree[p], onTransfer: (e) => events.push(`${e.outcome} ${e.file}`) });
  try {
    assertEquals((await tftpGet(server.port, "small")).bytes, tree["/small"]);
    assertEquals((await tftpGet(server.port, "/exact", { blksize: "512" })).bytes, tree["/exact"], "a file that is a whole number of blocks ends with an empty block");
    const m = await tftpGet(server.port, "/medium", { blksize: "1024", tsize: "0" });
    assertEquals(m.bytes, tree["/medium"]);
    assertEquals(m.oack, { blksize: "1024", tsize: "5000" });
    assertEquals((await tftpGet(server.port, "/nothing")).error?.code, 1);
    assertEquals((await tftpGet(server.port, "../etc/passwd")).error?.code, 2);
    assertEquals((await tftpGet(server.port, "/small", {}, "netascii")).error?.code, 4);
    const w = await new Promise<number>((resolve) => {
      const s = dgram.createSocket("udp4");
      s.on("message", (msg) => {
        s.close();
        resolve(msg.readUInt16BE(2));
      });
      s.send(Buffer.concat([Buffer.from([0, 2]), Buffer.from("/small\0octet\0")]), server.port, "127.0.0.1");
    });
    assertEquals(w, 2, "a write is an access violation");
    const rolled = await tftpGet(server.port, "/rolled", { blksize: "8" });
    assert(rolled.bytes !== undefined && rolled.bytes.length === tree["/rolled"]?.length, `rolled over: ${rolled.bytes?.length} bytes`);
    assert(rolled.bytes?.every((b, i) => b === ((i * 7) % 256)), "every byte is where it was");
    await new Promise((r) => setTimeout(r, 300));
    assert(events.includes("sent /small") && events.includes("not-found /nothing") && events.filter((e) => e.startsWith("refused")).length >= 3, events.join(", "));
  } finally {
    await server.stop();
  }
});

proves(["0004-netboot-physical FR-003"], "stopping the TFTP server while a transfer is going ends the transfer without an error", async () => {
  const big = new Uint8Array(8 * 5000);
  const events: string[] = [];
  const server = await tftpServer({ port: 0, hostname: "127.0.0.1", read: async () => big, onTransfer: (e) => events.push(e.outcome) });
  const got = tftpGet(server.port, "/big", { blksize: "8" });
  await new Promise((r) => setTimeout(r, 20));
  await server.stop();
  await new Promise((r) => setTimeout(r, 2500));
  assertEquals(events.includes("timed-out"), false, "a transfer cut by stop is not a time-out");
  assertEquals((await got).bytes, undefined);
});

const SPEC_BASE = BASE_PLACEHOLDER;
const USER_DATA = `#cloud-config\n{"base":"${SPEC_BASE}","hash":"${PASSWORD_PLACEHOLDER}"}\n`;

async function withBoot<T>(f: (c: { dir: string; stateFile: string; url: string; http: (path: string, init?: RequestInit) => Promise<Response>; events: string[]; tftp: number }) => Promise<T>, provider: Partial<BootProvider> = {}, use: BootProfile = UBUNTU_26_04_PROFILE): Promise<T> {
  return scratch(async (dir) => {
    const stateFile = path.join(dir, "state.json");
    const files: Record<string, string> = {};
    const bodies: Record<string, string> = { "bootx64.efi": "shim", "grubx64.efi": "grub", linux: "kernel", initrd: "initrd" };
    for (const [n, body] of Object.keys(use.pins.files).map((k) => [k, bodies[k] ?? k] as const)) {
      files[n] = path.join(dir, n);
      await fs.writeTextFile(files[n] ?? "", body);
    }
    const iso = path.join(dir, "x.iso");
    await fs.writeTextFile(iso, "image");
    const pins: BootPins = use.pins.iso === undefined ? use.pins : { ...use.pins, iso: { name: "x.iso", url: "https://iso.example.test/x.iso", sha256: sha("image") } };
    const profile: BootProfile = { ...use, pins };
    const events: string[] = [];
    const server = await startBoot({
      stateFile, assets: pins.iso === undefined ? { files } : { files, iso }, profile, http: { port: 0, hostname: "127.0.0.1" }, tftp: { port: 0, hostname: "127.0.0.1" }, emit: (e) => events.push(`${e.kind}: ${e.detail}`),
      provider: { hosts: async () => [{ name: "synthetic-server-02", mac: "aa:bb:cc:dd:ee:ff" }, { name: "synthetic-server-03" }], userData: async () => USER_DATA, metaData: async (h) => `instance-id: ${h}\n`, passwordHash: async () => "$6$made$up", ...provider },
    });
    try {
      const url = `http://127.0.0.1:${server.httpPort}/`;
      return await f({ dir, stateFile, url, http: (p, init) => fetch(`${url}${p.replace(/^\//, "")}`, init), events, tftp: server.tftpPort });
    } finally {
      await server.stop();
    }
  });
}

proves(["0004-netboot-physical FR-005"], "a host that is not armed boots its own disk and its install data is refused; armed, its menu installs under its token and the install data has the secrets put in as it is served", async () => {
  await withBoot(async (c) => {
    const unarmed = await (await c.http("/boot/hosts/aa:bb:cc:dd:ee:ff.cfg")).text();
    assert(unarmed.includes("not armed") && !unarmed.includes("autoinstall"));
    const token = newToken();
    assertEquals((await c.http(`/install/synthetic-server-02/${token}/aa:bb:cc:dd:ee:ff/user-data`)).status, 403, "not armed: nothing is served");
    await updateState(c.stateFile, (s) => ({ state: arm(s, "synthetic-server-02", { token, at: "2026-11-21T00:00:00Z" }), value: 0 }));
    const menu = await (await c.http("/boot/hosts/aa:bb:cc:dd:ee:ff.cfg")).text();
    assert(menu.includes("autoinstall") && menu.includes(`/install/synthetic-server-02/${token}/`), menu);
    const stranger = await (await c.http("/boot/hosts/11:22:33:44:55:66.cfg")).text();
    assert(stranger.includes("Unknown machine") && stranger.includes("Install synthetic-server-02"), "an unknown machine is offered the armed host, with its own disk first");
    assertEquals((await c.http(`/install/synthetic-server-02/${"0".repeat(32)}/aa:bb:cc:dd:ee:ff/user-data`)).status, 403, "a token that is not the one");
    assertEquals((await c.http(`/install/synthetic-server-03/${token}/aa:bb:cc:dd:ee:ff/user-data`)).status, 403, "a token is for one host");
    const ud = await c.http(`/install/synthetic-server-02/${token}/aa:bb:cc:dd:ee:ff/user-data`);
    assertEquals(ud.status, 200);
    const served = (await ud.text()).split("\n")[1] ?? "";
    assertEquals(JSON.parse(served), { base: `${c.url}install/synthetic-server-02/${token}/aa:bb:cc:dd:ee:ff/`, hash: "$6$made$up" });
    assertEquals(await (await c.http(`/install/synthetic-server-02/${token}/aa:bb:cc:dd:ee:ff/meta-data`)).text(), "instance-id: synthetic-server-02\n");
    assert((await (await c.http(`/install/synthetic-server-02/${token}/aa:bb:cc:dd:ee:ff/guard.sh`)).text()).includes("poweroff -f"));
    assertEquals(await (await c.http("/linux")).text(), "kernel");
    assertEquals(await (await c.http("/iso/x.iso")).text(), "image");
    assertEquals((await c.http("/iso/other.iso")).status, 404);
    assertEquals(new TextDecoder().decode((await tftpGet(c.tftp, "/boot/linux")).bytes), "kernel", "PXE and HTTP boot get the same files");
    assert(new TextDecoder().decode((await tftpGet(c.tftp, "/grub/grub.cfg")).bytes).includes("configfile"));
    assert(c.events.some((e) => e.startsWith("install: serving the install data of synthetic-server-02")));
  });
});

proves(["0004-netboot-physical FR-005"], "no install data is served where the boot machine has no password hash, and the hash is never in what is kept", async () => {
  await withBoot(async (c) => {
    const token = newToken();
    await updateState(c.stateFile, (s) => ({ state: arm(s, "synthetic-server-02", { token, at: "x" }), value: 0 }));
    const r = await c.http(`/install/synthetic-server-02/${token}/aa:bb:cc:dd:ee:ff/user-data`);
    assertEquals(r.status, 500);
    assert(!(await r.text()).includes("$6$"));
    assert(!(await fs.readTextFile(c.stateFile)).includes("$6$"), "the state holds no secret");
  }, { passwordHash: async () => undefined });
});

proves(["0004-netboot-physical FR-006"], "the guard stops a machine that holds data, lets a blank one and a confirmed one go on, notes progress, and done disarms the host and remembers its MAC", async () => {
  await withBoot(async (c) => {
    const token = newToken();
    const at = `install/synthetic-server-02/${token}/aa:bb:cc:dd:ee:ff`;
    await updateState(c.stateFile, (s) => ({ state: arm(s, "synthetic-server-02", { token, at: "x" }), value: 0 }));
    const post = (what: string, body: string) => c.http(`/${at}/${what}`, { method: "POST", body });
    const used = "disk=sda 500107862016 sata\nsignature=/dev/sda gpt\n";
    const stop = await (await post("facts", used)).text();
    assert(stop.startsWith("stop: ") && stop.includes("not blank") && stop.includes("confirm-destroy"), stop);
    assert((await (await post("facts", "disk=sda 500107862016 sata\n")).text()).startsWith("ok: every disk is blank"));
    assert((await (await post("facts", "cpus=1\n")).text()).startsWith("stop: the installer sees no disk"));
    await updateState(c.stateFile, (s) => ({ state: arm(s, "synthetic-server-02", { token, at: "x", confirmDestroy: true }), value: 0 }));
    assert((await (await post("facts", used)).text()).startsWith("ok: erasing as confirmed"));
    assertEquals((await post("event", JSON.stringify({ phase: "Install", level: "info", summary: "partitioning" }))).status, 200);
    assertEquals((await post("done", "")).status, 200);
    const s = await readState(c.stateFile);
    assertEquals([isArmed(s, "synthetic-server-02"), s.installed["synthetic-server-02"]?.mac], [false, "aa:bb:cc:dd:ee:ff"]);
    assert(s.progress.some((p) => p.summary === "partitioning") && s.progress.some((p) => p.phase === "Guard" && p.level === "fail") && s.progress.at(-1)?.summary === "the installer is done");
    assertEquals((await c.http(`/${at}/user-data`)).status, 403, "after done nothing is served");
    assert((await (await c.http("/boot/hosts/aa:bb:cc:dd:ee:ff.cfg")).text()).includes("not armed"), "its next network boot does not reinstall it");
    // it may come back: the same MAC is allowed to be reinstalled over its own disk, once armed again
    const t2 = newToken();
    await updateState(c.stateFile, (st) => ({ state: arm(st, "synthetic-server-02", { token: t2, at: "y" }), value: 0 }));
    assert((await (await c.http(`/install/synthetic-server-02/${t2}/aa:bb:cc:dd:ee:ff/facts`, { method: "POST", body: used })).text()).startsWith("ok: this machine installed as synthetic-server-02 before"));
    assert((await (await c.http(`/install/synthetic-server-02/${t2}/11:22:33:44:55:66/facts`, { method: "POST", body: used })).text()).startsWith("stop: "), "another machine's disks are not erased");
  });
});

proves(["0004-netboot-physical FR-005"], "the handler refuses a method it does not serve", async () => {
  await withBoot(async (c) => {
    assertEquals((await c.http("/linux", { method: "DELETE" })).status, 405);
    assertEquals((await c.http("/etc/passwd")).status, 404);
    void bootHandler;
  });
});

proves(["0005-netboot-profiles FR-001", "0005-netboot-profiles FR-002", "0005-netboot-profiles FR-005", "0005-netboot-profiles FR-006"], "every profile pins its boot files by SHA-256, names a kernel and a ramdisk it holds and an install document, and a profile is found by its id", () => {
  assertEquals(PROFILES.map((p) => p.id), ["ubuntu-26.04", "debian-13", "rocky-9"]);
  for (const p of PROFILES) {
    assert(Object.keys(p.pins.files).includes(p.kernel) && Object.keys(p.pins.files).includes(p.initrd), p.id);
    for (const v of Object.values(p.pins.files)) assert(/^[0-9a-f]{64}$/.test(v), `${p.id} ${v}`);
    assertEquals(profileById(p.id), p);
  }
  assertEquals(profileById("nope"), undefined);
  assertEquals(DEBIAN_13_PROFILE.pins.iso, undefined, "the Debian installer fetches from a mirror: no image");
  assertEquals([UBUNTU_26_04_PROFILE.guard, DEBIAN_13_PROFILE.guard, ROCKY_9_PROFILE.guard], [true, false, false]);
  for (const [name] of Object.entries(ROCKY_9_PROFILE.pins.paths ?? {})) assert(name in ROCKY_9_PROFILE.pins.files, name);
});

proves(["0005-netboot-profiles FR-003"], "a Debian host's menu boots its own kernel and ramdisk with the URL of its preseed, escapes nothing that GRUB would split, and Ubuntu's keeps the escaped semicolon", () => {
  const base = "http://192.0.2.10:8080/";
  const token = "d".repeat(32);
  const deb = hostMenu({ name: "synthetic-server-05" }, DEBIAN_13_PROFILE, base, token);
  assert(deb.includes("linux /boot/linux auto=true priority=critical") && deb.includes(`url=${base}install/synthetic-server-05/${token}/${"$"}{net_default_mac}/preseed.cfg`) && deb.includes("initrd /boot/initrd.gz") && !deb.includes("iso-url") && deb.includes("Debian 13.8"), deb);
  const ubu = hostMenu({ name: "synthetic-server-02" }, UBUNTU_26_04_PROFILE, base, token);
  assert(ubu.includes("autoinstall ds=nocloud-net\\;s="), "GRUB would end the command at a bare semicolon");
  assert(!ubu.includes("ip=dhcp ip=dhcp"));
});

proves(["0005-netboot-profiles FR-004"], "a server of the Debian profile serves the preseed as the install document under the token, refuses the user-data Ubuntu reads, and serves no image", async () => {
  await withBoot(async (c) => {
    const token = newToken();
    await updateState(c.stateFile, (s) => ({ state: arm(s, "synthetic-server-02", { token, at: "2026-11-21T00:00:00Z" }), value: 0 }));
    const ud = await c.http(`/install/synthetic-server-02/${token}/aa:bb:cc:dd:ee:ff/user-data`);
    assertEquals(ud.status, 200, "the default profile of the harness is Ubuntu's");
  });
  await withBoot(async (c) => {
    const token = newToken();
    await updateState(c.stateFile, (s) => ({ state: arm(s, "synthetic-server-02", { token, at: "2026-11-21T00:00:00Z" }), value: 0 }));
    const pre = await c.http(`/install/synthetic-server-02/${token}/aa:bb:cc:dd:ee:ff/preseed.cfg`);
    assertEquals(pre.status, 200);
    assert(pre.headers.get("content-type")?.startsWith("text/plain"));
    assertEquals((await c.http(`/install/synthetic-server-02/${token}/aa:bb:cc:dd:ee:ff/user-data`)).status, 404, "a Debian install does not read a user-data");
    assertEquals((await c.http(`/iso/x.iso`)).status, 404);
  }, {}, DEBIAN_13_PROFILE);
});

proves(["0005-netboot-profiles FR-003"], "a Rocky host's menu boots its kernel with the URL of its Kickstart and the repository, and a file of a two-folder tree is fetched from its own path", async () => {
  const base = "http://192.0.2.10:8080/";
  const token = "r".repeat(32);
  const menu = hostMenu({ name: "synthetic-server-04" }, ROCKY_9_PROFILE, base, token);
  assert(menu.includes("linux /boot/vmlinuz ip=dhcp inst.repo=https://download.rockylinux.org/") && menu.includes(`inst.ks=${base}install/synthetic-server-04/${token}/${"$"}{net_default_mac}/ks.cfg`) && menu.includes("initrd /boot/initrd.img") && menu.includes("Rocky Linux 9.9"), menu);
  const asked: string[] = [];
  const bodies: Record<string, string> = Object.fromEntries(Object.keys(ROCKY_9_PROFILE.pins.files).map((n) => [n, `body of ${n}`]));
  const pins: BootPins = { ...ROCKY_9_PROFILE.pins, files: Object.fromEntries(Object.entries(bodies).map(([n, b]) => [n, sha(b)])) };
  await scratch(async (dir) => {
    const r = await ensureAssets(dir, pins, async (u) => {
      asked.push(u);
      const name = Object.entries(pins.paths ?? {}).find(([, p]) => u.endsWith(p))?.[0] ?? "";
      return new Response(bodies[name] ?? "", { status: bodies[name] === undefined ? 404 : 200 });
    });
    assert(r.kind === "ok", JSON.stringify(r));
  });
  assert(asked.includes("https://download.rockylinux.org/pub/rocky/9/BaseOS/x86_64/os/EFI/BOOT/BOOTX64.EFI") && asked.includes("https://download.rockylinux.org/pub/rocky/9/BaseOS/x86_64/os/images/pxeboot/vmlinuz"), asked.join(" "));
});
