/**
 * Tests of the download of RustFS (commons anyfs-s3 0003-anyfs-s3-tests FR-001): the pins are well formed, an archive that is not the pinned one is refused and not unpacked, one that is is unpacked below the cache
 * folder of the user, kept, used again without a download, and downloaded again where what was kept is not what was unpacked.
 *
 * @module
 */
import process from "node:process";
import { err, ok } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { zip } from "@intellectual-frontiers/formats/archive";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { PINS, pinOf, RUSTFS_VERSION, rustfsBinary, type Pin } from "../tools/rustfs.ts";

proves(["0003-anyfs-s3-tests FR-001"], "every pin names a TLS address of the publisher for the version, a SHA-256 and the file in the archive, and a platform with no pin has none", () => {
  for (const [platform, pin] of Object.entries(PINS)) {
    assert(pin.url.startsWith("https://dl.rustfs.com/artifacts/rustfs/release/"), platform);
    assertStringIncludes(pin.url, `v${RUSTFS_VERSION}`);
    assert(/^[0-9a-f]{64}$/u.test(pin.sha256), platform);
    assert(pin.entry === "rustfs" || pin.entry === "rustfs.exe", platform);
  }
  assertEquals(new Set(Object.values(PINS).map((p) => p.sha256)).size, Object.keys(PINS).length, "no two platforms share an archive");
  assertEquals(pinOf("linux", "x86_64") !== undefined, true);
  assertEquals(pinOf("plan9", "mips"), undefined);
});

async function withCache<T>(run: (cache: string) => Promise<T>): Promise<T> {
  const cache = await fs.makeTempDir({ prefix: "anyfs-s3-cache-" });
  const before = proc.env.get("XDG_CACHE_HOME");
  process.env["XDG_CACHE_HOME"] = cache;
  try {
    return await run(cache);
  } finally {
    if (before === undefined) delete process.env["XDG_CACHE_HOME"];
    else process.env["XDG_CACHE_HOME"] = before;
    await fs.remove(cache, { recursive: true }).catch(() => undefined);
  }
}

const archive = (entry: string, body: string): Uint8Array => zip(new Map([[entry, new TextEncoder().encode(body)]]));

proves(["0003-anyfs-s3-tests FR-001"], "an archive that is not the pinned one is refused with both digests and nothing of it is unpacked, and an archive that cannot be fetched or has no entry is said so", async () => {
  await withCache(async (cache) => {
    const good = archive("rustfs", "#!/bin/sh\nexit 0\n");
    const pin: Pin = { url: "https://example.test/rustfs.zip", sha256: await sha256(good), entry: "rustfs" };
    const wrong = await rustfsBinary(async () => ok(archive("rustfs", "#!/bin/sh\necho evil\n")), pin);
    assert(wrong.kind === "err");
    assertStringIncludes(wrong.error, "not to the pinned");
    assertStringIncludes(wrong.error, pin.sha256);
    assertEquals(await fs.exists(path.join(cache, "anyfs")), false, "nothing was unpacked or kept");
    assertEquals((await rustfsBinary(async () => err("https://example.test cannot be reached"), pin)).kind, "err");
    const noEntry = archive("other", "x");
    assertStringIncludes(JSON.stringify(await rustfsBinary(async () => ok(noEntry), { ...pin, sha256: await sha256(noEntry) })), "has no rustfs");
  });
});

proves(["0003-anyfs-s3-tests FR-001"], "the pinned archive is unpacked below the XDG cache folder, the program is executable, it is used again with no download, and a program that is not what was unpacked is replaced from a verified archive", async () => {
  await withCache(async (cache) => {
    const good = archive("rustfs", "#!/bin/sh\nexit 0\n");
    const pin: Pin = { url: "https://example.test/rustfs.zip", sha256: await sha256(good), entry: "rustfs" };
    let fetched = 0;
    const fetcher = async () => {
      fetched++;
      return ok(good);
    };
    const first = await rustfsBinary(fetcher, pin);
    assert(first.kind === "ok");
    assert(first.value.startsWith(path.join(cache, "anyfs")), first.value);
    assertEquals(proc.isExecutable(first.value), true);
    assertEquals(fetched, 1);
    assertEquals((await rustfsBinary(fetcher, pin)).kind, "ok");
    assertEquals(fetched, 1, "used again with no download");
    await fs.writeFile(first.value, new TextEncoder().encode("#!/bin/sh\necho tampered\n"), { mode: 0o755 });
    const again = await rustfsBinary(fetcher, pin);
    assert(again.kind === "ok");
    assertEquals(fetched, 2, "downloaded again where the program is not what was unpacked");
    assertEquals(new TextDecoder().decode(await fs.readFile(again.value)), "#!/bin/sh\nexit 0\n");
  });
});
