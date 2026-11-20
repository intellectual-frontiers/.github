/**
 * Tests of the store (commons archon-dialect-native-pinned 0003-native-pinned-store FR-001 to FR-007): the short path of a tool, a rename retried as Windows needs, the switch that leaves the old
 * copy as it was where it fails, and, with a real local server and real files in a temporary folder, a verified download, an install under a lock, a second run that finds the first's copy
 * and fetches nothing, a wrong download that is kept nowhere, nothing written outside the store, and `clean`. Every name and byte is made up.
 *
 * @module
 */
import { createServer, type Server } from "node:http";
import { Retries } from "@intellectual-frontiers/net/net";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { gzip, tar } from "@intellectual-frontiers/formats/archive";
import * as fs from "@intellectual-frontiers/system/fs";
import * as path from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { INSTALL_RECORD, type InstallSpec } from "../src/install.ts";
import { cleanStore, installTool, readInstalled, renameRetrying, shimFolder, storeOf, switchInto, toolFolder, type FsOps, type Store } from "../src/store.ts";

const text = (s: string) => new TextEncoder().encode(s);
const ARCHIVE = (() => {
  const r = tar(new Map([["bin/jq", text("#!/bin/sh\necho jq\n")], ["share/doc.txt", text("made up\n")]]));
  if (r.kind === "err") throw new Error("tar");
  return gzip(r.value);
})();

const quiet = () => new Retries({ tries: 2, base: 0, cap: 0 }, () => undefined, () => 0, () => Promise.resolve());

/** Serves what it is given on a made-up path of a local port, and counts the requests. */
async function serve(body: Uint8Array): Promise<{ readonly url: string; readonly requests: () => number; readonly stop: () => Promise<void> }> {
  let count = 0;
  const server: Server = createServer((req, res) => {
    count++;
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": String(body.length) });
    res.end(body);
    void req;
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return { url: `http://127.0.0.1:${port}/jq-1.7.1.tar.gz`, requests: () => count, stop: () => new Promise<void>((ok) => server.close(() => ok())) };
}

async function spec(url: string, more: Partial<InstallSpec> = {}): Promise<InstallSpec> {
  return { tool: "jq", version: "1.7.1", platform: "linux-x64", os: "linux", program: "jq", downloadUrl: url, sha256: await sha256(ARCHIVE), archiveFormat: "tar", binPath: "bin", ...more };
}

async function withStore<T>(f: (store: Store, home: string) => Promise<T>): Promise<T> {
  return fs.withTempDir(async (home) => {
    const store = storeOf((n) => (n === "XDG_DATA_HOME" ? home : undefined), "linux");
    if (store === undefined) throw new Error("no store");
    return f(store, home);
  });
}

proves(["0003-native-pinned-store FR-001"], "a tool is at <store>/<name>/<version> with no platform in the path, in the user's data folder of archon", () => {
  const linux = storeOf((n) => (n === "XDG_DATA_HOME" ? "/home/a/data" : n === "HOME" ? "/home/a" : undefined), "linux");
  assert(linux !== undefined);
  assertEquals(toolFolder(linux, "bun", "1.4.4"), path.join("/home/a/data", "archon", "tools", "bun", "1.4.4"));
  const windows = storeOf((n) => (n === "LOCALAPPDATA" ? "C:\\Users\\a\\AppData\\Local" : n === "USERPROFILE" ? "C:\\Users\\a" : undefined), "windows");
  assert(windows !== undefined && windows.os === "windows");
  const there = toolFolder(windows, "bun", "1.4.4");
  assert(there.includes("archon") && /bun[\\/]1\.4\.4$/.test(there) && !there.includes("x64"), there);
  assert(there.length < 80, "the path stays short");
  assertEquals(storeOf(() => undefined, "linux"), undefined);
  assert(shimFolder(linux).endsWith("bin"));
});

proves(["0003-native-pinned-store FR-005"], "a rename refused as Windows refuses it is retried, and any other error ends it", async () => {
  const log: string[] = [];
  const refusing = (codes: readonly string[]): FsOps => {
    let n = 0;
    return {
      rename: async () => {
        const code = codes[n++];
        if (code !== undefined) throw Object.assign(new Error(`${code}: busy`), { code });
      },
      remove: async () => undefined,
      exists: async () => false,
      pause: async (ms) => void log.push(`pause ${ms}`),
    };
  };
  assertEquals((await renameRetrying(refusing(["EBUSY", "EPERM"]), "a", "b")).kind, "ok");
  assertEquals(log, ["pause 100", "pause 200"]);
  const other = await renameRetrying(refusing(["ENOENT"]), "a", "b");
  assert(other.kind === "err" && other.error.includes("ENOENT") && other.error.includes("1 try"));
  const always = await renameRetrying(refusing(Array(10).fill("EACCES")), "a", "b", 3);
  assert(always.kind === "err" && always.error.includes("3 tries"));
});

proves(["0003-native-pinned-store FR-005"], "the switch moves an old copy aside, removes it once the new one is in place, and where it fails puts the old copy back and removes the new", async () => {
  const world = (failOn: readonly string[]) => {
    const present = new Set(["/s/jq/1.7.1", "/s/.unpack-1"]);
    const ops: FsOps = {
      rename: async (from, to) => {
        if (failOn.includes(`${from}>${to}`)) throw Object.assign(new Error("EBUSY"), { code: "EBUSY" });
        present.delete(from);
        present.add(to);
      },
      remove: async (p) => void present.delete(p),
      exists: async (p) => present.has(p),
      pause: async () => undefined,
    };
    return { present, ops };
  };
  const good = world([]);
  assertEquals((await switchInto(good.ops, "/s/.unpack-1", "/s/jq/1.7.1", "/s/jq/1.7.1.old")).kind, "ok");
  assertEquals([...good.present], ["/s/jq/1.7.1"], "the new copy is in place and nothing is left over");
  const stuck = world(["/s/.unpack-1>/s/jq/1.7.1"]);
  const failed = await switchInto(stuck.ops, "/s/.unpack-1", "/s/jq/1.7.1", "/s/jq/1.7.1.old");
  assert(failed.kind === "err" && failed.error.includes("new copy"));
  assertEquals([...stuck.present], ["/s/jq/1.7.1"], "the old copy is back and the new one is removed");
  const aside = world(["/s/jq/1.7.1>/s/jq/1.7.1.old"]);
  const early = await switchInto(aside.ops, "/s/.unpack-1", "/s/jq/1.7.1", "/s/jq/1.7.1.old");
  assert(early.kind === "err" && early.error.includes("moved aside"));
  assertEquals([...aside.present], ["/s/jq/1.7.1"], "the old copy stays and the new one is removed");
});

proves(["0003-native-pinned-store FR-002", "0003-native-pinned-store FR-003", "0003-native-pinned-store FR-006"], "an install is a verified download into the store, with a record and a shim, and nothing is written outside the store", async () => {
  const server = await serve(ARCHIVE);
  try {
    await withStore(async (store, home) => {
      const done = await installTool(store, await spec(server.url), { retries: quiet() });
      assert(done.kind === "ok", done.kind === "err" ? JSON.stringify(done.error) : "");
      assert(done.value.fresh);
      assertEquals(done.value.folder, toolFolder(store, "jq", "1.7.1"));
      assertEquals(await fs.readTextFile(done.value.program), "#!/bin/sh\necho jq\n");
      assert(await fs.exists(path.join(done.value.folder, INSTALL_RECORD)));
      assert(await fs.exists(path.join(shimFolder(store), "jq")));
      assert(await fs.exists(path.join(store.root, ".cache", "downloads")), "the verified download is kept in the cache");
      assertEquals(await fs.listDirs(home), ["archon"], "nothing is written outside the store");
      assertEquals((await fs.listDirs(store.root)).filter((d) => d.startsWith(".unpack-")), [], "no temporary folder is left");
      if (store.os !== "windows") assert((((await fs.stat(done.value.program)).mode ?? 0) & 0o111) !== 0, "the program is executable");
      const read = await readInstalled(store, "jq", "1.7.1");
      assert(read !== undefined && read.record.artifactSha256 === (await sha256(ARCHIVE)));
    });
  } finally {
    await server.stop();
  }
});

proves(["0003-native-pinned-store FR-004"], "a second run finds the copy of the first and fetches nothing, and two runs at once install the tool once", async () => {
  const server = await serve(ARCHIVE);
  try {
    await withStore(async (store) => {
      const s = await spec(server.url);
      const both = await Promise.all([installTool(store, s, { retries: quiet(), unique: () => "a" }), installTool(store, s, { retries: quiet(), unique: () => "b" })]);
      assert(both.every((r) => r.kind === "ok"), JSON.stringify(both));
      assertEquals(both.filter((r) => r.kind === "ok" && r.value.fresh).length, 1, "one run installed it and the other found it");
      assertEquals(server.requests(), 1);
      const again = await installTool(store, s, { retries: quiet() });
      assert(again.kind === "ok" && !again.value.fresh);
      assertEquals(server.requests(), 1, "a copy that is as pinned costs no request");
    });
  } finally {
    await server.stop();
  }
});

proves(["0003-native-pinned-store FR-003"], "a download that is not the pinned one is kept nowhere, and the failure names the step and what to do", async () => {
  const server = await serve(text("not the pinned bytes at all"));
  try {
    await withStore(async (store) => {
      const done = await installTool(store, await spec(server.url), { retries: quiet() });
      assert(done.kind === "err" && done.error.step === "checksum" && done.error.tool === "jq");
      assert(done.error.next.includes("pin"));
      assertEquals(await fs.exists(toolFolder(store, "jq", "1.7.1")), false, "nothing is installed");
      const cached = (await fs.exists(path.join(store.root, ".cache", "downloads"))) ? await fs.listFiles(path.join(store.root, ".cache", "downloads")) : [];
      assertEquals(cached, [], "the wrong file is not kept");
      const gone = await installTool(store, await spec("http://127.0.0.1:1/never"), { retries: quiet() });
      assert(gone.kind === "err" && gone.error.step === "download");
    });
  } finally {
    await server.stop();
  }
});

proves(["0003-native-pinned-store FR-007"], "clean removes the cache and leftover unpacks with their sizes, and the programs only when asked", async () => {
  await withStore(async (store) => {
    await fs.mkdir(path.join(store.root, ".cache", "downloads"), { recursive: true });
    await fs.writeFile(path.join(store.root, ".cache", "downloads", "x"), text("12345"));
    await fs.mkdir(path.join(store.root, ".unpack-9"), { recursive: true });
    await fs.writeFile(path.join(store.root, ".unpack-9", "y"), text("123"));
    await fs.mkdir(toolFolder(store, "jq", "1.7.1"), { recursive: true });
    await fs.writeFile(path.join(toolFolder(store, "jq", "1.7.1"), "jq"), text("x"));
    const first = await cleanStore(store, { programs: false });
    assertEquals(first.map((c) => `${c.what}:${c.bytes}`).sort(), ["a leftover unpack:3", "the downloads kept:5"]);
    assert(await fs.exists(toolFolder(store, "jq", "1.7.1")), "the programs stay");
    const second = await cleanStore(store, { programs: true });
    assert(second.some((c) => c.what === "the programs of a tool"));
    assertEquals(await fs.exists(toolFolder(store, "jq", "1.7.1")), false);
    assertEquals(await cleanStore(store, { programs: true }), []);
  });
});
