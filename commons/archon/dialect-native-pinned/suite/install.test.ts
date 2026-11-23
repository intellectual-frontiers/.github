/**
 * Tests of the pure logic of an install (commons archon-dialect-native-pinned 0002-native-pinned-install FR-001 to FR-006), with real archives made by the archive writers of `formats`: the hash is
 * checked before anything is unpacked, a zip, a tar and a gzipped tar of the same files give the same files, an unsafe path, a path twice and a link refuse the archive whole, the program must be
 * there, the install record is written and read back, drift is found, and shims are the right text. Every name, address and byte is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { concat, gzip, tar, tarHeader, zip, type Files } from "@intellectual-frontiers/formats/archive";
import {
  describeDrift,
  describeInstallError,
  installDrift,
  installRecordOf,
  programFile,
  readInstallRecord,
  shimOf,
  unpackVerified,
  writeInstallRecord,
  type InstallSpec,
  type Unpacked,
} from "../src/install.ts";

const text = (s: string) => new TextEncoder().encode(s);
const FILES: Files = new Map([["bin/jq", text("#!/bin/sh\necho jq\n")], ["share/readme.txt", text("made up\n")]]);
const unpacked = (files: Files): Unpacked => ({ files, executable: new Set<string>(), links: [] });

async function spec(bytes: Uint8Array, more: Partial<InstallSpec> = {}): Promise<InstallSpec> {
  return { tool: "jq", version: "1.7.1", platform: "linux-x64", os: "linux", program: "jq", downloadUrl: "https://example.test/jq", sha256: await sha256(bytes), archiveFormat: "tar", binPath: "bin", ...more };
}

function unwrapTar(files: Files): Uint8Array {
  const r = tar(files);
  if (r.kind === "err") throw new Error("tar");
  return r.value;
}

const pad = (n: number): Uint8Array => new Uint8Array((512 - (n % 512)) % 512);

/** A tar with the entries as written, by hand, so that a path can be twice or a type can be a link. */
function rawTar(entries: readonly { path: string; data: Uint8Array; type?: string }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const e of entries) {
    const header = tarHeader(e.path, e.data.length, false);
    if (header === undefined) throw new Error("header");
    if (e.type !== undefined) {
      header[156] = e.type.charCodeAt(0);
      header.fill(0x20, 148, 156);
      let sum = 0;
      for (const b of header) sum += b;
      header.set(text(sum.toString(8).padStart(6, "0")), 148);
      header[154] = 0;
      header[155] = 0x20;
    }
    parts.push(header, e.data, pad(e.data.length));
  }
  parts.push(new Uint8Array(1024));
  return concat(parts);
}

proves(["0002-native-pinned-install FR-001"], "the bytes are checked against the pinned SHA-256 before anything is unpacked, and a mismatch returns no file", async () => {
  const bytes = unwrapTar(FILES);
  const good = await unpackVerified(await spec(bytes), bytes);
  assert(good.kind === "ok" && good.value.files.has("bin/jq"));
  const other = text("not the pinned bytes");
  const s = await spec(bytes);
  const bad = await unpackVerified(s, other);
  assert(bad.kind === "err" && bad.error.kind === "hash-mismatch");
  const message = describeInstallError(bad.error);
  assert(message.includes(s.sha256) && message.includes(await sha256(other)) && message.includes("nothing was written"));
  const corrupt = text("\u0000\u0001 corrupt that is not an archive");
  const refused = await unpackVerified(await spec(corrupt), corrupt);
  assert(refused.kind === "err", "a damaged archive with the right hash is still refused");
});

proves(["0002-native-pinned-install FR-002"], "a zip, a tar and a gzipped tar give the same files, a file is the program, and an unsafe path, a path twice and a link refuse the archive whole", async () => {
  const plain = unwrapTar(FILES);
  const archives: readonly [string, Uint8Array, InstallSpec["archiveFormat"]][] = [["tar", plain, "tar"], ["gzip", gzip(plain), "tar"], ["zip", zip(FILES), "zip"]];
  for (const [name, bytes, format] of archives) {
    const r = await unpackVerified(await spec(bytes, { archiveFormat: format }), bytes);
    assert(r.kind === "ok", `${name}`);
    assertEquals([...r.value.files.keys()].sort(), ["bin/jq", "share/readme.txt"], name);
    assertEquals(new TextDecoder().decode(r.value.files.get("share/readme.txt")), "made up\n", name);
  }
  const single = text("#!/bin/sh\n");
  const file = await unpackVerified(await spec(single, { archiveFormat: "file", binPath: "" }), single);
  assert(file.kind === "ok" && file.value.files.has("jq"));
  const windows = await unpackVerified(await spec(single, { archiveFormat: "file", binPath: "", os: "windows" }), single);
  assert(windows.kind === "ok" && windows.value.files.has("jq.exe"));

  const escape = rawTar([{ path: "bin/jq", data: text("x") }, { path: "../evil", data: text("y") }]);
  const evil = await unpackVerified(await spec(escape), escape);
  assert(evil.kind === "err", "a path that leaves the folder refuses the whole archive");
  const twice = rawTar([{ path: "bin/jq", data: text("a") }, { path: "bin/jq", data: text("b") }]);
  const dup = await unpackVerified(await spec(twice), twice);
  assert(dup.kind === "err" && dup.error.kind === "duplicate-path" && dup.error.path === "bin/jq");
  const linked = rawTar([{ path: "bin/jq", data: text("a") }, { path: "bin/link", data: new Uint8Array(0), type: "2" }]);
  const link = await unpackVerified(await spec(linked), linked);
  assert(link.kind === "err" && link.error.kind === "link", link.kind === "err" ? link.error.kind : "a link was installed");
});

proves(["0002-native-pinned-install FR-003"], "the program must be in the unpacked files, at its folder and with its name", async () => {
  const bytes = unwrapTar(new Map([["share/readme.txt", text("x")]]));
  const r = await unpackVerified(await spec(bytes), bytes);
  assert(r.kind === "err" && r.error.kind === "missing-program" && r.error.path === "bin/jq");
  assertEquals(programFile({ program: "jq", binPath: "bin", os: "linux" }), "bin/jq");
  assertEquals(programFile({ program: "jq", binPath: "bin", os: "windows" }), "bin/jq.exe");
  assertEquals(programFile({ program: "jq", binPath: "", os: "macos" }), "jq");
  assertEquals(programFile({ program: "tool.jar", binPath: "lib", os: "windows" }), "lib/tool.jar");
  const deep = unwrapTar(new Map([["jq-1.7.1/bin/jq", text("x")]]));
  const there = await unpackVerified(await spec(deep, { binPath: "jq-1.7.1/bin" }), deep);
  assertEquals(there.kind, "ok");
});

proves(["0002-native-pinned-install FR-004"], "the install record names the tool and the pin, holds the hash of each file, is written in a fixed form and is read back", async () => {
  const bytes = unwrapTar(FILES);
  const s = await spec(bytes);
  const record = await installRecordOf(s, unpacked(FILES));
  assertEquals([record.tool, record.version, record.platform, record.program, record.artifactSha256], ["jq", "1.7.1", "linux-x64", "bin/jq", s.sha256]);
  assertEquals(Object.keys(record.files), ["bin/jq", "share/readme.txt"]);
  const written = writeInstallRecord(record);
  assert(written.endsWith("\n") && written.startsWith('{\n  "tool"'));
  assertEquals(written, writeInstallRecord(await installRecordOf(s, unpacked(new Map([...FILES].reverse())))), "the same files give the same text whatever the order");
  const back = readInstallRecord(written);
  assert(back.kind === "ok");
  assertEquals(back.value, record);
  assertEquals(readInstallRecord("{}").kind, "err");
  assertEquals(readInstallRecord("not json").kind, "err");
});

proves(["0002-native-pinned-install FR-005"], "drift finds every file changed, missing or extra, in the order of the paths, and a pin that has moved", async () => {
  const bytes = unwrapTar(FILES);
  const s = await spec(bytes);
  const record = await installRecordOf(s, unpacked(FILES));
  assertEquals(installDrift(record, { files: { ...record.files }, links: {} }), []);
  const found = { ...record.files, "bin/jq": "0".repeat(64), "extra.txt": "1".repeat(64) } as Record<string, string>;
  delete found["share/readme.txt"];
  const drift = installDrift(record, { files: found, links: {} });
  assertEquals(drift.map((d) => `${d.kind} ${"path" in d ? d.path : ""}`), ["changed bin/jq", "missing share/readme.txt", "extra extra.txt"]);
  assert(describeDrift("jq", drift[0] ?? { kind: "unpinned", reason: "" }).includes("differs from the install record"));
  const moved = installDrift(record, { files: { ...record.files }, links: {} }, "f".repeat(64));
  assertEquals(moved.map((d) => d.kind), ["unpinned"]);
  assert(describeDrift("jq", moved[0] ?? { kind: "changed", path: "" }).includes("now names"));
});

proves(["0002-native-pinned-install FR-006"], "a shim is a POSIX script or a .cmd file, and an unsafe command or path is refused", () => {
  const linux = shimOf("linux", "bun", "/home/a/b c/bun");
  assert(linux.kind === "ok" && linux.value.name === "bun" && linux.value.text === "#!/bin/sh\nexec '/home/a/b c/bun' \"$@\"\n");
  const quoted = shimOf("macos", "bun", "/home/a/it's/bun");
  assert(quoted.kind === "ok" && quoted.value.text.includes("'/home/a/it'\\''s/bun'"));
  const windows = shimOf("windows", "bun", "C:\\Users\\a\\bun.exe");
  assert(windows.kind === "ok" && windows.value.name === "bun.cmd" && windows.value.text === '@echo off\r\n"C:\\Users\\a\\bun.exe" %*\r\n');
  for (const bad of ["", "a b", "../x", "-x", "a;b"]) assertEquals(shimOf("linux", bad, "/x").kind, "err", bad);
  assertEquals(shimOf("linux", "bun", "/x\n/y").kind, "err");
  for (const c of ['"', "%", "^", "&", "|", "<", ">"]) assertEquals(shimOf("windows", "bun", `C:\\a${c}b\\bun.exe`).kind, "err", c);
});
