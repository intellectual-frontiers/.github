/**
 * Tests of the pin tool (commons archon-dialect-native-pinned 0005-native-pinned-pin FR-001 to FR-006), with a real local server that serves made-up archives and checksum files: a request is
 * refused unless every address is https, the hash is the one the tool takes, the publisher's line of the artifact is the one compared, a mismatch, a missing name and an artifact without its
 * program make the proposal not ready, one platform that cannot be fetched leaves the others, the text does not depend on the order of the platforms, and the program writes only the proposal.
 * Every name and byte is made up.
 *
 * @module
 */
import { createServer, type Server } from "node:http";
import { Retries } from "@intellectual-frontiers/net/net";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { gzip, tar, zip, type Files } from "@intellectual-frontiers/formats/archive";
import * as fs from "@intellectual-frontiers/system/fs";
import * as path from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { main } from "../src/bin.ts";
import { checksumFrom, fetchBytes, proposalText, proposePin, readPinRequest, type PinRequest } from "../src/pin.ts";

const text = (s: string) => new TextEncoder().encode(s);
const FILES: Files = new Map([["bin/jq", text("#!/bin/sh\necho jq\n")], ["share/doc.txt", text("made up\n")]]);
const TAR = (() => {
  const r = tar(FILES);
  if (r.kind === "err") throw new Error("tar");
  return gzip(r.value);
})();
const ZIP = zip(new Map([["bin/jq.exe", text("MZ made up")]]));
const NO_PROGRAM = (() => {
  const r = tar(new Map([["share/doc.txt", text("made up\n")]]));
  if (r.kind === "err") throw new Error("tar");
  return r.value;
})();

const quiet = () => new Retries({ tries: 1, base: 0, cap: 0 }, () => undefined, () => 0, () => Promise.resolve());

/** Serves the files it is given by path on a local port. */
async function serve(files: Readonly<Record<string, Uint8Array>>): Promise<{ readonly base: string; readonly stop: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const body = files[req.url ?? ""];
    if (body === undefined) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-length": String(body.length) });
    res.end(body);
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const a = server.address();
  const port = typeof a === "object" && a !== null ? a.port : 0;
  return { base: `http://127.0.0.1:${port}`, stop: () => new Promise<void>((ok) => server.close(() => ok())) };
}

const get = (retries = quiet()) => fetchBytes(retries);

proves(["0005-native-pinned-pin FR-001"], "a request is refused unless it is well formed and every address is https with no credentials", () => {
  const good = { name: "jq", version: "1.7.1", program: "jq", platforms: { "linux-x64": { downloadUrl: "https://example.test/jq.tar.gz", archiveFormat: "tar", binPath: "bin", checksum: { url: "https://example.test/sums", name: "jq.tar.gz" } } } };
  assertEquals(readPinRequest(JSON.stringify(good)).kind, "ok");
  const bad = (change: (g: typeof good) => unknown): string => {
    const r = readPinRequest(JSON.stringify(change(structuredClone(good))));
    return r.kind === "err" ? r.error : "ok";
  };
  assert(bad((g) => ({ ...g, platforms: { "linux-x64": { ...g.platforms["linux-x64"], downloadUrl: "http://example.test/jq" } } })).includes("platform linux-x64: the address is not an https address"));
  assert(bad((g) => ({ ...g, platforms: { "linux-x64": { ...g.platforms["linux-x64"], downloadUrl: "https://u:p@example.test/jq" } } })).includes("carries credentials"));
  assert(bad((g) => ({ ...g, platforms: { "linux-x64": { ...g.platforms["linux-x64"], checksum: { url: "http://example.test/sums" } } } })).includes("the address of the checksum"));
  assert(bad((g) => ({ ...g, platforms: { "linux-x64": { ...g.platforms["linux-x64"], archiveFormat: "rar" } } })).includes("zip, tar or file"));
  assert(bad((g) => ({ ...g, name: "Bad Name" })).includes("lower case"));
  assert(bad((g) => ({ ...g, platforms: {} })).includes("no platform"));
  assertEquals(readPinRequest("not json").kind, "err");
});

proves(["0005-native-pinned-pin FR-002", "0005-native-pinned-pin FR-003"], "the hash is taken by the tool, and the line of the artifact in a checksum file of many is the one compared", async () => {
  const sum = await sha256(TAR);
  const other = await sha256(text("another artifact"));
  const sums = `${other}  other-1.0.tar.gz\n${sum} *dist/jq-1.7.1.tar.gz\n`;
  const s = await serve({ "/jq-1.7.1.tar.gz": TAR, "/SHA256SUMS": text(sums) });
  try {
    const req: PinRequest = { name: "jq", version: "1.7.1", program: "jq", platforms: { "linux-x64": { downloadUrl: `${s.base}/jq-1.7.1.tar.gz`, archiveFormat: "tar", binPath: "bin", checksum: { url: `${s.base}/SHA256SUMS`, name: "jq-1.7.1.tar.gz" } } } };
    const p = await proposePin(req, get());
    const x = p.platforms[0];
    assert(x !== undefined && x.sha256 === sum && x.publisher === "verified" && x.publisherSays === sum && x.program === "found" && x.bytes === TAR.length, JSON.stringify(x));
    assert(p.ready);
    const one = checksumFrom(`${sum}\n`, undefined);
    assertEquals(one, sum);
    assertEquals(checksumFrom(`${sum}  a\n${other}  b\n`, undefined), undefined, "two lines and no name is no answer");
    assertEquals(checksumFrom(`${sum}  a\n`, "b"), undefined);
  } finally {
    await s.stop();
  }
});

proves(["0005-native-pinned-pin FR-003", "0005-native-pinned-pin FR-005"], "a mismatch, a file with no line for the artifact and no checksum named each make the proposal not ready, with the concern told", async () => {
  const sum = await sha256(TAR);
  const wrong = await sha256(text("something else"));
  const s = await serve({ "/a.tar.gz": TAR, "/wrong": text(`${wrong}  a.tar.gz\n`), "/missing": text(`${wrong}  zzz.tar.gz\n`) });
  try {
    const at = (checksum?: { url: string; name?: string }): PinRequest => ({ name: "jq", version: "1.7.1", program: "jq", platforms: { "linux-x64": { downloadUrl: `${s.base}/a.tar.gz`, archiveFormat: "tar", binPath: "bin", ...(checksum === undefined ? {} : { checksum }) } } });
    const mismatch = await proposePin(at({ url: `${s.base}/wrong`, name: "a.tar.gz" }), get());
    assert(!mismatch.ready && mismatch.platforms[0]?.publisher === "mismatch" && mismatch.platforms[0].concerns.join(" ").includes(wrong) && mismatch.platforms[0].concerns.join(" ").includes(sum));
    const unreadable = await proposePin(at({ url: `${s.base}/missing`, name: "a.tar.gz" }), get());
    assert(!unreadable.ready && unreadable.platforms[0]?.publisher === "unreadable");
    const gone = await proposePin(at({ url: `${s.base}/nowhere`, name: "a.tar.gz" }), get());
    assert(!gone.ready && gone.platforms[0]?.publisher === "unreadable" && gone.platforms[0].concerns.join(" ").includes("could not be fetched"));
    const absent = await proposePin(at(), get());
    assert(!absent.ready && absent.platforms[0]?.publisher === "absent" && absent.platforms[0].concerns.join(" ").includes("first one seen"));
    assertEquals(absent.platforms[0]?.sha256, sum, "the hash is still the one taken");
  } finally {
    await s.stop();
  }
});

proves(["0005-native-pinned-pin FR-004"], "an artifact without its program says why, and a platform that cannot be fetched leaves the others", async () => {
  const sumTar = await sha256(TAR);
  const sumBare = await sha256(NO_PROGRAM);
  const s = await serve({ "/ok.tar.gz": TAR, "/bare.tar": NO_PROGRAM, "/ok.sums": text(`${sumTar}  ok.tar.gz\n`), "/bare.sums": text(`${sumBare}  bare.tar\n`) });
  try {
    const req: PinRequest = {
      name: "jq",
      version: "1.7.1",
      program: "jq",
      platforms: {
        "macos-arm64": { downloadUrl: `${s.base}/bare.tar`, archiveFormat: "tar", binPath: "bin", checksum: { url: `${s.base}/bare.sums`, name: "bare.tar" } },
        "linux-x64": { downloadUrl: `${s.base}/ok.tar.gz`, archiveFormat: "tar", binPath: "bin", checksum: { url: `${s.base}/ok.sums`, name: "ok.tar.gz" } },
        "windows-x64": { downloadUrl: `${s.base}/gone.zip`, archiveFormat: "zip", binPath: "bin" },
      },
    };
    const p = await proposePin(req, get());
    assertEquals(p.platforms.map((x) => x.platform), ["linux-x64", "macos-arm64", "windows-x64"]);
    const [linux, macos, windows] = p.platforms;
    assert(linux?.program === "found" && linux.publisher === "verified");
    assert(macos?.publisher === "verified" && macos.program !== "found" && macos.program.includes("bin/jq"), macos?.program);
    assert(windows?.sha256 === null && windows.program === "not fetched" && windows.concerns.join(" ").includes("could not be fetched"));
    assert(!p.ready);
  } finally {
    await s.stop();
  }
});

proves(["0005-native-pinned-pin FR-005"], "the proposal says it is a proposal, holds no pin, and has the same text whatever the order of the platforms", async () => {
  const zsum = await sha256(ZIP);
  const tsum = await sha256(TAR);
  const s = await serve({ "/a.zip": ZIP, "/a.tar.gz": TAR, "/zs": text(`${zsum}  a.zip\n`), "/ts": text(`${tsum}  a.tar.gz\n`) });
  try {
    const win = { downloadUrl: `${s.base}/a.zip`, archiveFormat: "zip", binPath: "bin", checksum: { url: `${s.base}/zs`, name: "a.zip" } } as const;
    const lin = { downloadUrl: `${s.base}/a.tar.gz`, archiveFormat: "tar", binPath: "bin", checksum: { url: `${s.base}/ts`, name: "a.tar.gz" } } as const;
    const a = proposalText(await proposePin({ name: "jq", version: "1.7.1", program: "jq", platforms: { "windows-x64": win, "linux-x64": lin } }, get()));
    const b = proposalText(await proposePin({ name: "jq", version: "1.7.1", program: "jq", platforms: { "linux-x64": lin, "windows-x64": win } }, get()));
    assertEquals(a, b);
    assert(a.includes("A proposal to review, not a pin") && a.endsWith("\n"));
    assertEquals(JSON.parse(a).ready, true);
  } finally {
    await s.stop();
  }
});

proves(["0005-native-pinned-pin FR-006"], "the program writes only the proposal: status 0 where ready, 2 where not, 1 for an unreadable request, 64 for a wrong use", async () => {
  const sum = await sha256(TAR);
  const s = await serve({ "/a.tar.gz": TAR, "/sums": text(`${sum}  a.tar.gz\n`) });
  try {
    await fs.withTempDir(async (dir) => {
      const lines: string[] = [];
      const io = { out: (l: string) => void lines.push(l), env: () => undefined, path: undefined, ask: () => Promise.resolve(undefined), retries: quiet(), fetch: get() };
      const write = async (name: string, v: unknown): Promise<string> => {
        const f = path.join(dir, name);
        await fs.writeTextFile(f, JSON.stringify(v));
        return f;
      };
      // The request is read by the program, so its addresses must be https; the fetch of the test answers for them.
      const real = new Map<string, string>([["https://example.test/a.tar.gz", `${s.base}/a.tar.gz`], ["https://example.test/sums", `${s.base}/sums`]]);
      const via = (url: string) => get()(real.get(url) ?? url);
      const request = (checksum: boolean) => ({ name: "jq", version: "1.7.1", program: "jq", platforms: { "linux-x64": { downloadUrl: "https://example.test/a.tar.gz", archiveFormat: "tar", binPath: "bin", ...(checksum ? { checksum: { url: "https://example.test/sums", name: "a.tar.gz" } } : {}) } } });
      const before = (await fs.listFiles(dir)).length;
      const out = path.join(dir, "proposal.json");
      assertEquals(await main(["pin", await write("ok.json", request(true)), "--out", out], { ...io, fetch: via }), 0);
      assertEquals(JSON.parse(await fs.readTextFile(out)).ready, true);
      assertEquals((await fs.listFiles(dir)).length, before + 2, "the request and the proposal are the only files");
      assertEquals(await main(["pin", await write("weak.json", request(false))], { ...io, fetch: via }), 2);
      assertEquals(await main(["pin", path.join(dir, "none.json")], io), 1);
      assertEquals(await main(["pin", await write("bad.json", { name: "x" })], io), 1);
      assertEquals(await main(["pin"], io), 64);
      assertEquals(await main(["pin", "x", "--out"], io), 64);
    });
  } finally {
    await s.stop();
  }
});
